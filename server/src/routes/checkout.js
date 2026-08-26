const express = require("express");
const { z } = require("zod");
const router = express.Router();

const orderService = require("../services/orderService");
const attachCartOwner = require("../middleware/attachCartOwner");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const { sendOrderNotification } = require("../services/emailService");

// Every checkout needs an owner; orderService refuses to guess one.
router.use(attachCartOwner);

const addressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().min(1, "Pincode is required"),
});

const checkoutBody = z.object({
  address: addressSchema,
  paymentMethod: z.string().min(1).default("cod"),
  couponCode: z.string().optional(),
});

// POST /api/checkout  { address, paymentMethod?, couponCode? }
// Always prices from the server-side cart — the client cannot specify items or
// prices. Out-of-stock lines in the cart make this 409; the caller must remove them.
router.post("/", validate({ body: checkoutBody }), asyncHandler(async (req, res) => {
  const order = await orderService.placeOrder(req.cartOwner, {
    address: req.body.address,
    paymentMethod: req.body.paymentMethod,
    couponCode: req.body.couponCode || null,
  });

  // Fire-and-forget: a mail failure must not roll back a placed order.
  sendOrderNotification(order).catch((err) =>
    console.error("Background order email failed:", err.message));

  return res.status(201).json(order);
}));

module.exports = router;
