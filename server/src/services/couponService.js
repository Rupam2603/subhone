const Coupon = require("../models/Coupon");

const INR = (p) => (p / 100).toLocaleString("en-IN");

// Validates a coupon against the current cart subtotal. The only entry point for
// discount logic — checkout (Task 14) will call this too, so a coupon is never
// trusted from the client. Returns a flat object the API and checkout can both
// read, never an exception on a *user* mistake (a bad code is a 200 with valid:false).
async function validateCoupon(code, subtotalPaise) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) {
    return { valid: false, code: "COUPON_EMPTY", message: "Enter a coupon code." };
  }

  const coupon = await Coupon.findOne({ code: normalized });
  if (!coupon) {
    return { valid: false, code: "COUPON_NOT_FOUND", message: "That coupon code isn't valid." };
  }
  if (!coupon.isActive) {
    return { valid: false, code: "COUPON_INACTIVE", message: "That coupon is no longer active." };
  }
  if (subtotalPaise < coupon.minCartValuePaise) {
    const shortfall = coupon.minCartValuePaise - subtotalPaise;
    return {
      valid: false,
      code: "COUPON_MIN_NOT_MET",
      message: `Add ₹${INR(shortfall)} more to use ${coupon.code}.`,
    };
  }

  let discountPaise;
  if (coupon.type === "PERCENT") {
    discountPaise = Math.round((subtotalPaise * coupon.value) / 100);
    if (typeof coupon.maxDiscountPaise === "number") {
      discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
    }
  } else {
    discountPaise = coupon.value;
  }
  discountPaise = Math.min(discountPaise, subtotalPaise);

  return {
    valid: true,
    code: coupon.code,
    discountPaise,
    newTotalPaise: subtotalPaise - discountPaise,
  };
}

module.exports = { validateCoupon };
