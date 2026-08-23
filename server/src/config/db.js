const mongoose = require("mongoose");

async function connectDb(uri, { retries = 5, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      const { topology } = mongoose.connection.client;
      const isReplicaSet = Boolean(topology && topology.s && topology.s.description
        && topology.s.description.type !== "Single");
      if (!isReplicaSet) {
        console.warn(
          "\n  ⚠  MongoDB is not a replica set. Transactions will fail.\n" +
          "     Cart merge and order creation need one. See README for single-node setup.\n"
        );
      }
      console.log("  ✓ MongoDB connected");
      return mongoose.connection;
    } catch (err) {
      console.error(`  ✗ MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

module.exports = { connectDb };
