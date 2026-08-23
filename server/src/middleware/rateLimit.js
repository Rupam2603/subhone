const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// The 429 body uses the same envelope as everything else: `error` is a plain
// string, `code` alongside. client/src/lib/api.js reads data.error directly.
const json = (message, code) => (req, res) => res.status(429).json({ error: message, code });

// express-rate-limit refuses to trust a raw req.ip inside a custom keyGenerator,
// because an IPv6 client can walk its /64 to get a fresh key per request.
// ipKeyGenerator collapses an address to its subnet before we compose the key.
const ipPart = (req) => ipKeyGenerator(req.ip);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${ipPart(req)}:${(req.body && req.body.email) || ""}`,
  handler: json("Too many sign-in attempts. Try again in a few minutes.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

// Spec §6.5 asks for two independent ceilings on OTP requests: per phone, so one
// number cannot be spammed, and per IP, so one host cannot enumerate many numbers.
const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => (req.body && req.body.phone) || ipPart(req),
  handler: json("Too many codes requested for that number. Try again later.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

const otpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  handler: json("Too many codes requested. Try again later.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: json("Too many attempts. Request a new code.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, otpRequestLimiter, otpIpLimiter, otpVerifyLimiter };
