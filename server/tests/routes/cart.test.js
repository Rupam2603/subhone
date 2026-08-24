// vitest runs with `globals: true` (see vitest.config.js), so describe/it/expect are
// already in scope. Never `require("vitest")` here — vitest refuses to be required
// from CommonJS and the whole file aborts before a single assertion runs.
const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const LabTest = require("../../src/models/LabTest");

let med;
let test1;

// tests/setup.js empties every collection after each case, so the catalog these
// requests price against has to be created here rather than seeded once.
//
// Note `id: "m1"` and not Mongo's _id: the cart — like the whole public API — is
// keyed on the catalog's own string id, which survives a reseed.
beforeEach(async () => {
  med = await Product.create({
    id: "m1",
    type: "medicine",
    name: "Paracetamol 500",
    brand: "Acme",
    category: "Pain Relief",
    pricePaise: 3000,
    mrpPaise: 4000,
  });
  test1 = await LabTest.create({
    id: "t1",
    name: "Full Body Checkup",
    category: "Full Body",
    testCount: 72,
    pricePaise: 99900,
    mrpPaise: 199900,
  });
});

// Returns the "so_gid=<value>" pair, ready to hand straight back as a Cookie header.
const guestCookie = (res) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith("so_gid="));
  return raw ? raw.split(";")[0] : null;
};

const accessCookie = (res) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith("so_at="));
  return raw ? raw.split(";")[0] : null;
};

const addMed = (quantity = 1) =>
  request(app).post("/api/cart/add").send({ id: med.id, type: "medicine", quantity });

describe("cart routes", () => {
  it("returns an empty cart in the legacy shape for a first-time visitor", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.itemCount).toBe(0);
    expect(res.body.subtotal).toBe(0);
    // Minted even on a read, or the next POST /add would have no cart to land in.
    expect(guestCookie(res)).toBeTruthy();
  });

  it("adds an item and returns the whole cart, as the client expects", async () => {
    const res = await addMed(2);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.itemCount).toBe(2);
    expect(res.body.subtotal).toBe(6000);
  });

  it("keeps two different guests' carts apart", async () => {
    const first = await addMed(1);
    const cookie = guestCookie(first);
    const same = await request(app).get("/api/cart").set("Cookie", cookie);
    expect(same.body.itemCount).toBe(1);
    const other = await request(app).get("/api/cart"); // no cookie → new guest
    expect(other.body.itemCount).toBe(0);
  });

  it("updates and removes a line", async () => {
    const add = await addMed(1);
    const cookie = guestCookie(add);

    const upd = await request(app).put("/api/cart/update").set("Cookie", cookie)
      .send({ id: med.id, type: "medicine", quantity: 3 });
    expect(upd.body.itemCount).toBe(3);

    const del = await request(app).delete(`/api/cart/medicine/${med.id}`).set("Cookie", cookie);
    expect(del.body.items).toHaveLength(0);
  });

  it("clears the cart", async () => {
    const add = await addMed(2);
    const res = await request(app).delete("/api/cart").set("Cookie", guestCookie(add));
    expect(res.body.itemCount).toBe(0);
  });

  it("404s an unknown product id", async () => {
    const res = await request(app).post("/api/cart/add")
      .send({ id: "64b7f9d2e1a4c5b6d7e8f901", type: "medicine", quantity: 1 });
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe("string");
  });

  it("422s a bad quantity rather than silently clamping", async () => {
    const res = await addMed(99);
    expect(res.status).toBe(422);
  });

  it("never leaks internal model names", async () => {
    const res = await addMed(1);
    expect(JSON.stringify(res.body)).not.toMatch(/refModel|refId/);
  });

  it("carries a guest cart into the account on login", async () => {
    const add = await addMed(2);
    const gid = guestCookie(add);

    const reg = await request(app).post("/api/auth/register").set("Cookie", gid)
      .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
    const at = accessCookie(reg);

    const mine = await request(app).get("/api/cart").set("Cookie", at);
    expect(mine.body.itemCount).toBe(2);
  });

  // ── Beyond the brief: three failure modes the shape tests above would not catch ──

  it("prefers the signed-in owner and does not merge a guest cookie on a cart read", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
    const at = accessCookie(reg);
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: med.id, type: "medicine", quantity: 2 });

    // A separate guest cart, then a read carrying both cookies. Merging is the login
    // flow's job; a cart route seeing a stale so_gid must simply ignore it.
    const guestAdd = await addMed(1);
    const res = await request(app).get("/api/cart")
      .set("Cookie", [at, guestCookie(guestAdd)]);
    expect(res.body.itemCount).toBe(2);
  });

  it("keeps the camelCase labTest type in the remove path", async () => {
    const add = await request(app).post("/api/cart/add")
      .send({ id: test1.id, type: "labTest", quantity: 1 });
    expect(add.status).toBe(200);
    const cookie = guestCookie(add);

    // An unrecognised type is a validation failure, not a silent no-op — otherwise a
    // client sending "labtest" would get a 200 and wonder why nothing was removed.
    expect((await request(app).delete(`/api/cart/labtest/${test1.id}`)
      .set("Cookie", cookie)).status).toBe(422);

    const del = await request(app).delete(`/api/cart/labTest/${test1.id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);
    expect(del.body.items).toHaveLength(0);
  });

  it("does not re-mint a guest id for a visitor who already has one", async () => {
    const first = await request(app).get("/api/cart");
    const cookie = guestCookie(first);
    const second = await request(app).get("/api/cart").set("Cookie", cookie);
    // A second cookie every request would give the visitor a fresh, empty cart per
    // page view — the exact bug the old global in-memory cart hid.
    expect(guestCookie(second)).toBeNull();
  });
});
