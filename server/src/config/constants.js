const FREE_DELIVERY_ABOVE_PAISE = 49900;
const DELIVERY_FEE_PAISE = 4000;
const MAX_CART_ITEM_QTY = 10;
const RUPEE = 100;

const ORDER_STATUS = [
  "PENDING_PAYMENT", "PLACED", "CONFIRMED", "PACKED", "DISPATCHED",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED",
];

// The stages a customer sees, in order. ORDER_STATUS additionally contains
// terminal and payment states that never appear as timeline steps.
const CUSTOMER_TIMELINE = ["PLACED", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];

// Public API item types → internal (model, kind) pair. Keeps Mongo names out of payloads.
const TYPE_MAP = {
  medicine: { refModel: "Product", kind: "medicine" },
  supplement: { refModel: "Product", kind: "supplement" },
  labTest: { refModel: "LabTest", kind: null },
};

module.exports = {
  FREE_DELIVERY_ABOVE_PAISE, DELIVERY_FEE_PAISE, MAX_CART_ITEM_QTY,
  RUPEE, ORDER_STATUS, CUSTOMER_TIMELINE, TYPE_MAP,
};
