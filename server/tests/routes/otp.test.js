const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/User");
const {
  otpRequestLimiter, otpIpLimiter, otpVerifyLimiter,
} = require("../../src/middleware/rateLimit");

process.env.SMS_PROVIDER = "dev";
const PHONE = "+919830000000";
const BAD_PHONE = "9830000000";

const cookieValue = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0].split("=")[1] : null;
};

const requestCode = async (phone = PHONE) => {
  const res = await request(app).post("/api/auth/otp/request").send({ phone });
  expect(res.status).toBe(202);
  return res.body;
};

// The OTP limiters keep their counters in a process-wide MemoryStore that outlives
// any single test, and the per-phone ceiling is 3 requests an hour — fewer than this
// file legitimately asks for. express-rate-limit only exposes resetKey on the
// middleware (no resetAll), so the keys are cleared by name: the phone numbers used
// here, plus the IPv4 form ipPart() collapses supertest's ::ffff:127.0.0.1 loopback to.
const LIMIT_KEYS = [PHONE, BAD_PHONE, "127.0.0.1"];
beforeEach(async () => {
  for (const limiter of [otpRequestLimiter, otpIpLimiter, otpVerifyLimiter]) {
    await Promise.all(LIMIT_KEYS.map((key) => limiter.resetKey(key)));
  }
});

describe("phone OTP", () => {
  it("returns a challenge and a dev code, never the hash", async () => {
    const body = await requestCode();
    expect(body.challengeId).toBeTruthy();
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body.codeHash).toBeUndefined();
  });

  it("rejects a non-E.164 phone with 422", async () => {
    const res = await request(app).post("/api/auth/otp/request").send({ phone: BAD_PHONE });
    expect(res.status).toBe(422);
  });

  it("creates an account on first verification and signs it in", async () => {
    const { challengeId, devCode } = await requestCode();
    const res = await request(app).post("/api/auth/otp/verify").send({ challengeId, code: devCode });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(PHONE);
    expect(res.body.user.phoneVerifiedAt).toBeTruthy();
    expect(cookieValue(res, "so_at")).toBeTruthy();
    expect(await User.countDocuments({ phone: PHONE })).toBe(1);
  });

  it("signs into the same account on a second verification", async () => {
    const first = await requestCode();
    const a = await request(app).post("/api/auth/otp/verify")
      .send({ challengeId: first.challengeId, code: first.devCode });
    const second = await requestCode();
    const b = await request(app).post("/api/auth/otp/verify")
      .send({ challengeId: second.challengeId, code: second.devCode });
    expect(b.body.user.id || b.body.user._id).toEqual(a.body.user.id || a.body.user._id);
    expect(await User.countDocuments({ phone: PHONE })).toBe(1);
  });

  it("rejects a wrong code with 400", async () => {
    const { challengeId } = await requestCode();
    const res = await request(app).post("/api/auth/otp/verify")
      .send({ challengeId, code: "000000" });
    expect(res.status).toBe(400);
  });

  it("links a verified phone to the signed-in account", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
    const at = cookieValue(reg, "so_at");
    const { challengeId, devCode } = await requestCode();
    const res = await request(app).post("/api/auth/link-phone")
      .set("Cookie", `so_at=${at}`).send({ challengeId, code: devCode });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(PHONE);
    expect(await User.countDocuments({})).toBe(1); // linked, not duplicated
  });

  it("refuses to link a phone already owned by another account", async () => {
    const own = await requestCode();
    await request(app).post("/api/auth/otp/verify")
      .send({ challengeId: own.challengeId, code: own.devCode });

    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Other", email: "o@example.com", password: "correct-horse-1" });
    const at = cookieValue(reg, "so_at");
    const next = await requestCode();
    const res = await request(app).post("/api/auth/link-phone")
      .set("Cookie", `so_at=${at}`).send({ challengeId: next.challengeId, code: next.devCode });
    expect(res.status).toBe(409);
  });

  it("does not switch identity when verifying while signed in", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
    const at = cookieValue(reg, "so_at");
    const { challengeId, devCode } = await requestCode();
    // /otp/verify is a login endpoint; hitting it while signed in must still
    // resolve by phone, not silently mutate the current account.
    const res = await request(app).post("/api/auth/otp/verify")
      .set("Cookie", `so_at=${at}`).send({ challengeId, code: devCode });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBeUndefined();
  });
});
