const express = require("express");
const router = express.Router();
const { medicines } = require("../data/medicines");
const { supplements } = require("../data/supplements");
const { labTests } = require("../data/labTests");

// GET /api/search?q=... — omnisearch across medicines, supplements & lab tests
router.get("/", (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ query: "", medicines: [], supplements: [], labTests: [], total: 0 });

  const match = (item, fields) =>
    fields.some((f) => item[f] && String(item[f]).toLowerCase().includes(q));

  const med = medicines.filter((i) => match(i, ["name", "brand", "category", "description"]));
  const sup = supplements.filter((i) => match(i, ["name", "brand", "category", "description"]));
  const lab = labTests.filter((i) => match(i, ["name", "category", "description"]));

  res.json({
    query: q,
    medicines: med,
    supplements: sup,
    labTests: lab,
    total: med.length + sup.length + lab.length,
  });
});

module.exports = router;
