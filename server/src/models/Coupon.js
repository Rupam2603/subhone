const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, required: true, enum: ["FLAT", "PERCENT"] },
    value: { type: Number, required: true }, // FLAT: paise. PERCENT: integer percent (e.g. 10 = 10%)
    minCartValuePaise: { type: Number, default: 0 },
    maxDiscountPaise: { type: Number }, // Required if PERCENT
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;
