const express = require("express");
const router = express.Router();
const store = require("../services/store");
const { sendOrderNotification } = require("../services/emailService");

// POST /api/checkout  { items?, address, paymentMethod, couponCode }
// Uses the passed items if present, otherwise the server-side cart.
router.post("/", async (req, res) => {
  const { address, paymentMethod, couponCode, items } = req.body || {};
  const serverCart = store.getCart().items;
  const lines = items && items.length ? items : serverCart;

  if (!lines || !lines.length) {
    return res.status(400).json({ error: "Your cart is empty." });
  }
  if (!address || !address.name || !address.phone || !address.pincode) {
    return res.status(400).json({ error: "A delivery name, phone and pincode are required." });
  }

  const order = store.createOrder({ items: lines, address, paymentMethod, couponCode });
  store.clearCart();

  // Send email notification asynchronously without blocking response
  sendOrderNotification(order).catch((err) => {
    console.error("Background email dispatch failed:", err.message);
  });

  res.status(201).json(order);
});

module.exports = router;
