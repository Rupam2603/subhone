const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const LabTest = require("../../src/models/LabTest");

describe("catalog routes (Mongo, paise prices)", () => {
  beforeEach(async () => {
    await Product.deleteMany({});
    await LabTest.deleteMany({});
    await Product.create([
      {
        id: "m1", type: "medicine", name: "Paracetamol 500", brand: "Acme",
        category: "Pain Relief", dosageForm: "Tablet", pricePaise: 3000, mrpPaise: 4000,
        inStock: true, rating: 4.5, reviews: 100,
      },
      {
        id: "m2", type: "medicine", name: "Cough Syrup", brand: "Zeta",
        category: "Cold & Cough", dosageForm: "Syrup", pricePaise: 12000, mrpPaise: 15000,
        inStock: false, rating: 4, reviews: 50,
      },
      {
        id: "s1", type: "supplement", name: "Whey Protein", brand: "Acme",
        category: "Protein", pricePaise: 250000, mrpPaise: 300000,
        inStock: true, rating: 4.7, reviews: 200,
      },
      {
        id: "bf1", type: "babyfood", name: "Cerelac Wheat", brand: "Nestle",
        category: "Baby Cereals", pricePaise: 28500, mrpPaise: 31000,
        inStock: true, rating: 4.8, reviews: 300,
      },
    ]);
    await LabTest.create({
      id: "t1", name: "Lipid Profile", type: "labTest", testCount: 72, category: "Heart",
      pricePaise: 79900, mrpPaise: 120000,
    });
  });

  it("GET /api/medicines returns all medicines (no inStock filter) with paise prices and string id", async () => {
    const res = await request(app).get("/api/medicines");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((m) => m.name)).toEqual(["Paracetamol 500", "Cough Syrup"]);
    expect(res.body[0].id).toBe("m1");
    expect(res.body[0].price).toBe(3000);
    expect(res.body[0].originalPrice).toBe(4000);
    expect(res.body[0].pricePaise).toBe(3000);
    expect(res.body[0].mrpPaise).toBe(4000);
    expect(res.body[0]._id).toBeUndefined();
  });

  it("GET /api/medicines?inStock=true returns only in-stock", async () => {
    const res = await request(app).get("/api/medicines?inStock=true");
    expect(res.body.map((m) => m.name)).toEqual(["Paracetamol 500"]);
  });

  it("GET /api/medicines filters by brand and category", async () => {
    const byBrand = await request(app).get("/api/medicines?brand=Zeta");
    expect(byBrand.body.map((m) => m.name)).toEqual(["Cough Syrup"]);
    const byCat = await request(app).get("/api/medicines?category=Pain+Relief");
    expect(byCat.body.map((m) => m.name)).toEqual(["Paracetamol 500"]);
  });

  it("GET /api/medicines filters by paise price range", async () => {
    const res = await request(app).get("/api/medicines?minPrice=0&maxPrice=5000");
    expect(res.body.map((m) => m.name)).toEqual(["Paracetamol 500"]);
  });

  it("GET /api/medicines searches by name", async () => {
    const res = await request(app).get("/api/medicines?search=cough");
    expect(res.body.map((m) => m.name)).toEqual(["Cough Syrup"]);
  });

  it("GET /api/medicines sorts by price", async () => {
    const asc = await request(app).get("/api/medicines?sort=price-asc");
    expect(asc.body.map((m) => m.price)).toEqual([3000, 12000]);
    const desc = await request(app).get("/api/medicines?sort=price-desc");
    expect(desc.body.map((m) => m.price)).toEqual([12000, 3000]);
  });

  it("GET /api/supplements returns supplements", async () => {
    const res = await request(app).get("/api/supplements");
    expect(res.body.map((m) => m.name)).toEqual(["Whey Protein"]);
  });

  it("GET /api/baby-food returns babyfood (folded-in route)", async () => {
    const res = await request(app).get("/api/baby-food");
    expect(res.body.map((m) => m.name)).toEqual(["Cerelac Wheat"]);
  });

  it("GET /api/products/:id resolves by string id; unknown -> 404", async () => {
    const s1 = await request(app).get("/api/products/s1");
    expect(s1.status).toBe(200);
    expect(s1.body.name).toBe("Whey Protein");
    const m1 = await request(app).get("/api/products/m1");
    expect(m1.status).toBe(200);
    expect(m1.body.name).toBe("Paracetamol 500");
    const missing = await request(app).get("/api/products/does-not-exist");
    expect(missing.status).toBe(404);
    expect(typeof missing.body.error).toBe("string");
  });

  it("GET /api/brands returns distinct sorted brands", async () => {
    const res = await request(app).get("/api/brands");
    expect(res.body).toEqual(["Acme", "Nestle", "Zeta"]);
  });

  it("GET /api/lab-tests returns paise price and truthy id", async () => {
    const res = await request(app).get("/api/lab-tests");
    expect(res.status).toBe(200);
    expect(res.body[0].price).toBe(79900);
    expect(res.body[0].id).toBeTruthy();
  });

  it("GET /api/search returns medicines + lab tests for query", async () => {
    const res = await request(app).get("/api/search?q=pro");
    const json = JSON.stringify(res.body);
    expect(json).toContain("Whey Protein");
    expect(json).toContain("Lipid Profile");
    expect(res.body).toHaveProperty("query", "pro");
    expect(res.body).toHaveProperty("total");
  });

  it("GET /api/products/does-not-exist returns 404 with string error", async () => {
    const res = await request(app).get("/api/products/does-not-exist");
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe("string");
  });
});
