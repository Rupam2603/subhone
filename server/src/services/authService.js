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

// A phone number that has just proved itself with a consumed OTP challenge. Login and
// signup are the same call because the caller cannot tell them apart: whoever holds
// the number owns the account, and refusing an unknown one would make phone-first
// signup impossible. The returned `created` flag exists for callers that want to
// treat the two differently (analytics, onboarding) without a second query.
async function findOrCreateByPhone(phone, attempt = 0) {
  const existing = await User.findOne({ phone });
  if (existing) {
    if (existing.disabledAt) throw new AppError(403, "DISABLED", "That account is disabled.");
    // An account can carry a phone it never verified (typed into an address, seeded,
    // set by an admin). Succeeding here is that number's first proof of possession.
    if (!existing.phoneVerifiedAt) {
      existing.phoneVerifiedAt = new Date();
      await existing.save();
    }
    return { user: existing, created: false };
  }

  try {
    // No email and no password: legal by the model's email-or-phone invariant, and
    // `login` already refuses an account with no passwordHash rather than leaking
    // that it exists. `name` is required by the schema, hence the placeholder — the
    // account page is where a real name gets filled in.
    const user = await User.create({
      name: "SubhOne Customer", phone, phoneVerifiedAt: new Date(),
    });
    return { user, created: true };
  } catch (err) {
    // Two verifications for the same unseen number landing together: the sparse
    // unique index on `phone` is the arbiter and one insert loses. The loser should
    // sign into the account the winner just created, not return a 500. Retried once
    // only — a second duplicate-key error is not a race, it is a bug.
    if (err && err.code === 11000 && attempt === 0) return findOrCreateByPhone(phone, 1);
    throw err;
  }
}

async function changePassword(user, newPassword) {
  user.passwordHash = await hashPassword(newPassword);
  // Invalidates every outstanding access token: attachUser compares this against
  // the token's `ver` claim, so sessions elsewhere stop working immediately.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  return user.save();
}

module.exports = {
  register, login, findOrCreateByPhone, changePassword, ROUNDS: BCRYPT_ROUNDS,
};
