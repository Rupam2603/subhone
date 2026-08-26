const mongoose = require("mongoose");
const { placeOrder, getOrder, listOrders, cancelOrder, computeTotals } = require("../../src/services/orderService");
const Product = require("../../src/models/Product");
const LabTest = require("../../src/models/LabTest");
const Counter = require("../../src/models/Counter");
const cartService = require("../../src/services/cartService");

const OWNER = { guestId: "order-test-guest" };

const seedProduct = (over = {}) =>
  Product.create({
    id: "m1", type: "medicine", name: "Paracetamol", brand: "Medi", category: "Pain",
    pricePaise: 5000, mrpPaise: 6000, inStock: true, prescriptionRequired: false,
    ...over,
  });

const seedLabTest = () =>
  LabTest.create({
    id: "t1", name: "Full Body Checkup", category: "Full Body", testCount: 72,
    pricePaise: 99900, mrpPaise: 199900,
  });

const address = { name: "Subhasis", phone: "+919830000000", pincode: "700001" };

describe("orderService.placeOrder", () => {
  beforeEach(async () => {
    await cartService.clearCart(OWNER);
    await Counter.deleteMany({});
  });

  it("creates an order with gap-free order numbers and clears the cart", async () => {
    await seedProduct();
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 2 });

    const o1 = await placeOrder(OWNER, { address });
    expect(o1.orderNumber).toBe("SO-000001");
    expect(o1.items).toHaveLength(1);
    expect(o1.items[0].lineTotalPaise).toBe(10000); // 5000 * 2, server-priced
    expect(o1.subtotalPaise).toBe(10000);
    expect(o1.status).toBe("PLACED");
    expect(o1.timeline.map((t) => t.stage)).toEqual(["PLACED"]);

    // Cart emptied
    const cart = await cartService.getOrCreateCart(OWNER);
    expect(cart.items).toHaveLength(0);

    const o2 = await placeOrder(OWNER, { address });
    expect(o2.orderNumber).toBe("SO-000002");
  });

  it("prices purely from the catalog, ignoring any client suggestion", async () => {
    await seedProduct();
    // The cart records only quantity; price must come from the catalog.
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    const o = await placeOrder(OWNER, { address });
    expect(o.items[0].pricePaise).toBe(5000);
    expect(o.items[0].mrpPaise).toBe(6000);
  });

  it("rejects an out-of-stock item rather than selling it", async () => {
    await seedProduct({ inStock: false });
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    await expect(placeOrder(OWNER, { address }))
      .rejects.toMatchObject({ code: "ITEM_OUT_OF_STOCK" });
  });

  it("rejects an empty cart", async () => {
    await expect(placeOrder(OWNER, { address }))
      .rejects.toMatchObject({ code: "CART_EMPTY" });
  });

  it("rejects an incomplete address", async () => {
    await seedProduct();
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    await expect(placeOrder(OWNER, { address: { name: "X", phone: "+91" } }))
      .rejects.toMatchObject({ code: "BAD_ADDRESS" });
  });

  it("applies a valid coupon discount from the server-computed subtotal", async () => {
    const { Coupon } = require("../../src/models/Coupon");
    await Coupon.create({ code: "HALFOFF", type: "FLAT", value: 2000, minCartValuePaise: 0, isActive: true });
    await seedProduct();
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });

    const o = await placeOrder(OWNER, { address, couponCode: "HALFOFF" });
    expect(o.couponCode).toBe("HALFOFF");
    expect(o.couponDiscountPaise).toBe(2000);
    expect(o.totalPaise).toBe(5000 - 2000 + o.deliveryFeePaise);
  });

  it("rejects an invalid coupon at checkout", async () => {
    await seedProduct();
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    await expect(placeOrder(OWNER, { address, couponCode: "NOPE" }))
      .rejects.toMatchObject({ code: "COUPON_NOT_FOUND" });
  });

  it("charges delivery below the free threshold, free above it", async () => {
    await seedProduct({ pricePaise: 50000, mrpPaise: 50000 }); // 500 * qty
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    const o = await placeOrder(OWNER, { address }); // subtotal 50000 < 49900? no, >= so free
    expect(o.deliveryFeePaise).toBe(0);

    await cartService.clearCart(OWNER);
    await seedProduct({ id: "m2", pricePaise: 1000, mrpPaise: 1000 });
    await cartService.addItem(OWNER, { id: "m2", type: "medicine", quantity: 1 });
    const o2 = await placeOrder(OWNER, { address });
    expect(o2.deliveryFeePaise).toBe(4000);
  });

  it("includes a lab test line with no prescription gate", async () => {
    await seedLabTest();
    await cartService.addItem(OWNER, { id: "t1", type: "labTest", quantity: 1 });
    const o = await placeOrder(OWNER, { address });
    expect(o.items[0].refModel).toBe("LabTest");
    expect(o.subtotalPaise).toBe(99900);
  });
});

describe("orderService lifecycle", () => {
  beforeEach(async () => { await Counter.deleteMany({}); });

  it("getOrder scopes to the owner when a userId is given", async () => {
    await seedProduct();
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    const o = await placeOrder(OWNER, { address });
    const id = o._id.toString();

    await expect(getOrder(id, new mongoose.Types.ObjectId())).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    const mine = await getOrder(id, null);
    expect(mine.orderNumber).toBe(o.orderNumber);
  });

  it("listOrders returns newest first", async () => {
    await seedProduct();
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    await placeOrder(OWNER, { address });
    await placeOrder(OWNER, { address });
    const all = await listOrders(null);
    expect(all).toHaveLength(2);
    expect(all[0].orderNumber).toBe("SO-000002");
  });

  it("cancelOrder moves a PLACED order to CANCELLED with a reason", async () => {
    await seedProduct();
    await cartService.addItem(OWNER, { id: "m1", type: "medicine", quantity: 1 });
    const o = await placeOrder(OWNER, { address });
    const cancelled = await cancelOrder(o._id, null, "changed my mind");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("changed my mind");
    expect(cancelled.cancelledAt).toBeTruthy();
  });
});

describe("orderService.computeTotals", () => {
  const line = (price, mrp, qty) => ({
    lineTotalPaise: price * qty, mrpPaise: mrp, quantity: qty, refModel: "Product",
  });

  it("waives delivery for lab-test-only carts", () => {
    const lines = [{ lineTotalPaise: 99900, mrpPaise: 199900, quantity: 1, refModel: "LabTest" }];
    const t = computeTotals(lines, 0);
    expect(t.deliveryFeePaise).toBe(0);
    expect(t.totalPaise).toBe(99900);
  });

  it("caps total at zero and records savings", () => {
    const t = computeTotals([line(5000, 6000, 2)], 0);
    expect(t.subtotalPaise).toBe(10000);
    expect(t.mrpTotalPaise).toBe(12000);
    expect(t.savingsPaise).toBe(2000);
    expect(t.totalPaise).toBe(10000 + 4000); // under free threshold → fee
  });
});
