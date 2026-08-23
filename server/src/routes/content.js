const express = require("express");
const router = express.Router();
const { medicines } = require("../data/medicines");
const { supplements } = require("../data/supplements");
const { banners, categories, wellnessGuides, flashSale } = require("../data/content");
const { doctors } = require("../data/doctors");
const store = require("../services/store");

// GET /api/banners — hero carousel slides
router.get("/banners", (req, res) => res.json(banners));

// GET /api/categories — quick-action bento cards
router.get("/categories", (req, res) => res.json(categories));

// GET /api/wellness — wellness guides
router.get("/wellness", (req, res) => res.json(wellnessGuides));

// GET /api/doctors?specialty=
router.get("/doctors", (req, res) => {
  const { specialty } = req.query;
  let result = doctors;
  if (specialty && specialty !== "All") result = doctors.filter((d) => d.specialty === specialty);
  res.json(result);
});

// GET /api/flash-sale — resolved items + live countdown end time
router.get("/flash-sale", (req, res) => {
  const pool = [...medicines, ...supplements];
  const items = flashSale.itemIds.map((id) => pool.find((x) => x.id === id)).filter(Boolean);
  res.json({
    title: flashSale.title,
    subtitle: flashSale.subtitle,
    endsAt: store.flashSaleEndsAt(),
    items,
  });
});

// POST /api/coupons/validate  { code, subtotal }
router.post("/coupons/validate", (req, res) => {
  const { code, subtotal } = req.body || {};
  res.json(store.validateCoupon(code, Number(subtotal) || 0));
});

module.exports = router;
