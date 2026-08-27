const Category = require("../../models/Category");
const Product = require("../../models/Product");

const CATEGORIES_DATA = [
  // Base parent categories to anchor the hierarchy
  {
    id: "cat_medicines",
    name: "Medicines",
    slug: "medicines",
    parentId: null,
    type: "medicine",
    description: "Prescription and OTC pharmaceuticals, pain relief, digestive care, and health remedies.",
    icon: "Pill",
    displayOrder: 1,
  },
  {
    id: "cat_supplements",
    name: "Supplements",
    slug: "supplements",
    parentId: null,
    type: "supplement",
    description: "Vitamins, minerals, protein, immunity boosters, and herbal supplements.",
    icon: "Sparkles",
    displayOrder: 2,
  },
  {
    id: "cat_baby_care",
    name: "Baby Care",
    slug: "baby-care",
    parentId: null,
    type: "general",
    description: "Gentle baby skincare, diapers, bath essentials, and feeding supplies.",
    icon: "Baby",
    displayOrder: 3,
  },
  {
    id: "cat_elderly_care",
    name: "Elderly Care",
    slug: "elderly-care",
    parentId: null,
    type: "general",
    description: "Adult incontinence protection, mobility aids, orthopedic supports, and monitoring devices.",
    icon: "HeartPulse",
    displayOrder: 4,
  },
  // Targeted new categories
  {
    id: "cat_baby_food_nutrition",
    name: "Baby food & nutrition",
    slug: "baby-food-and-nutrition",
    parentId: "cat_medicines", // Under Medicines as specified
    type: "babyfood",
    description: "Infant milk formula, fortified cereals, purees, and specialized child nutritional supplements.",
    icon: "Milk",
    displayOrder: 10,
  },
  {
    id: "cat_baby_diapers",
    name: "Baby Diapers",
    slug: "baby-diapers",
    parentId: "cat_baby_care",
    type: "general",
    description: "Ultra-absorbent baby pull-up diaper pants, tape diapers, and rash protection.",
    icon: "ShieldCheck",
    displayOrder: 11,
  },
  {
    id: "cat_adult_diapers",
    name: "Adult Diapers",
    slug: "adult-diapers",
    parentId: "cat_elderly_care",
    type: "general",
    description: "High-absorbency incontinence adult pull-up diaper pants and refastenable tapes.",
    icon: "Heart",
    displayOrder: 12,
  },
];

async function up(session = null) {
  const options = session ? { session } : {};
  console.log("  [Migration 001] Inserting/updating categories...");

  for (const cat of CATEGORIES_DATA) {
    await Category.findOneAndUpdate(
      { id: cat.id },
      { $set: cat },
      { upsert: true, new: true, ...options }
    );
  }

  // Map existing diaper and babyfood products into the new categories and multi-categories
  console.log("  [Migration 001] Linking existing products to new categories...");

  // Baby Diapers
  await Product.updateMany(
    {
      $or: [
        { name: { $regex: /baby diaper/i } },
        { id: "s39" },
      ],
    },
    {
      $set: { category: "Baby Diapers" },
      $addToSet: { categories: { $each: ["Baby Diapers", "Baby Care"] } },
    },
    options
  );

  // Adult Diapers
  await Product.updateMany(
    {
      $or: [
        { name: { $regex: /adult diaper/i } },
        { id: { $in: ["s40", "s41"] } },
      ],
    },
    {
      $set: { category: "Adult Diapers" },
      $addToSet: { categories: { $each: ["Adult Diapers", "Elderly Care"] } },
    },
    options
  );

  // Baby food & nutrition (under Medicines)
  await Product.updateMany(
    {
      $or: [
        { type: "babyfood" },
        { category: { $in: ["Baby Cereals", "Infant Formula", "Baby food & nutrition"] } },
      ],
    },
    {
      $addToSet: { categories: { $each: ["Baby food & nutrition", "Medicines"] } },
    },
    options
  );

  console.log("  [Migration 001] Up migration complete.");
  return { success: true, count: CATEGORIES_DATA.length };
}

async function down(session = null) {
  const options = session ? { session } : {};
  console.log("  [Migration 001] Rolling back categories...");

  const targetCategoryIds = ["cat_baby_food_nutrition", "cat_baby_diapers", "cat_adult_diapers"];
  await Category.deleteMany({ id: { $in: targetCategoryIds } }, options);

  // Remove the category links from products
  await Product.updateMany(
    {},
    {
      $pull: {
        categories: { $in: ["Baby food & nutrition", "Baby Diapers", "Adult Diapers"] },
      },
    },
    options
  );

  console.log("  [Migration 001] Down migration complete.");
  return { success: true };
}

module.exports = { up, down, CATEGORIES_DATA };
