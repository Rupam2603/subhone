const { z } = require("zod");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  CORS_ORIGIN: z.string().min(1),
  OTP_PEPPER: z.string().min(16, "OTP_PEPPER must be at least 16 characters"),
  SMS_PROVIDER: z.enum(["dev", "msg91", "twilio"]).default("dev"),
  GUEST_CART_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_ORDER_EMAIL: z.string().email().default("subhonehealthgroup@gmail.com"),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  EMAILJS_PUBLIC_KEY: z.string().optional(),
  EMAILJS_SERVICE_ID: z.string().optional(),
  EMAILJS_TEMPLATE_ID: z.string().optional(),
  EMAILJS_PRIVATE_KEY: z.string().optional(),
});

function loadEnv(raw = process.env) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${detail}`);
  }
  return parsed.data;
}

module.exports = { loadEnv, schema };
