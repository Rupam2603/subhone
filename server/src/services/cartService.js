const Cart = require("../models/Cart");
const Product = require("../models/Product");
const LabTest = require("../models/LabTest");
const AppError = require("../utils/AppError");
const {
  TYPE_MAP, MAX_CART_ITEM_QTY, FREE_DELIVERY_ABOVE_PAISE, DELIVERY_FEE_PAISE,
} = require("../config/constants");
// A deployment tunable, not a business constant — it lives in env, not constants.
// Read per call, matching tokenService, so tests can set the environment up first.
const { loadEnv } = require("../config/env");

const MODELS = { Product, LabTest };

// Public API type → internal (collection, catalog `type` value). hasOwnProperty
// rather than a bare lookup: `type` arrives from a request body, and
// TYPE_MAP["constructor"] would otherwise answer with something truthy.
function resolveType(type) {
  if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(TYPE_MAP, type)) {
    throw new AppError(400, "BAD_TYPE", "That item type isn't recognised.");
  }
  return TYPE_MAP[type]; // { refModel, kind }
}

// Catalog ids are compared by equality, so coercing to a string here also disarms
// an object-valued `id` — `{ $ne: null }` becomes the harmless literal "[object Object]".
function catalogKey(id) {
  return String(id == null ? "" : id).trim();
}

function ownerFilter(owner = {}) {
  // A signed-in owner wins: once you have an account, the account's cart is yours.
  if (owner.userId) return { userId: owner.userId };
  if (owner.guestId) return { guestId: String(owner.guestId) };
  throw new AppError(400, "NO_CART_OWNER", "Could not identify your cart.");
}

function guestExpiry() {
  const { GUEST_CART_TTL_DAYS } = loadEnv();
  return new Date(Date.now() + GUEST_CART_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// Guest carts expire on a sliding window: an active shopper's cart should die
// GUEST_CART_TTL_DAYS after their last change, not after their first click.
async function saveCart(cart) {
  if (cart.guestId) cart.guestExpiresAt = guestExpiry();
  await cart.save();
  return cart;
}

async function getOrCreateCart(owner) {
  const filter = ownerFilter(owner);
  const existing = await Cart.findOne(filter);
  if (existing) return existing;
  try {
    return await Cart.create({
      ...filter,
      ...(filter.guestId ? { guestExpiresAt: guestExpiry() } : {}),
    });
  } catch (err) {
    // Two parallel requests from the same visitor can both miss the findOne above;
    // the unique partial index lets exactly one insert win. Re-read the winner
    // instead of turning a routine race into a 500.
    if (err && err.code === 11000) {
      const raced = await Cart.findOne(filter);
      if (raced) return raced;
    }
    throw err;
  }
}

const findLine = (cart, refId, refModel) =>
  cart.items.find((i) => i.refId === refId && i.refModel === refModel);

// Loads the catalog document behind a public { id, type } pair and asserts it is
// purchasable. This is the only gate on the way into a cart, so everything the
// caller sent other than id, type and quantity is discarded here by omission.
async function loadRef({ id, type }) {
  const { refModel, kind } = resolveType(type);
  const key = catalogKey(id);
  if (!key) throw new AppError(404, "ITEM_NOT_FOUND", "That item is no longer available.");

  // `inStock` is this catalog's only unavailability flag — Product has no isActive
  // column and no numeric stock level. LabTest has neither field, so a lab test is
  // always purchasable. Product also carries the medicine/supplement split in
  // `type`, which is checked so "m1 as a supplement" cannot smuggle in a mismatch.
  const query = refModel === "Product" ? { id: key, type: kind, inStock: true } : { id: key };
  const doc = await MODELS[refModel].findOne(query);
  if (!doc) throw new AppError(404, "ITEM_NOT_FOUND", "That item is no longer available.");
  return { doc, refModel };
}

function assertQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEM_QTY) {
    throw new AppError(422, "BAD_QUANTITY", `Choose a quantity between 1 and ${MAX_CART_ITEM_QTY}.`);
  }
}

async function addItem(owner, { id, type, quantity = 1 } = {}) {
  const { doc, refModel } = await loadRef({ id, type });
  const cart = await getOrCreateCart(owner);
  const line = findLine(cart, doc.id, refModel);
  // Adding something already in the cart raises that line rather than opening a
  // second one, and the cap applies to the running total, not to one request.
  const nextQty = (line ? line.quantity : 0) + Number(quantity);
  assertQuantity(nextQty);

  if (line) line.quantity = nextQty;
  else cart.items.push({ refId: doc.id, refModel, quantity: nextQty });
  await saveCart(cart);
  return summarise(cart);
}

// Sets an absolute quantity. Zero is the client's way of saying "remove".
async function updateItem(owner, { id, type, quantity } = {}) {
  if (Number(quantity) === 0) return removeItem(owner, { id, type });
  const { refModel } = resolveType(type);
  const qty = Number(quantity);
  assertQuantity(qty);
  const cart = await getOrCreateCart(owner);
  const line = findLine(cart, catalogKey(id), refModel);
  if (!line) throw new AppError(404, "NOT_IN_CART", "That item isn't in your cart.");
  // Deliberately no purchasability check here: the line already passed that gate
  // when it was added, and refusing to *lower* the quantity of something that has
  // since gone out of stock would trap the shopper with a line they cannot shrink.
  line.quantity = qty;
  await saveCart(cart);
  return summarise(cart);
}

// No catalog lookup: a line whose product has since been deleted must still be
// removable, so removal works purely off what is stored.
async function removeItem(owner, { id, type } = {}) {
  const { refModel } = resolveType(type);
  const key = catalogKey(id);
  const cart = await getOrCreateCart(owner);
  cart.items = cart.items.filter((i) => !(i.refId === key && i.refModel === refModel));
  await saveCart(cart);
  return summarise(cart);
}

