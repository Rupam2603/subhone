const request = require("supertest");
const app = require("../../src/app");
const Coupon = require("../../src/models/Coupon");

describe("POST /api/coupons/validate", () => {
  it("returns the service response for a valid coupon", async () => {
    await Coupon.create({
      code: "WELCOME", type: "FLAT", value: 3000, minCartValuePaise: 0, isActive: true,
    });
    const res = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "welcome", subtotalPaise: 12000 });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.discountPaise).toBe(3000);
    expect(res.body.newTotalPaise).toBe(9000);
  });

  it("returns valid:false for an unknown code", async () => {
    const res = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "UNKNOWN", subtotalPaise: 12000 });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.code).toBe("COUPON_NOT_FOUND");
  });

  it("does not trust a subtotal from the client on a min-not-met coupon", async () => {
    await Coupon.create({
      code: "MIN500", type: "PERCENT", value: 5, minCartValuePaise: 50000,
      maxDiscountPaise: 10000, isActive: true,
    });
    const res = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "MIN500", subtotalPaise: 10000 }); // below 50000
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.code).toBe("COUPON_MIN_NOT_MET");
  });
});
