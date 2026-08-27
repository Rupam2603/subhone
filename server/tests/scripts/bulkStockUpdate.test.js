const Product = require("../../src/models/Product");
const Category = require("../../src/models/Category");
const OosAudit = require("../../src/models/OosAudit");
const { up: seedCategories } = require("../../src/scripts/migrations/001_create_categories");
const { runBulkStockUpdate } = require("../../src/scripts/bulkStockUpdate");

describe("Guarded Bulk Stock Update & Many-to-Many Edge Case", () => {
  beforeEach(async () => {
    await Product.deleteMany({});
    await Category.deleteMany({});
    await OosAudit.deleteMany({});

    // Seed category hierarchy
    await seedCategories();

    // Seed products with the tricky Many-to-Many edge case:
    // 1. Pure baby food product (only in baby nutrition) -> SHOULD BE MARKED OUT OF STOCK
    // 2. Multi-category product (in both "Baby food & nutrition" AND "Medicines") -> MUST STAY IN STOCK
    // 3. Regular medicine product (only in "Medicines" / "Pain Relief") -> SHOULD STAY IN STOCK
    // 4. Baby Diapers product -> SHOULD STAY IN STOCK (unless targeted)
    await Product.create([
      {
        id: "p_pure_baby",
        type: "babyfood",
        name: "Nestle Cerelac Rice 300g",
        brand: "Nestle",
        category: "Baby Cereals",
        categories: ["Baby food & nutrition", "Baby Cereals"],
        pricePaise: 27500,
        mrpPaise: 30000,
        inStock: true,
      },
      {
        id: "p_multi_edge_case",
        type: "medicine",
        name: "Pediatric Electrolyte & Zinc Liquid 200ml",
        brand: "OralRehydrate",
        category: "Pediatric Care",
        categories: ["Baby food & nutrition", "Medicines"], // In both!
        pricePaise: 6500,
        mrpPaise: 7500,
        inStock: true,
      },
      {
        id: "p_regular_med",
        type: "medicine",
        name: "Paracetamol 500mg Tablet",
        brand: "Acme",
        category: "Pain Relief",
        categories: ["Medicines", "Pain Relief"],
        pricePaise: 3000,
        mrpPaise: 4000,
        inStock: true,
      },
      {
        id: "p_diaper",
        type: "supplement",
        name: "Himalaya Baby Diaper Pants",
        brand: "Himalaya",
        category: "Baby Diapers",
        categories: ["Baby Diapers", "Baby Care"],
        pricePaise: 54000,
        mrpPaise: 60000,
        inStock: true,
      },
    ]);
  });

  it("fails live execution when --confirm is false", async () => {
    await expect(
      runBulkStockUpdate({
        category: "Baby food & nutrition",
        inStock: false,
        dryRun: false,
        confirm: false,
      })
    ).rejects.toThrow(/Safety guard/);
  });

  it("executes a DRY-RUN without modifying product stock, but logging preview audit", async () => {
    const dryRunResult = await runBulkStockUpdate({
      category: "Baby food & nutrition",
      inStock: false,
      dryRun: true,
      exemptCategories: ["Medicines"],
    });

    expect(dryRunResult.mode).toBe("DRY_RUN");
    expect(dryRunResult.candidateCount).toBe(2); // p_pure_baby and p_multi_edge_case
    expect(dryRunResult.updatedCount).toBe(1); // only p_pure_baby to be updated
    expect(dryRunResult.preservedCount).toBe(1); // p_multi_edge_case preserved!
    expect(dryRunResult.preservedProducts[0].product.id).toBe("p_multi_edge_case");

    // Verify products are UNTOUCHED in Mongo
    const pureBaby = await Product.findOne({ id: "p_pure_baby" });
    const edgeCase = await Product.findOne({ id: "p_multi_edge_case" });
    expect(pureBaby.inStock).toBe(true);
    expect(edgeCase.inStock).toBe(true);

    // Verify dry-run audit entries
    const audits = await OosAudit.find({ batchId: dryRunResult.batchId });
    expect(audits).toHaveLength(1);
    expect(audits[0].mode).toBe("DRY_RUN");
    expect(audits[0].productId).toBe("p_pure_baby");
  });

  it("executes LIVE update: marks baby food out of stock while PRESERVING multi-category edge case in stock", async () => {
    const execResult = await runBulkStockUpdate({
      category: "Baby food & nutrition",
      inStock: false,
      dryRun: false,
      confirm: true,
      exemptCategories: ["Medicines"],
      reason: "Bulk out-of-stock compliance update",
      executedBy: "lead_dev",
    });

    expect(execResult.mode).toBe("EXECUTE");
    expect(execResult.updatedCount).toBe(1);
    expect(execResult.preservedCount).toBe(1);

    // 1. Pure baby product MUST be out of stock
    const pureBaby = await Product.findOne({ id: "p_pure_baby" });
    expect(pureBaby.inStock).toBe(false);

    // 2. CRITICAL EDGE CASE: Multi-category product in both Medicines & Baby food & nutrition MUST STAY IN STOCK!
    const edgeCase = await Product.findOne({ id: "p_multi_edge_case" });
    expect(edgeCase.inStock).toBe(true);

    // 3. Regular medicine MUST stay in stock
    const regularMed = await Product.findOne({ id: "p_regular_med" });
    expect(regularMed.inStock).toBe(true);

    // 4. Baby Diapers MUST stay in stock
    const diaper = await Product.findOne({ id: "p_diaper" });
    expect(diaper.inStock).toBe(true);

    // 5. Audit table MUST contain immutable record
    const audits = await OosAudit.find({ batchId: execResult.batchId });
    expect(audits).toHaveLength(1);
    expect(audits[0].mode).toBe("EXECUTE");
    expect(audits[0].productId).toBe("p_pure_baby");
    expect(audits[0].previousInStock).toBe(true);
    expect(audits[0].newInStock).toBe(false);
    expect(audits[0].executedBy).toBe("lead_dev");
    expect(audits[0].targetedCategory).toBe("Baby food & nutrition");
  });

  it("supports recursive category targeting (e.g. targeting parent category 'Medicines')", async () => {
    // When targeting "Medicines", recursive discovery finds all child categories including "Baby food & nutrition"
    const result = await runBulkStockUpdate({
      category: "Medicines",
      inStock: false,
      dryRun: true,
      exemptCategories: [], // No exemptions
    });

    expect(result.targetCategoryNames).toContain("Medicines");
    expect(result.targetCategoryNames).toContain("Baby food & nutrition");
    expect(result.candidateCount).toBeGreaterThanOrEqual(3);
  });
});
