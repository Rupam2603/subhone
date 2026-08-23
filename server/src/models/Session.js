const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    familyId: { type: String, required: true }, // Ties token rotations together
    // sha256 of the refresh token. Unique because rotation looks a session up by
    // this value and must never find two — a collision would make reuse detection
    // ambiguous, and a duplicate insert is a bug worth surfacing loudly.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false }, // If true, family is compromised
    // Recorded so the account page can list "where you're signed in".
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true }
);

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, isRevoked: 1 });

const Session = mongoose.model("Session", sessionSchema);
module.exports = Session;
