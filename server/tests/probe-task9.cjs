// Sandbox-only probe: exercises Task 9's logic that does NOT need a live mongod, by
// stubbing OtpChallenge's query methods. Answers "is Task 9 correct?" for everything
// except real persistence, indexes-as-built, and the TTL reaper.
require("dotenv").config({ path: ".env.example" });

const assert = require("node:assert/strict");
const results = [];
const check = (name, fn) => {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name, e.message]); }
};
const acheck = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name, e.message]); }
};

const { hashOtp, sha256 } = require("../src/utils/hash");
const OtpChallenge = require("../src/models/OtpChallenge");
const { getProvider } = require("../src/services/smsProvider");

// ---------- hashOtp ----------
check("hashOtp is deterministic", () => {
  assert.equal(hashOtp("123456", "pep"), hashOtp("123456", "pep"));
});
check("hashOtp is pepper-sensitive", () => {
  assert.notEqual(hashOtp("123456", "pepA"), hashOtp("123456", "pepB"));
});
check("hashOtp is code-sensitive", () => {
  assert.notEqual(hashOtp("123456", "pep"), hashOtp("123457", "pep"));
});
check("hashOtp returns 64 hex chars (sha256)", () => {
  assert.match(hashOtp("123456", "pep"), /^[0-9a-f]{64}$/);
});
check("hashOtp is NOT a bare sha256 of the code (pepper actually applied)", () => {
  assert.notEqual(hashOtp("123456", "pep"), sha256("123456"));
});

// ---------- code generation ----------
const crypto = require("crypto");
const gen = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
check("codes are always exactly 6 digits over 20k samples", () => {
  for (let i = 0; i < 20000; i++) assert.match(gen(), /^\d{6}$/);
});
check("codes include leading-zero values (padStart works)", () => {
  let sawLeadingZero = false;
  for (let i = 0; i < 200000 && !sawLeadingZero; i++) if (gen()[0] === "0") sawLeadingZero = true;
  assert.ok(sawLeadingZero, "never produced a code starting with 0");
});

// ---------- schema, validated offline ----------
check("OtpChallenge has no plaintext code path", () => {
  const paths = Object.keys(OtpChallenge.schema.paths);
  assert.ok(!paths.includes("code"), `schema exposes a plaintext 'code' path: ${paths}`);
  assert.ok(paths.includes("codeHash"), "schema has no codeHash path");
});
check("OtpChallenge requires phone, codeHash, expiresAt", () => {
  const err = new OtpChallenge({}).validateSync();
  for (const f of ["phone", "codeHash", "expiresAt"]) {
    assert.ok(err && err.errors[f], `${f} is not required`);
  }
});
check("OtpChallenge defaults attempts to 0", () => {
  assert.equal(new OtpChallenge({}).attempts, 0);
});
check("OtpChallenge has a TTL index on expiresAt", () => {
  const idx = OtpChallenge.schema.indexes();
  const ttl = idx.find(([k, o]) => k.expiresAt !== undefined && o && o.expireAfterSeconds !== undefined);
  assert.ok(ttl, `no TTL index found; indexes=${JSON.stringify(idx)}`);
});

// ---------- provider selection ----------
check("dev provider is selected by default and is named 'dev'", () => {
  const old = process.env.SMS_PROVIDER; delete process.env.SMS_PROVIDER;
  const p = getProvider();
  assert.equal(p.name, "dev");
  assert.equal(typeof p.send, "function");
  process.env.SMS_PROVIDER = old;
});
check("unknown provider throws rather than silently falling back", () => {
  const old = process.env.SMS_PROVIDER; process.env.SMS_PROVIDER = "carrier-pigeon";
  assert.throws(() => getProvider(), /SMS_PROVIDER|provider/i);
  process.env.SMS_PROVIDER = old;
});
check("dev provider REFUSES to run in production", () => {
  const oldP = process.env.SMS_PROVIDER, oldN = process.env.NODE_ENV;
  process.env.SMS_PROVIDER = "dev"; process.env.NODE_ENV = "production";
  let threw = false;
  try { getProvider(); } catch { threw = true; }
  process.env.SMS_PROVIDER = oldP; process.env.NODE_ENV = oldN;
  assert.ok(threw, "dev SMS provider was allowed in production — OTPs would go to a log file");
});

// ---------- verifyOtp decision tree, with the model stubbed ----------
const otpService = require("../src/services/otpService");
const fake = (over = {}) => ({
  phone: "+919830000000", purpose: "login", attempts: 0,
  consumedAt: null, expiresAt: new Date(Date.now() + 60000),
  codeHash: hashOtp("111111", process.env.OTP_PEPPER),
  save: async function () { this._saved = true; },
  ...over,
});
const stub = (val) => { OtpChallenge.findById = () => Promise.resolve(val); };

(async () => {
  await acheck("unknown challengeId -> 400 OTP_INVALID", async () => {
    stub(null);
    await assert.rejects(otpService.verifyOtp({ challengeId: "x", code: "111111" }),
      (e) => e.statusCode === 400 && e.code === "OTP_INVALID");
  });
  await acheck("already-consumed challenge is rejected", async () => {
    stub(fake({ consumedAt: new Date() }));
    await assert.rejects(otpService.verifyOtp({ challengeId: "x", code: "111111" }),
      (e) => e.statusCode === 400 && e.code === "OTP_INVALID");
  });
  await acheck("expired challenge -> 400 OTP_EXPIRED", async () => {
    stub(fake({ expiresAt: new Date(Date.now() - 1) }));
    await assert.rejects(otpService.verifyOtp({ challengeId: "x", code: "111111" }),
      (e) => e.statusCode === 400 && e.code === "OTP_EXPIRED");
  });
  await acheck("attempt cap -> 429 OTP_ATTEMPTS", async () => {
    stub(fake({ attempts: otpService.MAX_ATTEMPTS }));
    await assert.rejects(otpService.verifyOtp({ challengeId: "x", code: "111111" }),
      (e) => e.statusCode === 429 && e.code === "OTP_ATTEMPTS");
  });
  await acheck("wrong code increments attempts and persists the increment", async () => {
    const c = fake();
    stub(c);
    await assert.rejects(otpService.verifyOtp({ challengeId: "x", code: "999999" }),
      (e) => e.code === "OTP_INVALID");
    assert.equal(c.attempts, 1, "attempts not incremented");
    assert.ok(c._saved, "increment was not saved — brute force would be free");
  });
  await acheck("correct code consumes the challenge and returns phone+purpose", async () => {
    const c = fake();
    stub(c);
    const out = await otpService.verifyOtp({ challengeId: "x", code: "111111" });
    assert.equal(out.phone, "+919830000000");
    assert.equal(out.purpose, "login");
    assert.ok(c.consumedAt instanceof Date, "consumedAt not set — code would be replayable");
    assert.ok(c._saved, "consumption not saved — code would be replayable");
  });
  await acheck("a consumed code cannot be replayed", async () => {
    const c = fake();
    stub(c);
    await otpService.verifyOtp({ challengeId: "x", code: "111111" });
    await assert.rejects(otpService.verifyOtp({ challengeId: "x", code: "111111" }),
      (e) => e.code === "OTP_INVALID");
  });

  const fails = results.filter((r) => r[0] === "FAIL");
  for (const r of results) console.log(r[0] === "PASS" ? `  ok   ${r[1]}` : `  FAIL ${r[1]}\n         ${r[2]}`);
  console.log(`\n  ${results.length - fails.length}/${results.length} passed`);
  process.exit(fails.length ? 1 : 0);
})();
