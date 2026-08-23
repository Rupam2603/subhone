const mongoose = require("mongoose");

const labTestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true, default: "labTest" },
    name: { type: String, required: true },
    testCount: { type: Number, required: true },
    pricePaise: { type: Number, required: true },
    mrpPaise: { type: Number, required: true },
    turnaroundTime: { type: String },
    reportsIn: { type: String },
    homeCollection: { type: Boolean, default: true },
    fastingRequired: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },
    category: { type: String, required: true },
    includes: [String],
    description: { type: String },
  },
  { timestamps: true }
);

const LabTest = mongoose.model("LabTest", labTestSchema);
module.exports = LabTest;
