// vitest runs with `globals: true` (see vitest.config.js), so describe/it/expect are
// already in scope. Never `require("vitest")` here — vitest refuses to be required
// from CommonJS and the whole file aborts before a single assertion runs.
const Product = require("../../src/models/Product");
const LabTest = require("../../src/models/LabTest");
const User = require("../../src/models/User");
const Cart = require("../../src/models/Cart");
const cartService = require("../../src/services/cartService");
const {
  FREE_DELIVERY_ABOVE_PAISE,
  DELIVERY_FEE_PAISE,
  MAX_CART_ITEM_QTY,
} = require("../../src/config/constants");

let med;
let supp;
let test1;
let user;

// tests/setup.js empties every collection after each case, so the catalog each test
// prices against has to be created here rather than seeded once.
beforeEach(async () => {
  med = await Product.create({
    id: "m1",
    type: "medicine",
    name: "Paracetamol 500",
    brand: "Acme",
    category: "Pain Relief",
    pricePaise: 3000,
    mrpPaise: 4000,
    prescriptionRequired: true,
    image: "/img/para.png",
  });
  supp = await Product.create({
    id: "s1",
    type: "supplement",
    name: "Whey Protein",
    brand: "Acme",
    category: "Protein",
    pricePaise: 250000,
    mrpPaise: 300000,
  });
  test1 = await LabTest.create({
    id: "t1",
    name: "Full Body Checkup",
    category: "Full Body",
    testCount: 72,
    pricePaise: 99900,
    mrpPaise: 199900,
  });
  user = await User.create({ name: "S", phone: "+919830000000" });
});

