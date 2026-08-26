const express = require("express");
const router = express.Router();
const LabTest = require("../models/LabTest");
const { buildFilter, buildSort } = require("../utils/filter");
const { publicLabTest } = require("../utils/serialise");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(async (req, res) => {
  const docs = await LabTest.find(buildFilter(req.query)).sort(buildSort(req.query.sort));
  res.json(docs.map(publicLabTest));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const doc = await LabTest.findOne({ id: req.params.id });
  if (!doc) return res.status(404).json({ error: "Lab test not found", code: "NOT_FOUND" });
  res.json(publicLabTest(doc));
}));

module.exports = router;
