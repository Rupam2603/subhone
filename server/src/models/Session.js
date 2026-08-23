const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    familyId: { type: String, required: true }, // Ties token rotations together
    tokenHash: { type: String, required: true }, // Hashed refresh token
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false }, // If true, family is compromised
  },
  { timestamps: true }
);

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model("Session", sessionSchema);
module.exports = Session;
