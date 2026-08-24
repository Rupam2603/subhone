const crypto = require("crypto");
const OtpChallenge = require("../models/OtpChallenge");
const { hashOtp } = require("../utils/hash");
const { getProvider } = require("./smsProvider");
const AppError = require("../utils/AppError");

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Normalize standard 10-digit Indian numbers to E.164
function normalizePhone(phone) {
  if (!phone) return "";
  const cleaned = String(phone).trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (cleaned.startsWith("+")) return cleaned;
  if (digits.length > 10) return `+${digits}`;
  return cleaned;
}

// randomInt is the CSPRNG variant — Math.random would make codes guessable from a
// couple of observed samples.
const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

async function requestOtp(rawPhone, purpose = "login") {
  const phone = normalizePhone(rawPhone);
  const provider = getProvider(); // resolve before writing anything
  const code = generateCode();
  const challenge = await OtpChallenge.create({
    phone,
    purpose,
    codeHash: hashOtp(code, process.env.OTP_PEPPER),
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  await provider.send({
    to: phone,
    message: `${code} is your SubhOne verification code. It expires in 5 minutes.`,
  });

  return {
    challengeId: String(challenge._id),
    expiresAt: challenge.expiresAt,
    // The plaintext code leaves this module in exactly one case: the dev provider,
    // where there is no real SMS to read it from.
    ...(provider.name === "dev" ? { devCode: code } : {}),
  };
}

async function verifyOtp({ challengeId, phone: rawPhone, code, purpose }) {
  let challenge = null;
  if (challengeId) {
    challenge = await OtpChallenge.findById(challengeId).catch(() => null);
  }
  if (!challenge && rawPhone) {
    const phone = normalizePhone(rawPhone);
    challenge = await OtpChallenge.findOne({
      phone,
      ...(purpose ? { purpose } : {}),
      consumedAt: null,
    }).sort({ createdAt: -1 });
  }

  const invalid = new AppError(400, "OTP_INVALID", "That verification code isn't right.");
  if (!challenge) throw invalid;
  if (purpose && challenge.purpose !== purpose) throw invalid;
  if (challenge.consumedAt) {
    throw new AppError(400, "OTP_INVALID", "That code has already been used. Request a new one.");
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "OTP_EXPIRED", "That code has expired. Request a new one.");
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new AppError(429, "OTP_ATTEMPTS", "Too many attempts. Request a new code.");
  }

  if (challenge.codeHash !== hashOtp(code, process.env.OTP_PEPPER)) {
    challenge.attempts += 1;
    await challenge.save();
    throw invalid;
  }

  challenge.consumedAt = new Date();
  await challenge.save();
  return { phone: challenge.phone, purpose: challenge.purpose };
}

module.exports = { requestOtp, verifyOtp, normalizePhone, MAX_ATTEMPTS, TTL_MS };
