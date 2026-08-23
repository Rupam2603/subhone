const express = require("express");
const { z } = require("zod");
const router = express.Router();

const authService = require("../services/authService");
const tokenService = require("../services/tokenService");
const cartService = require("../services/cartService");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { loginLimiter } = require("../middleware/rateLimit");
const {
  setAuthCookies, clearAuthCookies, clearGuestCookie, GUEST_COOKIE, REFRESH_COOKIE,
} = require("../utils/cookies");

// Recorded on the Session so the account page can show where you're signed in.
const meta = (req) => ({ userAgent: req.get("User-Agent"), ip: req.ip });

// Issues cookies and folds any guest cart into the user's own.
async function establishSession(req, res, user, status = 200) {
  const accessToken = tokenService.issueAccessToken(user);
  const { token: refreshToken } = await tokenService.issueRefreshToken(user, meta(req));
  setAuthCookies(res, { accessToken, refreshToken });

  const guestId = req.cookies && req.cookies[GUEST_COOKIE];
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
