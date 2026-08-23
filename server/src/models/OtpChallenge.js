const mongoose = require("mongoose");
const { E164 } = require("./User");

// A pending phone verification. The plaintext code lives only in the SMS the provider
// sent and, in development, in the server log — never here. `codeHash` is
// sha256(`${code}:${OTP_PEPPER}`), so a database leak yields nothing replayable, and a
// challenge is spent the moment it is used (`consumedAt`) or over-guessed (`attempts`).
const otpChallengeSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, match: E164, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ["login", "link_phone"], default: "login" },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Mongo reaps documents once expiresAt passes, so spent challenges do not accumulate.
// The TTL monitor only runs about once a minute, which is why otpService still checks
// expiresAt itself rather than trusting the row's absence.
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OtpChallenge", otpChallengeSchema);
