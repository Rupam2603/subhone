require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { loadEnv } = require("../config/env");
const Product = require("../models/Product");
const Category = require("../models/Category");
const OosAudit = require("../models/OosAudit");

/**
 * Executes or simulates a guarded bulk stock update for a category hierarchy.
 *
 * @param {Object} options
 * @param {string} options.category - Root category name or ID to target
 * @param {boolean} [options.inStock=false] - Target stock state (default: false / out of stock)
 * @param {boolean} [options.dryRun=true] - If true, do not commit changes to the database
 * @param {boolean} [options.confirm=false] - Safety confirmation required for live execution
 * @param {string[]} [options.exemptCategories=["Medicines"]] - Categories that protect a product from OOS
 * @param {string} [options.reason] - Audit reason description
 * @param {string} [options.executedBy="admin_script"] - Operator identifier
 * @param {mongoose.ClientSession} [options.existingSession=null] - Optional outer session for tests
 */
async function runBulkStockUpdate(options = {}) {
  const {
    category = "Baby food & nutrition",
    inStock = false,
    dryRun = true,
    confirm = false,
    exemptCategories = ["Medicines"],
    reason = "Bulk category out-of-stock update",
    executedBy = "system_admin",
    existingSession = null,
  } = options;

  const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  console.log(`\n======================================================`);
  console.log(`BULK STOCK UPDATE RUNNER — Batch: ${batchId}`);
  console.log(`Target Category: "${category}"`);
  console.log(`Target Stock State: inStock = ${inStock}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (Simulated)" : "LIVE EXECUTE (Guarded Transaction)"}`);
  console.log(`Exempt Categories: [${exemptCategories.join(", ")}]`);
  console.log(`======================================================\n`);

  if (!dryRun && !confirm) {
    throw new Error(
      "Safety guard: Live execution requires explicit confirmation (--confirm or confirm: true)."
    );
  }

  // 1. Recursive targeting query
  const targetCategoryNames = await Category.getCategoryAndDescendantNames(category);
  console.log(`Resolved target category hierarchy (${targetCategoryNames.length}):`, targetCategoryNames);

  // Find all products matching any category in the hierarchy
  const candidateProducts = await Product.find({
    $or: [
      { category: { $in: targetCategoryNames } },
      { categories: { $in: targetCategoryNames } },
    ],
  }).lean();

  console.log(`Found ${candidateProducts.length} candidate product(s) in category scope.`);

  const toUpdate = [];
  const preserved = [];
  const alreadyInTargetState = [];

  for (const prod of candidateProducts) {
    const prodCategories = [
      prod.category,
      ...(Array.isArray(prod.categories) ? prod.categories : []),
    ];

    // Many-to-Many Edge Case Check:
    // If we are marking items Out-of-Stock (inStock: false), check if this product
    // is also in an exempt category (e.g. Medicines). If so, it MUST stay in stock!
    const isExempt = !inStock && exemptCategories.some((exempt) => prodCategories.includes(exempt));

    if (isExempt) {
      preserved.push({
        product: prod,
        reason: `Preserved in-stock due to exempt category overlap (${exemptCategories.filter((e) => prodCategories.includes(e)).join(", ")})`,
      });
      continue;
    }

    if (prod.inStock === inStock) {
      alreadyInTargetState.push(prod);
      continue;
    }

    toUpdate.push(prod);
  }

  console.log(`\n--- Plan Breakdown ---`);
  console.log(`  To Update:                 ${toUpdate.length}`);
  console.log(`  Preserved by Guard Rule:   ${preserved.length}`);
  console.log(`  Already in Target State:   ${alreadyInTargetState.length}`);
  console.log(`-----------------------\n`);

  if (toUpdate.length > 0) {
    console.log("Products to be updated:");
    toUpdate.forEach((p) => {
      console.log(`  - [${p.id}] "${p.name}" (Current inStock: ${p.inStock} -> Target: ${inStock})`);
    });
  }

  if (preserved.length > 0) {
    console.log("\nProducts PRESERVED (Many-to-Many Rule):");
    preserved.forEach((item) => {
      console.log(`  * [${item.product.id}] "${item.product.name}" -> ${item.reason}`);
    });
  }

  // Handle DRY RUN
  if (dryRun) {
    console.log("\n[DRY RUN] Writing simulated audit records for preview...");
    const dryRunAudits = toUpdate.map((p) => ({
      batchId,
      productId: p.id,
      productName: p.name,
      category: p.category,
      categories: p.categories || [p.category],
      previousInStock: p.inStock,
      newInStock: inStock,
      mode: "DRY_RUN",
      targetedCategory: category,
      reason,
      executedBy,
      executedAt: new Date(),
    }));

    if (dryRunAudits.length > 0) {
      await OosAudit.insertMany(dryRunAudits);
      console.log(`[DRY RUN] Wrote ${dryRunAudits.length} dry-run audit entries to oos_audits.`);
    }

    return {
      batchId,
      mode: "DRY_RUN",
      targetCategory: category,
      targetCategoryNames,
      candidateCount: candidateProducts.length,
      updatedCount: toUpdate.length,
      preservedCount: preserved.length,
      alreadyInTargetCount: alreadyInTargetState.length,
      updatedProducts: toUpdate,
      preservedProducts: preserved,
    };
  }

  // LIVE EXECUTE inside a transaction
  console.log("\n[EXECUTE] Executing guarded update in a replica-set transaction...");
  const useSession = existingSession || (await mongoose.startSession());
  let externalSession = !!existingSession;

  const executeTransaction = async (session) => {
    const auditRecords = [];

    for (const prod of toUpdate) {
      await Product.updateOne(
        { _id: prod._id },
        { $set: { inStock } },
        { session }
      );

      auditRecords.push({
        batchId,
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        categories: prod.categories || [prod.category],
        previousInStock: prod.inStock,
        newInStock: inStock,
        mode: "EXECUTE",
        targetedCategory: category,
        reason,
        executedBy,
        executedAt: new Date(),
      });
    }

    if (auditRecords.length > 0) {
      await OosAudit.insertMany(auditRecords, { session });
    }

    return auditRecords;
  };

  let auditResults = [];
  try {
    if (externalSession) {
      auditResults = await executeTransaction(useSession);
    } else {
      await useSession.withTransaction(async () => {
        auditResults = await executeTransaction(useSession);
      });
    }

    console.log(`[EXECUTE] Successfully updated ${toUpdate.length} product(s) and wrote ${auditResults.length} audit records.`);
  } catch (err) {
    console.error("[EXECUTE] Transaction aborted due to error:", err);
    throw err;
  } finally {
    if (!externalSession) {
      await useSession.endSession();
    }
  }

  return {
    batchId,
    mode: "EXECUTE",
    targetCategory: category,
    targetCategoryNames,
    candidateCount: candidateProducts.length,
    updatedCount: toUpdate.length,
    preservedCount: preserved.length,
    alreadyInTargetCount: alreadyInTargetState.length,
    updatedProducts: toUpdate,
    preservedProducts: preserved,
    audits: auditResults,
  };
}

async function cli() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const prefix = `${flag}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.substring(prefix.length) : null;
  };

  const category = getArg("--category") || "Baby food & nutrition";
  const statusStr = getArg("--status") || "outOfStock";
  const inStock = statusStr === "inStock" || statusStr === "true";
  const execute = args.includes("--execute");
  const confirm = args.includes("--confirm");
  const dryRun = !execute;

  const cfg = loadEnv();
  await connectDb(cfg.MONGODB_URI);

  try {
    await runBulkStockUpdate({
      category,
      inStock,
      dryRun,
      confirm,
    });
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  cli().catch((err) => {
    console.error("Bulk stock update failed:", err);
    process.exit(1);
  });
}

module.exports = { runBulkStockUpdate };