describe("cartService", () => {
  it("stores no price on the cart line", async () => {
    await cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 2 });
    const cart = await Cart.findOne({ userId: user._id });
    const line = cart.items[0].toObject();
    expect(line.quantity).toBe(2);
    expect(Object.keys(line).join(",")).not.toMatch(/price|mrp|total/i);
  });

  it("prices the cart from the catalog, ignoring anything the caller sends", async () => {
    await cartService.addItem(
      { userId: user._id },
      { id: med.id, type: "medicine", quantity: 2, pricePaise: 1, price: 1, mrpPaise: 1 }
    );
    const summary = await cartService.summarise(
      await cartService.getOrCreateCart({ userId: user._id })
    );
    expect(summary.items[0].pricePaise).toBe(3000);
    expect(summary.subtotalPaise).toBe(6000);
  });

  it("keeps the exact key names CartContext.jsx already reads", async () => {
    // CartContext.jsx and CartDrawer.jsx are frozen; they read these names.
    // Dropping or renaming any of them silently blanks the cart UI.
    await cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 2 });
    const s = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(s).toHaveProperty("itemCount", 2);
    expect(s).toHaveProperty("subtotal", 6000); // paise
    expect(s).toHaveProperty("mrpTotal", 8000);
    expect(s).toHaveProperty("savings", 2000);
    const item = s.items[0];
    expect(item.price).toBe(3000); // drawer reads item.price
    expect(item.originalPrice).toBe(4000); // drawer reads item.originalPrice
    expect(item.name).toBe("Paracetamol 500");
    expect(item.image).toBe("/img/para.png");
    expect(item.quantity).toBe(2);
    expect(item.id).toBe("m1"); // the public catalog id, never Mongo's _id
    expect(item.type).toBe("medicine");
    expect(item.refModel).toBeUndefined(); // internal names must not leak
    expect(item.refId).toBeUndefined();
    expect(item._id).toBeUndefined();
  });

  it("charges delivery below the threshold and waives it above", async () => {
    await cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 1 });
    let s = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(s.subtotalPaise).toBeLessThan(FREE_DELIVERY_ABOVE_PAISE);
    expect(s.deliveryFeePaise).toBe(DELIVERY_FEE_PAISE);
    expect(s.totalPaise).toBe(s.subtotalPaise + DELIVERY_FEE_PAISE);

    await cartService.addItem({ userId: user._id }, { id: supp.id, type: "supplement", quantity: 1 });
    s = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(s.subtotalPaise).toBeGreaterThanOrEqual(FREE_DELIVERY_ABOVE_PAISE);
    expect(s.deliveryFeePaise).toBe(0);
  });

  it("charges no delivery on an empty cart", async () => {
    const s = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(s.itemCount).toBe(0);
    expect(s.deliveryFeePaise).toBe(0);
    expect(s.totalPaise).toBe(0);
  });

  it("increments quantity instead of duplicating a line", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 1 });
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 2 });
    const cart = await cartService.getOrCreateCart(owner);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  it("caps quantity at MAX_CART_ITEM_QTY", async () => {
    await expect(
      cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 99 })
    ).rejects.toThrow(/quantity/i);
  });

  it("caps the running total, not just a single add", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: MAX_CART_ITEM_QTY });
    await expect(
      cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 1 })
    ).rejects.toThrow(/quantity/i);
  });

  it("rejects a non-integer or negative quantity", async () => {
    const owner = { userId: user._id };
    await expect(
      cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 1.5 })
    ).rejects.toThrow(/quantity/i);
    await expect(
      cartService.addItem(owner, { id: med.id, type: "medicine", quantity: -3 })
    ).rejects.toThrow(/quantity/i);
  });

  it("removes the line when quantity is set to zero", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 2 });
    await cartService.updateItem(owner, { id: med.id, type: "medicine", quantity: 0 });
    expect((await cartService.getOrCreateCart(owner)).items).toHaveLength(0);
  });

  it("sets an absolute quantity on update rather than adding to it", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 2 });
    const s = await cartService.updateItem(owner, { id: med.id, type: "medicine", quantity: 5 });
    expect(s.itemCount).toBe(5);
    expect(s.subtotalPaise).toBe(15000);
  });

  it("refuses to update a line that is not in the cart", async () => {
    await expect(
      cartService.updateItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 2 })
    ).rejects.toThrow(/isn't in your cart/i);
  });

  // The brief asserted these on /not available|not found/i, which its own message
  // ("That item is no longer available.") does not satisfy. The machine code is the
  // real contract anyway — the prose is free to be written for humans.
  async function expectUnavailable(promise) {
    let caught;
    try {
      await promise;
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.code).toBe("ITEM_NOT_FOUND");
    expect(caught.status).toBe(404);
  }

  it("rejects an unknown product", async () => {
    await expectUnavailable(
      cartService.addItem({ userId: user._id }, { id: "nope", type: "medicine", quantity: 1 })
    );
  });

  it("rejects an out-of-stock product", async () => {
    // `inStock: false` is this catalog's only unavailability flag — there is no
    // `isActive` field and no numeric stock count.
    await Product.updateOne({ _id: med._id }, { $set: { inStock: false } });
    await expectUnavailable(
      cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 1 })
    );
  });

  it("rejects a product asked for under the wrong type", async () => {
    await expectUnavailable(
      cartService.addItem({ userId: user._id }, { id: med.id, type: "supplement", quantity: 1 })
    );
  });

  it("rejects an id that is not a plain string", async () => {
    // A String()-coerced id turns an injected operator into a literal that matches
    // nothing, rather than into a query Mongo would honour.
    await expectUnavailable(
      cartService.addItem({ userId: user._id }, { id: { $ne: null }, type: "medicine", quantity: 1 })
    );
  });

  it("rejects an unrecognised item type", async () => {
    await expect(
      cartService.addItem({ userId: user._id }, { id: med.id, type: "tractor", quantity: 1 })
    ).rejects.toThrow(/recognised/i);
  });

  it("refuses to act without a cart owner", async () => {
    await expect(cartService.getOrCreateCart({})).rejects.toThrow(/identify your cart/i);
  });

  it("prices lab tests and treats them as always available", async () => {
    // LabTest has neither `inStock` nor `prescriptionRequired`; both are synthesised.
    const s = await cartService.addItem(
      { userId: user._id },
      { id: test1.id, type: "labTest", quantity: 1 }
    );
    expect(s.items[0].id).toBe("t1");
    expect(s.items[0].type).toBe("labTest");
    expect(s.items[0].pricePaise).toBe(99900);
    expect(s.items[0].inStock).toBe(true);
    expect(s.items[0].prescriptionRequired).toBe(false);
    expect(s.subtotalPaise).toBe(99900);
    expect(s.savingsPaise).toBe(100000);
  });

  it("surfaces prescriptionRequired from the catalog, not from the caller", async () => {
    const s = await cartService.addItem(
      { userId: user._id },
      { id: med.id, type: "medicine", quantity: 1, prescriptionRequired: false }
    );
    expect(s.items[0].prescriptionRequired).toBe(true);
  });

  it("keeps a line that has gone out of stock but flags it", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 2 });
    await Product.updateOne({ _id: med._id }, { $set: { inStock: false } });
    const s = await cartService.summarise(await cartService.getOrCreateCart(owner));
    expect(s.items).toHaveLength(1);
    expect(s.items[0].inStock).toBe(false);
    expect(s.itemCount).toBe(2);
  });

  it("drops a line whose catalog item has been deleted instead of failing the read", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 2 });
    await cartService.addItem(owner, { id: supp.id, type: "supplement", quantity: 1 });
    await Product.deleteOne({ _id: med._id });
    const s = await cartService.summarise(await cartService.getOrCreateCart(owner));
    expect(s.items).toHaveLength(1);
    expect(s.items[0].id).toBe("s1");
    expect(s.subtotalPaise).toBe(250000);
  });

  it("removes only the line matching both id and type", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 1 });
    await cartService.addItem(owner, { id: supp.id, type: "supplement", quantity: 1 });
    const s = await cartService.removeItem(owner, { id: med.id, type: "medicine" });
    expect(s.items).toHaveLength(1);
    expect(s.items[0].id).toBe("s1");
  });

  it("clears the whole cart", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 2 });
    const s = await cartService.clearCart(owner);
    expect(s.items).toHaveLength(0);
    expect(s.itemCount).toBe(0);
    expect(s.subtotal).toBe(0);
    expect(s.total).toBe(0);
  });

  it("keeps guest and user carts separate", async () => {
    await cartService.addItem({ guestId: "guest-1" }, { id: med.id, type: "medicine", quantity: 1 });
    await cartService.addItem({ userId: user._id }, { id: supp.id, type: "supplement", quantity: 1 });
    expect((await cartService.getOrCreateCart({ guestId: "guest-1" })).items).toHaveLength(1);
    expect((await cartService.getOrCreateCart({ userId: user._id })).items).toHaveLength(1);
  });

  it("reuses one cart per owner instead of creating a second", async () => {
    const owner = { guestId: "guest-1" };
    const a = await cartService.getOrCreateCart(owner);
    const b = await cartService.getOrCreateCart(owner);
    expect(String(a._id)).toBe(String(b._id));
    expect(await Cart.countDocuments({ guestId: "guest-1" })).toBe(1);
  });

  it("sets a TTL only on guest carts", async () => {
    await cartService.addItem({ guestId: "guest-1" }, { id: med.id, type: "medicine", quantity: 1 });
    await cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 1 });
    expect((await Cart.findOne({ guestId: "guest-1" })).guestExpiresAt).toBeTruthy();
    expect((await Cart.findOne({ userId: user._id })).guestExpiresAt).toBeFalsy();
  });

  it("pushes a guest cart's expiry back on every change", async () => {
    const owner = { guestId: "guest-1" };
    const created = await cartService.getOrCreateCart(owner);
    await Cart.updateOne({ _id: created._id }, { $set: { guestExpiresAt: new Date(1000) } });
    await cartService.addItem(owner, { id: med.id, type: "medicine", quantity: 1 });
    const after = await Cart.findOne({ guestId: "guest-1" });
    expect(after.guestExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("merges a guest cart by summing overlapping lines, then deletes it", async () => {
    await cartService.addItem({ guestId: "g" }, { id: med.id, type: "medicine", quantity: 2 });
    await cartService.addItem({ guestId: "g" }, { id: supp.id, type: "supplement", quantity: 1 });
    await cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 1 });

    const merged = await cartService.mergeGuestCart({ guestId: "g", userId: user._id });
    const byId = Object.fromEntries(merged.items.map((i) => [String(i.refId), i.quantity]));
    expect(byId.m1).toBe(3);
    expect(byId.s1).toBe(1);
    expect(await Cart.findOne({ guestId: "g" })).toBeNull();
  });

  it("clamps a merged quantity to the per-item cap", async () => {
    await cartService.addItem({ guestId: "g" }, { id: med.id, type: "medicine", quantity: 8 });
    await cartService.addItem({ userId: user._id }, { id: med.id, type: "medicine", quantity: 8 });
    const merged = await cartService.mergeGuestCart({ guestId: "g", userId: user._id });
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0].quantity).toBe(MAX_CART_ITEM_QTY);
  });

  it("drops the guest cart's TTL once it belongs to a signed-in user", async () => {
    await cartService.addItem({ guestId: "g" }, { id: med.id, type: "medicine", quantity: 1 });
    await cartService.mergeGuestCart({ guestId: "g", userId: user._id });
    const userCart = await Cart.findOne({ userId: user._id });
    expect(userCart.items).toHaveLength(1);
    expect(userCart.guestExpiresAt).toBeFalsy();
  });

  it("is a no-op when the guest has no cart", async () => {
    await expect(
      cartService.mergeGuestCart({ guestId: "nope", userId: user._id })
    ).resolves.toBeTruthy();
  });

  it("never adopts an arbitrary cart when no guestId is given", async () => {
    // `Cart.findOne({ guestId: undefined })` degenerates to `findOne({})` in Mongoose
    // and would hand a stranger's cart to whoever just signed in.
    const other = await User.create({ name: "Other", email: "other@example.com" });
    await cartService.addItem({ userId: other._id }, { id: supp.id, type: "supplement", quantity: 1 });
    await cartService.mergeGuestCart({ userId: user._id });
    const mine = await Cart.findOne({ userId: user._id });
    expect(mine === null || mine.items.length === 0).toBe(true);
    expect((await Cart.findOne({ userId: other._id })).items).toHaveLength(1);
  });
});
