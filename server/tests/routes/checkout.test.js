const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const LabTest = require("../../src/models/LabTest");
const Counter = require("../../src/models/Counter");
const cartService = require("../../src/services/cartService");

const OWNER = { guestId: "checkout-route-guest" };
const address = { name: "Subhasis", phone: "+919830000000", pincode: "700001" };

const guestCookie = (res) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith("so_gid="));
  return raw ? raw.split(";")[0] : null;
};

describe("POST /api/checkout", () => {
  beforeEach(async () => {
    await cartService.clearCart(OWNER);
    await Counter.deleteMany({});
    await Product.deleteMany({});
  });

  it("places an order from the server-side cart and returns 201", async () => {
    await Product.create({
      id: "m1", type: "medicine", name: "Paracetamol", brand: "Medi", category: "Pain",
      pricePaise: 5000, mrpPaise: 6000, inStock: true, prescriptionRequired: false,
    });
    // Seed the guest cart via the cart API so ownership is real.
    const g = await request(app).post("/api/cart/add")
      .set("Cookie", "so_gid=checkout-route-guest")
      .send({ id: "m1", type: "medicine", quantity: 2 });
    expect(g.status).toBe(200);

    const res = await request(app).post("/api/checkout")
      .set("Cookie", "so_gid=checkout-route-guest")
      .send({ address });
    expect(res.status).toBe(201);
    expect(res.body.orderNumber).toBe("SO-000001");
    expect(res.body.items[0].lineTotalPaise).toBe(10000);
    expect(res.body.totalPaise).toBe(10000 + res.body.deliveryFeePaise);
  });

  it("rejects checkout with an empty cart", async () => {
    const res = await request(app).post("/api/checkout")
      .set("Cookie", "so_gid=checkout-route-guest")
      .send({ address });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CART_EMPTY");
  });

  it("rejects a missing pincode with 422", async () => {
    await Product.create({
      id: "m1", type: "medicine", name: "Paracetamol", brand: "Medi", category: "Pain",
      pricePaise: 5000, mrpPaise: 6000, inStock: true, prescriptionRequired: false,
    });
    await request(app).post("/api/cart/add")
      .set("Cookie", "so_gid=checkout-route-guest")
      .send({ id: "m1", type: "medicine", quantity: 1 });
    const res = await request(app).post("/api/checkout")
      .set("Cookie", "so_gid=checkout-route-guest")
      .send({ address: { name: "X", phone: "+91" } });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("BAD_ADDRESS");
  });

  it("refuses to sell an out-of-stock item in the cart", async () => {
    await Product.create({
      id: "m1", type: "medicine", name: "Paracetamol", brand: "Medi", category: "Pain",
      pricePaise: 5000, mrpPaise: 6000, inStock: false, prescriptionRequired: false,
    });
    await request(app).post("/api/cart/add")
      .set("Cookie", "so_gid=checkout-route-guest")
      .send({ id: "m1", type: "medicine", quantity: 1 });
    const res = await request(app).post("/api/checkout")
      .set("Cookie", "so_gid=checkout-route-guest")
      .send({ address });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ITEM_OUT_OF_STOCK");
  });
});
