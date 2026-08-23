// In-memory application state: cart, orders, consultations, prescriptions.
// Resets when the server restarts (no DB by design for this build).
const { medicines } = require("../data/medicines");
const { supplements } = require("../data/supplements");
const { labTests } = require("../data/labTests");
const { doctors } = require("../data/doctors");
const { coupons } = require("../data/content");

const FREE_DELIVERY_ABOVE = 499;
const DELIVERY_FEE = 40;

const ORDER_STAGES = ["Order Placed", "Verified", "Packed", "Out for Delivery", "Delivered"];
const STAGE_OFFSETS_MIN = [0, 2, 6, 12, 25]; // minutes after placedAt

let cart = [];
let orders = [];
let consultations = [];
let prescriptions = [];
let orderSeq = 481200;
let consultSeq = 90200;

// ---------- helpers ----------
function findItem(id, type) {
  if (type === "medicine") return medicines.find((m) => m.id === id);
  if (type === "supplement") return supplements.find((s) => s.id === id);
  if (type === "labTest") return labTests.find((l) => l.id === id);
  return [...medicines, ...supplements, ...labTests].find((x) => x.id === id);
}

function lineSnapshot(item, type, quantity) {
  return {
    id: item.id,
    type: type || item.type,
    name: item.name,
    brand: item.brand || "",
    price: item.price,
    originalPrice: item.originalPrice || item.price,
    image: item.image || "",
    prescriptionRequired: !!item.prescriptionRequired,
    testCount: item.testCount,
    quantity,
  };
}

function cartTotals(items) {
  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0);
  const mrpTotal = items.reduce((a, i) => a + (i.originalPrice || i.price) * i.quantity, 0);
  const itemCount = items.reduce((a, i) => a + i.quantity, 0);
  return { subtotal, mrpTotal, savings: mrpTotal - subtotal, itemCount };
}

// ---------- cart ----------
function getCart() {
  return { items: cart, ...cartTotals(cart) };
}

function addToCart(id, type, quantity = 1) {
  const item = findItem(id, type);
  if (!item) return { error: "Item not found" };
  const qty = Math.max(1, Number(quantity) || 1);
  const idx = cart.findIndex((c) => c.id === id && c.type === (type || item.type));
  if (idx > -1) {
    cart[idx].quantity += qty;
  } else {
    cart.push(lineSnapshot(item, type, qty));
  }
  return { ok: true };
}

function updateCart(id, type, quantity) {
  const qty = Number(quantity);
  const idx = cart.findIndex((c) => c.id === id && c.type === type);
  if (idx === -1) return { error: "Item not in cart" };
  if (qty <= 0) {
    cart.splice(idx, 1);
  } else {
    cart[idx].quantity = qty;
  }
  return { ok: true };
}

function removeFromCart(id, type) {
  cart = cart.filter((c) => !(c.id === id && c.type === type));
  return { ok: true };
}

function clearCart() {
  cart = [];
  return { ok: true };
}

// ---------- coupons ----------
function validateCoupon(code, subtotal = 0) {
  const c = coupons.find((x) => x.code.toUpperCase() === String(code || "").trim().toUpperCase());
  if (!c) return { valid: false, message: "That coupon code isn't valid." };
  if (subtotal < c.minOrder) {
    return { valid: false, message: `Add ₹${c.minOrder - subtotal} more to use ${c.code}.` };
  }
  let discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  return {
    valid: true,
    code: c.code,
    discount,
    description: c.description,
    message: `${c.code} applied — you saved ₹${discount}.`,
  };
}

// ---------- orders ----------
function computeTracker(order) {
  const elapsedMin = (Date.now() - new Date(order.placedAt).getTime()) / 60000;
  let stageIndex = 0;
  STAGE_OFFSETS_MIN.forEach((off, i) => {
    if (elapsedMin >= off) stageIndex = i;
  });
  const base = new Date(order.placedAt).getTime();
  const timeline = ORDER_STAGES.map((label, i) => ({
    label,
    at: new Date(base + STAGE_OFFSETS_MIN[i] * 60000).toISOString(),
    done: i <= stageIndex,
    current: i === stageIndex,
  }));
  return { ...order, status: ORDER_STAGES[stageIndex], stageIndex, timeline };
}

