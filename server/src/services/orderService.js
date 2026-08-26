const mongoose = require("mongoose");
const Order = require("../models/Order");
const Counter = require("../models/Counter");
const Product = require("../models/Product");
const LabTest = require("../models/LabTest");
const cartService = require("./cartService");
const couponService = require("./couponService");
const AppError = require("../utils/AppError");
const {
  FREE_DELIVERY_ABOVE_PAISE, DELIVERY_FEE_PAISE, MAX_CART_ITEM_QTY, ORDER_STATUS,
} = require("../config/constants");

const MODELS = { Product, LabTest };

// Resolves the catalog document behind a public { id, type } pair, exactly like
// cartService.loadRef — but here we also need the line's money fields, so we reach
// into the catalog directly rather than trusting anything the client sent.
async function resolveLine(refId, refModel) {
  const doc = await MODELS[refModel].findOne({ id: refId });
  if (!doc) {
    throw new AppError(404, "ITEM_GONE", `The item "${refId}" is no longer available.`);
  }
  // LabTest has neither field, so it is always in stock and never prescription-gated.
  const inStock = doc.inStock === undefined ? true : Boolean(doc.inStock);
  if (!inStock) {
    // cartService keeps out-of-stock lines (flagged) so the shopper can see them and
    // remove them; checkout is the one place that must refuse to sell something gone.
    throw new AppError(409, "ITEM_OUT_OF_STOCK", `"${doc.name}" is out of stock.`);
  }
  return {
    refId: doc.id,
    refModel,
    name: doc.name,
    brand: doc.brand || "",
    image: doc.image || "",
    packSize: doc.packSize || "",
    pricePaise: doc.pricePaise,
    mrpPaise: doc.mrpPaise || doc.pricePaise,
    prescriptionRequired: Boolean(doc.prescriptionRequired),
  };
}

// Builds the server-authoritative order lines from the cart owner's current cart.
// Quantity comes from the cart; price/mrp come from the catalog now. This is the
// structural guarantee: the client cannot influence what anything costs.
async function buildLinesFromCart(owner) {
  const cart = await cartService.getOrCreateCart(owner);
  if (!cart.items.length) {
    throw new AppError(400, "CART_EMPTY", "Your cart is empty.");
  }
  const lines = [];
  for (const item of cart.items) {
    const resolved = await resolveLine(item.refId, item.refModel);
    const quantity = Math.min(item.quantity, MAX_CART_ITEM_QTY);
    lines.push({
      ...resolved,
      quantity,
      lineTotalPaise: resolved.pricePaise * quantity,
    });
  }
  return { lines, cart };
}

function computeTotals(lines, couponDiscountPaise) {
  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  const mrpTotalPaise = lines.reduce((s, l) => s + l.mrpPaise * l.quantity, 0);
  const savingsPaise = Math.max(0, mrpTotalPaise - subtotalPaise);
  const hasOnlyLabTests = lines.length > 0 && lines.every((l) => l.refModel === "LabTest");
  const afterCoupon = Math.max(0, subtotalPaise - couponDiscountPaise);
  const deliveryFeePaise =
    hasOnlyLabTests || afterCoupon >= FREE_DELIVERY_ABOVE_PAISE ? 0 : DELIVERY_FEE_PAISE;
  const totalPaise = afterCoupon + deliveryFeePaise;
  return { subtotalPaise, mrpTotalPaise, savingsPaise, deliveryFeePaise, totalPaise };
}

// The one entry point for placing an order. owner = { userId } | { guestId }.
// Returns the created Order (Mongoose doc).
async function placeOrder(owner, { address, paymentMethod = "cod", couponCode = null } = {}) {
  if (!address || !address.name || !address.phone || !address.pincode) {
    throw new AppError(422, "BAD_ADDRESS", "A delivery name, phone and pincode are required.");
  }

  // 1. Resolve and price every line server-side, refusing anything out of stock.
  const { lines, cart } = await buildLinesFromCart(owner);

  // 2. Validate any coupon against the *computed* subtotal, never a client value.
  let couponDiscountPaise = 0;
  if (couponCode) {
    const c = await couponService.validateCoupon(couponCode, /* subtotal */ lines.reduce((s, l) => s + l.lineTotalPaise, 0));
    if (!c.valid) {
      throw new AppError(422, c.code || "COUPON_INVALID", c.message || "That coupon can't be applied.");
    }
    couponDiscountPaise = c.discountPaise;
  }

  // 3. Totals from the lines we just built.
  const totals = computeTotals(lines, couponDiscountPaise);

  // 4. Atomic: generate the order number and write the order in one session so a
  //    crash mid-write cannot both burn a sequence and lose the order.
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const seq = await Counter.getNextSequence("orders", session);
      const orderNumber = `SO-${String(seq).padStart(6, "0")}`;
      order = await Order.create(
        [{
          orderNumber,
          userId: owner.userId || null,
          items: lines,
          address: {
            name: address.name,
            phone: address.phone,
            line1: address.line1 || "",
            line2: address.line2 || "",
            city: address.city || "",
            state: address.state || "",
            pincode: address.pincode,
          },
          paymentMethod,
          couponCode: couponCode || null,
          couponDiscountPaise,
          ...totals,
          status: "PLACED",
          timeline: [{ stage: "PLACED", at: new Date() }],
        }],
        { session }
      );
      // Empty the cart only after the order is durably written.
      await cartService.clearCart(owner);
    });
  } finally {
    await session.endSession();
  }

  return Array.isArray(order) ? order[0] : order;
}

// Fetches one order, ensuring it belongs to the requesting owner when a userId is
// supplied. Guests (no userId) can only see orders they hold the id for directly.
async function getOrder(orderId, userId) {
  const filter = { _id: orderId };
  if (userId) filter.userId = userId;
  const order = await Order.findOne(filter);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "That order doesn't exist.");
  return order;
}

// Admin / account listing. userId-scoped when provided.
async function listOrders(userId) {
  const filter = userId ? { userId } : {};
  return Order.find(filter).sort({ createdAt: -1 });
}

// Moves an order to CANCELLED with a reason. Only PLACED/CONFIRMED orders can be
// cancelled by this path; later stages require a return flow (out of P0 scope).
async function cancelOrder(orderId, userId, reason = null) {
  const order = await getOrder(orderId, userId);
  if (!["PLACED", "CONFIRMED"].includes(order.status)) {
    throw new AppError(409, "CANCEL_NOT_ALLOWED",
      "This order can no longer be cancelled online.");
  }
  order.status = "CANCELLED";
  order.cancelledAt = new Date();
  order.cancelReason = reason;
  await order.save();
  return order;
}

module.exports = {
  placeOrder, getOrder, listOrders, cancelOrder, computeTotals,
};
