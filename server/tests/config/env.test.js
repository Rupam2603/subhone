const { loadEnv } = require("../../src/config/env");

const valid = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/subhone",
  JWT_SECRET: "x".repeat(32),
  OTP_PEPPER: "y".repeat(16),
  CORS_ORIGIN: "http://localhost:5173",
};

describe("loadEnv", () => {
  it("accepts a valid environment and applies defaults", () => {
    const cfg = loadEnv(valid);
    expect(cfg.PORT).toBe(5000);
    expect(cfg.COOKIE_SECURE).toBe(false);
    expect(cfg.SMS_PROVIDER).toBe("dev");
    expect(cfg.REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  it("throws a naming error when JWT_SECRET is too short", () => {
    expect(() => loadEnv({ ...valid, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });

  it("throws when MONGODB_URI is missing", () => {
    const { MONGODB_URI, ...without } = valid;
    expect(() => loadEnv(without)).toThrow(/MONGODB_URI/);
  });

  it("coerces numeric strings from the real process env", () => {
    expect(loadEnv({ ...valid, PORT: "8080" }).PORT).toBe(8080);
  });
});
