const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Category = require("../models/Category");
const { buildFilter, buildSort } = require("../utils/filter");
const { publicProduct } = require("../utils/serialise");
const asyncHandler = require("../utils/asyncHandler");

const list = (type) => asyncHandler(async (req, res) => {
  const docs = await Product.find(buildFilter(req.query, { type })).sort(buildSort(req.query.sort));
  res.json(docs.map(publicProduct));
});

router.get("/medicines", list("medicine"));
router.get("/supplements", list("supplement"));
router.get("/baby-food", list("babyfood")); // keep this route; Product.type now includes babyfood

// Find by the committed string id (cart/order resolve the catalog by string id, NOT _id).
router.get("/products/:id", asyncHandler(async (req, res) => {
  const doc = await Product.findOne({ id: req.params.id });
  if (!doc) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
  res.json(publicProduct(doc));
}));

router.get("/brands", asyncHandler(async (req, res) => {
  const brands = await Product.distinct("brand");
  res.json(brands.filter(Boolean).sort());
}));

router.get("/categories", asyncHandler(async (req, res) => {
  const tree = await Category.getCategoryTree();
  res.json(tree);
}));

module.exports = router;
