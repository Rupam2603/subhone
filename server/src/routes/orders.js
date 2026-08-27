const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../utils/asyncHandler");
const orderService = require("../services/orderService");
const { CUSTOMER_TIMELINE } = require("../config/constants");

// Friendly labels for the customer-facing timeline stages. Falls back to the raw
// stage constant if a stage has no explicit label (defensive — CUSTOMER_TIMELINE
// is the single source of truth for the ordered stage list).
const STAGE_LABELS = {
  PENDING_PAYMENT: "Pending payment",
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

// Transforms a Mongoose Order doc into the shape client/src/pages/Orders.jsx
// already consumes. Prices are PAISE — the client (Task 18) formats them; do
// not divide by 100 here.
function toClient(order) {
  const lastIdx = order.timeline && order.timeline.length ? order.timeline.length - 1 : -1;
  return {
    id: order.orderNumber, // "SO-000123" — client shows order.id
    placedAt: order.createdAt.toISOString(),
    status: order.status,
    eta: order.timeline && order.timeline.length
      ? order.timeline[lastIdx].at.toISOString()
      : null,
    items: order.items.map((l) => ({
      type: l.refModel === "LabTest" ? "labTest" : "medicine",
      id: l.refId,
      name: l.name,
      quantity: l.quantity,
      price: l.pricePaise,
    })),
    total: order.totalPaise,
    timeline: CUSTOMER_TIMELINE.map((stage) => {
      const idx = order.timeline && order.timeline.length
        ? order.timeline.findIndex((t) => t.stage === stage)
        : -1;
      return {
        label: STAGE_LABELS[stage] || stage,
        done: idx !== -1,
        current: idx !== -1 && idx === lastIdx,
      };
    }),
  };
}

// Every orders route is account-scoped.
router.use(requireAuth);

// GET /api/orders — order history for the caller
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orders = await orderService.listOrders(req.user._id);
    res.json(orders.map(toClient));
  })
);

// GET /api/orders/:id — single order, owned by the caller
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.id, req.user._id);
    res.json(toClient(order));
  })
);

module.exports = router;
