require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { loadEnv } = require("../config/env");

const bcrypt = require("bcrypt");
const Product = require("../models/Product");
const LabTest = require("../models/LabTest");
const Coupon = require("../models/Coupon");
const Category = require("../models/Category");
const User = require("../models/User");
const { up: seedCategories } = require("./migrations/001_create_categories");

const { medicines } = require("../data/medicines");
const { supplements } = require("../data/supplements");
const { labTests } = require("../data/labTests");
const { babyFood } = require("../data/babyFood");

// Convert rupees to paise
function mapItem(item) {
  const { price, originalPrice, ...rest } = item;
  return {
    ...rest,
    pricePaise: Math.round(price * 100),
    mrpPaise: Math.round(originalPrice * 100),
  };
}

const coupons = [
  {
    code: "WELCOME50",
    type: "FLAT",
    value: 5000, // ₹50 flat
    minCartValuePaise: 20000,
  },
  {
    code: "HEALTH10",
    type: "PERCENT",
    value: 10, // 10%
    minCartValuePaise: 100000,
    maxDiscountPaise: 20000, // max ₹200
  },
];

async function seed() {
  const cfg = loadEnv();
  await connectDb(cfg.MONGODB_URI);

  console.log("Clearing old catalog...");
  await Product.deleteMany({});
  await LabTest.deleteMany({});
  await Coupon.deleteMany({});
  await Category.deleteMany({});

  console.log("Seeding medicines...");
  await Product.insertMany(medicines.map(mapItem));

  console.log("Seeding supplements...");
  await Product.insertMany(supplements.map(mapItem));

  console.log("Seeding baby food...");
  await Product.insertMany(babyFood.map(mapItem));

  console.log("Seeding categories and mappings...");
  await seedCategories();

  console.log("Seeding lab tests...");
  await LabTest.insertMany(labTests.map(mapItem));

  console.log("Seeding coupons...");
  await Coupon.insertMany(coupons);

  if (cfg.SEED_ADMIN_EMAIL && cfg.SEED_ADMIN_PASSWORD) {
    console.log("Seeding admin user...");
    await User.deleteMany({ email: cfg.SEED_ADMIN_EMAIL });
    const passwordHash = await bcrypt.hash(cfg.SEED_ADMIN_PASSWORD, 10);
    await User.create({
      name: "Admin User",
      email: cfg.SEED_ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
    });
  }

  console.log("Seed complete!");
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
