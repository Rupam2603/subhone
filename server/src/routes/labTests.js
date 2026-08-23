const express = require("express");
const router = express.Router();
const { labTests } = require("../data/labTests");
const { applyFilters, applySort } = require("../utils/filter");

// GET /api/lab-tests?category=&search=&sort=
router.get("/", (req, res) => {
  let result = applyFilters(labTests, req.query);
  result = applySort(result, req.query.sort);
  res.json(result);
});

// GET /api/lab-tests/:id
router.get("/:id", (req, res) => {
  const test = labTests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: "Lab test not found" });
  res.json(test);
});

module.exports = router;
