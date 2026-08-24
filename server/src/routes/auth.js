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
    phone: z.string().trim().optional(),
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
const otpVerifyBody = z.object({
  challengeId: z.string().optional(),
  phone: z.string().optional(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
}).refine((v) => v.challengeId || v.phone, { message: "Provide either challengeId or phone" });

const handleOtpRequest = asyncHandler(async (req, res) => {
  const purpose = req.body.purpose || "login";
  const result = await otpService.requestOtp(req.body.phone, purpose);
  return res.status(202).json(result);
});

const handleOtpVerify = asyncHandler(async (req, res) => {
  const { phone } = await otpService.verifyOtp({ ...req.body, purpose: "login" });
  const { user } = await authService.findOrCreateByPhone(phone);
  return establishSession(req, res, user);
});

// Both /otp/request and /otp/send supported (and direct /request & /send when mounted on /api/otp)
router.post(["/otp/request", "/otp/send", "/request", "/send"], otpIpLimiter, otpRequestLimiter,
  validate({ body: z.object({
    phone: z.string().min(10, "Enter a valid mobile number"),
    purpose: z.enum(["login", "link_phone"]).optional().default("login"),
  }) }),
  handleOtpRequest
);

// Both /otp/verify and /otp/login supported (and direct /verify & /login when mounted on /api/otp)
router.post(["/otp/verify", "/otp/login", "/verify"], otpVerifyLimiter, validate({ body: otpVerifyBody }), handleOtpVerify);

// The identity-upgrade half: an existing account gains a verified number.
router.post("/link-phone", requireAuth, otpVerifyLimiter, validate({ body: otpVerifyBody }),
  asyncHandler(async (req, res) => {
    const { phone } = await otpService.verifyOtp({ ...req.body, purpose: "link_phone" });
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
