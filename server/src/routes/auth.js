const express = require("express");
const { z } = require("zod");
const router = express.Router();

const authService = require("../services/authService");
const tokenService = require("../services/tokenService");
const cartService = require("../services/cartService");
const otpService = require("../services/otpService");
const User = require("../models/User");
// The one E.164 pattern, shared with the model and OtpChallenge rather than copied.
const { E164 } = User;
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const {
  loginLimiter, otpRequestLimiter, otpIpLimiter, otpVerifyLimiter,
} = require("../middleware/rateLimit");
const {
  setAuthCookies, clearAuthCookies, clearGuestCookie, readGuestId, REFRESH_COOKIE,
} = require("../utils/cookies");

// Recorded on the Session so the account page can show where you're signed in.
const meta = (req) => ({ userAgent: req.get("User-Agent"), ip: req.ip });

// Issues cookies and folds any guest cart into the user's own.
async function establishSession(req, res, user, status = 200) {
  const accessToken = tokenService.issueAccessToken(user);
  const { token: refreshToken } = await tokenService.issueRefreshToken(user, meta(req));
  setAuthCookies(res, { accessToken, refreshToken });

  // Signed value only: an unsigned or tampered so_gid must not be able to nominate
  // which cart gets folded into the account that is signing in.
  const guestId = readGuestId(req);
  if (guestId) {
    await cartService.mergeGuestCart({ guestId, userId: user._id });
    clearGuestCookie(res);
  }
  return res.status(status).json({ user });
}

router.post("/register",
  validate({ body: z.object({
    name: z.string().trim().min(2),
    email: z.string().email(),
    password: z.string().min(8, "Use at least 8 characters"),
  }) }),
  asyncHandler(async (req, res) =>
    establishSession(req, res, await authService.register(req.body), 201)));

router.post("/login", loginLimiter,
  validate({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) }),
  asyncHandler(async (req, res) =>
    establishSession(req, res, await authService.login(req.body))));

router.post("/refresh", asyncHandler(async (req, res) => {
  const raw = req.cookies && req.cookies[REFRESH_COOKIE];
  if (!raw) throw new AppError(401, "SESSION_INVALID", "Your session is no longer valid.");
  // Single-use rotation: presenting an already-rotated token burns the whole family.
  const { token, user } = await tokenService.rotateRefreshToken(raw, meta(req));
  setAuthCookies(res, { accessToken: tokenService.issueAccessToken(user), refreshToken: token });
  return res.json({ user });
}));

router.post("/logout", asyncHandler(async (req, res) => {
  const raw = req.cookies && req.cookies[REFRESH_COOKIE];
  if (raw) await tokenService.revokeSession(raw);
  // Idempotent on purpose — signing out twice, or with no session, still succeeds.
  clearAuthCookies(res);
  return res.status(204).end();
}));

// ── Phone OTP ──────────────────────────────────────────────────────────────────
// One challenge shape serves both verification routes; the difference is whether the
// verified number resolves an identity (/otp/verify) or is attached to the identity
// the request already carries (/link-phone).
const otpVerifyBody = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

// Two ceilings, because they stop different attacks: per-phone stops one number being
// spammed with texts, per-IP stops one host enumerating many numbers. Both run ahead
// of validate() on purpose — a malformed phone must still cost the caller quota, or
// probing is free.
router.post("/otp/request", otpIpLimiter, otpRequestLimiter,
  validate({ body: z.object({
    phone: z.string().regex(E164, "Enter a phone number with country code, e.g. +919830000000"),
    // Defaults to login so the common case needs no field. A code is bound to the flow
    // it was issued for and verifyOtp refuses to spend it on the other one.
    purpose: z.enum(["login", "link_phone"]).optional().default("login"),
  }) }),
  // 202, not 200: the code has been handed to the SMS provider, and whether it ever
  // reaches the handset is not something this response can promise.
  asyncHandler(async (req, res) =>
    res.status(202).json(await otpService.requestOtp(req.body.phone, req.body.purpose))));

// A login endpoint, so it resolves the account from the *phone*, never from any
// session the request happens to carry. Signing in as someone else while signed in is
// a legitimate thing to do; silently editing the current account is not.
router.post("/otp/verify", otpVerifyLimiter, validate({ body: otpVerifyBody }),
  asyncHandler(async (req, res) => {
    const { phone } = await otpService.verifyOtp({ ...req.body, purpose: "login" });
    const { user } = await authService.findOrCreateByPhone(phone);
    // 200 even when the account was just created: to the caller this is one flow, and
    // leaking "this number was new" tells an enumerator which numbers are registered.
    return establishSession(req, res, user);
  }));

// The identity-upgrade half: an existing account gains a verified number. No new
// session is issued — the caller is already signed in and stays signed in as the
// same user, so the cookies in play remain valid.
router.post("/link-phone", requireAuth, otpVerifyLimiter, validate({ body: otpVerifyBody }),
  asyncHandler(async (req, res) => {
    const { phone } = await otpService.verifyOtp({ ...req.body, purpose: "link_phone" });
    // `phone` is a sparse unique index, so without this check a taken number would
    // surface as a raw duplicate-key 500 instead of an answerable error.
    const owner = await User.findOne({ phone });
    if (owner && String(owner._id) !== String(req.user._id)) {
      throw new AppError(409, "PHONE_TAKEN", "That number is already linked to another account.");
    }
    req.user.phone = phone;
    req.user.phoneVerifiedAt = new Date();
    await req.user.save();
    return res.json({ user: req.user });
  }));

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

router.patch("/me", requireAuth,
  validate({ body: z.object({
    name: z.string().trim().min(2).optional(),
    password: z.string().min(8).optional(),
  }).refine((v) => v.name || v.password, { message: "Nothing to update" }) }),
  asyncHandler(async (req, res) => {
    if (req.body.name) { req.user.name = req.body.name; await req.user.save(); }
    // Bumps tokenVersion, so the access cookie in this very response's caller is
    // already stale. The client must re-authenticate or refresh.
    if (req.body.password) await authService.changePassword(req.user, req.body.password);
    return res.json({ user: req.user });
  }));

module.exports = router;
