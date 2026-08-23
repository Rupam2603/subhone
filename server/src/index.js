require("dotenv").config();
const { loadEnv } = require("./config/env");
const { connectDb } = require("./config/db");

// Validate the environment before anything reads process.env, so a misconfigured
// deploy fails here with a precise message rather than mid-request.
const cfg = loadEnv();
const app = require("./app");

// Attempt DB connection but do not crash — most routes use in-memory data and
// can serve requests without Mongo. Auth/user routes will fail gracefully.
connectDb(cfg.MONGODB_URI).catch((err) => {
  console.warn(
    "\n  ⚠  MongoDB unavailable — server will run in no-DB mode.\n" +
    `     (${err.message})\n` +
    "     In-memory catalogue, cart and order routes remain fully functional.\n"
  );
});

app.listen(cfg.PORT, () => {
  console.log(`\n  🌿 SubhOne API running on http://localhost:${cfg.PORT}`);
  console.log(`     Health:  http://localhost:${cfg.PORT}/api/health\n`);
});
