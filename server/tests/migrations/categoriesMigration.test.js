const Product = require("../../src/models/Product");
const Category = require("../../src/models/Category");
const { up, down, CATEGORIES_DATA } = require("../../src/scripts/migrations/001_create_categories");

describe("001_create_categories migration", () => {
  beforeEach(async () => {
    await Category.deleteMany({});
    await Product.deleteMany({});

    // Seed test products
    await Product.create([
      {
        id: "s39",
        type: "supplement",
        name: "Himalaya Baby Diaper Pants Medium (40 Pack)",
        brand: "Himalaya",
        category: "Baby Care",
        pricePaise: 54000,
        mrpPaise: 60000,
        inStock: true,
      },
      {
        id: "s40",
        type: "supplement",
        name: "B-Fit Adult Diaper Tape Economy Medium (10 Diapers)",
        brand: "B-Fit",
        category: "Elderly Care",
        pricePaise: 26300,
        mrpPaise: 35000,
        inStock: true,
      },
      {
        id: "bf1",
        type: "babyfood",
        name: "Cerelac Wheat Apple Cherry 300g",
        brand: "Nestle",
        category: "Baby Cereals",
        pricePaise: 28500,
        mrpPaise: 31000,
        inStock: true,
      },
    ]);
  });

  it("up() inserts categories and establishes correct parent-child hierarchy", async () => {
    const result = await up();
    expect(result.success).toBe(true);

    const babyFoodCat = await Category.findOne({ id: "cat_baby_food_nutrition" });
    expect(babyFoodCat).not.toBeNull();
    expect(babyFoodCat.name).toBe("Baby food & nutrition");
    expect(babyFoodCat.parentId).toBe("cat_medicines"); // Under Medicines

    const babyDiaperCat = await Category.findOne({ id: "cat_baby_diapers" });
    expect(babyDiaperCat).not.toBeNull();
    expect(babyDiaperCat.name).toBe("Baby Diapers");

    const adultDiaperCat = await Category.findOne({ id: "cat_adult_diapers" });
    expect(adultDiaperCat).not.toBeNull();
    expect(adultDiaperCat.name).toBe("Adult Diapers");

    // Check tree structure
    const tree = await Category.getCategoryTree();
    const medicinesRoot = tree.find((c) => c.id === "cat_medicines");
    expect(medicinesRoot).toBeDefined();
    expect(medicinesRoot.children.map((c) => c.id)).toContain("cat_baby_food_nutrition");

    // Check descendant name discovery
    const descNames = await Category.getCategoryAndDescendantNames("Medicines");
    expect(descNames).toContain("Medicines");
    expect(descNames).toContain("Baby food & nutrition");
  });

  it("up() updates existing products with new category mappings", async () => {
    await up();

    const babyDiaper = await Product.findOne({ id: "s39" });
    expect(babyDiaper.category).toBe("Baby Diapers");
    expect(babyDiaper.categories).toContain("Baby Diapers");

    const adultDiaper = await Product.findOne({ id: "s40" });
    expect(adultDiaper.category).toBe("Adult Diapers");
    expect(adultDiaper.categories).toContain("Adult Diapers");

    const babyFood = await Product.findOne({ id: "bf1" });
    expect(babyFood.categories).toContain("Baby food & nutrition");
    expect(babyFood.categories).toContain("Medicines");
  });

  it("down() rolls back target categories and product category links", async () => {
    await up();
    const downResult = await down();
    expect(downResult.success).toBe(true);

    const babyFoodCat = await Category.findOne({ id: "cat_baby_food_nutrition" });
    expect(babyFoodCat).toBeNull();

    const babyFood = await Product.findOne({ id: "bf1" });
    expect(babyFood.categories).not.toContain("Baby food & nutrition");
  });
});
