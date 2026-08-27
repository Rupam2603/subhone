const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    // Human-facing number, e.g. RX-000123. Gap-free via the Counter collection.
    prescriptionNumber: { type: String, required: true, unique: true },
    // The account that uploaded. Always present — uploads require auth.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    filePath: { type: String, required: true },
    originalName: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number, default: 0 },
    note: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
      default: "PENDING_REVIEW",
    },
    // Set when a pharmacist acts on the upload. Null until then.
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewNote: { type: String, default: "" },
    // Linked order, once this prescription is attached to a purchase. Null until then.
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true }
);

prescriptionSchema.index({ userId: 1, createdAt: -1 });

const Prescription = mongoose.model("Prescription", prescriptionSchema);
module.exports = Prescription;
