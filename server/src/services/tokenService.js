const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { loadEnv } = require("../config/env");
const Session = require("../models/Session");
const { sha256, randomToken } = require("../utils/hash");

async function generateTokens(user, existingFamilyId = null) {
  const cfg = loadEnv();
  
  const accessToken = jwt.sign(
    { userId: user._id, role: user.role },
    cfg.JWT_SECRET,
    { expiresIn: cfg.ACCESS_TOKEN_TTL }
  );

  const refreshToken = randomToken(32);
  const tokenHash = sha256(refreshToken);
  
  const familyId = existingFamilyId || crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + cfg.REFRESH_TOKEN_TTL_DAYS);

  await Session.create({
    userId: user._id,
    familyId,
    tokenHash,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

async function refreshSession(refreshToken) {
  if (!refreshToken) throw new Error("No refresh token provided");

  const tokenHash = sha256(refreshToken);
  const session = await Session.findOne({ tokenHash }).populate("userId");

  if (!session) {
    throw new Error("Invalid refresh token");
  }

  if (session.isRevoked) {
    // Token Reuse Detected! Revoke the entire family.
    await Session.updateMany({ familyId: session.familyId }, { $set: { isRevoked: true } });
    throw new Error("Token reuse detected");
  }

  if (session.expiresAt < new Date()) {
    throw new Error("Refresh token expired");
  }

  const user = session.userId;
  if (!user) throw new Error("User not found");

  // Mark this session as used/revoked
  session.isRevoked = true;
  await session.save();

  return generateTokens(user, session.familyId);
}

async function revokeAllSessions(userId) {
  await Session.updateMany({ userId }, { $set: { isRevoked: true } });
}

async function revokeSession(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = sha256(refreshToken);
  await Session.findOneAndUpdate({ tokenHash }, { $set: { isRevoked: true } });
}

module.exports = {
  generateTokens,
  refreshSession,
  revokeAllSessions,
  revokeSession,
};
