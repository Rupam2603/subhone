const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const Category = require("../../src/models/Category");
const { up: seedCategories } = require("../../src/scripts/migrations/001_create_categories");

describe("Catalog Categories & Filter Integration", () => {
  beforeEach(async () => {
    await Product.deleteMany({});
    await Category.deleteMany({});

    await seedCategories();

    await Product.create([
      {
        id: "m_diaper_1",
        type: "supplement",
        name: "Himalaya Baby Diaper Medium",
        brand: "Himalaya",
        category: "Baby Diapers",
        categories: ["Baby Diapers", "Baby Care"],
        pricePaise: 54000,
        mrpPaise: 60000,
        inStock: true,
      },
      {
        id: "m_adult_diaper_1",
        type: "supplement",
        name: "B-Fit Adult Diaper Pants",
        brand: "B-Fit",
        category: "Adult Diapers",
        categories: ["Adult Diapers", "Elderly Care"],
        pricePaise: 26300,
        mrpPaise: 35000,
        inStock: true,
      },
      {
        id: "m_baby_food_1",
        type: "babyfood",
        name: "Cerelac Wheat Apple 300g",
        brand: "Nestle",
        category: "Baby Cereals",
        categories: ["Baby food & nutrition", "Medicines"],
        pricePaise: 28500,
        mrpPaise: 31000,
        inStock: true,
      },
      {
        id: "m_baby_food_oos",
        type: "babyfood",
        name: "Similac Infant Formula 400g",
        brand: "Abbott",
        category: "Infant Formula",
        categories: ["Baby food & nutrition"],
        pricePaise: 45000,
        mrpPaise: 50000,
        inStock: false, // Out of stock
      },
    ]);
  });

  it("GET /api/categories returns full category hierarchy tree", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const medRoot = res.body.find((c) => c.id === "cat_medicines");
    expect(medRoot).toBeDefined();
    expect(medRoot.children.some((child) => child.id === "cat_baby_food_nutrition")).toBe(true);
  });

  it("GET /api/medicines?category=Baby+Diapers filters by category", async () => {
    const res = await request(app).get("/api/medicines?category=Baby+Diapers");
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.id)).toContain("m_diaper_1");
  });

  it("GET /api/medicines?category=Adult+Diapers filters adult diapers", async () => {
    const res = await request(app).get("/api/medicines?category=Adult+Diapers");
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.id)).toContain("m_adult_diaper_1");
  });

  it("GET /api/medicines?inStock=true excludes out of stock items", async () => {
    const res = await request(app).get("/api/medicines?inStock=true");
    expect(res.status).toBe(200);
    const ids = res.body.map((p) => p.id);
    expect(ids).not.toContain("m_baby_food_oos");
  });
});
