const express = require("express");
const router = express.Router();
const store = require("../services/store");

// GET /api/orders — order history (with live tracker status)
router.get("/", (req, res) => res.json(store.listOrders()));

// GET /api/orders/:id — single order with computed timeline
router.get("/:id", (req, res) => {
  const order = store.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

module.exports = router;
