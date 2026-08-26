const Coupon = require("../../src/models/Coupon");
const { validateCoupon } = require("../../src/services/couponService");

describe("couponService.validateCoupon", () => {
  const seed = async (over = {}) =>
    Coupon.create({
      code: "SAVE10",
      type: "PERCENT",
      value: 10,
      minCartValuePaise: 50000,
      maxDiscountPaise: 5000,
      isActive: true,
      ...over,
    });

  it("accepts a valid PERCENT coupon and returns the discount in paise", async () => {
    await seed();
    const r = await validateCoupon("save10", 100000); // 10% of 1000 = 100 paise
    expect(r.valid).toBe(true);
    expect(r.code).toBe("SAVE10");
    expect(r.discountPaise).toBe(10000);
    expect(r.newTotalPaise).toBe(90000);
  });

  it("accepts a valid FLAT coupon using value as paise", async () => {
    await seed({ code: "FLAT50", type: "FLAT", value: 5000, minCartValuePaise: 0 });
    const r = await validateCoupon("flat50", 20000);
    expect(r.valid).toBe(true);
    expect(r.discountPaise).toBe(5000);
    expect(r.newTotalPaise).toBe(15000);
  });

  it("caps a PERCENT discount at maxDiscountPaise", async () => {
    await seed(); // value 10, maxDiscountPaise 5000
    const r = await validateCoupon("SAVE10", 1000000); // 10% would be 100000
    expect(r.discountPaise).toBe(5000);
    expect(r.newTotalPaise).toBe(995000);
  });

  it("returns COUPON_NOT_FOUND for an unknown code", async () => {
    const r = await validateCoupon("NOPE", 100000);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("COUPON_NOT_FOUND");
  });

  it("returns COUPON_INACTIVE for a disabled coupon", async () => {
    await seed({ isActive: false });
    const r = await validateCoupon("SAVE10", 100000);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("COUPON_INACTIVE");
  });

  it("returns COUPON_MIN_NOT_MET when subtotal is too low", async () => {
    await seed(); // min 50000
    const r = await validateCoupon("SAVE10", 40000);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("COUPON_MIN_NOT_MET");
    expect(r.message).toMatch(/Add/);
  });

  it("never discounts more than the subtotal (guards against a FLAT > subtotal)", async () => {
    await seed({ code: "BIGFLAT", type: "FLAT", value: 999999, minCartValuePaise: 0 });
    const r = await validateCoupon("BIGFLAT", 10000);
    expect(r.discountPaise).toBe(10000);
    expect(r.newTotalPaise).toBe(0);
  });

  it("treats empty / whitespace code as invalid", async () => {
    const r = await validateCoupon("   ", 100000);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("COUPON_EMPTY");
  });
});