function createOrder({ items, address, paymentMethod, couponCode }) {
  const lines = (items || []).map((i) => ({
    id: i.id, type: i.type, name: i.name, brand: i.brand || "",
    price: i.price, originalPrice: i.originalPrice || i.price,
    image: i.image || "", quantity: i.quantity || 1,
  }));
  const { subtotal, savings } = cartTotals(lines);
  const coupon = couponCode ? validateCoupon(couponCode, subtotal) : { valid: false };
  const couponDiscount = coupon.valid ? coupon.discount : 0;
  const hasOnlyLabTests = lines.length > 0 && lines.every((l) => l.type === "labTest");
  const deliveryFee = hasOnlyLabTests || subtotal - couponDiscount >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  const total = Math.max(0, subtotal - couponDiscount + deliveryFee);

  orderSeq += 1;
  const order = {
    id: `SO-${orderSeq}`,
    items: lines,
    address: address || null,
    paymentMethod: paymentMethod || "Cash on Delivery",
    coupon: coupon.valid ? { code: coupon.code, discount: couponDiscount } : null,
    subtotal, mrpSavings: savings, couponDiscount, deliveryFee, total,
    placedAt: new Date().toISOString(),
    eta: "Arriving in 30–90 minutes",
  };
  orders.unshift(order);
  return computeTracker(order);
}

function getOrder(id) {
  const o = orders.find((x) => x.id === id);
  return o ? computeTracker(o) : null;
}

function listOrders() {
  return orders.map(computeTracker);
}

// ---------- consultations ----------
function bookConsultation({ doctorId, date, slot, patientName, mode, concern }) {
  const doctor = doctors.find((d) => d.id === doctorId);
  if (!doctor) return { error: "Doctor not found" };
  consultSeq += 1;
  const booking = {
    id: `CON-${consultSeq}`,
    doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty, image: doctor.image },
    date: date || null,
    slot: slot || null,
    mode: mode || "Video consult",
    patientName: patientName || "Guest",
    concern: concern || "",
    fee: doctor.consultationFee,
    status: "Confirmed",
    bookedAt: new Date().toISOString(),
  };
  consultations.unshift(booking);
  return booking;
}

function listConsultations() {
  return consultations;
}

// ---------- prescriptions ----------
function addPrescription(p) {
  const record = { id: `RX-${Date.now()}`, ...p, status: "Under pharmacist review", uploadedAt: new Date().toISOString() };
  prescriptions.unshift(record);
  return record;
}

function listPrescriptions() {
  return prescriptions;
}

// ---------- flash sale ----------
function flashSaleEndsAt() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 0);
  if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
  return end.toISOString();
}

// ---------- seed a couple of past orders so /orders isn't empty ----------
(function seedOrders() {
  const m = medicines[0], s = supplements[2], lt = labTests[0];
  const mkPast = (min) => new Date(Date.now() - min * 60000).toISOString();

  orderSeq += 1;
  orders.push({
    id: `SO-${orderSeq}`,
    items: [
      { id: m.id, type: "medicine", name: m.name, brand: m.brand, price: m.price, originalPrice: m.originalPrice, image: m.image, quantity: 2 },
      { id: s.id, type: "supplement", name: s.name, brand: s.brand, price: s.price, originalPrice: s.originalPrice, image: s.image, quantity: 1 },
    ],
    address: { name: "Subhasis", line1: "12 Park Street", city: "Kolkata", pincode: "700016", phone: "+91 98300 00000" },
    paymentMethod: "UPI",
    coupon: { code: "FIRST20", discount: 56 },
    subtotal: 280, mrpSavings: 90, couponDiscount: 56, deliveryFee: 40, total: 264,
    placedAt: mkPast(9), // in transit
    eta: "Arriving today",
  });

  orderSeq += 1;
  orders.push({
    id: `SO-${orderSeq}`,
    items: [
      { id: lt.id, type: "labTest", name: lt.name, brand: "SubhOne Labs", price: lt.price, originalPrice: lt.originalPrice, image: "", quantity: 1 },
    ],
    address: { name: "Subhasis", line1: "12 Park Street", city: "Kolkata", pincode: "700016", phone: "+91 98300 00000" },
    paymentMethod: "Cash on Delivery",
    coupon: null,
    subtotal: 1499, mrpSavings: 1500, couponDiscount: 0, deliveryFee: 0, total: 1499,
    placedAt: mkPast(120), // delivered
    eta: "Completed",
  });
})();

module.exports = {
  findItem,
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  clearCart,
  validateCoupon,
  createOrder,
  getOrder,
  listOrders,
  bookConsultation,
  listConsultations,
  addPrescription,
  listPrescriptions,
  flashSaleEndsAt,
};
