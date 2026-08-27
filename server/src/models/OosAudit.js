const mongoose = require("mongoose");

const oosAuditSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    categories: [{ type: String }],
    previousInStock: { type: Boolean, required: true },
    newInStock: { type: Boolean, required: true },
    mode: {
      type: String,
      enum: ["DRY_RUN", "EXECUTE"],
      required: true,
      default: "EXECUTE",
    },
    targetedCategory: { type: String, required: true },
    reason: { type: String, default: "Bulk Category Out-Of-Stock Update" },
    executedBy: { type: String, default: "system_migration" },
    executedAt: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "oos_audits" }
);

const OosAudit = mongoose.model("OosAudit", oosAuditSchema);
module.exports = OosAudit;
