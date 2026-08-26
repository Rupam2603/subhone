const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const LabTest = require("../models/LabTest");
const { publicProduct, publicLabTest } = require("../utils/serialise");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/search?q=... — omnisearch across medicines, supplements & lab tests.
// Shape expected by SearchModal: { query, medicines, supplements, labTests, total }.
// babyfood is bucketed into medicines (the client's grouping only has
// medicines / supplements / labTests).
router.get("/", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ query: "", medicines: [], supplements: [], labTests: [], total: 0 });

  const re = { $regex: q, $options: "i" };
  const [meds, sups, labs] = await Promise.all([
    Product.find({
      $or: [{ name: re }, { brand: re }, { category: re }, { description: re }],
      type: { $in: ["medicine", "babyfood"] },
    }),
    Product.find({
      $or: [{ name: re }, { brand: re }, { category: re }, { description: re }],
      type: "supplement",
    }),
    LabTest.find({
      $or: [{ name: re }, { category: re }, { description: re }],
    }),
  ]);

  const medicines = meds.map(publicProduct);
  const supplements = sups.map(publicProduct);
  const labTests = labs.map(publicLabTest);

  res.json({
    query: q,
    medicines,
    supplements,
    labTests,
    total: medicines.length + supplements.length + labTests.length,
  });
}));

module.exports = router;
