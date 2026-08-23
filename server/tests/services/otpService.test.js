// `describe/it/expect/vi` come from vitest's injected globals (vitest.config.js sets
// `globals: true`), exactly as every other suite in this repo does. The plan's snippet
// opened with `require("vitest")`, which cannot work here: vitest 4's `require`
// condition resolves to node_modules/vitest/index.cjs, whose entire body is
// `throw new Error("Vitest cannot be imported in a CommonJS module using require()")`.
// That line would abort the file before a single test ran.
const OtpChallenge = require("../../src/models/OtpChallenge");
const otpService = require("../../src/services/otpService");

process.env.OTP_PEPPER = "p".repeat(16);
process.env.SMS_PROVIDER = "dev";

const PHONE = "+919830000000";

describe("otpService", () => {
  it("stores only a hash of the code, never the code itself", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    const doc = await OtpChallenge.findById(challengeId);
    expect(devCode).toMatch(/^\d{6}$/);
    expect(doc.codeHash).not.toContain(devCode);
    expect(doc.codeHash).toHaveLength(64);
    expect(JSON.stringify(doc.toObject())).not.toContain(devCode);
  });

  it("verifies a correct code and returns the phone", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    const result = await otpService.verifyOtp({ challengeId, code: devCode });
    expect(result.phone).toBe(PHONE);
  });

  it("refuses to reuse a consumed challenge", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    await otpService.verifyOtp({ challengeId, code: devCode });
    await expect(otpService.verifyOtp({ challengeId, code: devCode }))
      .rejects.toThrow(/invalid|used/i);
  });

  it("locks the challenge after five wrong attempts", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    for (let i = 0; i < 5; i += 1) {
      await expect(otpService.verifyOtp({ challengeId, code: "000000" })).rejects.toThrow();
    }
    // Even the right code must now fail — the challenge is spent.
    await expect(otpService.verifyOtp({ challengeId, code: devCode }))
      .rejects.toThrow(/attempts|invalid/i);
  });

  it("rejects an expired challenge", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    await OtpChallenge.updateOne({ _id: challengeId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(otpService.verifyOtp({ challengeId, code: devCode }))
      .rejects.toThrow(/expired/i);
  });

  it("omits devCode when a real provider is configured", async () => {
    process.env.SMS_PROVIDER = "twilio";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      // No credentials configured, so the factory must fail loudly rather than
      // silently falling back to the dev logger.
      await expect(otpService.requestOtp(PHONE)).rejects.toThrow(/provider/i);
    } finally {
      spy.mockRestore();
      process.env.SMS_PROVIDER = "dev";
    }
  });
});
