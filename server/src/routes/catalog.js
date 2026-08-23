const express = require("express");
const router = express.Router();
const { medicines } = require("../data/medicines");
const { supplements } = require("../data/supplements");
const { babyFood } = require("../data/babyFood");
const { applyFilters, applySort } = require("../utils/filter");

// GET /api/medicines?search=&brand=&dosageForm=&category=&minPrice=&maxPrice=&inStock=&sort=
router.get("/medicines", (req, res) => {
  let result = applyFilters(medicines, req.query);
  result = applySort(result, req.query.sort);
  res.json(result);
});

// GET /api/supplements?search=&category=&sort=&minPrice=&maxPrice=
router.get("/supplements", (req, res) => {
  let result = applyFilters(supplements, req.query);
  result = applySort(result, req.query.sort);
  res.json(result);
});

// GET /api/baby-food?search=&category=&ageGroup=&sort=&minPrice=&maxPrice=
router.get("/baby-food", (req, res) => {
  let result = applyFilters(babyFood, req.query);
  result = applySort(result, req.query.sort);
  res.json(result);
});

// GET /api/products/:id — find across medicines + supplements
router.get("/products/:id", (req, res) => {
  const product = [...medicines, ...supplements].find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// Distinct brands (handy for filter sidebar)
router.get("/brands", (req, res) => {
  const brands = [...new Set(medicines.map((m) => m.brand))].sort();
  res.json(brands);
});

module.exports = router;
