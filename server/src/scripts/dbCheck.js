// Proves the MONGODB_URI in .env actually works, without booting the API.
// Run with: npm run db:check
require("dotenv").config();
const mongoose = require("mongoose");

const redact = (uri) => uri.replace(/\/\/[^@]+@/, "//<credentials>@");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  // A URI with no /dbname segment is not an error — the driver just silently uses
  // "test", which is the kind of thing you find out about three weeks later.
  const afterHost = (uri.split("@")[1] || "");
  const dbInUri = afterHost.includes("/") ? afterHost.split("/")[1].split("?")[0] : "";
  if (/<[a-z_]+>/i.test(uri)) {
    console.error(`MONGODB_URI still contains a placeholder: ${redact(uri)}`);
    process.exit(1);
  }

  console.log(`connecting to ${redact(uri)}`);
  if (!dbInUri) console.warn('  warning: no database name in the URI — the driver will use "test"');

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    console.log(`  connected  host=${mongoose.connection.host} db=${mongoose.connection.name}`);
    console.log(`  replica set: ${hello.setName || "(none)"}`);

    // Transactions are required by the order-creation path, and they need a replica
    // set. Atlas always is one; a standalone local mongod is not.
    if (!hello.setName) {
      console.warn("  warning: not a replica set — transactions will fail (order creation needs them)");
    }

    const names = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name);
    console.log(`  collections (${names.length}): ${names.length ? names.join(", ") : "none yet — run npm run seed"}`);
    await mongoose.disconnect();
    console.log("ok");
  } catch (err) {
    console.error(`  failed: ${err.name} — ${String(err.message).split("\n")[0]}`);
    if (/bad auth|Authentication failed/i.test(err.message)) {
      console.error("  the username or password is wrong, or the password needs URL-encoding");
    }
    if (/ENOTFOUND|querySrv|ETIMEDOUT/i.test(err.message)) {
      console.error("  DNS or network could not reach the cluster — check Atlas Network Access allows your IP");
    }
    process.exit(1);
  }
})();
