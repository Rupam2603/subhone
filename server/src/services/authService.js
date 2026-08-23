const User = require("../models/User");
const AppError = require("../utils/AppError");
const { hashPassword, verifyPassword, BCRYPT_ROUNDS } = require("../utils/hash");

async function register({ name, email, password }) {
  const normalised = String(email).toLowerCase();
  // Checked up front so the caller gets EMAIL_TAKEN rather than a raw duplicate-key
  // error. The unique index on User.email is still the authority under a race.
  if (await User.findOne({ email: normalised })) {
    throw new AppError(409, "EMAIL_TAKEN", "An account with that email already exists.");
  }
  return User.create({
    name, email: normalised, passwordHash: await hashPassword(password),
  });
}

async function login({ email, password }) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  // Identical error for unknown account and wrong password — no account enumeration.
  const invalid = new AppError(401, "CREDENTIALS", "That email or password isn't right.");
  // `!user.passwordHash` covers an OTP-only account: it has no password to compare,
  // and saying so would confirm the account exists.
  if (!user || !user.passwordHash) throw invalid;
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid;
  if (user.disabledAt) throw new AppError(403, "DISABLED", "That account is disabled.");
  return user;
}

async function changePassword(user, newPassword) {
  user.passwordHash = await hashPassword(newPassword);
  // Invalidates every outstanding access token: attachUser compares this against
  // the token's `ver` claim, so sessions elsewhere stop working immediately.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  return user.save();
}

module.exports = { register, login, changePassword, ROUNDS: BCRYPT_ROUNDS };
