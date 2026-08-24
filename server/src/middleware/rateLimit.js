const { rateLimit } = require("express-rate-limit");

// The 429 body uses the same envelope as everything else: `error` is a plain
// string, `code` alongside. client/src/lib/api.js reads data.error directly.
const json = (message, code) => (req, res) => res.status(429).json({ error: message, code });

// express-rate-limit documents an `ipKeyGenerator` helper for exactly this, but its
// 7.5.x CommonJS build exports only `default`, `rateLimit` and `MemoryStore` — so
// requiring it yielded undefined and every rate-limited route threw a 500 on the
// first request. Inlined rather than depending on a packaging gap.
//
// IPv6 addresses collapse to their /64 prefix because a single host is routinely
// handed an entire /64; limiting per full address is bypassed by incrementing one
// hextet. Two spellings of the same prefix must also produce one key, hence the
// expansion of `::` and the stripping of leading zeros.
const ipPart = (req) => {
  const raw = req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
  const ip = raw.replace(/^\[|\]$/g, "").split("%")[0]; // brackets, IPv6 zone id
  if (!ip.includes(":")) return ip; // IPv4, or the "unknown" fallback
  if (ip.toLowerCase().startsWith("::ffff:")) return ip.slice(7); // IPv4-mapped

  let parts;
  if (ip.includes("::")) {
    const [head, tail = ""] = ip.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const gap = Math.max(8 - headParts.length - tailParts.length, 0);
    parts = [...headParts, ...Array(gap).fill("0"), ...tailParts];
  } else {
    parts = ip.split(":");
  }

  const prefix = parts
    .slice(0, 4)
    .map((h) => (h || "0").toLowerCase().replace(/^0+(?=.)/, ""))
    .join(":");
  return `${prefix}::/64`;
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `${ipPart(req)}:${(req.body && req.body.email) || ""}`,
  handler: json("Too many sign-in attempts. Try again in a few minutes.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

// Spec §6.5 asks for two independent ceilings on OTP requests: per phone, so one
// number cannot be spammed, and per IP, so one host cannot enumerate many numbers.
const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => (req.body && req.body.phone) || ipPart(req),
  handler: json("Too many codes requested for that number. Try again later.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

const otpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: ipPart,
  handler: json("Too many codes requested. Try again later.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: ipPart,
  handler: json("Too many attempts. Request a new code.", "RATE_LIMITED"),
  standardHeaders: true,
  legacyHeaders: false,
});

// ipPart is exported for its unit test; nothing else should need it.
module.exports = { loginLimiter, otpRequestLimiter, otpIpLimiter, otpVerifyLimiter, ipPart };
