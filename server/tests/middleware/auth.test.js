const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const User = require("../../src/models/User");
const tokenService = require("../../src/services/tokenService");
const attachUser = require("../../src/middleware/attachUser");
const requireAuth = require("../../src/middleware/requireAuth");
const requireRole = require("../../src/middleware/requireRole");
const originCheck = require("../../src/middleware/originCheck");
const errorHandler = require("../../src/middleware/errorHandler");

process.env.JWT_SECRET = "t".repeat(32);

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(originCheck(["http://localhost:5173"]));
app.use(attachUser);
app.get("/open", (req, res) => res.json({ user: req.user ? req.user.name : null }));
app.get("/private", requireAuth, (req, res) => res.json({ ok: true }));
app.get("/admin", requireAuth, requireRole("admin"), (req, res) => res.json({ ok: true }));
app.post("/mutate", (req, res) => res.json({ ok: true }));
app.use(errorHandler);

let user; let accessToken;
beforeEach(async () => {
  user = await User.create({ name: "Subhasis", phone: "+919830000000" });
  accessToken = tokenService.issueAccessToken(user);
});

describe("auth middleware", () => {
  it("leaves req.user unset for anonymous callers without erroring", async () => {
    const res = await request(app).get("/open");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("attaches the user from a valid access cookie", async () => {
    const res = await request(app).get("/open").set("Cookie", `so_at=${accessToken}`);
    expect(res.body.user).toBe("Subhasis");
  });

  it("ignores a malformed token rather than 500ing", async () => {
    const res = await request(app).get("/open").set("Cookie", "so_at=garbage");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("rejects a token whose tokenVersion is stale", async () => {
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    const res = await request(app).get("/private").set("Cookie", `so_at=${accessToken}`);
    expect(res.status).toBe(401);
  });

  it("401s an anonymous caller on a protected route", async () => {
    expect((await request(app).get("/private")).status).toBe(401);
  });

  it("403s a customer on an admin route", async () => {
    const res = await request(app).get("/admin").set("Cookie", `so_at=${accessToken}`);
    expect(res.status).toBe(403);
  });

  it("allows an admin through", async () => {
    const admin = await User.create({ name: "A", phone: "+919830000009", role: "admin" });
    const res = await request(app).get("/admin")
      .set("Cookie", `so_at=${tokenService.issueAccessToken(admin)}`);
    expect(res.status).toBe(200);
  });

  it("rejects a mutating request from a foreign origin", async () => {
    const res = await request(app).post("/mutate").set("Origin", "http://evil.example");
    expect(res.status).toBe(403);
  });

  it("allows a mutating request with no Origin header (non-browser client)", async () => {
    expect((await request(app).post("/mutate")).status).toBe(200);
  });
});
