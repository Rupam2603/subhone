const express = require("express");
const { z } = require("zod");
const router = express.Router();

const cartService = require("../services/cartService");
const attachCartOwner = require("../middleware/attachCartOwner");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const { MAX_CART_ITEM_QTY } = require("../config/constants");

// Every route below needs an owner; cartService refuses to guess one.
router.use(attachCartOwner);

const ITEM_TYPES = ["medicine", "supplement", "labTest"];

// zod objects strip unknown keys, so a client that posts a `price` alongside its
// item has that field discarded before cartService ever sees the body. Pricing is
// resolved from the catalog regardless — this is the belt to that braces.
const addBody = z.object({
  id: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  quantity: z.coerce.number().int().min(1).max(MAX_CART_ITEM_QTY).default(1),
});

const updateBody = z.object({
  id: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  // min(0), unlike addBody: zero is how the client says "remove this line".
  quantity: z.coerce.number().int().min(0).max(MAX_CART_ITEM_QTY),
});

// Every handler answers with the whole cart summary, which is what the frozen
// CartContext.jsx replaces its state with after each call.

// GET /api/cart
router.get("/", asyncHandler(async (req, res) =>
  res.json(await cartService.summarise(await cartService.getOrCreateCart(req.cartOwner)))));

// POST /api/cart/add  { id, type, quantity }
router.post("/add", validate({ body: addBody }), asyncHandler(async (req, res) =>
  res.json(await cartService.addItem(req.cartOwner, req.body))));

// PUT /api/cart/update  { id, type, quantity }  — quantity 0 removes the line
router.put("/update", validate({ body: updateBody }), asyncHandler(async (req, res) =>
  res.json(await cartService.updateItem(req.cartOwner, req.body))));

// DELETE /api/cart — clear whole cart. Declared ahead of the parameterised route
// below so clearing is never captured by it.
router.delete("/", asyncHandler(async (req, res) =>
  res.json(await cartService.clearCart(req.cartOwner))));

// DELETE /api/cart/:type/:id — remove one line
router.delete("/:type/:id",
  validate({ params: z.object({ type: z.enum(ITEM_TYPES), id: z.string().min(1) }) }),
  asyncHandler(async (req, res) =>
    res.json(await cartService.removeItem(req.cartOwner, req.params))));

module.exports = router;
