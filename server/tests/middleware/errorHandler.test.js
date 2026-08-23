const express = require("express");
const request = require("supertest");
const { z } = require("zod");
const AppError = require("../../src/utils/AppError");
const asyncHandler = require("../../src/utils/asyncHandler");
const errorHandler = require("../../src/middleware/errorHandler");
const validate = require("../../src/middleware/validate");

const app = express();
app.use(express.json());
app.get("/boom", asyncHandler(async () => { throw new AppError(403, "NOPE", "Not allowed."); }));
app.get("/crash", asyncHandler(async () => { throw new Error("kaboom"); }));
app.post("/thing", validate({ body: z.object({ qty: z.number().int().positive() }) }),
  (req, res) => res.json({ ok: true }));
app.get("/dupe", asyncHandler(async () => {
  const err = new Error("E11000 duplicate key");
  err.code = 11000;
  err.keyValue = { email: "s@example.com" };
  throw err;
}));
app.get("/model", asyncHandler(async () => {
  const err = new Error("User validation failed");
  err.name = "ValidationError";
  err.errors = { phone: { message: "phone must be E.164" } };
  throw err;
}));
app.get("/query", validate({ body: z.object({}).passthrough() }),
  (req, res) => res.json({ q: req.query.q, hasParams: Boolean(req.params) }));
app.use(errorHandler);

describe("error envelope", () => {
  it("keeps `error` a plain string so the existing client keeps working", async () => {
    const res = await request(app).get("/boom");
    expect(res.status).toBe(403);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error).toBe("Not allowed.");
    expect(res.body.code).toBe("NOPE");
  });

  it("hides internal messages behind a 500", async () => {
    const res = await request(app).get("/crash");
    expect(res.status).toBe(500);
    expect(res.body.error).not.toMatch(/kaboom/);
    expect(res.body.code).toBe("INTERNAL");
  });

  it("returns 422 with per-field details on validation failure", async () => {
    const res = await request(app).post("/thing").send({ qty: -1 });
    expect(res.status).toBe(422);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.details[0].path).toBe("qty");
  });

  it("passes valid bodies through", async () => {
    const res = await request(app).post("/thing").send({ qty: 2 });
    expect(res.status).toBe(200);
  });

  it("maps a duplicate key error to 409 DUPLICATE", async () => {
    const res = await request(app).get("/dupe");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE");
    expect(typeof res.body.error).toBe("string");
  });

  it("maps a Mongoose ValidationError to 422", async () => {
    const res = await request(app).get("/model");
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details[0].path).toBe("phone");
  });

  it("leaves req.query intact when only a body schema is declared", async () => {
    const res = await request(app).get("/query?q=hello");
    expect(res.status).toBe(200);
    expect(res.body.q).toBe("hello");
    expect(res.body.hasParams).toBe(true);
  });
});
