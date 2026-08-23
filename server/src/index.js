require("dotenv").config();
const { loadEnv } = require("./config/env");
const { connectDb } = require("./config/db");

// Validate the environment before anything reads process.env, so a misconfigured
// deploy fails here with a precise message rather than mid-request.
const cfg = loadEnv();
const app = require("./app");

connectDb(cfg.MONGODB_URI)
  .then(() => app.listen(cfg.PORT, () => {
    console.log(`\n  🌿 SubhOne API running on http://localhost:${cfg.PORT}`);
    console.log(`     Health:  http://localhost:${cfg.PORT}/api/health\n`);
  }))
  .catch((err) => { console.error("Failed to start:", err.message); process.exit(1); });
