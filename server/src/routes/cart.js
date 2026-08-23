const express = require("express");
const router = express.Router();
const store = require("../services/store");

// GET /api/cart
router.get("/", (req, res) => res.json(store.getCart()));

// POST /api/cart/add  { id, type, quantity }
router.post("/add", (req, res) => {
  const { id, type, quantity } = req.body;
  const r = store.addToCart(id, type, quantity);
  if (r.error) return res.status(404).json(r);
  res.json(store.getCart());
});

// PUT /api/cart/update  { id, type, quantity }
router.put("/update", (req, res) => {
  const { id, type, quantity } = req.body;
  const r = store.updateCart(id, type, quantity);
  if (r.error) return res.status(404).json(r);
  res.json(store.getCart());
});

// DELETE /api/cart  — clear whole cart
router.delete("/", (req, res) => {
  store.clearCart();
  res.json(store.getCart());
});

// DELETE /api/cart/:type/:id — remove one line
router.delete("/:type/:id", (req, res) => {
  store.removeFromCart(req.params.id, req.params.type);
  res.json(store.getCart());
});

module.exports = router;