async function clearCart(owner) {
  const cart = await getOrCreateCart(owner);
  cart.items = [];
  await saveCart(cart);
  return summarise(cart);
}

// Hydrates the stored references with live catalog data and computes the totals.
// This is where every rupee in the cart comes from; nothing is read back from the
// cart document except a reference and a quantity.
async function summarise(cart) {
  const lines = (cart && cart.items) || [];

  // One query per collection rather than one per line.
  const idsByModel = lines.reduce((acc, line) => {
    (acc[line.refModel] = acc[line.refModel] || []).push(line.refId);
    return acc;
  }, {});
  const catalog = new Map();
  await Promise.all(
    Object.entries(idsByModel).map(async ([refModel, ids]) => {
      const found = await MODELS[refModel].find({ id: { $in: ids } });
      found.forEach((doc) => catalog.set(`${refModel}:${doc.id}`, doc));
    })
  );

  const items = lines.reduce((acc, line) => {
    const doc = catalog.get(`${line.refModel}:${line.refId}`);
    // A reference to a catalog item that has since been deleted is not the
    // shopper's fault: drop the line from this read rather than failing the whole
    // cart. An item that merely went *out of stock* still exists and is kept
    // below, flagged, so checkout can refuse it instead of it silently vanishing.
    if (!doc) return acc;

    const pricePaise = doc.pricePaise;
    const mrpPaise = doc.mrpPaise || pricePaise;
    const lineTotalPaise = pricePaise * line.quantity;
    acc.push({
      id: doc.id,
      // Derived from the collection, not from doc.type, so the public contract
      // holds no matter what a seed happened to write.
      type: line.refModel === "LabTest" ? "labTest" : doc.type,
      name: doc.name,
      brand: doc.brand,
      image: doc.image,
      packSize: doc.packSize,
      quantity: line.quantity,
      // Legacy key names, now carrying paise — see the contract note below.
      price: pricePaise,
      originalPrice: mrpPaise,
      lineTotal: lineTotalPaise,
      // Explicit twins for code written after the paise migration.
      pricePaise,
      mrpPaise,
      lineTotalPaise,
      // LabTest has neither column, so a lab test is never prescription-gated and
      // always in stock.
      prescriptionRequired: Boolean(doc.prescriptionRequired),
      inStock: doc.inStock === undefined ? true : Boolean(doc.inStock),
    });
    return acc;
  }, []);

  const subtotalPaise = items.reduce((sum, i) => sum + i.lineTotalPaise, 0);
  const mrpTotalPaise = items.reduce((sum, i) => sum + i.mrpPaise * i.quantity, 0);
  const savingsPaise = Math.max(0, mrpTotalPaise - subtotalPaise);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  // An empty cart is never charged delivery — there is nothing to deliver.
  const deliveryFeePaise =
    subtotalPaise === 0 || subtotalPaise >= FREE_DELIVERY_ABOVE_PAISE ? 0 : DELIVERY_FEE_PAISE;
  const totalPaise = subtotalPaise + deliveryFeePaise;

  // The unprefixed keys below (`itemCount`, `subtotal`, `mrpTotal`, `savings`, and
  // `price`/`originalPrice` on each item) are the exact names CartContext.jsx and
  // CartDrawer.jsx already read, and those files are frozen. They now carry
  // *paise*. The `*Paise` twins exist so new code can be unambiguous. Renaming or
  // dropping a legacy key blanks the cart UI without any error to notice.
  return {
    items,
    itemCount,
    count: itemCount,
    subtotal: subtotalPaise,
    mrpTotal: mrpTotalPaise,
    savings: savingsPaise,
    deliveryFee: deliveryFeePaise,
    total: totalPaise,
    subtotalPaise,
    mrpTotalPaise,
    savingsPaise,
    deliveryFeePaise,
    totalPaise,
    freeDeliveryAbovePaise: FREE_DELIVERY_ABOVE_PAISE,
  };
}

// Folds a guest cart into the user's own on sign-in, then deletes the guest cart.
// Called by establishSession in routes/auth.js on every login, register and OTP
// verification, so it must tolerate there being nothing to merge.
async function mergeGuestCart({ guestId, userId } = {}) {
  // Mongoose strips undefined keys from a filter, so findOne({ guestId: undefined })
  // degenerates to findOne({}) and would hand whichever cart Mongo answered with to
  // whoever just signed in. The guard belongs with the query, not with the caller.
  if (!guestId || !userId) return null;

  const guestCart = await Cart.findOne({ guestId: String(guestId) });
  const userCart = await getOrCreateCart({ userId });
  if (!guestCart) return userCart;

  guestCart.items.forEach((gi) => {
    const line = findLine(userCart, gi.refId, gi.refModel);
    // Additive, not overwriting: the shopper deliberately chose both sets of items.
    // Purchasability is deliberately not re-checked — summarise flags anything that
    // has gone out of stock, and dropping items during a login would be baffling.
    if (line) line.quantity = Math.min(line.quantity + gi.quantity, MAX_CART_ITEM_QTY);
    else {
      userCart.items.push({
        refId: gi.refId, refModel: gi.refModel, quantity: gi.quantity, addedAt: gi.addedAt,
      });
    }
  });

  await saveCart(userCart);
  // Deleted unconditionally, so a stale guest cookie replayed later cannot merge
  // the same items a second time.
  await Cart.deleteOne({ _id: guestCart._id });
  return userCart;
}

module.exports = {
  getOrCreateCart, addItem, updateItem, removeItem, clearCart, summarise, mergeGuestCart,
};
