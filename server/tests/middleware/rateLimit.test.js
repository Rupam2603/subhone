// Regression coverage for the gap that let `ipKeyGenerator is not a function` reach a
// real run: there was no test for this module at all, so a crash in every limiter's
// key generator only surfaced through an unrelated login test expecting 200.
const express = require("express");
const request = require("supertest");
const {
  loginLimiter,
  otpRequestLimiter,
  otpIpLimiter,
  otpVerifyLimiter,
  ipPart,
} = require("../../src/middleware/rateLimit");

const appWith = (limiter) => {
  const app = express();
  app.use(express.json());
  app.post("/t", limiter, (req, res) => res.json({ ok: true }));
  return app;
};

// Every request below originates from 127.0.0.1, so limiters keyed on the IP share one
// budget across this file. Only the email/phone-keyed limiters are pushed to their
// ceiling; the IP-keyed ones are checked for pass-through well inside their limit.
describe("rate limit middleware", () => {
  it("passes a request through instead of throwing in the key generator", async () => {
    const res = await request(appWith(loginLimiter))
      .post("/t")
      .send({ email: "pass-through@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("blocks the 6th sign-in attempt with the standard error envelope", async () => {
    const app = appWith(loginLimiter);
    const send = () => request(app).post("/t").send({ email: "burst@example.com" });

    for (let i = 0; i < 5; i += 1) {
      expect((await send()).status).toBe(200);
    }

    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("RATE_LIMITED");
    expect(typeof blocked.body.error).toBe("string");
  });

  it("gives each email its own sign-in budget", async () => {
    const app = appWith(loginLimiter);
    // "burst@example.com" is already exhausted by the previous case.
    expect((await request(app).post("/t").send({ email: "burst@example.com" })).status).toBe(429);
    expect((await request(app).post("/t").send({ email: "fresh@example.com" })).status).toBe(200);
  });

  it("caps OTP requests per phone number at 3", async () => {
    const app = appWith(otpRequestLimiter);
    const send = (phone) => request(app).post("/t").send({ phone });

    for (let i = 0; i < 3; i += 1) {
      expect((await send("+919000000001")).status).toBe(200);
    }
    expect((await send("+919000000001")).status).toBe(429);
    expect((await send("+919000000002")).status).toBe(200);
  });

  it("keys the IP-scoped limiters without throwing", async () => {
    expect((await request(appWith(otpIpLimiter)).post("/t").send({})).status).toBe(200);
    expect((await request(appWith(otpVerifyLimiter)).post("/t").send({})).status).toBe(200);
  });

  describe("ipPart", () => {
    const key = (ip) => ipPart({ ip });

    it("returns IPv4 addresses unchanged", () => {
      expect(key("203.0.113.7")).toBe("203.0.113.7");
    });

    it("unwraps IPv4-mapped IPv6 addresses", () => {
      expect(key("::ffff:127.0.0.1")).toBe("127.0.0.1");
    });

    it("collapses an IPv6 address to its /64 prefix", () => {
      expect(key("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    });

    it("gives two addresses in one /64 the same key", () => {
      expect(key("2001:db8:1:2::1")).toBe(key("2001:db8:1:2::dead:beef"));
    });

    it("normalises leading zeros and case so one prefix is one key", () => {
      expect(key("2001:0DB8:0001:0002::1")).toBe(key("2001:db8:1:2::1"));
    });

    it("separates addresses in different /64s", () => {
      expect(key("2001:db8:1:2::1")).not.toBe(key("2001:db8:1:3::1"));
    });

    it("strips a zone index and brackets", () => {
      expect(key("[2001:db8:1:2::1%eth0]")).toBe("2001:db8:1:2::/64");
    });

    it("falls back to the socket address, then to a constant", () => {
      expect(ipPart({ socket: { remoteAddress: "198.51.100.4" } })).toBe("198.51.100.4");
      expect(ipPart({})).toBe("unknown");
    });
  });
});
