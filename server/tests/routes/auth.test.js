const request = require("supertest");
const app = require("../../src/app"); // extracted in this task
const User = require("../../src/models/User");

const creds = { name: "Subhasis", email: "s@example.com", password: "correct-horse-1" };
const cookieValue = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0].split("=")[1] : null;
};

describe("auth routes", () => {
  it("registers a user and sets both auth cookies httpOnly", async () => {
    const res = await request(app).post("/api/auth/register").send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("s@example.com");
    expect(res.body.user.passwordHash).toBeUndefined();
    const setCookie = res.headers["set-cookie"].join(";");
    expect(setCookie).toMatch(/so_at=/);
    expect(setCookie).toMatch(/so_rt=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/register").send(creds);
    const res = await request(app).post("/api/auth/register").send(creds);
    expect(res.status).toBe(409);
    expect(typeof res.body.error).toBe("string");
  });

  it("rejects a weak password with 422", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...creds, password: "short" });
    expect(res.status).toBe(422);
    expect(res.body.details[0].path).toBe("password");
  });

  it("logs in with correct credentials and rejects wrong ones identically", async () => {
    await request(app).post("/api/auth/register").send(creds);
    expect((await request(app).post("/api/auth/login")
      .send({ email: creds.email, password: creds.password })).status).toBe(200);

    const wrongPass = await request(app).post("/api/auth/login")
      .send({ email: creds.email, password: "nope-nope-nope" });
    const noUser = await request(app).post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "nope-nope-nope" });
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    // Identical message — must not reveal whether the account exists.
    expect(wrongPass.body.error).toBe(noUser.body.error);
  });

  it("returns the current user from /me and 401s when anonymous", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const at = cookieValue(reg, "so_at");
    const me = await request(app).get("/api/auth/me").set("Cookie", `so_at=${at}`);
    expect(me.body.user.name).toBe("Subhasis");
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("rotates cookies on refresh", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const rt = cookieValue(reg, "so_rt");
    const res = await request(app).post("/api/auth/refresh").set("Cookie", `so_rt=${rt}`);
    expect(res.status).toBe(200);
    expect(cookieValue(res, "so_rt")).not.toBe(rt);
  });

  it("revokes the session on logout so refresh stops working", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const rt = cookieValue(reg, "so_rt");
    await request(app).post("/api/auth/logout").set("Cookie", `so_rt=${rt}`);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", `so_rt=${rt}`)).status).toBe(401);
  });

  it("invalidates existing access tokens after a password change", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const at = cookieValue(reg, "so_at");
    await request(app).patch("/api/auth/me")
      .set("Cookie", `so_at=${at}`).send({ password: "brand-new-secret-9" });
    expect((await request(app).get("/api/auth/me").set("Cookie", `so_at=${at}`)).status).toBe(401);
  });
});
