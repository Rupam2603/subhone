const bcrypt = require("bcrypt");
const crypto = require("crypto");

// Spec §6: bcrypt cost 12 for passwords; sha256 for anything we only ever need to
// look up by equality (refresh tokens, OTP codes) so a database leak yields nothing
// replayable.
const BCRYPT_ROUNDS = 12;

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
const hashOtp = (code, pepper) => sha256(`${code}:${pepper}`);

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword, verifyPassword, sha256, randomToken, hashOtp, BCRYPT_ROUNDS,
};
