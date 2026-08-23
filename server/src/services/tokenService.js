const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { loadEnv } = require("../config/env");
const Session = require("../models/Session");
const AppError = require("../utils/AppError");
const { sha256, randomToken } = require("../utils/hash");

// Two token kinds, deliberately different in nature:
//
//  * The access token is a short-lived JWT. It is never looked up in the database
//    on the hot path, so it must carry everything a request needs to be authorised:
//    `sub` (user id), `role`, and `ver` (the user's tokenVersion). `ver` is what
//    makes global invalidation possible — bumping User.tokenVersion makes every
//    outstanding access token stale on its next use without any revocation list.
//
//  * The refresh token is an opaque random string. Only its sha256 is stored, so a
//    database leak yields nothing replayable. Rotation is single-use: presenting an
//    already-rotated token means the token was copied, so the whole family burns.

const REFRESH_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

const invalidRefresh = (message) =>
  new AppError(401, "INVALID_REFRESH", message || "Your session is no longer valid.");

// ── Access tokens ──────────────────────────────────────────────────────────────

// Synchronous on purpose: callers (attachUser, establishSession) treat it as a
// pure function of the user document.
function issueAccessToken(user) {
  const cfg = loadEnv();
  return jwt.sign(
    { sub: String(user._id), role: user.role, ver: user.tokenVersion || 0 },
    cfg.JWT_SECRET,
    { expiresIn: cfg.ACCESS_TOKEN_TTL }
  );
}

function verifyAccessToken(token) {
  const cfg = loadEnv();
  try {
    return jwt.verify(token, cfg.JWT_SECRET);
  } catch {
    // Expired, tampered with, or signed by another secret — all the same to a caller.
    throw new AppError(401, "TOKEN_INVALID", "Your sign-in has expired. Please sign in again.");
  }
}

// ── Refresh tokens ─────────────────────────────────────────────────────────────

async function issueRefreshToken(user, meta = {}, existingFamilyId = null) {
  const cfg = loadEnv();
  const token = randomToken(REFRESH_BYTES);
  const session = await Session.create({
    userId: user._id,
    familyId: existingFamilyId || crypto.randomUUID(),
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + cfg.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  return { token, session, familyId: session.familyId, expiresAt: session.expiresAt };
}

// Single-use rotation. Returns the replacement token plus the populated user so the
// caller can mint a matching access token without a second query.
async function rotateRefreshToken(rawToken, meta = {}) {
  if (!rawToken) throw invalidRefresh();

  const session = await Session.findOne({ tokenHash: sha256(rawToken) }).populate("userId");
  if (!session) throw invalidRefresh();

  if (session.isRevoked) {
    // Reuse of a token we already rotated (or one revoked by logout). Assume theft
    // and revoke the entire family so neither party keeps a usable session.
    await Session.updateMany({ familyId: session.familyId }, { $set: { isRevoked: true } });
    throw new AppError(401, "TOKEN_REUSE", "Session token reuse detected. Please sign in again.");
  }

  if (session.expiresAt < new Date()) {
    throw invalidRefresh("Your session has expired. Please sign in again.");
  }

  const user = session.userId;
  if (!user) throw invalidRefresh();
  if (user.disabledAt) throw new AppError(403, "DISABLED", "That account is disabled.");

  session.isRevoked = true;
  await session.save();

  const { token, familyId } = await issueRefreshToken(user, meta, session.familyId);
  return { token, user, familyId };
}

async function revokeAllSessions(userId) {
  await Session.updateMany({ userId }, { $set: { isRevoked: true } });
}

async function revokeSession(refreshToken) {
  if (!refreshToken) return;
  await Session.findOneAndUpdate({ tokenHash: sha256(refreshToken) }, { $set: { isRevoked: true } });
}

// ── Back-compatible façade ─────────────────────────────────────────────────────
// Kept because tests/services/tokenService.test.js and the plan's Interfaces section
// name these. They are thin wrappers over the pair above.

async function generateTokens(user, existingFamilyId = null) {
  const accessToken = issueAccessToken(user);
  const { token: refreshToken } = await issueRefreshToken(user, {}, existingFamilyId);
  return { accessToken, refreshToken };
}

async function refreshSession(refreshToken) {
  const { token, user } = await rotateRefreshToken(refreshToken);
  return { accessToken: issueAccessToken(user), refreshToken: token };
}

module.exports = {
  issueAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllSessions,
  revokeSession,
  generateTokens,
  refreshSession,
};
