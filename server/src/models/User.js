const mongoose = require("mongoose");

// E.164: a leading "+", a non-zero country digit, then up to 14 more digits. Defined
// here and exported so phone-shaped fields elsewhere (OtpChallenge, request schemas)
// validate against one pattern instead of each keeping a copy to drift out of sync.
// Deliberately not attached to `phone` below: tightening an existing field's
// validation belongs to the User task, not to the OTP task that needed the constant.
const E164 = /^\+[1-9]\d{6,14}$/;

const addressSchema = new mongoose.Schema({
  id: { type: String, required: true },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pinCode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    // Stored upper-case. The setter normalises so callers may pass either case;
    // requireRole compares case-insensitively for the same reason.
    role: {
      type: String,
      enum: ["USER", "ADMIN", "DOCTOR"],
      default: "USER",
      set: (v) => (typeof v === "string" ? v.toUpperCase() : v),
    },
    name: { type: String, required: true },
    email: { type: String, sparse: true, unique: true },
    phone: { type: String, sparse: true, unique: true },
    // Proof that the number was actually held, not merely typed in. Only a consumed
    // OTP challenge sets it, so it — not `phone` — is what a later flow (order
    // notifications, delivery calls) should trust. Null on an email-only account.
    phoneVerifiedAt: { type: Date, default: null },
    passwordHash: { type: String }, // Optional, since phone login uses OTP
    // Bumped to invalidate every outstanding access token (password change, forced
    // sign-out). tokenService puts it in the `ver` claim; attachUser compares them.
    tokenVersion: { type: Number, default: 0 },
    // Set by an admin to lock an account out. attachUser refuses to attach a
    // disabled user, and login/refresh both reject with 403 DISABLED.
    disabledAt: { type: Date, default: null },
    addresses: [addressSchema],
  },
  { timestamps: true }
);

// Invariant: A user must have either an email or a phone
userSchema.pre("validate", function () {
  if (!this.email && !this.phone) {
    this.invalidate("email", "User must have either an email or a phone number");
    this.invalidate("phone", "User must have either an email or a phone number");
  }
});

// The user document is serialised straight into responses (`res.json({ user })`),
// so secrets are stripped here rather than at each call site — one place to be
// wrong instead of a dozen.
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
module.exports.E164 = E164;
