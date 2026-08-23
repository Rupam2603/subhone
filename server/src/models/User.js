const mongoose = require("mongoose");

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
    role: { type: String, enum: ["USER", "ADMIN", "DOCTOR"], default: "USER" },
    name: { type: String, required: true },
    email: { type: String, sparse: true, unique: true },
    phone: { type: String, sparse: true, unique: true },
    passwordHash: { type: String }, // Optional, since phone login uses OTP
    // Bumped to invalidate every outstanding access token (password change, forced
    // sign-out). tokenService puts it in the `ver` claim; attachUser compares them.
    tokenVersion: { type: Number, default: 0 },
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

const User = mongoose.model("User", userSchema);
module.exports = User;
