const express = require("express");
const router = express.Router();
const { banners, categories, wellnessGuides, flashSale } = require("../data/content");
const Doctor = require("../models/Doctor");
const Product = require("../models/Product");
const couponService = require("../services/couponService");
const serialise = require("../utils/serialise");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/banners — hero carousel slides
router.get("/banners", (req, res) => res.json(banners));

// GET /api/categories — quick-action bento cards
router.get("/categories", (req, res) => res.json(categories));

// GET /api/wellness — wellness guides
router.get("/wellness", (req, res) => res.json(wellnessGuides));

// GET /api/doctors?specialty= — doctors from the Doctor Mongo model
router.get(
  "/doctors",
  asyncHandler(async (req, res) => {
    const { specialty } = req.query;
    const filter = specialty && specialty !== "All" ? { specialty } : {};
    const docs = await Doctor.find(filter);
    res.json(
      docs.map((d) => {
        const o = d.toObject ? d.toObject() : d;
        const { _id, __v, consultationFeePaise, ...rest } = o;
        return { ...rest, consultationFee: consultationFeePaise };
      })
    );
  })
);

// GET /api/flash-sale — resolved items + live countdown end time. End of current
// day, computed server-side (no client clock, no store import).
function flashSaleEndsAt() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
  return end.toISOString();
}

router.get(
  "/flash-sale",
  asyncHandler(async (req, res) => {
    const docs = await Product.find({ id: { $in: flashSale.itemIds } });
    const byId = new Map(docs.map((d) => [d.id, d]));
    const items = flashSale.itemIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((d) => serialise.publicProduct(d));
    res.json({
      title: flashSale.title,
      subtitle: flashSale.subtitle,
      endsAt: flashSaleEndsAt(),
      items,
    });
  })
);

// POST /api/coupons/validate  { code, subtotalPaise }
router.post(
  "/coupons/validate",
  asyncHandler(async (req, res) => {
    const { code, subtotalPaise } = req.body || {};
    const subtotal = Number(subtotalPaise) || 0;
    const result = await couponService.validateCoupon(code, subtotal);
    res.json(result);
  })
);

module.exports = router;
