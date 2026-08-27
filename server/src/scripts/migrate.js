require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { loadEnv } = require("../config/env");

const migration001 = require("./migrations/001_create_categories");

const MIGRATIONS = [
  { id: "001_create_categories", ...migration001 },
];

async function run() {
  const args = process.argv.slice(2);
  const direction = args.includes("down") ? "down" : "up";

  const cfg = loadEnv();
  await connectDb(cfg.MONGODB_URI);

  console.log(`Starting database migrations (direction: ${direction})...`);

  for (const m of MIGRATIONS) {
    console.log(`Running migration: ${m.id} (${direction})`);
    if (direction === "up") {
      await m.up();
    } else {
      await m.down();
    }
  }

  console.log("Migrations completed successfully!");
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}

module.exports = { MIGRATIONS, run };
