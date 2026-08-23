# SubhOne P0 — Data & Identity Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SubhOne's in-memory prototype store with MongoDB persistence, real authentication with roles, per-owner carts with guest merge, and integer-paise money — closing two critical security holes without changing user-visible behaviour.

**Architecture:** A layered Express server (`config` / `models` / `services` / `routes` / `middleware`) replaces the single `services/store.js`. Cart documents store only item references and quantities, never prices, so pricing is always resolved server-side from the live catalog. Identity uses a short-lived access JWT plus a rotating opaque refresh token, both in httpOnly cookies.

**Tech Stack:** Node + Express 4 (CommonJS), Mongoose 8, bcrypt, jsonwebtoken, zod, express-rate-limit, cookie-parser. Tests: vitest + supertest + mongodb-memory-server in replica-set mode. Client: React 18 + Vite + Tailwind + react-router-dom.

**Spec:** `docs/superpowers/specs/2026-08-23-order-system-design.md` — read it alongside this plan. Full model field lists live in spec §6.3; this plan shows the fields that carry logic or invariants and defers the purely descriptive ones to the spec.

## Global Constraints

- **All money is integer paise.** Field names must carry the unit: `pricePaise`, `totalPaise`, `mrpPaise`. A bare `price` field is a bug. Exception: the public API keeps its existing property names (`price`, `subtotal`, `total`) for client compatibility — values are paise.
- **The public API contract for cart, catalog and coupons must not change.** Item identity stays `{ id, type }` with `type` ∈ `medicine` | `supplement` | `labTest`. Mongo model names never appear in API payloads.
- **The error envelope keeps `error` as a plain string**, with `code` and `details` alongside. `client/src/lib/api.js:26` reads `data.error` as a string; nesting it breaks every UI error message.
- **`CartContext.jsx` must not be modified.** If a change there seems necessary, the server contract has drifted — fix the server instead.
- **The cart response keys are frozen by name.** `CartContext.jsx:7` seeds state from `{ items, itemCount, subtotal, mrpTotal, savings }` and `CartDrawer.jsx` reads `item.price`, `item.originalPrice`, `item.name`, `item.image`, `item.quantity`. Every cart-returning endpoint must keep emitting exactly those keys. After the paise migration they carry paise, and `*Paise` twins (`subtotalPaise`, `pricePaise`, …) are added alongside for new code. This is the one place the plan deliberately violates its own "field names carry the unit" rule, because the alternative is editing a frozen file.
- Mongoose 8.x, Express 4.21.x (do not upgrade to Express 5).
- Node's built-in `crypto` for hashing tokens and OTP codes — no extra hashing library beyond bcrypt for passwords.
- Every mutating route validates its input with zod and returns 422 with per-field `details` on failure.
- Commit after every task. Conventional commit prefixes (`feat:`, `test:`, `refactor:`, `chore:`).
- `FREE_DELIVERY_ABOVE_PAISE = 49900`, `DELIVERY_FEE_PAISE = 4000`. Declared once per side (server `config/constants.js`, client `lib/constants.js`) and imported — never re-literalled.

---

## File Structure

**Server — created**

| File | Responsibility |
|---|---|
| `server/src/app.js` | Express app assembly, extracted from `index.js` so supertest can mount it |
| `server/src/config/env.js` | zod-validated environment; throws on boot if invalid |
| `server/src/config/db.js` | Mongoose connection, retry, replica-set warning |
| `server/src/config/constants.js` | Money constants, `ORDER_STATUS`, `CUSTOMER_TIMELINE`, `TYPE_MAP`, limits |
| `server/src/config/upload.js` | Hardened multer config — mimetype allow-list, size cap, generated filenames |
| `server/src/models/*.js` | One Mongoose model per file, per spec §6.3 |
| `server/src/services/*.js` | Business logic; no Express imports |
| `server/src/middleware/*.js` | One concern per file |
| `server/src/routes/me.js` | Address book (spec §6.6) |
| `server/src/utils/AppError.js` | Status + machine code + message |
| `server/src/utils/asyncHandler.js` | Promise rejection forwarding |
| `server/src/utils/hash.js` | sha256 helpers |
| `server/src/utils/serialise.js` | Mongo document → public payload, incl. paise → `price` renaming |
| `server/src/scripts/seed.js` | Idempotent catalog/coupon/admin seeding |
| `server/tests/**` | vitest suites mirroring `src/` |
| `server/vitest.config.js`, `server/tests/setup.js` | In-memory replica set lifecycle |

**Server — modified:** every file in `routes/`, plus `src/index.js` (now only boot + listen) and `utils/filter.js` (rewritten as Mongo query builders, paise). **Deleted:** `src/services/store.js`.

**Client — created:** `lib/constants.js`, `context/AuthContext.jsx`, `components/RequireAuth.jsx`, `components/CartAuthBridge.jsx`, `pages/Login.jsx`, `pages/Register.jsx`.

**Client — modified:** `lib/format.js`, `lib/api.js`, `main.jsx`, `App.jsx`, `components/Header.jsx`, `components/CartDrawer.jsx`, `components/FilterSidebar.jsx`, `pages/Medicines.jsx`, `pages/Supplements.jsx`, `pages/LabTests.jsx`, `pages/Orders.jsx`. **Never modified:** `context/CartContext.jsx`.

---

## Task 1: Test harness, environment config, database connection

**Files:**
- Create: `server/vitest.config.js`, `server/tests/setup.js`, `server/src/config/env.js`, `server/src/config/db.js`, `server/src/config/constants.js`, `server/.env.example`
- Test: `server/tests/config/env.test.js`
- Modify: `server/package.json`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `loadEnv(rawEnv) → validated config object`; `connectDb(uri) → Promise<mongoose.Connection>`; constants `FREE_DELIVERY_ABOVE_PAISE`, `DELIVERY_FEE_PAISE`, `ORDER_STATUS` (array), `MAX_CART_ITEM_QTY`

- [ ] **Step 1: Install dependencies**

```bash
cd server
npm install mongoose bcrypt jsonwebtoken cookie-parser zod express-rate-limit uuid
npm install -D vitest supertest mongodb-memory-server
```

- [ ] **Step 2: Add scripts to `server/package.json`**

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "seed": "node src/scripts/seed.js"
}
```

- [ ] **Step 3: Create `server/vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
```

`fileParallelism: false` matters — one shared in-memory replica set cannot serve parallel suites cleanly.

- [ ] **Step 4: Create `server/tests/setup.js`**

```js
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { beforeAll, afterAll, afterEach } = require("vitest");

let replSet;

beforeAll(async () => {
  // Replica set (not MongoMemoryServer) because the design relies on transactions.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) await collections[key].deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});
```

- [ ] **Step 5: Write the failing test — `server/tests/config/env.test.js`**

```js
const { describe, it, expect } = require("vitest");
const { loadEnv } = require("../../src/config/env");

const valid = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/subhone",
  JWT_SECRET: "x".repeat(32),
  OTP_PEPPER: "y".repeat(16),
  CORS_ORIGIN: "http://localhost:5173",
};

describe("loadEnv", () => {
  it("accepts a valid environment and applies defaults", () => {
    const cfg = loadEnv(valid);
    expect(cfg.PORT).toBe(5000);
    expect(cfg.COOKIE_SECURE).toBe(false);
    expect(cfg.SMS_PROVIDER).toBe("dev");
    expect(cfg.REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  it("throws a naming error when JWT_SECRET is too short", () => {
    expect(() => loadEnv({ ...valid, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });

  it("throws when MONGODB_URI is missing", () => {
    const { MONGODB_URI, ...without } = valid;
    expect(() => loadEnv(without)).toThrow(/MONGODB_URI/);
  });

  it("coerces numeric strings from the real process env", () => {
    expect(loadEnv({ ...valid, PORT: "8080" }).PORT).toBe(8080);
  });
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `cd server && npx vitest run tests/config/env.test.js`
Expected: FAIL — cannot find module `../../src/config/env`

- [ ] **Step 7: Implement `server/src/config/env.js`**

```js
const { z } = require("zod");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  CORS_ORIGIN: z.string().min(1),
  OTP_PEPPER: z.string().min(16, "OTP_PEPPER must be at least 16 characters"),
  SMS_PROVIDER: z.enum(["dev", "msg91", "twilio"]).default("dev"),
  GUEST_CART_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
});

function loadEnv(raw = process.env) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${detail}`);
  }
  return parsed.data;
}

module.exports = { loadEnv, schema };
```

- [ ] **Step 8: Run the test and confirm it passes**

Run: `npx vitest run tests/config/env.test.js`
Expected: PASS (4 tests)

- [ ] **Step 9: Implement `server/src/config/constants.js`**

```js
const FREE_DELIVERY_ABOVE_PAISE = 49900;
const DELIVERY_FEE_PAISE = 4000;
const MAX_CART_ITEM_QTY = 10;
const RUPEE = 100;

const ORDER_STATUS = [
  "PENDING_PAYMENT", "PLACED", "CONFIRMED", "PACKED", "DISPATCHED",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED",
];

// The stages a customer sees, in order. ORDER_STATUS additionally contains
// terminal and payment states that never appear as timeline steps.
const CUSTOMER_TIMELINE = ["PLACED", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];

// Public API item types → internal (model, kind) pair. Keeps Mongo names out of payloads.
const TYPE_MAP = {
  medicine: { refModel: "Product", kind: "medicine" },
  supplement: { refModel: "Product", kind: "supplement" },
  labTest: { refModel: "LabTest", kind: null },
};

module.exports = {
  FREE_DELIVERY_ABOVE_PAISE, DELIVERY_FEE_PAISE, MAX_CART_ITEM_QTY,
  RUPEE, ORDER_STATUS, CUSTOMER_TIMELINE, TYPE_MAP,
};
```

- [ ] **Step 10: Implement `server/src/config/db.js`**

```js
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
```

- [ ] **Step 11: Create `server/.env.example`**

Copy the block from spec §6.10 verbatim.

- [ ] **Step 12: Commit**

```bash
git add server/package.json server/package-lock.json server/vitest.config.js \
        server/tests/setup.js server/src/config server/.env.example
git commit -m "chore: add test harness, validated env config and db connection"
```

---

## Task 2: Counter model and gap-free order numbers

**Files:**
- Create: `server/src/models/Counter.js`
- Test: `server/tests/models/counter.test.js`

**Interfaces:**
- Consumes: Task 1 test harness
- Produces: `Counter.nextSequence(name) → Promise<number>`; `Counter.nextOrderNumber() → Promise<string>` formatted `SO-<seq>` starting at `SO-481301`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect } = require("vitest");
const Counter = require("../../src/models/Counter");

describe("Counter", () => {
  it("returns increasing sequence values", async () => {
    expect(await Counter.nextSequence("order")).toBe(1);
    expect(await Counter.nextSequence("order")).toBe(2);
  });

  it("keeps separate sequences independent", async () => {
    await Counter.nextSequence("order");
    expect(await Counter.nextSequence("invoice")).toBe(1);
  });

  it("issues unique numbers under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => Counter.nextSequence("order"))
    );
    expect(new Set(results).size).toBe(50);
  });

  it("formats order numbers with the SO- prefix and base offset", async () => {
    expect(await Counter.nextOrderNumber()).toBe("SO-481301");
    expect(await Counter.nextOrderNumber()).toBe("SO-481302");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/models/counter.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `server/src/models/Counter.js`**

```js
const mongoose = require("mongoose");

const ORDER_NUMBER_BASE = 481300; // continues the prototype's visible sequence

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

// Atomic $inc + upsert — safe under concurrency without a transaction.
counterSchema.statics.nextSequence = async function nextSequence(name) {
  const doc = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

counterSchema.statics.nextOrderNumber = async function nextOrderNumber() {
  const seq = await this.nextSequence("order");
  return `SO-${ORDER_NUMBER_BASE + seq}`;
};

module.exports = mongoose.model("Counter", counterSchema);
module.exports.ORDER_NUMBER_BASE = ORDER_NUMBER_BASE;
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/models/counter.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/models/Counter.js server/tests/models/counter.test.js
git commit -m "feat: add Counter model for gap-free order numbers"
```

---

## Task 3: Catalog models and the paise-converting seed script

This task carries the highest defect risk in P0 — the coupon `value` field is unit-dependent (rupees for `flat`, percentage points for `percent`), so a blanket ×100 is wrong.

**Files:**
- Create: `server/src/models/Product.js`, `server/src/models/LabTest.js`, `server/src/models/Coupon.js`, `server/src/scripts/seed.js`
- Test: `server/tests/scripts/seed.test.js`

**Interfaces:**
- Consumes: `config/constants.js` (`RUPEE`) from Task 1
- Produces: models `Product`, `LabTest`, `Coupon`; `seed({ fresh = false }) → Promise<{ products, labTests, coupons, adminCreated }>`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect } = require("vitest");
const Product = require("../../src/models/Product");
const LabTest = require("../../src/models/LabTest");
const Coupon = require("../../src/models/Coupon");
const { seed } = require("../../src/scripts/seed");
const { medicines } = require("../../src/data/medicines");

describe("seed", () => {
  it("converts rupee prices to integer paise", async () => {
    await seed();
    const source = medicines[0]; // Paracetamol, price 15
    const doc = await Product.findOne({ slug: expect.any(String), name: source.name });
    expect(doc.pricePaise).toBe(source.price * 100);
    expect(doc.mrpPaise).toBe(source.originalPrice * 100);
    expect(Number.isInteger(doc.pricePaise)).toBe(true);
  });

  it("multiplies flat coupon values but never percent values", async () => {
    await seed();
    const flat = await Coupon.findOne({ code: "HEALTH50" });   // flat, value 50 rupees
    expect(flat.value).toBe(5000);
    expect(flat.minOrderPaise).toBe(49900);

    const pct = await Coupon.findOne({ code: "FIRST20" });     // percent, value 20 points
    expect(pct.value).toBe(20);
  });

  it("is idempotent — a second run creates no duplicates", async () => {
    const first = await seed();
    const second = await seed();
    expect(second.products).toBe(first.products);
    expect(await Product.countDocuments()).toBe(first.products);
    expect(await LabTest.countDocuments()).toBe(first.labTests);
  });

  it("does not reset stock on re-seed", async () => {
    await seed();
    const before = await Product.findOne({});
    await Product.updateOne({ _id: before._id }, { $set: { stock: 3 } });
    await seed();
    const after = await Product.findById(before._id);
    expect(after.stock).toBe(3);
  });

  it("gives every product a unique slug", async () => {
    await seed();
    const slugs = (await Product.find({}, "slug")).map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every(Boolean)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/scripts/seed.test.js`
Expected: FAIL — cannot find module `Product`

- [ ] **Step 3: Implement `server/src/models/Product.js`**

Full descriptive field list in spec §6.3; the logic-bearing parts:

```js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  kind: { type: String, enum: ["medicine", "supplement"], required: true, index: true },
  brand: { type: String, index: true },
  pricePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
  mrpPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
  image: String,
  prescriptionRequired: { type: Boolean, default: false },
  stock: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true, index: true },
  description: String, composition: String, packSize: String,
  dosageForm: String, manufacturer: String,
  categories: { type: [String], index: true },
  tags: [String],
  rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
}, { timestamps: true });

productSchema.pre("validate", function guardMrp(next) {
  if (this.mrpPaise < this.pricePaise) return next(new Error("mrpPaise cannot be below pricePaise"));
  return next();
});

productSchema.index({ kind: 1, isActive: 1, brand: 1 });
productSchema.index({ name: "text", brand: "text", composition: "text" });

module.exports = mongoose.model("Product", productSchema);
```

- [ ] **Step 4: Implement `server/src/models/LabTest.js` and `server/src/models/Coupon.js`**

Follow the field lists in spec §6.3. `LabTest` mirrors `Product`'s paise validation. `Coupon` uses `code` uppercase-unique, `type` enum `percent|flat`, `value` Number, `minOrderPaise`, `maxDiscountPaise` nullable, `validFrom`/`validUntil`, `usageLimit` nullable, `usedCount` default 0, `perUserLimit` default 1, `appliesTo` enum default `all`, `isActive` default true.

- [ ] **Step 5: Implement `server/src/scripts/seed.js`**

```js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { medicines } = require("../data/medicines");
const { supplements } = require("../data/supplements");
const { labTests } = require("../data/labTests");
const { coupons } = require("../data/content");
const { RUPEE } = require("../config/constants");
const Product = require("../models/Product");
const LabTest = require("../models/LabTest");
const Coupon = require("../models/Coupon");
const User = require("../models/User"); // available from Task 5 onward

const toPaise = (rupees) => Math.round(Number(rupees || 0) * RUPEE);

const slugify = (name, id) =>
  `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${id}`;

// `stock` is only applied on insert, so re-seeding never silently restocks.
const upsert = (Model, filter, onInsert, always) =>
  Model.updateOne(filter, { $setOnInsert: onInsert, $set: always }, { upsert: true });

async function seed({ fresh = false } = {}) {
  if (fresh) {
    // Catalog only. Never users or orders.
    await Promise.all([Product.deleteMany({}), LabTest.deleteMany({}), Coupon.deleteMany({})]);
  }

  const products = [...medicines.map((m) => ({ ...m, kind: "medicine" })),
                    ...supplements.map((s) => ({ ...s, kind: "supplement" }))];

  for (const p of products) {
    await upsert(Product, { slug: slugify(p.name, p.id) },
      { slug: slugify(p.name, p.id), stock: p.inStock === false ? 0 : 100 },
      {
        name: p.name, kind: p.kind, brand: p.brand || "",
        pricePaise: toPaise(p.price), mrpPaise: toPaise(p.originalPrice || p.price),
        image: p.image || "", prescriptionRequired: !!p.prescriptionRequired,
        description: p.description || "", composition: p.composition || "",
        packSize: p.packSize || "", dosageForm: p.dosageForm || "",
        manufacturer: p.manufacturer || "",
        categories: p.category ? [p.category] : [],
        tags: p.tags || [],
        rating: { average: p.rating || 0, count: p.reviews || 0 },
        isActive: true,
      });
  }

  for (const l of labTests) {
    await upsert(LabTest, { slug: slugify(l.name, l.id) },
      { slug: slugify(l.name, l.id) },
      {
        name: l.name, pricePaise: toPaise(l.price), mrpPaise: toPaise(l.originalPrice || l.price),
        testCount: l.testCount || 0, fastingRequired: !!l.fastingRequired,
        reportTimeHours: l.reportTimeHours || 24, sampleType: l.sampleType || "Blood",
        description: l.description || "", categories: l.category ? [l.category] : [],
        isActive: true,
      });
  }

  for (const c of coupons) {
    // value is rupees for flat coupons, percentage points for percent coupons.
    const value = c.type === "flat" ? toPaise(c.value) : c.value;
    await upsert(Coupon, { code: c.code.toUpperCase() },
      { code: c.code.toUpperCase(), usedCount: 0 },
      {
        type: c.type, value,
        minOrderPaise: toPaise(c.minOrder || 0),
        maxDiscountPaise: c.maxDiscount == null ? null : toPaise(c.maxDiscount),
        description: c.description || "",
        validFrom: new Date(0),
        validUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        usageLimit: null, perUserLimit: 1, appliesTo: "all", isActive: true,
      });
  }

  let adminCreated = false;
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (SEED_ADMIN_EMAIL && SEED_ADMIN_PASSWORD && !(await User.findOne({ email: SEED_ADMIN_EMAIL.toLowerCase() }))) {
    await User.create({
      name: "SubhOne Admin",
      email: SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 12),
      role: "admin",
      emailVerified: true,
    });
    adminCreated = true;
  }

  return {
    products: await Product.countDocuments(),
    labTests: await LabTest.countDocuments(),
    coupons: await Coupon.countDocuments(),
    adminCreated,
  };
}

// CLI entry point
if (require.main === module) {
  require("dotenv").config();
  const { loadEnv } = require("../config/env");
  const { connectDb } = require("../config/db");
  (async () => {
    const cfg = loadEnv();
    await connectDb(cfg.MONGODB_URI);
    const result = await seed({ fresh: process.argv.includes("--fresh") });
    console.log("  ✓ Seed complete:", result);
    await mongoose.disconnect();
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed, toPaise, slugify };
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run tests/scripts/seed.test.js`
Expected: PASS (5 tests). The `adminCreated` path needs `User` from Task 5 — if running Task 3 standalone, the import will fail; implement Task 5's `User` model first or temporarily guard the require. Note this ordering in your commit message.

- [ ] **Step 7: Commit**

```bash
git add server/src/models server/src/scripts/seed.js server/tests/scripts/seed.test.js
git commit -m "feat: add catalog models and idempotent paise-converting seed"
```

---

## Task 4: User model with its invariants

**Files:**
- Create: `server/src/models/User.js`
- Test: `server/tests/models/user.test.js`

**Interfaces:**
- Consumes: nothing beyond Mongoose
- Produces: `User` model with embedded `addresses`; instance method `setDefaultAddress(addressId)`; static `findByEmailOrPhone({ email, phone })`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect } = require("vitest");
const User = require("../../src/models/User");

const base = { name: "Subhasis" };

describe("User", () => {
  it("rejects a user with neither email nor phone", async () => {
    await expect(User.create({ ...base })).rejects.toThrow(/email or phone/i);
  });

  it("rejects an email account with no password hash", async () => {
    await expect(User.create({ ...base, email: "a@b.com" })).rejects.toThrow(/password/i);
  });

  it("accepts a phone-only account with no password hash", async () => {
    const u = await User.create({ ...base, phone: "+919830000000" });
    expect(u.passwordHash).toBeFalsy();
    expect(u.role).toBe("customer");
    expect(u.tokenVersion).toBe(0);
  });

  it("lowercases email and enforces uniqueness sparsely", async () => {
    await User.create({ ...base, email: "A@B.com", passwordHash: "h" });
    const found = await User.findOne({ email: "a@b.com" });
    expect(found).toBeTruthy();
    await expect(User.create({ ...base, email: "a@b.com", passwordHash: "h" })).rejects.toThrow();
    // Two phone-only users must both be allowed despite null email.
    await User.create({ ...base, phone: "+919830000001" });
    await expect(User.create({ ...base, phone: "+919830000002" })).resolves.toBeTruthy();
  });

  it("keeps exactly one default address", async () => {
    const u = await User.create({
      ...base, phone: "+919830000003",
      addresses: [
        { name: "S", phone: "+919830000003", line1: "12 Park St", city: "Kolkata", state: "WB", pincode: "700016", isDefault: true },
        { name: "S", phone: "+919830000003", line1: "9 Salt Lake", city: "Kolkata", state: "WB", pincode: "700064" },
      ],
    });
    await u.setDefaultAddress(u.addresses[1]._id);
    const fresh = await User.findById(u._id);
    expect(fresh.addresses.filter((a) => a.isDefault)).toHaveLength(1);
    expect(String(fresh.addresses.find((a) => a.isDefault)._id)).toBe(String(u.addresses[1]._id));
  });

  it("rejects a malformed pincode", async () => {
    await expect(User.create({
      ...base, phone: "+919830000004",
      addresses: [{ name: "S", phone: "+919830000004", line1: "x", city: "Kolkata", state: "WB", pincode: "0123" }],
    })).rejects.toThrow(/pincode/i);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/models/user.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `server/src/models/User.js`**

```js
const mongoose = require("mongoose");

const PINCODE = /^[1-9][0-9]{5}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

const addressSchema = new mongoose.Schema({
  label: { type: String, default: "Home" },
  name: { type: String, required: true },
  phone: { type: String, required: true, match: [E164, "phone must be E.164"] },
  line1: { type: String, required: true },
  line2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true, match: [PINCODE, "pincode must be 6 digits"] },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
  passwordHash: { type: String, default: null },
  phone: { type: String, sparse: true, unique: true, match: [E164, "phone must be E.164"] },
  phoneVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  name: { type: String, required: true },
  role: { type: String, enum: ["customer", "admin"], default: "customer", index: true },
  tokenVersion: { type: Number, default: 0 },
  addresses: [addressSchema],
  disabledAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.pre("validate", function guardIdentity(next) {
  if (!this.email && !this.phone) {
    return next(new Error("A user requires either an email or phone"));
  }
  if (this.email && !this.passwordHash) {
    return next(new Error("An email account requires a password"));
  }
  const defaults = (this.addresses || []).filter((a) => a.isDefault);
  if (defaults.length > 1) return next(new Error("Only one address may be default"));
  return next();
});

userSchema.methods.setDefaultAddress = async function setDefaultAddress(addressId) {
  this.addresses.forEach((a) => { a.isDefault = String(a._id) === String(addressId); });
  return this.save();
};

userSchema.statics.findByEmailOrPhone = function findByEmailOrPhone({ email, phone }) {
  const or = [];
  if (email) or.push({ email: String(email).toLowerCase() });
  if (phone) or.push({ phone });
  if (!or.length) return null;
  return this.findOne({ $or: or });
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
```

`toJSON` stripping `passwordHash` is a safety net, not the primary control — services still select fields explicitly.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/models/user.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/models/User.js server/tests/models/user.test.js
git commit -m "feat: add User model with identity and address invariants"
```

---

## Task 5: Hash utilities, Session model, and refresh-token rotation

Reuse detection is the security-critical behaviour here: presenting an already-revoked refresh token must revoke every session in that token's family.

**Files:**
- Create: `server/src/utils/hash.js`, `server/src/models/Session.js`, `server/src/services/tokenService.js`
- Test: `server/tests/services/tokenService.test.js`

**Interfaces:**
- Consumes: `User` (Task 4), `loadEnv` (Task 1)
- Produces:
  - `sha256(value) → string` (hex)
  - `tokenService.issueAccessToken(user) → string`
  - `tokenService.verifyAccessToken(jwt) → { sub, role, ver }` (throws on invalid)
  - `tokenService.issueRefreshToken(user, { userAgent, ip, family }) → { token, session }`
  - `tokenService.rotateRefreshToken(rawToken, meta) → { token, session, user }` (throws `AppError` 401 on reuse)
  - `tokenService.revokeSession(rawToken) → Promise<void>`
  - `tokenService.revokeFamily(family) → Promise<void>`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const User = require("../../src/models/User");
const Session = require("../../src/models/Session");
const tokenService = require("../../src/services/tokenService");

process.env.JWT_SECRET = "t".repeat(32);

let user;
beforeEach(async () => {
  user = await User.create({ name: "S", phone: "+919830000000" });
});

describe("tokenService", () => {
  it("issues a verifiable access token carrying role and tokenVersion", () => {
    const jwt = tokenService.issueAccessToken(user);
    const claims = tokenService.verifyAccessToken(jwt);
    expect(claims.sub).toBe(String(user._id));
    expect(claims.role).toBe("customer");
    expect(claims.ver).toBe(0);
  });

  it("stores refresh tokens only as a hash", async () => {
    const { token } = await tokenService.issueRefreshToken(user, {});
    const stored = await Session.findOne({});
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toHaveLength(64);
  });

  it("rotates a refresh token, revoking the old session", async () => {
    const { token: first } = await tokenService.issueRefreshToken(user, {});
    const { token: second } = await tokenService.rotateRefreshToken(first, {});
    expect(second).not.toBe(first);
    const sessions = await Session.find({}).sort({ createdAt: 1 });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].revokedAt).toBeTruthy();
    expect(sessions[0].replacedByHash).toBe(sessions[1].tokenHash);
  });

  it("revokes the whole family when a used token is replayed", async () => {
    const { token: first } = await tokenService.issueRefreshToken(user, {});
    const { token: second } = await tokenService.rotateRefreshToken(first, {});
    // Replay the already-rotated token.
    await expect(tokenService.rotateRefreshToken(first, {})).rejects.toThrow(/reuse|invalid/i);
    // The legitimate successor must now be dead too.
    await expect(tokenService.rotateRefreshToken(second, {})).rejects.toThrow();
    const live = await Session.find({ revokedAt: null });
    expect(live).toHaveLength(0);
  });

  it("rejects an unknown refresh token", async () => {
    await expect(tokenService.rotateRefreshToken("nonsense", {})).rejects.toThrow();
  });

  it("rejects an access token whose tokenVersion is stale", async () => {
    const jwt = tokenService.issueAccessToken(user);
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    const claims = tokenService.verifyAccessToken(jwt);
    const fresh = await User.findById(user._id);
    expect(claims.ver).not.toBe(fresh.tokenVersion); // attachUser enforces this in Task 7
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/services/tokenService.test.js`
Expected: FAIL — cannot find module `utils/hash`

- [ ] **Step 3: Implement `server/src/utils/hash.js`**

```js
const crypto = require("crypto");

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
const hashOtp = (code, pepper) => sha256(`${code}:${pepper}`);

module.exports = { sha256, randomToken, hashOtp };
```

- [ ] **Step 4: Implement `server/src/models/Session.js`**

```js
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true },
  userAgent: String,
  ip: String,
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
}, { timestamps: true });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", sessionSchema);
```

- [ ] **Step 5: Implement `server/src/services/tokenService.js`**

```js
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const User = require("../models/User");
const Session = require("../models/Session");
const { sha256, randomToken } = require("../utils/hash");
const AppError = require("../utils/AppError"); // Task 6

const secret = () => process.env.JWT_SECRET;
const accessTtl = () => process.env.ACCESS_TOKEN_TTL || "15m";
const refreshDays = () => Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function issueAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, ver: user.tokenVersion },
    secret(),
    { expiresIn: accessTtl() }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, secret());
}

async function issueRefreshToken(user, { userAgent, ip, family } = {}) {
  const token = randomToken(32);
  const session = await Session.create({
    userId: user._id,
    tokenHash: sha256(token),
    family: family || uuid(),
    userAgent, ip,
    expiresAt: new Date(Date.now() + refreshDays() * 24 * 3600 * 1000),
  });
  return { token, session };
}

async function revokeFamily(family) {
  await Session.updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function revokeSession(rawToken) {
  await Session.updateOne({ tokenHash: sha256(rawToken) }, { $set: { revokedAt: new Date() } });
}

async function rotateRefreshToken(rawToken, meta = {}) {
  const existing = await Session.findOne({ tokenHash: sha256(rawToken) });
  if (!existing) throw new AppError(401, "SESSION_INVALID", "Your session is no longer valid.");

  if (existing.revokedAt) {
    // Replay of a rotated token — assume theft and kill the whole family.
    await revokeFamily(existing.family);
    throw new AppError(401, "SESSION_REUSE", "Your session was reused and has been revoked.");
  }
  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, "SESSION_EXPIRED", "Your session has expired.");
  }

  const user = await User.findById(existing.userId);
  if (!user || user.disabledAt) throw new AppError(401, "SESSION_INVALID", "Your session is no longer valid.");

  const { token, session } = await issueRefreshToken(user, { ...meta, family: existing.family });
  existing.revokedAt = new Date();
  existing.replacedByHash = session.tokenHash;
  await existing.save();

  return { token, session, user };
}

module.exports = {
  issueAccessToken, verifyAccessToken, issueRefreshToken,
  rotateRefreshToken, revokeSession, revokeFamily,
};
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run tests/services/tokenService.test.js`
Expected: PASS (6 tests). Requires `AppError` from Task 6 — implement that file first if running out of order.

- [ ] **Step 7: Commit**

```bash
git add server/src/utils/hash.js server/src/models/Session.js \
        server/src/services/tokenService.js server/tests/services/tokenService.test.js
git commit -m "feat: add session model and refresh rotation with reuse detection"
```

---

## Task 6: Error envelope, async handler, and zod validation middleware

**Files:**
- Create: `server/src/utils/AppError.js`, `server/src/utils/asyncHandler.js`, `server/src/middleware/errorHandler.js`, `server/src/middleware/validate.js`
- Test: `server/tests/middleware/errorHandler.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `new AppError(status, code, message, details?)`; `asyncHandler(fn) → handler`; `errorHandler(err, req, res, next)`; `validate({ body?, params?, query? }) → middleware`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect } = require("vitest");
const express = require("express");
const request = require("supertest");
const { z } = require("zod");
const AppError = require("../../src/utils/AppError");
const asyncHandler = require("../../src/utils/asyncHandler");
const errorHandler = require("../../src/middleware/errorHandler");
const validate = require("../../src/middleware/validate");

const app = express();
app.use(express.json());
app.get("/boom", asyncHandler(async () => { throw new AppError(403, "NOPE", "Not allowed."); }));
app.get("/crash", asyncHandler(async () => { throw new Error("kaboom"); }));
app.post("/thing", validate({ body: z.object({ qty: z.number().int().positive() }) }),
  (req, res) => res.json({ ok: true }));
app.use(errorHandler);

describe("error envelope", () => {
  it("keeps `error` a plain string so the existing client keeps working", async () => {
    const res = await request(app).get("/boom");
    expect(res.status).toBe(403);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error).toBe("Not allowed.");
    expect(res.body.code).toBe("NOPE");
  });

  it("hides internal messages behind a 500", async () => {
    const res = await request(app).get("/crash");
    expect(res.status).toBe(500);
    expect(res.body.error).not.toMatch(/kaboom/);
    expect(res.body.code).toBe("INTERNAL");
  });

  it("returns 422 with per-field details on validation failure", async () => {
    const res = await request(app).post("/thing").send({ qty: -1 });
    expect(res.status).toBe(422);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.details[0].path).toBe("qty");
  });

  it("passes valid bodies through", async () => {
    const res = await request(app).post("/thing").send({ qty: 2 });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/middleware/errorHandler.test.js`
Expected: FAIL — cannot find module `AppError`

- [ ] **Step 3: Implement the four files**

`server/src/utils/AppError.js`

```js
class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
module.exports = AppError;
```

`server/src/utils/asyncHandler.js`

```js
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

`server/src/middleware/errorHandler.js`

```js
const AppError = require("../utils/AppError");

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.message, code: err.code };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: "That value is already in use.", code: "DUPLICATE" });
  }
  if (err && err.name === "ValidationError") {
    return res.status(422).json({
      error: "Some fields need attention.",
      code: "VALIDATION",
      details: Object.entries(err.errors).map(([path, e]) => ({ path, message: e.message })),
    });
  }
  console.error(err);
  return res.status(500).json({ error: "Something went wrong on our side.", code: "INTERNAL" });
};
```

`server/src/middleware/validate.js`

```js
const AppError = require("../utils/AppError");

module.exports = (schemas) => (req, res, next) => {
  for (const key of ["body", "params", "query"]) {
    if (!schemas[key]) continue;
    const parsed = schemas[key].safeParse(req[key]);
    if (!parsed.success) {
      return next(new AppError(422, "VALIDATION", "Some fields need attention.",
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))));
    }
    req[key] = parsed.data;
  }
  return next();
};
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/middleware/errorHandler.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils server/src/middleware server/tests/middleware
git commit -m "feat: add error envelope, async handler and zod validation middleware"
```

---

## Task 7: Auth middleware — attachUser, requireAuth, requireRole, originCheck

**Files:**
- Create: `server/src/middleware/attachUser.js`, `requireAuth.js`, `requireRole.js`, `originCheck.js`, `rateLimit.js` (all under `server/src/middleware/`)
- Test: `server/tests/middleware/auth.test.js`

**Interfaces:**
- Consumes: `tokenService` (Task 5), `User` (Task 4), `AppError` (Task 6)
- Produces: `attachUser` (never throws; sets `req.user` or leaves it undefined); `requireAuth`; `requireRole(...roles)`; `originCheck(allowedOrigins)`; `rateLimit.loginLimiter`, `rateLimit.otpRequestLimiter`, `rateLimit.otpVerifyLimiter`
- Cookie names: `so_at` (access), `so_rt` (refresh), `so_gid` (guest id)

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const User = require("../../src/models/User");
const tokenService = require("../../src/services/tokenService");
const attachUser = require("../../src/middleware/attachUser");
const requireAuth = require("../../src/middleware/requireAuth");
const requireRole = require("../../src/middleware/requireRole");
const originCheck = require("../../src/middleware/originCheck");
const errorHandler = require("../../src/middleware/errorHandler");

process.env.JWT_SECRET = "t".repeat(32);

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(originCheck(["http://localhost:5173"]));
app.use(attachUser);
app.get("/open", (req, res) => res.json({ user: req.user ? req.user.name : null }));
app.get("/private", requireAuth, (req, res) => res.json({ ok: true }));
app.get("/admin", requireAuth, requireRole("admin"), (req, res) => res.json({ ok: true }));
app.post("/mutate", (req, res) => res.json({ ok: true }));
app.use(errorHandler);

let user; let accessToken;
beforeEach(async () => {
  user = await User.create({ name: "Subhasis", phone: "+919830000000" });
  accessToken = tokenService.issueAccessToken(user);
});

describe("auth middleware", () => {
  it("leaves req.user unset for anonymous callers without erroring", async () => {
    const res = await request(app).get("/open");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("attaches the user from a valid access cookie", async () => {
    const res = await request(app).get("/open").set("Cookie", `so_at=${accessToken}`);
    expect(res.body.user).toBe("Subhasis");
  });

  it("ignores a malformed token rather than 500ing", async () => {
    const res = await request(app).get("/open").set("Cookie", "so_at=garbage");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("rejects a token whose tokenVersion is stale", async () => {
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
    const res = await request(app).get("/private").set("Cookie", `so_at=${accessToken}`);
    expect(res.status).toBe(401);
  });

  it("401s an anonymous caller on a protected route", async () => {
    expect((await request(app).get("/private")).status).toBe(401);
  });

  it("403s a customer on an admin route", async () => {
    const res = await request(app).get("/admin").set("Cookie", `so_at=${accessToken}`);
    expect(res.status).toBe(403);
  });

  it("allows an admin through", async () => {
    const admin = await User.create({ name: "A", phone: "+919830000009", role: "admin" });
    const res = await request(app).get("/admin")
      .set("Cookie", `so_at=${tokenService.issueAccessToken(admin)}`);
    expect(res.status).toBe(200);
  });

  it("rejects a mutating request from a foreign origin", async () => {
    const res = await request(app).post("/mutate").set("Origin", "http://evil.example");
    expect(res.status).toBe(403);
  });

  it("allows a mutating request with no Origin header (non-browser client)", async () => {
    expect((await request(app).post("/mutate")).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/middleware/auth.test.js`
Expected: FAIL — cannot find module `attachUser`

- [ ] **Step 3: Implement the middleware**

`attachUser.js`

```js
const User = require("../models/User");
const tokenService = require("../services/tokenService");

// Never throws — downstream requireAuth decides whether anonymity is acceptable.
module.exports = async function attachUser(req, res, next) {
  const token = req.cookies && req.cookies.so_at;
  if (!token) return next();
  try {
    const claims = tokenService.verifyAccessToken(token);
    const user = await User.findById(claims.sub);
    if (user && !user.disabledAt && user.tokenVersion === claims.ver) req.user = user;
  } catch {
    /* invalid or expired token — treat as anonymous */
  }
  return next();
};
```

`requireAuth.js`

```js
const AppError = require("../utils/AppError");

module.exports = function requireAuth(req, res, next) {
  if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Please sign in to continue."));
  return next();
};
```

`requireRole.js`

```js
const AppError = require("../utils/AppError");

module.exports = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Please sign in to continue."));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, "FORBIDDEN", "You don't have access to that."));
  }
  return next();
};
```

`originCheck.js`

```js
const AppError = require("../utils/AppError");
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Defence in depth behind SameSite=Lax. A missing Origin means a non-browser
// client (curl, mobile app), which carries no ambient-cookie risk.
module.exports = (allowed) => (req, res, next) => {
  if (!MUTATING.has(req.method)) return next();
  const origin = req.get("Origin");
  if (!origin) return next();
  if (allowed.includes(origin)) return next();
  return next(new AppError(403, "BAD_ORIGIN", "Request origin not allowed."));
};
```

`rateLimit.js`

```js
const rateLimit = require("express-rate-limit");

const json = (message, code) => (req, res) => res.status(429).json({ error: message, code });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ""}`,
  handler: json("Too many sign-in attempts. Try again in a few minutes.", "RATE_LIMITED"),
  standardHeaders: true, legacyHeaders: false,
});

// Spec §6.5 asks for two independent ceilings on OTP requests: per phone, so one
// number cannot be spammed, and per IP, so one host cannot enumerate many numbers.
const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => (req.body && req.body.phone) || req.ip,
  handler: json("Too many codes requested for that number. Try again later.", "RATE_LIMITED"),
  standardHeaders: true, legacyHeaders: false,
});

const otpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  handler: json("Too many codes requested. Try again later.", "RATE_LIMITED"),
  standardHeaders: true, legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: json("Too many attempts. Request a new code.", "RATE_LIMITED"),
  standardHeaders: true, legacyHeaders: false,
});

module.exports = { loginLimiter, otpRequestLimiter, otpIpLimiter, otpVerifyLimiter };
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/middleware/auth.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware server/tests/middleware/auth.test.js
git commit -m "feat: add auth, role, origin and rate-limit middleware"
```

---

## Task 8: authService and the auth routes

**Files:**
- Create: `server/src/services/authService.js`, `server/src/routes/auth.js`, `server/src/utils/cookies.js`
- Test: `server/tests/routes/auth.test.js`
- Modify: `server/src/index.js` (mount `/api/auth`, add `cookieParser`, `originCheck`, `attachUser`)

**Interfaces:**
- Consumes: `User`, `tokenService`, `AppError`, `validate`, `rateLimit`
- Produces:
  - `authService.register({ name, email, password }) → user`
  - `authService.login({ email, password }) → user` (throws 401 `CREDENTIALS`)
  - `authService.changePassword(user, newPassword) → user` (bumps `tokenVersion`)
  - `cookies.setAuthCookies(res, { accessToken, refreshToken })`, `cookies.clearAuthCookies(res)`, `cookies.GUEST_COOKIE = "so_gid"`
- Routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/me`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect } = require("vitest");
const request = require("supertest");
const app = require("../../src/app"); // extracted in this task
const User = require("../../src/models/User");

const creds = { name: "Subhasis", email: "s@example.com", password: "correct-horse-1" };
const cookieValue = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0].split("=")[1] : null;
};

describe("auth routes", () => {
  it("registers a user and sets both auth cookies httpOnly", async () => {
    const res = await request(app).post("/api/auth/register").send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("s@example.com");
    expect(res.body.user.passwordHash).toBeUndefined();
    const setCookie = res.headers["set-cookie"].join(";");
    expect(setCookie).toMatch(/so_at=/);
    expect(setCookie).toMatch(/so_rt=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/register").send(creds);
    const res = await request(app).post("/api/auth/register").send(creds);
    expect(res.status).toBe(409);
    expect(typeof res.body.error).toBe("string");
  });

  it("rejects a weak password with 422", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...creds, password: "short" });
    expect(res.status).toBe(422);
    expect(res.body.details[0].path).toBe("password");
  });

  it("logs in with correct credentials and rejects wrong ones identically", async () => {
    await request(app).post("/api/auth/register").send(creds);
    expect((await request(app).post("/api/auth/login")
      .send({ email: creds.email, password: creds.password })).status).toBe(200);

    const wrongPass = await request(app).post("/api/auth/login")
      .send({ email: creds.email, password: "nope-nope-nope" });
    const noUser = await request(app).post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "nope-nope-nope" });
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    // Identical message — must not reveal whether the account exists.
    expect(wrongPass.body.error).toBe(noUser.body.error);
  });

  it("returns the current user from /me and 401s when anonymous", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const at = cookieValue(reg, "so_at");
    const me = await request(app).get("/api/auth/me").set("Cookie", `so_at=${at}`);
    expect(me.body.user.name).toBe("Subhasis");
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("rotates cookies on refresh", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const rt = cookieValue(reg, "so_rt");
    const res = await request(app).post("/api/auth/refresh").set("Cookie", `so_rt=${rt}`);
    expect(res.status).toBe(200);
    expect(cookieValue(res, "so_rt")).not.toBe(rt);
  });

  it("revokes the session on logout so refresh stops working", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const rt = cookieValue(reg, "so_rt");
    await request(app).post("/api/auth/logout").set("Cookie", `so_rt=${rt}`);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", `so_rt=${rt}`)).status).toBe(401);
  });

  it("invalidates existing access tokens after a password change", async () => {
    const reg = await request(app).post("/api/auth/register").send(creds);
    const at = cookieValue(reg, "so_at");
    await request(app).patch("/api/auth/me")
      .set("Cookie", `so_at=${at}`).send({ password: "brand-new-secret-9" });
    expect((await request(app).get("/api/auth/me").set("Cookie", `so_at=${at}`)).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/routes/auth.test.js`
Expected: FAIL — cannot find module `src/app`

- [ ] **Step 3: Extract the Express app into `server/src/app.js`**

`index.js` currently builds the app and calls `listen` in one file, which makes it untestable. Split them: `app.js` exports the configured app; `index.js` loads env, connects the database, and listens.

```js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const attachUser = require("./middleware/attachUser");
const originCheck = require("./middleware/originCheck");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors({ origin: CORS_ORIGIN.split(","), credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(originCheck(CORS_ORIGIN.split(",")));
app.use(attachUser);

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "subhone-api", time: new Date().toISOString() }));

app.use("/api/auth", require("./routes/auth"));
// Remaining routers are mounted here as later tasks land.

app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found", code: "NOT_FOUND" }));
app.use(errorHandler);

module.exports = app;
```

And `server/src/index.js` becomes:

```js
require("dotenv").config();
const { loadEnv } = require("./config/env");
const { connectDb } = require("./config/db");

const cfg = loadEnv();
const app = require("./app");

connectDb(cfg.MONGODB_URI)
  .then(() => app.listen(cfg.PORT, () => {
    console.log(`\n  🌿 SubhOne API running on http://localhost:${cfg.PORT}`);
    console.log(`     Health:  http://localhost:${cfg.PORT}/api/health\n`);
  }))
  .catch((err) => { console.error("Failed to start:", err.message); process.exit(1); });
```

- [ ] **Step 4: Implement `server/src/utils/cookies.js`**

```js
const GUEST_COOKIE = "so_gid";
const ACCESS_COOKIE = "so_at";
const REFRESH_COOKIE = "so_rt";

const secure = () => String(process.env.COOKIE_SECURE) === "true";
const base = () => ({ httpOnly: true, sameSite: "lax", secure: secure() });

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...base(), path: "/", maxAge: 15 * 60 * 1000 });
  if (refreshToken) {
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...base(), path: "/api/auth", maxAge: days * 24 * 3600 * 1000,
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...base(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: "/api/auth" });
}

function clearGuestCookie(res) {
  res.clearCookie(GUEST_COOKIE, { ...base(), path: "/" });
}

module.exports = {
  setAuthCookies, clearAuthCookies, clearGuestCookie,
  GUEST_COOKIE, ACCESS_COOKIE, REFRESH_COOKIE,
};
```

- [ ] **Step 5: Implement `server/src/services/authService.js`**

```js
const bcrypt = require("bcrypt");
const User = require("../models/User");
const AppError = require("../utils/AppError");

const ROUNDS = 12;

async function register({ name, email, password }) {
  const normalised = String(email).toLowerCase();
  if (await User.findOne({ email: normalised })) {
    throw new AppError(409, "EMAIL_TAKEN", "An account with that email already exists.");
  }
  return User.create({
    name, email: normalised, passwordHash: await bcrypt.hash(password, ROUNDS),
  });
}

async function login({ email, password }) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  // Identical error for unknown account and wrong password — no account enumeration.
  const invalid = new AppError(401, "CREDENTIALS", "That email or password isn't right.");
  if (!user || !user.passwordHash) throw invalid;
  if (!(await bcrypt.compare(password, user.passwordHash))) throw invalid;
  if (user.disabledAt) throw new AppError(403, "DISABLED", "That account is disabled.");
  return user;
}

async function changePassword(user, newPassword) {
  user.passwordHash = await bcrypt.hash(newPassword, ROUNDS);
  user.tokenVersion += 1; // invalidates every outstanding access token
  return user.save();
}

module.exports = { register, login, changePassword, ROUNDS };
```

- [ ] **Step 6: Implement `server/src/routes/auth.js`**

```js
const express = require("express");
const { z } = require("zod");
const router = express.Router();

const authService = require("../services/authService");
const tokenService = require("../services/tokenService");
const cartService = require("../services/cartService"); // Task 10
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { loginLimiter } = require("../middleware/rateLimit");
const {
  setAuthCookies, clearAuthCookies, clearGuestCookie, GUEST_COOKIE, REFRESH_COOKIE,
} = require("../utils/cookies");

const meta = (req) => ({ userAgent: req.get("User-Agent"), ip: req.ip });

// Issues cookies and folds any guest cart into the user's own.
async function establishSession(req, res, user, status = 200) {
  const accessToken = tokenService.issueAccessToken(user);
  const { token: refreshToken } = await tokenService.issueRefreshToken(user, meta(req));
  setAuthCookies(res, { accessToken, refreshToken });

  const guestId = req.cookies && req.cookies[GUEST_COOKIE];
  if (guestId) {
    await cartService.mergeGuestCart({ guestId, userId: user._id });
    clearGuestCookie(res);
  }
  return res.status(status).json({ user });
}

router.post("/register",
  validate({ body: z.object({
    name: z.string().trim().min(2),
    email: z.string().email(),
    password: z.string().min(8, "Use at least 8 characters"),
  }) }),
  asyncHandler(async (req, res) =>
    establishSession(req, res, await authService.register(req.body), 201)));

router.post("/login", loginLimiter,
  validate({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) }),
  asyncHandler(async (req, res) =>
    establishSession(req, res, await authService.login(req.body))));

router.post("/refresh", asyncHandler(async (req, res) => {
  const raw = req.cookies && req.cookies[REFRESH_COOKIE];
  if (!raw) throw new AppError(401, "SESSION_INVALID", "Your session is no longer valid.");
  const { token, user } = await tokenService.rotateRefreshToken(raw, meta(req));
  setAuthCookies(res, { accessToken: tokenService.issueAccessToken(user), refreshToken: token });
  return res.json({ user });
}));

router.post("/logout", asyncHandler(async (req, res) => {
  const raw = req.cookies && req.cookies[REFRESH_COOKIE];
  if (raw) await tokenService.revokeSession(raw);
  clearAuthCookies(res);
  return res.status(204).end();
}));

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

router.patch("/me", requireAuth,
  validate({ body: z.object({
    name: z.string().trim().min(2).optional(),
    password: z.string().min(8).optional(),
  }).refine((v) => v.name || v.password, { message: "Nothing to update" }) }),
  asyncHandler(async (req, res) => {
    if (req.body.name) { req.user.name = req.body.name; await req.user.save(); }
    if (req.body.password) await authService.changePassword(req.user, req.body.password);
    return res.json({ user: req.user });
  }));

module.exports = router;
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `npx vitest run tests/routes/auth.test.js`
Expected: PASS (8 tests). `cartService.mergeGuestCart` arrives in Task 10 — until then, stub it as a resolved no-op in `cartService` so this suite runs green, and Task 10 replaces the stub with the real implementation plus its own tests.

- [ ] **Step 8: Commit**

```bash
git add server/src/app.js server/src/index.js server/src/routes/auth.js \
        server/src/services/authService.js server/src/utils/cookies.js \
        server/tests/routes/auth.test.js
git commit -m "feat: add auth service and routes with cookie sessions"
```

---

## Task 9: OtpChallenge model, SMS provider interface, and otpService

The provider boundary matters more than the dev implementation: P0 ships a logger, but nothing outside `smsProvider.js` may know that.

**Files:**
- Create: `server/src/models/OtpChallenge.js`, `server/src/services/smsProvider.js`, `server/src/services/otpService.js`
- Test: `server/tests/services/otpService.test.js`

**Interfaces:**
- Consumes: `hashOtp` (Task 5), `AppError` (Task 6), env `OTP_PEPPER`, `SMS_PROVIDER`
- Produces:
  - `smsProvider.getProvider() → { name, send({ to, message }) }`
  - `otpService.requestOtp(phone) → { challengeId, expiresAt, devCode? }` (`devCode` only when `SMS_PROVIDER === "dev"`)
  - `otpService.verifyOtp({ challengeId, code }) → { phone }` (throws 400 `OTP_INVALID` / `OTP_EXPIRED` / 429 `OTP_ATTEMPTS`)
- Rules: 6-digit code, 5-minute TTL, stored only as `hashOtp(code, OTP_PEPPER)`, max 5 attempts, single-use (`consumedAt`)

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach, vi } = require("vitest");
const OtpChallenge = require("../../src/models/OtpChallenge");
const otpService = require("../../src/services/otpService");

process.env.OTP_PEPPER = "p".repeat(16);
process.env.SMS_PROVIDER = "dev";

const PHONE = "+919830000000";

describe("otpService", () => {
  it("stores only a hash of the code, never the code itself", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    const doc = await OtpChallenge.findById(challengeId);
    expect(devCode).toMatch(/^\d{6}$/);
    expect(doc.codeHash).not.toContain(devCode);
    expect(doc.codeHash).toHaveLength(64);
    expect(JSON.stringify(doc.toObject())).not.toContain(devCode);
  });

  it("verifies a correct code and returns the phone", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    const result = await otpService.verifyOtp({ challengeId, code: devCode });
    expect(result.phone).toBe(PHONE);
  });

  it("refuses to reuse a consumed challenge", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    await otpService.verifyOtp({ challengeId, code: devCode });
    await expect(otpService.verifyOtp({ challengeId, code: devCode }))
      .rejects.toThrow(/invalid|used/i);
  });

  it("locks the challenge after five wrong attempts", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    for (let i = 0; i < 5; i += 1) {
      await expect(otpService.verifyOtp({ challengeId, code: "000000" })).rejects.toThrow();
    }
    // Even the right code must now fail — the challenge is spent.
    await expect(otpService.verifyOtp({ challengeId, code: devCode }))
      .rejects.toThrow(/attempts|invalid/i);
  });

  it("rejects an expired challenge", async () => {
    const { challengeId, devCode } = await otpService.requestOtp(PHONE);
    await OtpChallenge.updateOne({ _id: challengeId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(otpService.verifyOtp({ challengeId, code: devCode }))
      .rejects.toThrow(/expired/i);
  });

  it("omits devCode when a real provider is configured", async () => {
    process.env.SMS_PROVIDER = "twilio";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      // No credentials configured, so the factory must fail loudly rather than
      // silently falling back to the dev logger.
      await expect(otpService.requestOtp(PHONE)).rejects.toThrow(/provider/i);
    } finally {
      spy.mockRestore();
      process.env.SMS_PROVIDER = "dev";
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/services/otpService.test.js`
Expected: FAIL — cannot find module `models/OtpChallenge`

- [ ] **Step 3: Implement `server/src/models/OtpChallenge.js`**

```js
const mongoose = require("mongoose");
const { E164 } = require("./User");

const otpChallengeSchema = new mongoose.Schema({
  phone: { type: String, required: true, match: E164, index: true },
  codeHash: { type: String, required: true },
  purpose: { type: String, enum: ["login", "link_phone"], default: "login" },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OtpChallenge", otpChallengeSchema);
```

If `User.js` does not already export `E164`, add `module.exports.E164 = E164;` alongside the model export in Task 4's file rather than duplicating the pattern here.

- [ ] **Step 4: Implement `server/src/services/smsProvider.js`**

```js
const AppError = require("../utils/AppError");

// Dev provider: prints the code to the server console. The only place in the
// codebase allowed to know a code's plaintext value.
const devLoggerProvider = {
  name: "dev",
  async send({ to, message }) {
    console.log(`\n  📱 [dev-sms] → ${to}\n     ${message}\n`);
    return { id: `dev-${Date.now()}`, provider: "dev" };
  },
};

function getProvider() {
  const configured = process.env.SMS_PROVIDER || "dev";
  if (configured === "dev") return devLoggerProvider;
  // Real providers register here in a later phase. Failing loudly beats silently
  // logging OTPs to stdout in an environment that expected real delivery.
  throw new AppError(500, "SMS_PROVIDER_MISSING",
    `SMS provider "${configured}" is not configured.`);
}

module.exports = { getProvider, devLoggerProvider };
```

- [ ] **Step 5: Implement `server/src/services/otpService.js`**

```js
const crypto = require("crypto");
const OtpChallenge = require("../models/OtpChallenge");
const { hashOtp } = require("../utils/hash");
const { getProvider } = require("./smsProvider");
const AppError = require("../utils/AppError");

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

async function requestOtp(phone, purpose = "login") {
  const provider = getProvider(); // resolve before writing anything
  const code = generateCode();
  const challenge = await OtpChallenge.create({
    phone, purpose,
    codeHash: hashOtp(code, process.env.OTP_PEPPER),
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  await provider.send({
    to: phone,
    message: `${code} is your SubhOne verification code. It expires in 5 minutes.`,
  });

  return {
    challengeId: String(challenge._id),
    expiresAt: challenge.expiresAt,
    ...(provider.name === "dev" ? { devCode: code } : {}),
  };
}

async function verifyOtp({ challengeId, code }) {
  const challenge = await OtpChallenge.findById(challengeId).catch(() => null);
  const invalid = new AppError(400, "OTP_INVALID", "That code isn't right.");
  if (!challenge || challenge.consumedAt) throw invalid;
  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "OTP_EXPIRED", "That code has expired. Request a new one.");
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new AppError(429, "OTP_ATTEMPTS", "Too many attempts. Request a new code.");
  }

  if (challenge.codeHash !== hashOtp(code, process.env.OTP_PEPPER)) {
    challenge.attempts += 1;
    await challenge.save();
    throw invalid;
  }

  challenge.consumedAt = new Date();
  await challenge.save();
  return { phone: challenge.phone, purpose: challenge.purpose };
}

module.exports = { requestOtp, verifyOtp, MAX_ATTEMPTS, TTL_MS };
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run tests/services/otpService.test.js`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add server/src/models/OtpChallenge.js server/src/services/smsProvider.js \
        server/src/services/otpService.js server/tests/services/otpService.test.js
git commit -m "feat: add OTP challenges behind an SMS provider interface"
```

---

## Task 10: OTP routes — phone login and phone linking

Phone OTP is both a login method and an identity upgrade. The rule: verifying a phone that already belongs to a user logs into *that* user; verifying an unknown phone creates one; verifying while already signed in links the phone to the current account and never switches identity.

**Files:**
- Modify: `server/src/routes/auth.js` (add three routes), `server/src/services/authService.js` (add `findOrCreateByPhone`)
- Test: `server/tests/routes/otp.test.js`

**Interfaces:**
- Consumes: `otpService` (Task 9), `establishSession` (Task 8), `requireAuth`
- Produces:
  - `POST /api/auth/otp/request` `{ phone }` → `202 { challengeId, expiresAt, devCode? }`
  - `POST /api/auth/otp/verify` `{ challengeId, code }` → `{ user }` + cookies
  - `POST /api/auth/link-phone` (auth required) `{ challengeId, code }` → `{ user }`
  - `authService.findOrCreateByPhone(phone) → { user, created }`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect } = require("vitest");
const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/User");

process.env.SMS_PROVIDER = "dev";
const PHONE = "+919830000000";

const cookieValue = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0].split("=")[1] : null;
};

const requestCode = async (phone = PHONE) => {
  const res = await request(app).post("/api/auth/otp/request").send({ phone });
  expect(res.status).toBe(202);
  return res.body;
};

describe("phone OTP", () => {
  it("returns a challenge and a dev code, never the hash", async () => {
    const body = await requestCode();
    expect(body.challengeId).toBeTruthy();
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body.codeHash).toBeUndefined();
  });

  it("rejects a non-E.164 phone with 422", async () => {
    const res = await request(app).post("/api/auth/otp/request").send({ phone: "9830000000" });
    expect(res.status).toBe(422);
  });

  it("creates an account on first verification and signs it in", async () => {
    const { challengeId, devCode } = await requestCode();
    const res = await request(app).post("/api/auth/otp/verify").send({ challengeId, code: devCode });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(PHONE);
    expect(res.body.user.phoneVerifiedAt).toBeTruthy();
    expect(cookieValue(res, "so_at")).toBeTruthy();
    expect(await User.countDocuments({ phone: PHONE })).toBe(1);
  });

  it("signs into the same account on a second verification", async () => {
    const first = await requestCode();
    const a = await request(app).post("/api/auth/otp/verify")
      .send({ challengeId: first.challengeId, code: first.devCode });
    const second = await requestCode();
    const b = await request(app).post("/api/auth/otp/verify")
      .send({ challengeId: second.challengeId, code: second.devCode });
    expect(b.body.user.id || b.body.user._id).toEqual(a.body.user.id || a.body.user._id);
    expect(await User.countDocuments({ phone: PHONE })).toBe(1);
  });

  it("rejects a wrong code with 400", async () => {
    const { challengeId } = await requestCode();
    const res = await request(app).post("/api/auth/otp/verify")
      .send({ challengeId, code: "000000" });
    expect(res.status).toBe(400);
  });

  it("links a verified phone to the signed-in account", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
    const at = cookieValue(reg, "so_at");
    const { challengeId, devCode } = await requestCode();
    const res = await request(app).post("/api/auth/link-phone")
      .set("Cookie", `so_at=${at}`).send({ challengeId, code: devCode });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(PHONE);
    expect(await User.countDocuments({})).toBe(1); // linked, not duplicated
  });

  it("refuses to link a phone already owned by another account", async () => {
    const own = await requestCode();
    await request(app).post("/api/auth/otp/verify")
      .send({ challengeId: own.challengeId, code: own.devCode });

    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Other", email: "o@example.com", password: "correct-horse-1" });
    const at = cookieValue(reg, "so_at");
    const next = await requestCode();
    const res = await request(app).post("/api/auth/link-phone")
      .set("Cookie", `so_at=${at}`).send({ challengeId: next.challengeId, code: next.devCode });
    expect(res.status).toBe(409);
  });

  it("does not switch identity when verifying while signed in", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
    const at = cookieValue(reg, "so_at");
    const { challengeId, devCode } = await requestCode();
    // /otp/verify is a login endpoint; hitting it while signed in must still
    // resolve by phone, not silently mutate the current account.
    const res = await request(app).post("/api/auth/otp/verify")
      .set("Cookie", `so_at=${at}`).send({ challengeId, code: devCode });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/routes/otp.test.js`
Expected: FAIL — 404 on `/api/auth/otp/request`

- [ ] **Step 3: Add `findOrCreateByPhone` to `authService.js`**

```js
async function findOrCreateByPhone(phone) {
  const existing = await User.findOne({ phone });
  if (existing) {
    if (existing.disabledAt) throw new AppError(403, "DISABLED", "That account is disabled.");
    if (!existing.phoneVerifiedAt) {
      existing.phoneVerifiedAt = new Date();
      await existing.save();
    }
    return { user: existing, created: false };
  }
  const user = await User.create({
    name: "SubhOne Customer", phone, phoneVerifiedAt: new Date(),
  });
  return { user, created: true };
}
```

Add it to the module exports.

- [ ] **Step 4: Add the three routes to `server/src/routes/auth.js`**

```js
const otpService = require("../services/otpService");
const { otpRequestLimiter, otpIpLimiter, otpVerifyLimiter } = require("../middleware/rateLimit");
const { E164 } = require("../models/User");

const otpVerifyBody = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

router.post("/otp/request", otpIpLimiter, otpRequestLimiter,
  validate({ body: z.object({
    phone: z.string().regex(E164, "Enter a phone number with country code, e.g. +919830000000"),
  }) }),
  asyncHandler(async (req, res) =>
    res.status(202).json(await otpService.requestOtp(req.body.phone))));

router.post("/otp/verify", otpVerifyLimiter, validate({ body: otpVerifyBody }),
  asyncHandler(async (req, res) => {
    const { phone } = await otpService.verifyOtp(req.body);
    const { user } = await authService.findOrCreateByPhone(phone);
    return establishSession(req, res, user);
  }));

router.post("/link-phone", requireAuth, otpVerifyLimiter, validate({ body: otpVerifyBody }),
  asyncHandler(async (req, res) => {
    const { phone } = await otpService.verifyOtp(req.body);
    const owner = await User.findOne({ phone });
    if (owner && String(owner._id) !== String(req.user._id)) {
      throw new AppError(409, "PHONE_TAKEN", "That number is already linked to another account.");
    }
    req.user.phone = phone;
    req.user.phoneVerifiedAt = new Date();
    await req.user.save();
    return res.json({ user: req.user });
  }));
```

Add `const User = require("../models/User");` to the route file's imports.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run tests/routes/otp.test.js`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/auth.js server/src/services/authService.js server/tests/routes/otp.test.js
git commit -m "feat: add phone OTP login and phone linking"
```

---

## Task 11: Cart model and cartService with server-resolved pricing

This is the task that structurally kills the client-price vulnerability. The cart schema has no price field, so there is nowhere for a client-supplied price to land.

**Files:**
- Create: `server/src/models/Cart.js`, `server/src/services/cartService.js`
- Test: `server/tests/services/cartService.test.js`

**Interfaces:**
- Consumes: `Product` (Task 3), `constants.TYPE_MAP`, `MAX_CART_ITEM_QTY`, `FREE_DELIVERY_ABOVE_PAISE`, `DELIVERY_FEE_PAISE`
- Produces:
  - `cartService.getOrCreateCart({ userId, guestId }) → cart`
  - `cartService.addItem(owner, { id, type, quantity }) → summary`
  - `cartService.updateItem(owner, { id, type, quantity }) → summary` (quantity 0 removes)
  - `cartService.removeItem(owner, { id, type }) → summary`
  - `cartService.clearCart(owner) → summary`
  - `cartService.summarise(cart) → { items, itemCount, count, subtotal, mrpTotal, savings, deliveryFee, total, …Paise twins }`
  - `cartService.mergeGuestCart({ guestId, userId }) → cart`
- Public item shape returned to the client stays `{ id, type, name, image, price, originalPrice, quantity, … }` — the same key names as today, now carrying paise. `refModel` never appears in a response.

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const Product = require("../../src/models/Product");
const Cart = require("../../src/models/Cart");
const User = require("../../src/models/User");
const cartService = require("../../src/services/cartService");
const { FREE_DELIVERY_ABOVE_PAISE, DELIVERY_FEE_PAISE } = require("../../src/config/constants");

let med; let supp; let user;
beforeEach(async () => {
  med = await Product.create({
    kind: "medicine", name: "Paracetamol 500", slug: "para-500",
    brand: "Acme", pricePaise: 3000, mrpPaise: 4000, stock: 50,
  });
  supp = await Product.create({
    kind: "supplement", name: "Whey", slug: "whey",
    brand: "Acme", pricePaise: 250000, mrpPaise: 300000, stock: 10,
  });
  user = await User.create({ name: "S", phone: "+919830000000" });
});

describe("cartService", () => {
  it("stores no price on the cart line", async () => {
    await cartService.addItem({ userId: user._id }, { id: String(med._id), type: "medicine", quantity: 2 });
    const cart = await Cart.findOne({ userId: user._id });
    const line = cart.items[0].toObject();
    expect(line.quantity).toBe(2);
    expect(Object.keys(line).join(",")).not.toMatch(/price|mrp|total/i);
  });

  it("prices the cart from the catalog, ignoring anything the caller sends", async () => {
    await cartService.addItem({ userId: user._id },
      { id: String(med._id), type: "medicine", quantity: 2, pricePaise: 1 });
    const summary = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(summary.items[0].pricePaise).toBe(3000);
    expect(summary.subtotalPaise).toBe(6000);
  });

  it("keeps the exact key names CartContext.jsx already reads", async () => {
    // CartContext.jsx and CartDrawer.jsx are frozen; they read these names.
    // Dropping or renaming any of them silently blanks the cart UI.
    await cartService.addItem({ userId: user._id }, { id: String(med._id), type: "medicine", quantity: 2 });
    const s = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(s).toHaveProperty("itemCount", 2);
    expect(s).toHaveProperty("subtotal", 6000);   // paise
    expect(s).toHaveProperty("mrpTotal", 8000);
    expect(s).toHaveProperty("savings", 2000);
    const item = s.items[0];
    expect(item.price).toBe(3000);            // drawer reads item.price
    expect(item.originalPrice).toBe(4000);    // drawer reads item.originalPrice
    expect(item.id).toBe(String(med._id));
    expect(item.type).toBe("medicine");
    expect(item.refModel).toBeUndefined();    // internal names must not leak
  });

  it("charges delivery below the threshold and waives it above", async () => {
    await cartService.addItem({ userId: user._id }, { id: String(med._id), type: "medicine", quantity: 1 });
    let s = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(s.subtotalPaise).toBeLessThan(FREE_DELIVERY_ABOVE_PAISE);
    expect(s.deliveryFeePaise).toBe(DELIVERY_FEE_PAISE);
    expect(s.totalPaise).toBe(s.subtotalPaise + DELIVERY_FEE_PAISE);

    await cartService.addItem({ userId: user._id }, { id: String(supp._id), type: "supplement", quantity: 1 });
    s = await cartService.summarise(await cartService.getOrCreateCart({ userId: user._id }));
    expect(s.subtotalPaise).toBeGreaterThanOrEqual(FREE_DELIVERY_ABOVE_PAISE);
    expect(s.deliveryFeePaise).toBe(0);
  });

  it("increments quantity instead of duplicating a line", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: String(med._id), type: "medicine", quantity: 1 });
    await cartService.addItem(owner, { id: String(med._id), type: "medicine", quantity: 2 });
    const cart = await cartService.getOrCreateCart(owner);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  it("caps quantity at MAX_CART_ITEM_QTY", async () => {
    await expect(cartService.addItem({ userId: user._id },
      { id: String(med._id), type: "medicine", quantity: 99 })).rejects.toThrow(/quantity/i);
  });

  it("removes the line when quantity is set to zero", async () => {
    const owner = { userId: user._id };
    await cartService.addItem(owner, { id: String(med._id), type: "medicine", quantity: 2 });
    await cartService.updateItem(owner, { id: String(med._id), type: "medicine", quantity: 0 });
    expect((await cartService.getOrCreateCart(owner)).items).toHaveLength(0);
  });

  it("rejects an unknown or inactive product", async () => {
    await Product.updateOne({ _id: med._id }, { $set: { isActive: false } });
    await expect(cartService.addItem({ userId: user._id },
      { id: String(med._id), type: "medicine", quantity: 1 })).rejects.toThrow(/not available|not found/i);
  });

  it("keeps guest and user carts separate", async () => {
    await cartService.addItem({ guestId: "guest-1" }, { id: String(med._id), type: "medicine", quantity: 1 });
    await cartService.addItem({ userId: user._id }, { id: String(supp._id), type: "supplement", quantity: 1 });
    expect((await cartService.getOrCreateCart({ guestId: "guest-1" })).items).toHaveLength(1);
    expect((await cartService.getOrCreateCart({ userId: user._id })).items).toHaveLength(1);
  });

  it("sets a TTL only on guest carts", async () => {
    await cartService.addItem({ guestId: "guest-1" }, { id: String(med._id), type: "medicine", quantity: 1 });
    await cartService.addItem({ userId: user._id }, { id: String(med._id), type: "medicine", quantity: 1 });
    expect((await Cart.findOne({ guestId: "guest-1" })).guestExpiresAt).toBeTruthy();
    expect((await Cart.findOne({ userId: user._id })).guestExpiresAt).toBeFalsy();
  });

  it("merges a guest cart by summing overlapping lines, then deletes it", async () => {
    await cartService.addItem({ guestId: "g" }, { id: String(med._id), type: "medicine", quantity: 2 });
    await cartService.addItem({ guestId: "g" }, { id: String(supp._id), type: "supplement", quantity: 1 });
    await cartService.addItem({ userId: user._id }, { id: String(med._id), type: "medicine", quantity: 1 });

    const merged = await cartService.mergeGuestCart({ guestId: "g", userId: user._id });
    const byId = Object.fromEntries(merged.items.map((i) => [String(i.refId), i.quantity]));
    expect(byId[String(med._id)]).toBe(3);
    expect(byId[String(supp._id)]).toBe(1);
    expect(await Cart.findOne({ guestId: "g" })).toBeNull();
  });

  it("clamps a merged quantity to the per-item cap", async () => {
    await cartService.addItem({ guestId: "g" }, { id: String(med._id), type: "medicine", quantity: 8 });
    await cartService.addItem({ userId: user._id }, { id: String(med._id), type: "medicine", quantity: 8 });
    const merged = await cartService.mergeGuestCart({ guestId: "g", userId: user._id });
    expect(merged.items[0].quantity).toBe(10);
  });

  it("is a no-op when the guest has no cart", async () => {
    await expect(cartService.mergeGuestCart({ guestId: "nope", userId: user._id })).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/services/cartService.test.js`
Expected: FAIL — cannot find module `models/Cart`

- [ ] **Step 3: Implement `server/src/models/Cart.js`**

```js
const mongoose = require("mongoose");

// Deliberately price-free: a cart line records *what* and *how many*, never
// *for how much*. Pricing is resolved from the catalog at read time, so a
// client cannot influence money by any payload it sends.
const cartItemSchema = new mongoose.Schema({
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  refModel: { type: String, required: true, enum: ["Product", "LabTest"] },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  guestId: { type: String, default: null },
  items: { type: [cartItemSchema], default: [] },
  // Present on guest carts only — a TTL index cannot be conditional, so an
  // absent field is how a signed-in cart opts out of expiry.
  guestExpiresAt: { type: Date, default: undefined },
}, { timestamps: true });

cartSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });
cartSchema.index({ guestId: 1 }, { unique: true, partialFilterExpression: { guestId: { $type: "string" } } });
cartSchema.index({ guestExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Cart", cartSchema);
```

- [ ] **Step 4: Implement `server/src/services/cartService.js`**

```js
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const LabTest = require("../models/LabTest");
const AppError = require("../utils/AppError");
const {
  TYPE_MAP, MAX_CART_ITEM_QTY, FREE_DELIVERY_ABOVE_PAISE, DELIVERY_FEE_PAISE,
} = require("../config/constants");
// A deployment tunable, not a business constant — it lives in env, not constants.
const { GUEST_CART_TTL_DAYS } = require("../config/env").loadEnv();

const MODELS = { Product, LabTest };
const REVERSE_TYPE = { medicine: "medicine", supplement: "supplement", labTest: "labTest" };

function resolveType(type) {
  const mapped = TYPE_MAP[type];
  if (!mapped) throw new AppError(400, "BAD_TYPE", "That item type isn't recognised.");
  return mapped; // { refModel, kind }
}

function ownerFilter({ userId, guestId }) {
  if (userId) return { userId };
  if (guestId) return { guestId };
  throw new AppError(400, "NO_CART_OWNER", "Could not identify your cart.");
}

async function getOrCreateCart(owner) {
  const filter = ownerFilter(owner);
  const existing = await Cart.findOne(filter);
  if (existing) return existing;
  return Cart.create({
    ...filter,
    ...(owner.guestId
      ? { guestExpiresAt: new Date(Date.now() + GUEST_CART_TTL_DAYS * 24 * 3600 * 1000) }
      : {}),
  });
}

// Loads the catalog document and asserts it is purchasable.
async function loadRef({ id, type }) {
  const { refModel, kind } = resolveType(type);
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, "ITEM_NOT_FOUND", "That item is no longer available.");
  }
  const query = { _id: id, isActive: true, ...(kind ? { kind } : {}) };
  const doc = await MODELS[refModel].findOne(query);
  if (!doc) throw new AppError(404, "ITEM_NOT_FOUND", "That item is no longer available.");
  return { doc, refModel };
}

function assertQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEM_QTY) {
    throw new AppError(422, "BAD_QUANTITY",
      `Choose a quantity between 1 and ${MAX_CART_ITEM_QTY}.`);
  }
}

async function addItem(owner, { id, type, quantity = 1 }) {
  const { doc, refModel } = await loadRef({ id, type });
  const cart = await getOrCreateCart(owner);
  const line = cart.items.find(
    (i) => String(i.refId) === String(doc._id) && i.refModel === refModel);
  const nextQty = (line ? line.quantity : 0) + Number(quantity);
  assertQuantity(nextQty);

  if (line) line.quantity = nextQty;
  else cart.items.push({ refId: doc._id, refModel, quantity: nextQty });
  await cart.save();
  return summarise(cart);
}

async function updateItem(owner, { id, type, quantity }) {
  if (Number(quantity) === 0) return removeItem(owner, { id, type });
  const { doc, refModel } = await loadRef({ id, type });
  assertQuantity(Number(quantity));
  const cart = await getOrCreateCart(owner);
  const line = cart.items.find(
    (i) => String(i.refId) === String(doc._id) && i.refModel === refModel);
  if (!line) throw new AppError(404, "NOT_IN_CART", "That item isn't in your cart.");
  line.quantity = Number(quantity);
  await cart.save();
  return summarise(cart);
}

async function removeItem(owner, { id, type }) {
  const { refModel } = resolveType(type);
  const cart = await getOrCreateCart(owner);
  cart.items = cart.items.filter(
    (i) => !(String(i.refId) === String(id) && i.refModel === refModel));
  await cart.save();
  return summarise(cart);
}

async function clearCart(owner) {
  const cart = await getOrCreateCart(owner);
  cart.items = [];
  await cart.save();
  return summarise(cart);
}

// Hydrates lines with live catalog data and computes totals. Silently drops
// lines whose product has since been deactivated or deleted.
async function summarise(cart) {
  const byModel = cart.items.reduce((acc, i) => {
    (acc[i.refModel] = acc[i.refModel] || []).push(i.refId);
    return acc;
  }, {});

  const docs = new Map();
  await Promise.all(Object.entries(byModel).map(async ([refModel, ids]) => {
    const found = await MODELS[refModel].find({ _id: { $in: ids }, isActive: true });
    found.forEach((d) => docs.set(`${refModel}:${d._id}`, d));
  }));

  const items = cart.items.reduce((acc, line) => {
    const doc = docs.get(`${line.refModel}:${line.refId}`);
    if (!doc) return acc;
    const lineTotal = doc.pricePaise * line.quantity;
    acc.push({
      id: String(doc._id),
      type: doc.kind ? REVERSE_TYPE[doc.kind] : "labTest",
      name: doc.name,
      brand: doc.brand,
      image: doc.image,
      quantity: line.quantity,
      // Legacy key names, now carrying paise — see the cart contract note below.
      price: doc.pricePaise,
      originalPrice: doc.mrpPaise,
      lineTotal,
      // Explicit aliases for code written after the migration.
      pricePaise: doc.pricePaise,
      mrpPaise: doc.mrpPaise,
      lineTotalPaise: lineTotal,
      prescriptionRequired: Boolean(doc.prescriptionRequired),
      inStock: doc.stock === undefined ? true : doc.stock > 0,
    });
    return acc;
  }, []);

  const subtotalPaise = items.reduce((sum, i) => sum + i.lineTotalPaise, 0);
  const mrpTotalPaise = items.reduce(
    (sum, i) => sum + (i.mrpPaise || i.pricePaise) * i.quantity, 0);
  const savingsPaise = Math.max(0, mrpTotalPaise - subtotalPaise);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const deliveryFeePaise =
    subtotalPaise === 0 || subtotalPaise >= FREE_DELIVERY_ABOVE_PAISE ? 0 : DELIVERY_FEE_PAISE;

  // ⚠️ The legacy keys below (`itemCount`, `subtotal`, `mrpTotal`, `savings`) are the
  // exact names `CartContext.jsx` and `CartDrawer.jsx` already read, and that file is
  // frozen. They now carry *paise*. The `*Paise` twins exist so new code can be
  // unambiguous. Do not rename or drop the legacy keys.
  return {
    items,
    itemCount,
    count: itemCount,
    subtotal: subtotalPaise,
    mrpTotal: mrpTotalPaise,
    savings: savingsPaise,
    deliveryFee: deliveryFeePaise,
    total: subtotalPaise + deliveryFeePaise,
    subtotalPaise,
    mrpTotalPaise,
    savingsPaise,
    deliveryFeePaise,
    totalPaise: subtotalPaise + deliveryFeePaise,
    freeDeliveryAbovePaise: FREE_DELIVERY_ABOVE_PAISE,
  };
}

// Folds a guest cart into the user's cart, summing overlapping lines and
// clamping to the per-item cap, then deletes the guest cart.
async function mergeGuestCart({ guestId, userId }) {
  const guestCart = await Cart.findOne({ guestId });
  const userCart = await getOrCreateCart({ userId });
  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) await Cart.deleteOne({ _id: guestCart._id });
    return userCart;
  }

  guestCart.items.forEach((gi) => {
    const line = userCart.items.find(
      (ui) => String(ui.refId) === String(gi.refId) && ui.refModel === gi.refModel);
    if (line) line.quantity = Math.min(line.quantity + gi.quantity, MAX_CART_ITEM_QTY);
    else userCart.items.push({ refId: gi.refId, refModel: gi.refModel, quantity: gi.quantity });
  });

  await userCart.save();
  await Cart.deleteOne({ _id: guestCart._id });
  return userCart;
}

module.exports = {
  getOrCreateCart, addItem, updateItem, removeItem, clearCart,
  summarise, mergeGuestCart,
};
```

Add `GUEST_CART_TTL_DAYS` to `server/.env.example` with the value `30` if Task 1's `.env.example` omitted it — the zod schema already defaults it, so a missing entry is a documentation gap, not a boot failure.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run tests/services/cartService.test.js`
Expected: PASS (13 tests). This task also replaces the `mergeGuestCart` stub introduced in Task 8, so re-run `npx vitest run tests/routes/auth.test.js` and confirm it is still green.

- [ ] **Step 6: Commit**

```bash
git add server/src/models/Cart.js server/src/services/cartService.js \
        server/tests/services/cartService.test.js
git commit -m "feat: add persistent carts with server-resolved pricing"
```

---

## Task 12: attachCartOwner and the cart routes

The HTTP contract must come out byte-compatible in shape with today's, so `CartContext.jsx` keeps working untouched.

**Files:**
- Create: `server/src/middleware/attachCartOwner.js`
- Rewrite: `server/src/routes/cart.js`
- Modify: `server/src/app.js` (mount `/api/cart`)
- Test: `server/tests/routes/cart.test.js`

**Interfaces:**
- Consumes: `cartService` (Task 11), `cookies.GUEST_COOKIE`
- Produces: `attachCartOwner` sets `req.cartOwner = { userId }` or `{ guestId }`, minting and setting `so_gid` when needed
- Routes (all shapes unchanged): `GET /api/cart`, `POST /api/cart/add`, `PUT /api/cart/update`, `DELETE /api/cart/:type/:id`, `DELETE /api/cart`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");

let med;
beforeEach(async () => {
  med = await Product.create({
    kind: "medicine", name: "Paracetamol 500", slug: "para-500",
    brand: "Acme", pricePaise: 3000, mrpPaise: 4000, stock: 50,
  });
});

const guestCookie = (res) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith("so_gid="));
  return raw ? raw.split(";")[0] : null;
};

describe("cart routes", () => {
  it("returns an empty cart in the legacy shape for a first-time visitor", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.itemCount).toBe(0);
    expect(res.body.subtotal).toBe(0);
    expect(guestCookie(res)).toBeTruthy();
  });

  it("adds an item and returns the whole cart, as the client expects", async () => {
    const res = await request(app).post("/api/cart/add")
      .send({ id: String(med._id), type: "medicine", quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.itemCount).toBe(2);
    expect(res.body.subtotal).toBe(6000);
  });

  it("keeps two different guests' carts apart", async () => {
    const first = await request(app).post("/api/cart/add")
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    const cookie = guestCookie(first);
    const same = await request(app).get("/api/cart").set("Cookie", cookie);
    expect(same.body.itemCount).toBe(1);
    const other = await request(app).get("/api/cart"); // no cookie → new guest
    expect(other.body.itemCount).toBe(0);
  });

  it("updates and removes a line", async () => {
    const add = await request(app).post("/api/cart/add")
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    const cookie = guestCookie(add);

    const upd = await request(app).put("/api/cart/update").set("Cookie", cookie)
      .send({ id: String(med._id), type: "medicine", quantity: 3 });
    expect(upd.body.itemCount).toBe(3);

    const del = await request(app).delete(`/api/cart/medicine/${med._id}`).set("Cookie", cookie);
    expect(del.body.items).toHaveLength(0);
  });

  it("clears the cart", async () => {
    const add = await request(app).post("/api/cart/add")
      .send({ id: String(med._id), type: "medicine", quantity: 2 });
    const res = await request(app).delete("/api/cart").set("Cookie", guestCookie(add));
    expect(res.body.itemCount).toBe(0);
  });

  it("404s an unknown product id", async () => {
    const res = await request(app).post("/api/cart/add")
      .send({ id: "64b7f9d2e1a4c5b6d7e8f901", type: "medicine", quantity: 1 });
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe("string");
  });

  it("422s a bad quantity rather than silently clamping", async () => {
    const res = await request(app).post("/api/cart/add")
      .send({ id: String(med._id), type: "medicine", quantity: 99 });
    expect(res.status).toBe(422);
  });

  it("never leaks internal model names", async () => {
    const res = await request(app).post("/api/cart/add")
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/refModel|refId/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/routes/cart.test.js`
Expected: FAIL — the old `store`-backed route returns the legacy in-memory cart and no `so_gid` cookie

- [ ] **Step 3: Implement `server/src/middleware/attachCartOwner.js`**

```js
const { v4: uuid } = require("uuid");
const { GUEST_COOKIE } = require("../utils/cookies");

// A signed-in user always owns their own cart. Anonymous visitors get a
// stable guest id in a cookie so their cart survives a page reload and can be
// merged on login.
module.exports = function attachCartOwner(req, res, next) {
  if (req.user) {
    req.cartOwner = { userId: req.user._id };
    return next();
  }
  let guestId = req.cookies && req.cookies[GUEST_COOKIE];
  if (!guestId) {
    guestId = uuid();
    res.cookie(GUEST_COOKIE, guestId, {
      httpOnly: true, sameSite: "lax",
      secure: String(process.env.COOKIE_SECURE) === "true",
      path: "/", maxAge: 30 * 24 * 3600 * 1000,
    });
  }
  req.cartOwner = { guestId };
  return next();
};
```

- [ ] **Step 4: Rewrite `server/src/routes/cart.js`**

```js
const express = require("express");
const { z } = require("zod");
const router = express.Router();

const cartService = require("../services/cartService");
const attachCartOwner = require("../middleware/attachCartOwner");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const { MAX_CART_ITEM_QTY } = require("../config/constants");

router.use(attachCartOwner);

const ITEM_TYPES = ["medicine", "supplement", "labTest"];

const addBody = z.object({
  id: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  quantity: z.coerce.number().int().min(1).max(MAX_CART_ITEM_QTY).default(1),
});

const updateBody = z.object({
  id: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  quantity: z.coerce.number().int().min(0).max(MAX_CART_ITEM_QTY),
});

// GET /api/cart
router.get("/", asyncHandler(async (req, res) =>
  res.json(await cartService.summarise(await cartService.getOrCreateCart(req.cartOwner)))));

// POST /api/cart/add  { id, type, quantity }
router.post("/add", validate({ body: addBody }), asyncHandler(async (req, res) =>
  res.json(await cartService.addItem(req.cartOwner, req.body))));

// PUT /api/cart/update  { id, type, quantity }  — quantity 0 removes the line
router.put("/update", validate({ body: updateBody }), asyncHandler(async (req, res) =>
  res.json(await cartService.updateItem(req.cartOwner, req.body))));

// DELETE /api/cart — clear whole cart
router.delete("/", asyncHandler(async (req, res) =>
  res.json(await cartService.clearCart(req.cartOwner))));

// DELETE /api/cart/:type/:id — remove one line
router.delete("/:type/:id",
  validate({ params: z.object({ type: z.enum(ITEM_TYPES), id: z.string().min(1) }) }),
  asyncHandler(async (req, res) =>
    res.json(await cartService.removeItem(req.cartOwner, req.params))));

module.exports = router;
```

Note the route order: `DELETE /` is declared before `DELETE /:type/:id`, matching the original file, so clearing the cart is not captured by the parameterised route.

- [ ] **Step 5: Mount it in `app.js`**

```js
app.use("/api/cart", require("./routes/cart"));
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run tests/routes/cart.test.js`
Expected: PASS (8 tests)

- [ ] **Step 7: Verify the guest-cart merge end to end**

Add to `server/tests/routes/cart.test.js`:

```js
it("carries a guest cart into the account on login", async () => {
  const add = await request(app).post("/api/cart/add")
    .send({ id: String(med._id), type: "medicine", quantity: 2 });
  const gid = guestCookie(add);

  const reg = await request(app).post("/api/auth/register").set("Cookie", gid)
    .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
  const at = (reg.headers["set-cookie"].find((c) => c.startsWith("so_at="))).split(";")[0];

  const mine = await request(app).get("/api/cart").set("Cookie", at);
  expect(mine.body.itemCount).toBe(2);
});
```

Run: `npx vitest run tests/routes/cart.test.js`
Expected: PASS (9 tests). This is the assertion that proves Task 8's `establishSession` and Task 11's `mergeGuestCart` are wired to each other.

- [ ] **Step 8: Commit**

```bash
git add server/src/middleware/attachCartOwner.js server/src/routes/cart.js \
        server/src/app.js server/tests/routes/cart.test.js
git commit -m "feat: serve carts from Mongo with guest ownership, contract unchanged"
```

---

## Task 13: couponService and the validation route

The trap here, found during spec review: `value` means rupees for a flat coupon and percentage points for a percent coupon. Only the flat branch converts.

**Files:**
- Create: `server/src/services/couponService.js`, `server/src/routes/coupons.js`
- Modify: `server/src/app.js`
- Test: `server/tests/services/couponService.test.js`

**Interfaces:**
- Consumes: `Coupon` (Task 3)
- Produces:
  - `couponService.validate({ code, subtotalPaise, userId }) → { valid, code, discountPaise, message }`
  - `POST /api/coupons/validate` `{ code, subtotal }` — `subtotal` in paise; response shape unchanged from today
- Rule: a percent coupon's discount is `Math.floor(subtotalPaise * value / 100)`, clamped by `maxDiscountPaise` when set. Never returns a discount above the subtotal.

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const Coupon = require("../../src/models/Coupon");
const couponService = require("../../src/services/couponService");

beforeEach(async () => {
  await Coupon.create({
    code: "HEALTH50", type: "flat", value: 5000, minOrderPaise: 49900, isActive: true,
  });
  await Coupon.create({
    code: "SAVE10", type: "percent", value: 10, minOrderPaise: 0,
    maxDiscountPaise: 20000, isActive: true,
  });
});

describe("couponService", () => {
  it("applies a flat discount already stored in paise", async () => {
    const r = await couponService.validate({ code: "HEALTH50", subtotalPaise: 60000 });
    expect(r.valid).toBe(true);
    expect(r.discountPaise).toBe(5000);
  });

  it("rejects a flat coupon below its minimum order", async () => {
    const r = await couponService.validate({ code: "HEALTH50", subtotalPaise: 10000 });
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/₹399/); // (49900 - 10000) / 100 = 399 → message uses rupees
  });

  it("treats a percent coupon's value as percentage points, not paise", async () => {
    const r = await couponService.validate({ code: "SAVE10", subtotalPaise: 100000 });
    expect(r.discountPaise).toBe(10000); // 10% of ₹1000 = ₹100
  });

  it("clamps a percent discount to maxDiscountPaise", async () => {
    const r = await couponService.validate({ code: "SAVE10", subtotalPaise: 1000000 });
    expect(r.discountPaise).toBe(20000); // capped at ₹200, not ₹1000
  });

  it("never discounts more than the subtotal", async () => {
    await Coupon.create({ code: "HUGE", type: "flat", value: 999999, minOrderPaise: 0, isActive: true });
    const r = await couponService.validate({ code: "HUGE", subtotalPaise: 5000 });
    expect(r.discountPaise).toBeLessThanOrEqual(5000);
  });

  it("is case-insensitive on the code", async () => {
    expect((await couponService.validate({ code: "health50", subtotalPaise: 60000 })).valid).toBe(true);
  });

  it("rejects unknown, inactive and expired coupons", async () => {
    expect((await couponService.validate({ code: "NOPE", subtotalPaise: 60000 })).valid).toBe(false);
    await Coupon.updateOne({ code: "HEALTH50" }, { $set: { isActive: false } });
    expect((await couponService.validate({ code: "HEALTH50", subtotalPaise: 60000 })).valid).toBe(false);
    await Coupon.updateOne({ code: "SAVE10" },
      { $set: { validUntil: new Date(Date.now() - 86400000) } });
    expect((await couponService.validate({ code: "SAVE10", subtotalPaise: 60000 })).valid).toBe(false);
  });

  it("rejects a coupon that has hit its global usage limit", async () => {
    await Coupon.updateOne({ code: "SAVE10" }, { $set: { usageLimit: 5, usedCount: 5 } });
    const r = await couponService.validate({ code: "SAVE10", subtotalPaise: 60000 });
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/no longer available|limit/i);
  });

  it("returns integer paise for an awkward percentage", async () => {
    await Coupon.create({ code: "ODD", type: "percent", value: 7, minOrderPaise: 0, isActive: true });
    const r = await couponService.validate({ code: "ODD", subtotalPaise: 3333 });
    expect(Number.isInteger(r.discountPaise)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/services/couponService.test.js`
Expected: FAIL — cannot find module `services/couponService`

- [ ] **Step 3: Implement `server/src/services/couponService.js`**

```js
const Coupon = require("../models/Coupon");
const { RUPEE } = require("../config/constants");

const invalid = (message) => ({ valid: false, discountPaise: 0, message });

async function validate({ code, subtotalPaise = 0, userId = null }) {
  if (!code) return invalid("Enter a coupon code.");
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });

  if (!coupon || !coupon.isActive) return invalid("That coupon code isn't valid.");

  const now = Date.now();
  if (coupon.validFrom && coupon.validFrom.getTime() > now) return invalid("That coupon isn't active yet.");
  if (coupon.validUntil && coupon.validUntil.getTime() < now) return invalid("That coupon has expired.");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return invalid("That coupon is no longer available.");
  }
  if (subtotalPaise < coupon.minOrderPaise) {
    const short = Math.ceil((coupon.minOrderPaise - subtotalPaise) / RUPEE);
    return invalid(`Add ₹${short} more to use ${coupon.code}.`);
  }

  // `value` is paise for a flat coupon and percentage points for a percent
  // coupon — the two branches are not interchangeable.
  let discountPaise = coupon.type === "percent"
    ? Math.floor((subtotalPaise * coupon.value) / 100)
    : coupon.value;

  if (coupon.maxDiscountPaise != null) {
    discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
  }
  discountPaise = Math.max(0, Math.min(discountPaise, subtotalPaise));

  return {
    valid: true,
    code: coupon.code,
    type: coupon.type,
    discountPaise,
    discount: discountPaise, // legacy key name, now paise
    message: `${coupon.code} applied.`,
  };
}

module.exports = { validate };
```

- [ ] **Step 4: Implement `server/src/routes/coupons.js` and mount it**

```js
const express = require("express");
const { z } = require("zod");
const router = express.Router();

const couponService = require("../services/couponService");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");

// POST /api/coupons/validate  { code, subtotal }  — subtotal in paise
router.post("/validate",
  validate({ body: z.object({
    code: z.string().trim().min(1),
    subtotal: z.coerce.number().int().min(0).default(0),
  }) }),
  asyncHandler(async (req, res) => res.json(await couponService.validate({
    code: req.body.code,
    subtotalPaise: req.body.subtotal,
    userId: req.user ? req.user._id : null,
  }))));

module.exports = router;
```

```js
app.use("/api/coupons", require("./routes/coupons"));
```

An invalid coupon is a 200 with `valid: false`, exactly as today — the client renders `message` inline rather than treating it as a request failure.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run tests/services/couponService.test.js`
Expected: PASS (9 tests)

- [ ] **Step 6: Commit**

```bash
git add server/src/services/couponService.js server/src/routes/coupons.js \
        server/src/app.js server/tests/services/couponService.test.js
git commit -m "feat: add coupon validation with unit-aware discount maths"
```

---

## Task 14: Order model, order creation, and the hardened checkout route

Two vulnerabilities die here. `POST /api/checkout` stops reading `body.items`, and `GET /api/orders` stops returning everybody's orders.

**Files:**
- Create: `server/src/models/Order.js`, `server/src/services/orderService.js`
- Rewrite: `server/src/routes/checkout.js`, `server/src/routes/orders.js`
- Modify: `server/src/app.js`
- Test: `server/tests/routes/checkout.test.js`, `server/tests/routes/orders.test.js`

**Interfaces:**
- Consumes: `cartService`, `couponService`, `Counter.nextOrderNumber` (Task 2), `requireAuth`, `ORDER_STATUS`
- Produces:
  - `orderService.createOrder({ user, address, paymentMethod, couponCode }) → order`
  - `orderService.listForUser(userId) → order[]`
  - `orderService.findForCaller({ orderNumber, user }) → order` (own order, or any for an admin)
  - `orderService.toPublic(order) → { id, placedAt, status, items, total, timeline, … }`
- `GET /api/orders/:id` resolves `:id` as the **order number** (`SO-481301`), because `Orders.jsx` links with `order.id`.
- Order documents snapshot price at purchase time — unlike carts, an order must not re-price when the catalog changes.

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const Order = require("../../src/models/Order");

let med;
const creds = { name: "Subhasis", email: "s@example.com", password: "correct-horse-1" };
const address = {
  label: "Home", line1: "12 Park Street", city: "Kolkata",
  state: "West Bengal", pincode: "700016", phone: "+919830000000",
};

const cookieOf = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0] : null;
};

async function signedIn() {
  const res = await request(app).post("/api/auth/register").send(creds);
  return cookieOf(res, "so_at");
}

beforeEach(async () => {
  med = await Product.create({
    kind: "medicine", name: "Paracetamol 500", slug: "para-500",
    brand: "Acme", pricePaise: 3000, mrpPaise: 4000, stock: 50,
  });
});

describe("checkout", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/checkout").send({ address, paymentMethod: "COD" });
    expect(res.status).toBe(401);
  });

  it("refuses to place an order from an empty cart", async () => {
    const at = await signedIn();
    const res = await request(app).post("/api/checkout").set("Cookie", at)
      .send({ address, paymentMethod: "COD" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cart/i);
  });

  it("prices the order from the server cart and ignores body.items entirely", async () => {
    const at = await signedIn();
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 2 });

    const res = await request(app).post("/api/checkout").set("Cookie", at).send({
      address, paymentMethod: "COD",
      // A hostile client trying to buy two boxes for one paisa.
      items: [{ id: String(med._id), type: "medicine", name: "Paracetamol 500",
                price: 1, quantity: 2 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(6000);   // 2 × ₹30 in paise, not 2
    expect(res.body.items[0].price).toBe(3000);
    expect(res.body.total).toBe(6000 + res.body.deliveryFee);
  });

  it("empties the cart once the order exists", async () => {
    const at = await signedIn();
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    await request(app).post("/api/checkout").set("Cookie", at).send({ address, paymentMethod: "COD" });
    const cart = await request(app).get("/api/cart").set("Cookie", at);
    expect(cart.body.itemCount).toBe(0);
  });

  it("issues sequential human-readable order numbers", async () => {
    const at = await signedIn();
    const place = async () => {
      await request(app).post("/api/cart/add").set("Cookie", at)
        .send({ id: String(med._id), type: "medicine", quantity: 1 });
      return request(app).post("/api/checkout").set("Cookie", at).send({ address, paymentMethod: "COD" });
    };
    const a = await place();
    const b = await place();
    expect(a.body.id).toMatch(/^SO-\d+$/);
    expect(Number(b.body.id.slice(3))).toBe(Number(a.body.id.slice(3)) + 1);
  });

  it("snapshots the price so a later catalog change cannot rewrite history", async () => {
    const at = await signedIn();
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    const res = await request(app).post("/api/checkout").set("Cookie", at)
      .send({ address, paymentMethod: "COD" });

    await Product.updateOne({ _id: med._id }, { $set: { pricePaise: 99999 } });
    const after = await request(app).get(`/api/orders/${res.body.id}`).set("Cookie", at);
    expect(after.body.items[0].price).toBe(3000);
  });

  it("422s a malformed address", async () => {
    const at = await signedIn();
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    const res = await request(app).post("/api/checkout").set("Cookie", at)
      .send({ address: { ...address, pincode: "12" }, paymentMethod: "COD" });
    expect(res.status).toBe(422);
  });

  it("applies a valid coupon to the order total", async () => {
    const Coupon = require("../../src/models/Coupon");
    await Coupon.create({ code: "SAVE10", type: "percent", value: 10, minOrderPaise: 0, isActive: true });
    const at = await signedIn();
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 2 });
    const res = await request(app).post("/api/checkout").set("Cookie", at)
      .send({ address, paymentMethod: "COD", couponCode: "SAVE10" });
    expect(res.body.couponDiscount).toBe(600);
    expect(res.body.total).toBe(6000 - 600 + res.body.deliveryFee);
  });

  it("records an initial status and a real timeline", async () => {
    const at = await signedIn();
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    const res = await request(app).post("/api/checkout").set("Cookie", at)
      .send({ address, paymentMethod: "COD" });
    expect(res.body.status).toBe("PLACED");
    const stored = await Order.findOne({ orderNumber: res.body.id });
    expect(stored.statusHistory).toHaveLength(1);
    expect(stored.statusHistory[0].status).toBe("PLACED");
    // The timeline must reflect stored history, not elapsed minutes.
    const placed = res.body.timeline.find((t) => t.done);
    expect(placed).toBeTruthy();
    expect(res.body.timeline.filter((t) => t.current)).toHaveLength(1);
  });
});
```

And `server/tests/routes/orders.test.js`:

```js
const { describe, it, expect, beforeEach } = require("vitest");
const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const User = require("../../src/models/User");
const tokenService = require("../../src/services/tokenService");

const address = {
  label: "Home", line1: "12 Park Street", city: "Kolkata",
  state: "West Bengal", pincode: "700016", phone: "+919830000000",
};

const cookieOf = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0] : null;
};

let med;
beforeEach(async () => {
  med = await Product.create({
    kind: "medicine", name: "Paracetamol 500", slug: "para-500",
    brand: "Acme", pricePaise: 3000, mrpPaise: 4000, stock: 50,
  });
});

async function userWithOrder(email) {
  const reg = await request(app).post("/api/auth/register")
    .send({ name: "U", email, password: "correct-horse-1" });
  const at = cookieOf(reg, "so_at");
  await request(app).post("/api/cart/add").set("Cookie", at)
    .send({ id: String(med._id), type: "medicine", quantity: 1 });
  const order = await request(app).post("/api/checkout").set("Cookie", at)
    .send({ address, paymentMethod: "COD" });
  return { at, orderId: order.body.id };
}

describe("orders", () => {
  it("401s an anonymous caller", async () => {
    expect((await request(app).get("/api/orders")).status).toBe(401);
  });

  it("returns only the caller's own orders", async () => {
    const a = await userWithOrder("a@example.com");
    const b = await userWithOrder("b@example.com");

    const mine = await request(app).get("/api/orders").set("Cookie", a.at);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].id).toBe(a.orderId);
    expect(mine.body.map((o) => o.id)).not.toContain(b.orderId);
  });

  it("404s — not 403 — when fetching someone else's order", async () => {
    const a = await userWithOrder("a@example.com");
    const b = await userWithOrder("b@example.com");
    // 404 rather than 403 so order numbers cannot be probed for existence.
    const res = await request(app).get(`/api/orders/${b.orderId}`).set("Cookie", a.at);
    expect(res.status).toBe(404);
  });

  it("lets an admin fetch any order", async () => {
    const a = await userWithOrder("a@example.com");
    const admin = await User.create({ name: "Admin", email: "admin@example.com", role: "admin", passwordHash: "x" });
    const res = await request(app).get(`/api/orders/${a.orderId}`)
      .set("Cookie", `so_at=${tokenService.issueAccessToken(admin)}`);
    expect(res.status).toBe(200);
  });

  it("returns newest first", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "U", email: "u@example.com", password: "correct-horse-1" });
    const at = cookieOf(reg, "so_at");
    const place = async () => {
      await request(app).post("/api/cart/add").set("Cookie", at)
        .send({ id: String(med._id), type: "medicine", quantity: 1 });
      return (await request(app).post("/api/checkout").set("Cookie", at)
        .send({ address, paymentMethod: "COD" })).body.id;
    };
    const first = await place();
    const second = await place();
    const list = await request(app).get("/api/orders").set("Cookie", at);
    expect(list.body[0].id).toBe(second);
    expect(list.body[1].id).toBe(first);
  });
});
```

- [ ] **Step 2: Run both and confirm they fail**

Run: `npx vitest run tests/routes/checkout.test.js tests/routes/orders.test.js`
Expected: FAIL — the current routes are `store`-backed, accept `body.items`, and require no auth

- [ ] **Step 3: Implement `server/src/models/Order.js`**

```js
const mongoose = require("mongoose");
const { ORDER_STATUS } = require("../config/constants");
const { PINCODE, E164 } = require("./User");

const int = { validate: { validator: Number.isInteger, message: "{PATH} must be integer paise" } };

// A line here is a *snapshot*, not a reference: name, brand and price are copied
// at purchase time so the order stays a faithful record of what was bought.
const orderItemSchema = new mongoose.Schema({
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  refModel: { type: String, required: true, enum: ["Product", "LabTest"] },
  type: { type: String, required: true, enum: ["medicine", "supplement", "labTest"] },
  name: { type: String, required: true },
  brand: { type: String, default: "" },
  image: { type: String, default: "" },
  pricePaise: { type: Number, required: true, min: 0, ...int },
  mrpPaise: { type: Number, required: true, min: 0, ...int },
  quantity: { type: Number, required: true, min: 1 },
  prescriptionRequired: { type: Boolean, default: false },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  label: { type: String, default: "Home" },
  line1: { type: String, required: true },
  line2: { type: String, default: "" },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true, match: PINCODE },
  phone: { type: String, required: true, match: E164 },
}, { _id: false });

const statusEventSchema = new mongoose.Schema({
  status: { type: String, required: true, enum: ORDER_STATUS },
  at: { type: Date, default: Date.now },
  note: { type: String, default: "" },
  byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
  address: { type: addressSchema, required: true },
  paymentMethod: { type: String, required: true, enum: ["COD", "RAZORPAY"], default: "COD" },
  paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING" },
  coupon: {
    code: { type: String, default: null },
    discountPaise: { type: Number, default: 0, ...int },
  },
  subtotalPaise: { type: Number, required: true, ...int },
  mrpTotalPaise: { type: Number, required: true, ...int },
  couponDiscountPaise: { type: Number, default: 0, ...int },
  deliveryFeePaise: { type: Number, default: 0, ...int },
  totalPaise: { type: Number, required: true, ...int },
  status: { type: String, required: true, enum: ORDER_STATUS, default: "PLACED" },
  statusHistory: { type: [statusEventSchema], default: [] },
  placedAt: { type: Date, default: Date.now },
  cancelledAt: { type: Date, default: null },
  prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription", default: null },
}, { timestamps: true });

orderSchema.index({ userId: 1, placedAt: -1 });
orderSchema.index({ status: 1, placedAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
```

- [ ] **Step 4: Implement `server/src/services/orderService.js`**

```js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const cartService = require("./cartService");
const couponService = require("./couponService");
const Counter = require("../models/Counter");
const AppError = require("../utils/AppError");
const { CUSTOMER_TIMELINE, ORDER_STATUS, TYPE_MAP } = require("../config/constants");

async function createOrder({ user, address, paymentMethod = "COD", couponCode = null }) {
  const cart = await cartService.getOrCreateCart({ userId: user._id });
  const summary = await cartService.summarise(cart);
  if (summary.items.length === 0) {
    throw new AppError(400, "CART_EMPTY", "Your cart is empty.");
  }

  const coupon = couponCode
    ? await couponService.validate({ code: couponCode, subtotalPaise: summary.subtotalPaise, userId: user._id })
    : { valid: false, discountPaise: 0 };
  if (couponCode && !coupon.valid) {
    throw new AppError(400, "COUPON_INVALID", coupon.message);
  }

  const couponDiscountPaise = coupon.valid ? coupon.discountPaise : 0;
  const afterDiscount = summary.subtotalPaise - couponDiscountPaise;
  const labTestsOnly = summary.items.every((i) => i.type === "labTest");
  const deliveryFeePaise = labTestsOnly || afterDiscount >= summary.freeDeliveryAbovePaise
    ? 0 : summary.deliveryFeePaise || 0;
  const totalPaise = Math.max(0, afterDiscount + deliveryFeePaise);

  const items = summary.items.map((i) => ({
    refId: i.id,
    refModel: TYPE_MAP[i.type].refModel,
    type: i.type,
    name: i.name,
    brand: i.brand || "",
    image: i.image || "",
    pricePaise: i.pricePaise,
    mrpPaise: i.mrpPaise || i.pricePaise,
    quantity: i.quantity,
    prescriptionRequired: Boolean(i.prescriptionRequired),
  }));

  const orderNumber = await Counter.nextOrderNumber();
  const now = new Date();

  const order = await Order.create({
    orderNumber,
    userId: user._id,
    items,
    address,
    paymentMethod,
    coupon: coupon.valid ? { code: coupon.code, discountPaise: couponDiscountPaise } : { code: null, discountPaise: 0 },
    subtotalPaise: summary.subtotalPaise,
    mrpTotalPaise: summary.mrpTotalPaise,
    couponDiscountPaise,
    deliveryFeePaise,
    totalPaise,
    status: "PLACED",
    statusHistory: [{ status: "PLACED", at: now }],
    placedAt: now,
  });

  // The cart is emptied only after the order document exists, so a failure
  // here never loses a customer's cart.
  await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } });

  return order;
}

async function listForUser(userId) {
  return Order.find({ userId }).sort({ placedAt: -1, _id: -1 });
}

async function findForCaller({ orderNumber, user }) {
  const filter = { orderNumber };
  // A customer scoping failure would leak another person's address, so the
  // ownership check is part of the query rather than a later comparison.
  if (user.role !== "admin") filter.userId = user._id;
  const order = await Order.findOne(filter);
  // 404 rather than 403: an order number must not be probeable.
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "We couldn't find that order.");
  return order;
}

// Builds the customer-facing stage list from stored history. Contrast with the
// old computeTracker(), which invented progress from elapsed minutes.
function buildTimeline(order) {
  const reached = new Map(order.statusHistory.map((e) => [e.status, e.at]));
  const cancelled = order.status === "CANCELLED" || order.status === "REFUNDED";
  if (cancelled) {
    return order.statusHistory.map((e, i) => ({
      label: e.status, at: e.at, done: true,
      current: i === order.statusHistory.length - 1,
    }));
  }
  const currentIndex = CUSTOMER_TIMELINE.lastIndexOf(order.status);
  return CUSTOMER_TIMELINE.map((status, i) => ({
    label: status,
    at: reached.get(status) || null,
    done: i <= currentIndex,
    current: i === currentIndex,
  }));
}

// Maps to the exact key names Orders.jsx reads, with money in paise.
function toPublic(order) {
  return {
    id: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    address: order.address,
    items: order.items.map((i) => ({
      id: String(i.refId), type: i.type, name: i.name, brand: i.brand, image: i.image,
      quantity: i.quantity,
      price: i.pricePaise, originalPrice: i.mrpPaise,
      pricePaise: i.pricePaise, mrpPaise: i.mrpPaise,
      lineTotal: i.pricePaise * i.quantity,
    })),
    coupon: order.coupon && order.coupon.code
      ? { code: order.coupon.code, discount: order.coupon.discountPaise }
      : null,
    subtotal: order.subtotalPaise,
    mrpSavings: Math.max(0, order.mrpTotalPaise - order.subtotalPaise),
    couponDiscount: order.couponDiscountPaise,
    deliveryFee: order.deliveryFeePaise,
    total: order.totalPaise,
    subtotalPaise: order.subtotalPaise,
    totalPaise: order.totalPaise,
    eta: order.status === "DELIVERED" ? "Delivered" : "Arriving in 30–90 minutes",
    timeline: buildTimeline(order),
    statusHistory: order.statusHistory,
  };
}

module.exports = { createOrder, listForUser, findForCaller, toPublic, buildTimeline };
```

This service imports `CUSTOMER_TIMELINE` from `config/constants.js`, where Task 1 defined it as the customer-visible subset of `ORDER_STATUS`:

```js
// The stages a customer sees, in order. ORDER_STATUS additionally contains
// terminal and payment states that never appear as timeline steps.
const CUSTOMER_TIMELINE = ["PLACED", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
```

Confirm it is present and exported before running this task's tests; if Task 1 was executed from an earlier revision of this plan, add it now.

- [ ] **Step 5: Rewrite `server/src/routes/checkout.js`**

```js
const express = require("express");
const { z } = require("zod");
const router = express.Router();

const orderService = require("../services/orderService");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");

const addressBody = z.object({
  label: z.string().trim().default("Home"),
  line1: z.string().trim().min(4),
  line2: z.string().trim().default(""),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Include the country code"),
});

// POST /api/checkout
// `items` is deliberately NOT part of the schema. The order is priced solely
// from the server-side cart; anything the client sends about items is ignored.
router.post("/", requireAuth,
  validate({ body: z.object({
    address: addressBody,
    paymentMethod: z.enum(["COD", "RAZORPAY"]).default("COD"),
    couponCode: z.string().trim().optional().nullable(),
  }).strip() }),
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder({
      user: req.user,
      address: req.body.address,
      paymentMethod: req.body.paymentMethod,
      couponCode: req.body.couponCode || null,
    });
    return res.status(201).json(orderService.toPublic(order));
  }));

module.exports = router;
```

`.strip()` on the zod object drops unknown keys, so a stray `items` array is removed before the handler ever sees `req.body`.

- [ ] **Step 6: Rewrite `server/src/routes/orders.js`**

```js
const express = require("express");
const { z } = require("zod");
const router = express.Router();

const orderService = require("../services/orderService");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");

router.use(requireAuth);

// GET /api/orders — the caller's own orders, newest first.
router.get("/", asyncHandler(async (req, res) => {
  const orders = await orderService.listForUser(req.user._id);
  return res.json(orders.map(orderService.toPublic));
}));

// GET /api/orders/:id — :id is the order number, e.g. SO-481301.
router.get("/:id",
  validate({ params: z.object({ id: z.string().trim().min(3) }) }),
  asyncHandler(async (req, res) => {
    const order = await orderService.findForCaller({ orderNumber: req.params.id, user: req.user });
    return res.json(orderService.toPublic(order));
  }));

module.exports = router;
```

- [ ] **Step 7: Mount both in `app.js`**

```js
app.use("/api/checkout", require("./routes/checkout"));
app.use("/api/orders", require("./routes/orders"));
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `npx vitest run tests/routes/checkout.test.js tests/routes/orders.test.js`
Expected: PASS (9 + 5 tests)

- [ ] **Step 9: Commit**

```bash
git add server/src/models/Order.js server/src/services/orderService.js \
        server/src/routes/checkout.js server/src/routes/orders.js server/src/app.js \
        server/src/config/constants.js server/tests/routes/checkout.test.js \
        server/tests/routes/orders.test.js
git commit -m "fix: price orders from the server cart and scope orders to their owner"
```

---

## Task 15: Address book routes

Checkout needs saved addresses, and the `User` model already carries the subdocument array from Task 4.

**Files:**
- Create: `server/src/routes/me.js`
- Modify: `server/src/app.js`
- Test: `server/tests/routes/addresses.test.js`

**Interfaces:**
- Consumes: `User.setDefaultAddress` (Task 4), `requireAuth`
- Produces: `GET/POST /api/me/addresses`, `PATCH/DELETE /api/me/addresses/:id`, `POST /api/me/addresses/:id/default`; every response returns the full `addresses` array so the client never needs to reconcile

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const request = require("supertest");
const app = require("../../src/app");

const address = {
  label: "Home", line1: "12 Park Street", city: "Kolkata",
  state: "West Bengal", pincode: "700016", phone: "+919830000000",
};

let at;
beforeEach(async () => {
  const reg = await request(app).post("/api/auth/register")
    .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
  at = (reg.headers["set-cookie"].find((c) => c.startsWith("so_at="))).split(";")[0];
});

describe("address book", () => {
  it("401s an anonymous caller", async () => {
    expect((await request(app).get("/api/me/addresses")).status).toBe(401);
  });

  it("starts empty and makes the first address default automatically", async () => {
    expect((await request(app).get("/api/me/addresses").set("Cookie", at)).body.addresses).toEqual([]);
    const res = await request(app).post("/api/me/addresses").set("Cookie", at).send(address);
    expect(res.status).toBe(201);
    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.addresses[0].isDefault).toBe(true);
  });

  it("keeps exactly one default when a second address is promoted", async () => {
    const first = await request(app).post("/api/me/addresses").set("Cookie", at).send(address);
    const second = await request(app).post("/api/me/addresses").set("Cookie", at)
      .send({ ...address, label: "Office", line1: "5 Camac Street" });
    const id = second.body.addresses.find((a) => a.label === "Office")._id;

    const res = await request(app).post(`/api/me/addresses/${id}/default`).set("Cookie", at);
    const defaults = res.body.addresses.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe("Office");
    expect(first.body.addresses[0].isDefault).toBe(true); // was default before promotion
  });

  it("updates an address in place", async () => {
    const created = await request(app).post("/api/me/addresses").set("Cookie", at).send(address);
    const id = created.body.addresses[0]._id;
    const res = await request(app).patch(`/api/me/addresses/${id}`).set("Cookie", at)
      .send({ line2: "Flat 4B" });
    expect(res.body.addresses[0].line2).toBe("Flat 4B");
    expect(res.body.addresses[0].line1).toBe(address.line1); // untouched
  });

  it("422s an invalid pincode", async () => {
    const res = await request(app).post("/api/me/addresses").set("Cookie", at)
      .send({ ...address, pincode: "012345" });
    expect(res.status).toBe(422);
  });

  it("deletes an address and promotes a survivor to default", async () => {
    const a = await request(app).post("/api/me/addresses").set("Cookie", at).send(address);
    await request(app).post("/api/me/addresses").set("Cookie", at)
      .send({ ...address, label: "Office", line1: "5 Camac Street" });
    const defaultId = a.body.addresses[0]._id;

    const res = await request(app).delete(`/api/me/addresses/${defaultId}`).set("Cookie", at);
    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.addresses[0].isDefault).toBe(true);
  });

  it("404s an unknown address id", async () => {
    const res = await request(app).delete("/api/me/addresses/64b7f9d2e1a4c5b6d7e8f901").set("Cookie", at);
    expect(res.status).toBe(404);
  });

  it("cannot touch another user's address", async () => {
    const created = await request(app).post("/api/me/addresses").set("Cookie", at).send(address);
    const id = created.body.addresses[0]._id;
    const other = await request(app).post("/api/auth/register")
      .send({ name: "Other", email: "o@example.com", password: "correct-horse-1" });
    const otherAt = (other.headers["set-cookie"].find((c) => c.startsWith("so_at="))).split(";")[0];
    const res = await request(app).delete(`/api/me/addresses/${id}`).set("Cookie", otherAt);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/routes/addresses.test.js`
Expected: FAIL — 404, the router does not exist

- [ ] **Step 3: Implement `server/src/routes/me.js`**

```js
const express = require("express");
const { z } = require("zod");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

router.use(requireAuth);

const addressBody = z.object({
  label: z.string().trim().min(1).default("Home"),
  line1: z.string().trim().min(4),
  line2: z.string().trim().default(""),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Include the country code"),
  isDefault: z.boolean().optional(),
});

const reply = (res, user, status = 200) => res.status(status).json({ addresses: user.addresses });

// Scoped to req.user, so an id belonging to someone else simply is not found.
const findOwn = (user, id) => {
  const found = user.addresses.id(id);
  if (!found) throw new AppError(404, "ADDRESS_NOT_FOUND", "We couldn't find that address.");
  return found;
};

router.get("/addresses", (req, res) => reply(res, req.user));

router.post("/addresses", validate({ body: addressBody }), asyncHandler(async (req, res) => {
  const makeDefault = req.body.isDefault || req.user.addresses.length === 0;
  req.user.addresses.push({ ...req.body, isDefault: false });
  const added = req.user.addresses[req.user.addresses.length - 1];
  if (makeDefault) req.user.setDefaultAddress(added._id);
  await req.user.save();
  return reply(res, req.user, 201);
}));

router.patch("/addresses/:id",
  validate({ body: addressBody.partial() }),
  asyncHandler(async (req, res) => {
    const address = findOwn(req.user, req.params.id);
    const { isDefault, ...fields } = req.body;
    Object.assign(address, fields);
    if (isDefault === true) req.user.setDefaultAddress(address._id);
    await req.user.save();
    return reply(res, req.user);
  }));

router.post("/addresses/:id/default", asyncHandler(async (req, res) => {
  const address = findOwn(req.user, req.params.id);
  req.user.setDefaultAddress(address._id);
  await req.user.save();
  return reply(res, req.user);
}));

router.delete("/addresses/:id", asyncHandler(async (req, res) => {
  const address = findOwn(req.user, req.params.id);
  const wasDefault = address.isDefault;
  address.deleteOne();
  // Never leave the book without a default while addresses remain.
  if (wasDefault && req.user.addresses.length > 0) {
    req.user.setDefaultAddress(req.user.addresses[0]._id);
  }
  await req.user.save();
  return reply(res, req.user);
}));

module.exports = router;
```

Mount it: `app.use("/api/me", require("./routes/me"));`

`findOwn` relies on Mongoose's `DocumentArray.prototype.id`, which returns `null` for an id that is not in *this* user's array — that is what makes the cross-user test return 404 rather than 403.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/routes/addresses.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/me.js server/src/app.js server/tests/routes/addresses.test.js
git commit -m "feat: add address book routes"
```

---

## Task 16: Move the catalog routes onto Mongo

The catalog currently serves in-memory arrays from `data/*.js`. The response shapes must not change — only their source and their money unit.

**Files:**
- Rewrite: `server/src/routes/catalog.js`, `server/src/routes/labTests.js`, `server/src/routes/search.js`
- Modify: `server/src/utils/filter.js` (paise-aware price filtering), `server/src/app.js`
- Test: `server/tests/routes/catalog.test.js`

**Interfaces:**
- Consumes: `Product`, `LabTest`
- Produces: same routes and same response shapes as today — `GET /api/medicines`, `/api/supplements`, `/api/products/:id`, `/api/brands`, `/api/lab-tests`, `/api/lab-tests/:id`, `/api/search`
- Every catalog document is serialised with `id: String(_id)` and `price` / `originalPrice` in paise, so `addToCart({ id, type })` keeps working unchanged.
- Query params keep their names (`search`, `brand`, `category`, `dosageForm`, `minPrice`, `maxPrice`, `inStock`, `sort`); `minPrice` and `maxPrice` now arrive in paise.

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const LabTest = require("../../src/models/LabTest");

beforeEach(async () => {
  await Product.create([
    { kind: "medicine", name: "Paracetamol 500", slug: "para-500", brand: "Acme",
      category: "Pain relief", dosageForm: "Tablet",
      pricePaise: 3000, mrpPaise: 4000, stock: 50 },
    { kind: "medicine", name: "Cough Syrup", slug: "cough-syrup", brand: "Zeta",
      category: "Cold & cough", dosageForm: "Syrup",
      pricePaise: 12000, mrpPaise: 15000, stock: 0 },
    { kind: "supplement", name: "Whey Protein", slug: "whey", brand: "Acme",
      category: "Protein", pricePaise: 250000, mrpPaise: 300000, stock: 10 },
    { kind: "medicine", name: "Retired Pill", slug: "retired", brand: "Acme",
      pricePaise: 500, mrpPaise: 500, stock: 5, isActive: false },
  ]);
  await LabTest.create({ name: "Lipid Profile", slug: "lipid", pricePaise: 79900, mrpPaise: 120000 });
});

describe("catalog", () => {
  it("returns medicines only, as a bare array, with paise prices", async () => {
    const res = await request(app).get("/api/medicines");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((m) => m.name).sort()).toEqual(["Cough Syrup", "Paracetamol 500"]);
    const para = res.body.find((m) => m.name === "Paracetamol 500");
    expect(para.price).toBe(3000);
    expect(para.originalPrice).toBe(4000);
    expect(para.id).toBeTruthy();
    expect(para._id).toBeUndefined();
  });

  it("hides inactive products", async () => {
    const res = await request(app).get("/api/medicines");
    expect(res.body.map((m) => m.name)).not.toContain("Retired Pill");
  });

  it("filters by brand, category and stock", async () => {
    expect((await request(app).get("/api/medicines?brand=Zeta")).body).toHaveLength(1);
    expect((await request(app).get("/api/medicines?category=Pain relief")).body).toHaveLength(1);
    expect((await request(app).get("/api/medicines?inStock=true")).body
      .map((m) => m.name)).toEqual(["Paracetamol 500"]);
  });

  it("filters by a paise price range", async () => {
    const res = await request(app).get("/api/medicines?minPrice=0&maxPrice=5000");
    expect(res.body.map((m) => m.name)).toEqual(["Paracetamol 500"]);
  });

  it("searches by name", async () => {
    const res = await request(app).get("/api/medicines?search=cough");
    expect(res.body).toHaveLength(1);
  });

  it("sorts by price ascending and descending", async () => {
    const asc = await request(app).get("/api/medicines?sort=price-asc");
    const desc = await request(app).get("/api/medicines?sort=price-desc");
    expect(asc.body[0].price).toBeLessThan(asc.body[asc.body.length - 1].price);
    expect(desc.body[0].price).toBeGreaterThan(desc.body[desc.body.length - 1].price);
  });

  it("serves supplements separately from medicines", async () => {
    const res = await request(app).get("/api/supplements");
    expect(res.body.map((s) => s.name)).toEqual(["Whey Protein"]);
  });

  it("finds one product across both kinds, and 404s an unknown id", async () => {
    const whey = (await request(app).get("/api/supplements")).body[0];
    expect((await request(app).get(`/api/products/${whey.id}`)).body.name).toBe("Whey Protein");
    const missing = await request(app).get("/api/products/64b7f9d2e1a4c5b6d7e8f901");
    expect(missing.status).toBe(404);
    expect(typeof missing.body.error).toBe("string");
  });

  it("returns a sorted distinct brand list", async () => {
    const res = await request(app).get("/api/brands");
    expect(res.body).toEqual(["Acme", "Zeta"]);
  });

  it("serves lab tests with paise prices", async () => {
    const res = await request(app).get("/api/lab-tests");
    expect(res.body[0].price).toBe(79900);
    expect(res.body[0].id).toBeTruthy();
  });

  it("searches across all three kinds", async () => {
    const res = await request(app).get("/api/search?q=pro");
    const names = JSON.stringify(res.body);
    expect(names).toMatch(/Whey Protein/);
    expect(names).toMatch(/Lipid Profile/);
  });

  it("does not 500 on a malformed product id", async () => {
    const res = await request(app).get("/api/products/not-an-objectid");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/routes/catalog.test.js`
Expected: FAIL — routes still read `data/medicines.js`, so prices come back in rupees and ids are legacy strings

- [ ] **Step 3: Add a shared serialiser at `server/src/utils/serialise.js`**

```js
// Catalog documents go out under the key names the client already reads, with
// money in paise and `_id` renamed to `id`.
function publicProduct(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const {
    _id, __v, pricePaise, mrpPaise, kind, slug, isActive, createdAt, updatedAt, ...rest
  } = o;
  return {
    ...rest,
    id: String(_id),
    type: kind === "supplement" ? "supplement" : kind === "medicine" ? "medicine" : "labTest",
    price: pricePaise,
    originalPrice: mrpPaise,
    pricePaise,
    mrpPaise,
    inStock: rest.stock === undefined ? true : rest.stock > 0,
  };
}

module.exports = { publicProduct };
```

- [ ] **Step 4: Rewrite `server/src/utils/filter.js` as a Mongo query builder**

```js
// Translates the existing query-string contract into a Mongo filter.
// minPrice/maxPrice are paise, matching the rest of the server.
function buildFilter(query, base = {}) {
  const filter = { isActive: true, ...base };

  if (query.search) filter.name = { $regex: String(query.search).trim(), $options: "i" };
  if (query.brand) filter.brand = query.brand;
  if (query.category) filter.category = query.category;
  if (query.dosageForm) filter.dosageForm = query.dosageForm;
  if (String(query.inStock) === "true") filter.stock = { $gt: 0 };

  const min = query.minPrice === undefined ? null : Number(query.minPrice);
  const max = query.maxPrice === undefined ? null : Number(query.maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    filter.pricePaise = {};
    if (Number.isFinite(min)) filter.pricePaise.$gte = min;
    if (Number.isFinite(max)) filter.pricePaise.$lte = max;
  }
  return filter;
}

const SORTS = {
  "price-asc": { pricePaise: 1 },
  "price-desc": { pricePaise: -1 },
  "rating-desc": { rating: -1 },
  "name-asc": { name: 1 },
  discount: { discountPct: -1 },
};

const buildSort = (sort) => SORTS[sort] || { name: 1 };

module.exports = { buildFilter, buildSort };
```

If any client page passes a `sort` value not listed above, add it here rather than changing the client — grep `sort=` and `sort:` under `client/src` to confirm the full set before finishing this task.

- [ ] **Step 5: Rewrite the three route files**

`catalog.js`

```js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Product = require("../models/Product");
const { buildFilter, buildSort } = require("../utils/filter");
const { publicProduct } = require("../utils/serialise");
const asyncHandler = require("../utils/asyncHandler");

const list = (kind) => asyncHandler(async (req, res) => {
  const docs = await Product.find(buildFilter(req.query, { kind })).sort(buildSort(req.query.sort));
  return res.json(docs.map(publicProduct));
});

router.get("/medicines", list("medicine"));
router.get("/supplements", list("supplement"));

router.get("/products/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
  }
  const doc = await Product.findOne({ _id: req.params.id, isActive: true });
  if (!doc) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
  return res.json(publicProduct(doc));
}));

router.get("/brands", asyncHandler(async (req, res) => {
  const brands = await Product.distinct("brand", { isActive: true });
  return res.json(brands.filter(Boolean).sort());
}));

module.exports = router;
```

`labTests.js` follows the same shape against `LabTest`, and `search.js` runs all three lookups in parallel:

```js
router.get("/", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ medicines: [], supplements: [], labTests: [] });
  const rx = { $regex: q, $options: "i" };
  const match = { isActive: true, $or: [{ name: rx }, { brand: rx }] };
  const [medicines, supplements, labTests] = await Promise.all([
    Product.find({ ...match, kind: "medicine" }).limit(10),
    Product.find({ ...match, kind: "supplement" }).limit(10),
    LabTest.find({ isActive: true, name: rx }).limit(10),
  ]);
  return res.json({
    medicines: medicines.map(publicProduct),
    supplements: supplements.map(publicProduct),
    labTests: labTests.map(publicProduct),
  });
}));
```

Before writing this, open `client/src/components/SearchBar.jsx` (or whichever component calls `api.search`) and match the existing response shape exactly — if it currently returns a flat array, keep it flat.

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run tests/routes/catalog.test.js`
Expected: PASS (12 tests)

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/catalog.js server/src/routes/labTests.js server/src/routes/search.js \
        server/src/utils/filter.js server/src/utils/serialise.js server/src/app.js \
        server/tests/routes/catalog.test.js
git commit -m "refactor: serve the catalog from Mongo in paise, contract unchanged"
```

---

## Task 17: Migrate consultations and prescriptions, then delete `store.js`

This is the task that removes the prototype. `store.js` cannot be deleted until nothing imports it.

**Files:**
- Create: `server/src/models/Consultation.js`, `server/src/models/Prescription.js`, `server/src/models/Doctor.js`, `server/src/services/consultationService.js`
- Rewrite: `server/src/routes/consultations.js`, `server/src/routes/prescriptions.js`, `server/src/routes/content.js`
- Delete: `server/src/services/store.js`
- Test: `server/tests/routes/consultations.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `Counter` (for `CON-` and `RX-` numbers), multer upload config
- Produces: `POST /api/consultations/book`, `POST /api/prescriptions/upload`, plus the content routes (`/api/flash-sale`, `/api/banners`, `/api/categories`, `/api/wellness`, `/api/doctors`)
- `Doctor.consultationFeePaise` replaces `doctors.js:15`'s `consultationFee`, serialised back out as `consultationFee` in paise.

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const path = require("path");
const request = require("supertest");
const app = require("../../src/app");
const Doctor = require("../../src/models/Doctor");
const Prescription = require("../../src/models/Prescription");

let doctor; let at;
beforeEach(async () => {
  doctor = await Doctor.create({
    name: "Dr. A. Sen", slug: "a-sen", specialty: "General physician",
    consultationFeePaise: 49900, experienceYears: 12,
  });
  const reg = await request(app).post("/api/auth/register")
    .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
  at = (reg.headers["set-cookie"].find((c) => c.startsWith("so_at="))).split(";")[0];
});

describe("consultations and prescriptions", () => {
  it("lists doctors with the fee in paise under the existing key", async () => {
    const res = await request(app).get("/api/doctors");
    expect(res.body[0].consultationFee).toBe(49900);
    expect(res.body[0].id).toBeTruthy();
  });

  it("books a consultation for the signed-in user", async () => {
    const res = await request(app).post("/api/consultations/book").set("Cookie", at).send({
      doctorId: String(doctor._id), date: "2026-09-01", slot: "10:00 AM",
      patientName: "Subhasis", mode: "Video consult", concern: "Fever",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^CON-\d+$/);
    expect(res.body.doctor.name).toBe("Dr. A. Sen");
    expect(res.body.feePaise ?? res.body.fee).toBe(49900);
  });

  it("requires authentication to book", async () => {
    const res = await request(app).post("/api/consultations/book")
      .send({ doctorId: String(doctor._id), date: "2026-09-01", slot: "10:00 AM", patientName: "S" });
    expect(res.status).toBe(401);
  });

  it("404s an unknown doctor", async () => {
    const res = await request(app).post("/api/consultations/book").set("Cookie", at)
      .send({ doctorId: "64b7f9d2e1a4c5b6d7e8f901", date: "2026-09-01", slot: "10:00 AM", patientName: "S" });
    expect(res.status).toBe(404);
  });

  it("stores an uploaded prescription against the user", async () => {
    const res = await request(app).post("/api/prescriptions/upload").set("Cookie", at)
      .attach("file", Buffer.from("%PDF-1.4 fake"), "rx.pdf")
      .field("note", "For the fever");
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^RX-\d+$/);
    expect(res.body.status).toBe("PENDING_REVIEW");
    const stored = await Prescription.findOne({});
    expect(String(stored.userId)).toBeTruthy();
    expect(stored.filePath).toBeTruthy();
  });

  it("rejects an upload with no file", async () => {
    const res = await request(app).post("/api/prescriptions/upload").set("Cookie", at);
    expect(res.status).toBe(422);
  });

  it("rejects a disallowed file type", async () => {
    const res = await request(app).post("/api/prescriptions/upload").set("Cookie", at)
      .attach("file", Buffer.from("MZ"), "malware.exe");
    expect([415, 422]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/routes/consultations.test.js`
Expected: FAIL — cannot find module `models/Doctor`

- [ ] **Step 3: Create the three models**

`Doctor` carries `name`, `slug` (unique), `specialty`, `qualifications`, `experienceYears`, `languages`, `rating`, `image`, `consultationFeePaise` (integer-validated), `nextAvailable`, `isActive`. `Consultation` carries `consultationNumber` (unique), `userId`, `doctorId`, a `doctor` name/specialty/image snapshot, `date`, `slot`, `mode`, `patientName`, `concern`, `feePaise`, `status` enum `BOOKED|COMPLETED|CANCELLED`, and timestamps. `Prescription` carries `prescriptionNumber` (unique), `userId`, `filePath`, `originalName`, `mimeType`, `sizeBytes`, `note`, `status` enum `PENDING_REVIEW|APPROVED|REJECTED`, `reviewedBy`, `reviewNote`, `orderId` (nullable — P3 links it), and timestamps. Follow the field lists in spec §6.3; all money fields use the same `Number.isInteger` validator as `Product`.

- [ ] **Step 4: Harden the multer configuration**

```js
// server/src/config/upload.js
const path = require("path");
const multer = require("multer");
const AppError = require("../utils/AppError");

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 8 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "uploads"),
  filename: (req, file, cb) => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // Never trust the client filename on disk — keep only a safe extension.
    cb(null, `${stamp}${path.extname(file.originalname).toLowerCase().slice(0, 8)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new AppError(415, "BAD_FILE_TYPE", "Upload a JPG, PNG, WebP or PDF."));
    }
    return cb(null, true);
  },
});

module.exports = { upload, ALLOWED, MAX_BYTES };
```

- [ ] **Step 5: Rewrite the routes**

`consultations.js` requires auth, validates with zod, loads the doctor, snapshots its details, allocates `CON-` from the counter, and returns 201. `prescriptions.js` requires auth, runs `upload.single("file")`, throws `AppError(422, "FILE_REQUIRED", …)` when `req.file` is absent, allocates `RX-`, and stores the relative path. `content.js` reads `Doctor` and the content collections from Mongo instead of `data/*.js`, serialising money through the paise convention.

- [ ] **Step 6: Delete `store.js` and prove nothing imports it**

```bash
rm server/src/services/store.js
grep -rn "services/store\|require(\"../services/store\")" server/src || echo "no importers — clean"
```

Expected: `no importers — clean`. If anything is listed, migrate that caller before continuing; the exit checklist depends on this file being gone.

- [ ] **Step 7: Run the whole server suite**

Run: `cd server && npx vitest run`
Expected: PASS — every suite from Tasks 1–17 green

- [ ] **Step 8: Commit**

```bash
git add -A server
git commit -m "refactor: migrate consultations and prescriptions to Mongo, delete store.js"
```

---

## Task 18: Client money migration

Every rupee-assuming line on the client moves to paise in one commit, so the app is never half-migrated. The three `₹{}` interpolations are the dangerous ones — they bypass `inr()` entirely and would render "₹3000" for a ₹30 medicine.

**Files:**
- Create: `client/src/lib/constants.js`
- Modify: `client/src/lib/format.js`, `client/src/components/CartDrawer.jsx`, `client/src/components/FilterSidebar.jsx`, `client/src/pages/Medicines.jsx`, `client/src/pages/Supplements.jsx`, `client/src/pages/LabTests.jsx`, `client/src/components/Header.jsx`
- Test: `client/src/lib/format.test.js`

**Interfaces:**
- Produces:
  - `inr(paise) → string` — takes **paise**, renders rupees
  - `rupees(paise) → number`
  - `constants.FREE_DELIVERY_ABOVE_PAISE = 49900`, `DELIVERY_FEE_PAISE = 4000`, `PRICE_FILTER_MAX_PAISE = 200000`
- `discountPct(pricePaise, mrpPaise)` is unit-agnostic (it divides), so it needs no change — but its arguments must both be paise.

- [ ] **Step 1: Add vitest to the client and write the failing test**

```bash
cd client && npm i -D vitest
```

Add to `client/package.json` scripts: `"test": "vitest run"`.

`client/src/lib/format.test.js`

```js
import { describe, it, expect } from "vitest";
import { inr, rupees, discountPct } from "./format";

describe("inr", () => {
  it("renders paise as rupees", () => {
    expect(inr(3000)).toBe("₹30");
    expect(inr(49900)).toBe("₹499");
    expect(inr(0)).toBe("₹0");
  });

  it("groups thousands the Indian way", () => {
    expect(inr(250000)).toBe("₹2,500");
    expect(inr(10000000)).toBe("₹1,00,000");
  });

  it("shows paise only when they are non-zero", () => {
    expect(inr(3050)).toBe("₹30.50");
    expect(inr(3000)).toBe("₹30");
  });

  it("survives null and undefined", () => {
    expect(inr(null)).toBe("₹0");
    expect(inr(undefined)).toBe("₹0");
  });

  it("converts to a rupee number", () => {
    expect(rupees(49900)).toBe(499);
    expect(rupees(3050)).toBe(30.5);
  });

  it("computes a discount percentage from paise", () => {
    expect(discountPct(3000, 4000)).toBe(25);
    expect(discountPct(4000, 4000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/lib/format.test.js`
Expected: FAIL — `inr(3000)` currently returns `"₹3,000"`, and `rupees` does not exist

- [ ] **Step 3: Rewrite `client/src/lib/format.js`**

```js
// Formatting & small pure helpers.
// MONEY CONVENTION: every amount crossing the API is an integer number of
// paise. `inr` is the only place that divides by 100 — never do it inline.

const RUPEE = 100;

export const rupees = (paise) => Number(paise || 0) / RUPEE;

export const inr = (paise) => {
  const value = rupees(paise);
  const hasPaise = Math.round(Number(paise || 0)) % RUPEE !== 0;
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  })}`;
};

export const discountPct = (price, mrp) =>
  mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : 0;

export const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A stable label -> type map used across the app.
export const TYPE_LABEL = {
  medicine: "Medicine",
  supplement: "Supplement",
  labTest: "Lab Test",
};

export const cx = (...args) => args.filter(Boolean).join(" ");
```

- [ ] **Step 4: Create `client/src/lib/constants.js`**

```js
// Mirrors server/src/config/constants.js. These two must stay in step; the
// server is authoritative and re-validates every total.
export const FREE_DELIVERY_ABOVE_PAISE = 49900;
export const DELIVERY_FEE_PAISE = 4000;
export const PRICE_FILTER_MAX_PAISE = 200000;
export const MAX_CART_ITEM_QTY = 10;
```

- [ ] **Step 5: Fix the three `₹{}` bypasses**

In `client/src/pages/Medicines.jsx` replace lines 78–79:

```jsx
<div className="font-price-display text-[16px] font-bold text-primary">{inr(med.price)}</div>
<div className="text-[12px] text-outline line-through">{inr(med.originalPrice)}</div>
```

Apply the identical change at `Supplements.jsx:45-46` and `LabTests.jsx:62-63`, adjusting the variable name. Add `import { inr } from "../lib/format";` to any of the three that does not already import it.

- [ ] **Step 6: Point the two components at the shared constants**

`CartDrawer.jsx` — delete its local `const FREE_DELIVERY_ABOVE = 499;` (line 9) and import instead:

```jsx
import { FREE_DELIVERY_ABOVE_PAISE } from "../lib/constants";
```

Then replace the two usages, which already work in whatever unit the constant carries:

```jsx
const toFree = Math.max(0, FREE_DELIVERY_ABOVE_PAISE - subtotal);
const freePct = Math.min(100, Math.round((subtotal / FREE_DELIVERY_ABOVE_PAISE) * 100));
```

`FilterSidebar.jsx:6` — change the default prop:

```jsx
export default function FilterSidebar({ facets = {}, value, onChange, onClear,
  priceMax = PRICE_FILTER_MAX_PAISE, className }) {
```

with `import { PRICE_FILTER_MAX_PAISE } from "../lib/constants";`. Check every caller of `FilterSidebar` for a hard-coded `priceMax` prop and any free-delivery copy in `Header.jsx`; convert those too.

- [ ] **Step 7: Sweep for anything left in rupees**

```bash
cd client && grep -rn '₹{' src/ ; grep -rn '499\b\|2000\b' src/ --include=*.jsx | grep -v constants
```

Expected: the first grep returns nothing at all. The second should surface only intentional copy (`Home.jsx:353`'s "from ₹349" static text, which is marketing copy and should be updated by hand to match a real price or made dynamic).

- [ ] **Step 8: Run the test and confirm it passes**

Run: `cd client && npx vitest run` then `npm run build`
Expected: PASS (6 tests), and a clean production build

- [ ] **Step 9: Commit**

```bash
git add client/src/lib client/src/components client/src/pages client/package.json
git commit -m "refactor: move client money handling to integer paise"
```

---

## Task 19: `api.js` — credentials, silent refresh, and the auth methods

The access token lives 15 minutes, so a user who leaves a tab open will hit a 401 during ordinary browsing. That must be invisible.

**Files:**
- Modify: `client/src/lib/api.js`
- Test: `client/src/lib/api.test.js`

**Interfaces:**
- Consumes: the auth routes from Tasks 8 and 10
- Produces: existing `api` methods unchanged in signature, plus `api.register`, `api.login`, `api.logout`, `api.me`, `api.requestOtp`, `api.verifyOtp`, `api.linkPhone`, `api.updateMe`, `api.getAddresses`, `api.addAddress`, `api.updateAddress`, `api.deleteAddress`, `api.setDefaultAddress`
- Behaviour: every request sends `credentials: "include"`; a 401 on a non-auth endpoint triggers **one** `POST /auth/refresh` and **one** retry; concurrent 401s share a single in-flight refresh; a failed refresh clears state and notifies listeners rather than hard-redirecting from inside the fetch layer.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import api, { onAuthLost } from "./api";

const json = (body, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300, status,
  json: () => Promise.resolve(body),
});

beforeEach(() => { global.fetch = vi.fn(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("api client", () => {
  it("sends cookies on every request", async () => {
    global.fetch.mockReturnValueOnce(json({ items: [] }));
    await api.getCart();
    expect(global.fetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("refreshes once and retries after a 401", async () => {
    global.fetch
      .mockReturnValueOnce(json({ error: "Please sign in to continue." }, 401)) // /cart
      .mockReturnValueOnce(json({ user: { id: "1" } }))                        // /auth/refresh
      .mockReturnValueOnce(json({ items: [], itemCount: 0 }));                 // /cart retry

    const result = await api.getCart();
    expect(result.itemCount).toBe(0);
    const urls = global.fetch.mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["/api/cart", "/api/auth/refresh", "/api/cart"]);
  });

  it("does not retry more than once", async () => {
    global.fetch
      .mockReturnValueOnce(json({ error: "nope" }, 401))
      .mockReturnValueOnce(json({ user: { id: "1" } }))
      .mockReturnValueOnce(json({ error: "nope" }, 401));

    await expect(api.getCart()).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("never tries to refresh a failed login", async () => {
    global.fetch.mockReturnValueOnce(json({ error: "That email or password isn't right." }, 401));
    await expect(api.login({ email: "a@b.com", password: "x" }))
      .rejects.toThrow("That email or password isn't right.");
    expect(global.fetch).toHaveBeenCalledTimes(1); // no refresh attempt
  });

  it("shares one refresh across concurrent 401s", async () => {
    global.fetch
      .mockReturnValueOnce(json({ error: "x" }, 401))
      .mockReturnValueOnce(json({ error: "x" }, 401))
      .mockReturnValueOnce(json({ user: { id: "1" } }))
      .mockReturnValue(json({ items: [] }));

    await Promise.all([api.getCart(), api.getOrders()]);
    const refreshCalls = global.fetch.mock.calls.filter((c) => c[0] === "/api/auth/refresh");
    expect(refreshCalls).toHaveLength(1);
  });

  it("notifies listeners when the refresh itself fails", async () => {
    const lost = vi.fn();
    const off = onAuthLost(lost);
    global.fetch
      .mockReturnValueOnce(json({ error: "x" }, 401))
      .mockReturnValueOnce(json({ error: "Your session is no longer valid." }, 401));

    await expect(api.getOrders()).rejects.toThrow();
    expect(lost).toHaveBeenCalledOnce();
    off();
  });

  it("still surfaces the server's error string", async () => {
    global.fetch.mockReturnValueOnce(json({ error: "Your cart is empty.", code: "CART_EMPTY" }, 400));
    await expect(api.checkout({})).rejects.toThrow("Your cart is empty.");
  });

  it("passes FormData through without a JSON content-type", async () => {
    global.fetch.mockReturnValueOnce(json({ id: "RX-1" }));
    await api.uploadPrescription(new FormData());
    expect(global.fetch.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/lib/api.test.js`
Expected: FAIL — no `credentials`, no refresh logic, no `onAuthLost` export

- [ ] **Step 3: Rewrite the transport half of `client/src/lib/api.js`**

Keep the existing `qs` helper and the whole `api` object's existing entries untouched; replace only `request` and add the new methods.

```js
// Thin API client for the SubhOne backend. Uses the Vite dev proxy (/api -> :5000).
const BASE = "/api";

// Endpoints that must never trigger a refresh-and-retry: a 401 from these is a
// real answer, not an expired token.
const NO_RETRY = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout", "/auth/otp/"];

const listeners = new Set();
export const onAuthLost = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const announceAuthLost = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });

let refreshing = null;
// All concurrent 401s await the same refresh, so one expired token produces one
// refresh call rather than one per in-flight request.
function refreshOnce() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function errorFrom(res) {
  let message = `Something went wrong (${res.status}).`;
  let code;
  let details;
  try {
    const data = await res.json();
    if (data && data.error) message = data.error;
    if (data) { code = data.code; details = data.details; }
  } catch {
    /* non-json error */
  }
  const err = new Error(message);
  err.status = res.status;
  err.code = code;
  err.details = details;
  return err;
}

async function send(path, options) {
  const isForm = options.body instanceof FormData;
  return fetch(BASE + path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

async function request(path, options = {}, { allowRetry = true } = {}) {
  let res = await send(path, options);

  if (res.status === 401 && allowRetry && !NO_RETRY.some((p) => path.startsWith(p))) {
    if (await refreshOnce()) {
      res = await send(path, options);
    } else {
      announceAuthLost();
      throw await errorFrom(res);
    }
  }

  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return null;
  return res.json();
}

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
```

Then extend the exported object:

```js
  // Auth
  register: (body) => post(`/auth/register`, body),
  login: (body) => post(`/auth/login`, body),
  logout: () => request(`/auth/logout`, { method: "POST" }),
  me: () => request(`/auth/me`),
  updateMe: (body) => request(`/auth/me`, { method: "PATCH", body: JSON.stringify(body) }),
  requestOtp: (phone) => post(`/auth/otp/request`, { phone }),
  verifyOtp: (body) => post(`/auth/otp/verify`, body),
  linkPhone: (body) => post(`/auth/link-phone`, body),

  // Addresses
  getAddresses: () => request(`/me/addresses`),
  addAddress: (body) => post(`/me/addresses`, body),
  updateAddress: (id, body) => request(`/me/addresses/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAddress: (id) => request(`/me/addresses/${id}`, { method: "DELETE" }),
  setDefaultAddress: (id) => post(`/me/addresses/${id}/default`),
```

`api.me()` is called on boot for a visitor who may well be anonymous, so `AuthContext` must treat its 401 as "not signed in" rather than an error. Because `/auth/me` is not in `NO_RETRY`, one refresh is attempted first — which is the desired behaviour for a returning visitor whose access cookie has expired but whose refresh cookie is still good.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd client && npx vitest run src/lib/api.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/api.js client/src/lib/api.test.js
git commit -m "feat: send cookies and silently refresh expired sessions"
```

---

## Task 20: AuthContext, login and register pages, route guarding

**Files:**
- Create: `client/src/context/AuthContext.jsx`, `client/src/components/RequireAuth.jsx`, `client/src/pages/Login.jsx`, `client/src/pages/Register.jsx`
- Modify: `client/src/main.jsx`, `client/src/App.jsx`, `client/src/components/Header.jsx`
- Test: `client/src/context/AuthContext.test.jsx`

**Interfaces:**
- Consumes: `api` (Task 19), `onAuthLost`
- Produces: `useAuth() → { user, loading, login, register, logout, requestOtp, verifyOtp, isAuthenticated }`
- `AuthProvider` must wrap `CartProvider` in `main.jsx`, because a successful login has to trigger `cart.refresh()` — the server merged the guest cart, and the client's copy is now stale.
- `RequireAuth` renders a spinner while `loading`, redirects to `/login` with `state.from` when anonymous, and renders children otherwise.

- [ ] **Step 1: Install the testing libraries and write the failing test**

```bash
cd client && npm i -D @testing-library/react @testing-library/jest-dom jsdom
```

Add to `client/vite.config.js`: `test: { environment: "jsdom", globals: true, setupFiles: "./src/test-setup.js" }`, and create `client/src/test-setup.js` containing `import "@testing-library/jest-dom";`.

```jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import api from "../lib/api";

vi.mock("../lib/api", () => ({
  default: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  onAuthLost: vi.fn(() => () => {}),
}));

function Probe() {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{isAuthenticated ? `hi ${user.name}` : "anonymous"}</p>;
}

const renderProbe = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => vi.clearAllMocks());

describe("AuthContext", () => {
  it("treats a 401 from /me as anonymous, not an error", async () => {
    api.me.mockRejectedValueOnce(Object.assign(new Error("Please sign in"), { status: 401 }));
    renderProbe();
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });

  it("bootstraps an existing session", async () => {
    api.me.mockResolvedValueOnce({ user: { id: "1", name: "Subhasis" } });
    renderProbe();
    await waitFor(() => expect(screen.getByText("hi Subhasis")).toBeInTheDocument());
  });

  it("stops loading even if /me hangs up with a network error", async () => {
    api.me.mockRejectedValueOnce(new Error("Failed to fetch"));
    renderProbe();
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });

  it("sets the user after login and clears it after logout", async () => {
    api.me.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 401 }));
    api.login.mockResolvedValueOnce({ user: { id: "1", name: "Subhasis" } });
    api.logout.mockResolvedValueOnce(null);

    let auth;
    function Capture() { auth = useAuth(); return null; }
    render(<AuthProvider><Capture /><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());

    await act(() => auth.login({ email: "s@example.com", password: "correct-horse-1" }));
    await waitFor(() => expect(screen.getByText("hi Subhasis")).toBeInTheDocument());

    await act(() => auth.logout());
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });

  it("propagates a login failure so the form can show it", async () => {
    api.me.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 401 }));
    api.login.mockRejectedValueOnce(new Error("That email or password isn't right."));

    let auth;
    function Capture() { auth = useAuth(); return null; }
    render(<AuthProvider><Capture /></AuthProvider>);
    await waitFor(() => expect(auth).toBeTruthy());
    await expect(auth.login({ email: "a@b.com", password: "x" }))
      .rejects.toThrow("That email or password isn't right.");
  });

  it("clears the user when the api reports the session was lost", async () => {
    const { onAuthLost } = await import("../lib/api");
    api.me.mockResolvedValueOnce({ user: { id: "1", name: "Subhasis" } });
    let fire;
    onAuthLost.mockImplementation((fn) => { fire = fn; return () => {}; });

    renderProbe();
    await waitFor(() => expect(screen.getByText("hi Subhasis")).toBeInTheDocument());
    await act(async () => { fire(); });
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/context/AuthContext.test.jsx`
Expected: FAIL — cannot resolve `./AuthContext`

- [ ] **Step 3: Implement `client/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { onAuthLost } from "../lib/api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // An anonymous visitor is the common case, so a 401 here is an answer,
  // not a failure worth surfacing.
  useEffect(() => {
    let active = true;
    api.me()
      .then((data) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // The api layer tells us when a refresh failed, so a session that dies in
  // the background does not leave a stale name in the header.
  useEffect(() => onAuthLost(() => setUser(null)), []);

  const login = useCallback(async (creds) => {
    const data = await api.login(creds);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (body) => {
    const data = await api.register(body);
    setUser(data.user);
    return data.user;
  }, []);

  const requestOtp = useCallback((phone) => api.requestOtp(phone), []);

  const verifyOtp = useCallback(async (body) => {
    const data = await api.verifyOtp(body);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { setUser(null); }
  }, []);

  const value = {
    user, loading, isAuthenticated: Boolean(user),
    login, register, logout, requestOtp, verifyOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 4: Wire the cart refresh to auth changes**

`CartContext.jsx` is frozen, so the coupling lives in a tiny bridge component instead. Create `client/src/components/CartAuthBridge.jsx`:

```jsx
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

// The server merges the guest cart during login, so the client's copy is stale
// the moment the user identity changes. Refreshing here keeps CartContext
// untouched while still reacting to auth.
export default function CartAuthBridge() {
  const { user, loading } = useAuth();
  const { refresh } = useCart();
  const lastUserId = useRef(undefined);

  useEffect(() => {
    if (loading) return;
    const id = user ? user.id || user._id : null;
    if (lastUserId.current !== undefined && lastUserId.current !== id) refresh();
    lastUserId.current = id;
  }, [user, loading, refresh]);

  return null;
}
```

- [ ] **Step 5: Implement `RequireAuth`, `Login` and `Register`**

`client/src/components/RequireAuth.jsx`

```jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui/Feedback";

export default function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Rendering the redirect before the bootstrap finishes would bounce a
  // signed-in user to /login on every hard refresh.
  if (loading) {
    return <div className="container-max flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
```

`Login.jsx` offers two tabs — email plus password, and phone plus OTP. The email form calls `login`, the phone form calls `requestOtp` then `verifyOtp` with the returned `challengeId`, and in development it pre-fills the code from `devCode` when present. Both paths navigate to `location.state?.from?.pathname || "/"` on success and render `err.message` inline on failure. `Register.jsx` posts name, email and password, showing `err.details` per field when the server returns 422. Use the existing `Button`, `SectionHeader` and `Feedback` primitives so the pages match the rest of the app rather than introducing new styling.

- [ ] **Step 6: Update `main.jsx` and `App.jsx`**

```jsx
// main.jsx — AuthProvider must sit outside CartProvider.
<NotificationProvider>
  <AuthProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </AuthProvider>
</NotificationProvider>
```

```jsx
// App.jsx — new routes, and /orders behind the guard.
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
<Route path="/checkout" element={<Checkout />} />
<Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
<Route path="/orders/:id" element={<RequireAuth><Orders /></RequireAuth>} />
```

Render `<CartAuthBridge />` once inside `Layout`. Leave the `/cart` → `/checkout` redirect exactly as it is; Checkout itself is P1's job, and this task must not touch it.

In `Header.jsx`, replace any static account affordance with a conditional: when `isAuthenticated`, show the user's first name and a menu containing "My orders" and "Sign out"; otherwise show a "Sign in" link to `/login`.

- [ ] **Step 7: Run the tests and build**

Run: `cd client && npx vitest run && npm run build`
Expected: PASS (6 auth tests, plus Tasks 18 and 19 still green) and a clean build

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "feat: add client auth context, login and register, guarded routes"
```

---

## Task 21: Render the order timeline from real history

`Orders.jsx` currently trusts whatever `timeline` the server invents. The server now sends real history, so the page needs to handle a cancelled order and a missing timestamp — cases the fabricated version could never produce.

**Files:**
- Modify: `client/src/pages/Orders.jsx`
- Test: `client/src/pages/Orders.test.jsx`

**Interfaces:**
- Consumes: `orderService.toPublic` output from Task 14 — `{ id, status, placedAt, items, total, timeline: [{ label, at, done, current }] }`
- `STATUS_LABEL` maps the server's `SCREAMING_SNAKE` statuses to sentence-case copy; an unknown status falls back to a humanised form of the raw value rather than rendering blank.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Orders from "./Orders";
import api from "../lib/api";

vi.mock("../lib/api", () => ({ default: { getOrders: vi.fn(), getOrder: vi.fn() } }));

const order = {
  id: "SO-481301", status: "PACKED", placedAt: "2026-08-20T10:00:00.000Z",
  total: 64000, subtotal: 60000, deliveryFee: 4000,
  items: [{ id: "p1", type: "medicine", name: "Paracetamol 500", quantity: 2, price: 3000 }],
  eta: "Arriving in 30–90 minutes",
  timeline: [
    { label: "PLACED", at: "2026-08-20T10:00:00.000Z", done: true, current: false },
    { label: "CONFIRMED", at: "2026-08-20T10:05:00.000Z", done: true, current: false },
    { label: "PACKED", at: "2026-08-20T10:20:00.000Z", done: true, current: true },
    { label: "OUT_FOR_DELIVERY", at: null, done: false, current: false },
    { label: "DELIVERED", at: null, done: false, current: false },
  ],
};

const renderDetail = () => render(
  <MemoryRouter initialEntries={["/orders/SO-481301"]}>
    <Routes><Route path="/orders/:id" element={<Orders />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => vi.clearAllMocks());

describe("Orders", () => {
  it("formats money from paise", async () => {
    api.getOrders.mockResolvedValueOnce([order]);
    render(<MemoryRouter><Orders /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("₹640")).toBeInTheDocument());
  });

  it("renders every stage with readable labels", async () => {
    api.getOrder.mockResolvedValueOnce(order);
    renderDetail();
    await waitFor(() => expect(screen.getByText("Packed")).toBeInTheDocument());
    expect(screen.getByText("Out for delivery")).toBeInTheDocument();
    expect(screen.queryByText("OUT_FOR_DELIVERY")).not.toBeInTheDocument();
  });

  it("marks exactly one stage as current", async () => {
    api.getOrder.mockResolvedValueOnce(order);
    renderDetail();
    await waitFor(() => expect(screen.getAllByTestId("stage-current")).toHaveLength(1));
  });

  it("omits a timestamp for a stage not yet reached", async () => {
    api.getOrder.mockResolvedValueOnce(order);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("stage-DELIVERED")).toBeInTheDocument());
    expect(screen.getByTestId("stage-DELIVERED")).not.toHaveTextContent(/2026/);
  });

  it("renders a cancelled order without inventing progress", async () => {
    api.getOrder.mockResolvedValueOnce({
      ...order, status: "CANCELLED",
      timeline: [
        { label: "PLACED", at: "2026-08-20T10:00:00.000Z", done: true, current: false },
        { label: "CANCELLED", at: "2026-08-20T11:00:00.000Z", done: true, current: true },
      ],
    });
    renderDetail();
    await waitFor(() => expect(screen.getByText("Cancelled")).toBeInTheDocument());
    expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
  });

  it("survives an order with no timeline at all", async () => {
    api.getOrder.mockResolvedValueOnce({ ...order, timeline: undefined });
    renderDetail();
    await waitFor(() => expect(screen.getByText("SO-481301")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/pages/Orders.test.jsx`
Expected: FAIL — raw `PACKED` is rendered and there are no `data-testid` hooks

- [ ] **Step 3: Update `client/src/pages/Orders.jsx`**

Add the label map and rewrite the timeline block:

```jsx
const STATUS_LABEL = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_FAILED: "Payment failed",
  AWAITING_PRESCRIPTION: "Awaiting prescription",
};

// Unknown statuses still render legibly rather than as a blank row.
const label = (status) =>
  STATUS_LABEL[status] ||
  String(status || "").toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const stageTime = (at) =>
  at ? new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;
```

```jsx
<div className="card p-5">
  <div className="space-y-4">
    {(order.timeline || []).map((stage) => (
      <div
        key={stage.label}
        data-testid={stage.current ? "stage-current" : `stage-${stage.label}`}
        className="flex items-center gap-3"
      >
        <span className={`h-3 w-3 shrink-0 rounded-full ${stage.done ? "bg-primary" : "bg-outline-variant"}`} />
        <span className={stage.current ? "font-bold text-primary" : "text-on-surface-variant"}>
          {label(stage.label)}
        </span>
        {stage.at && (
          <span className="ml-auto text-xs text-on-surface-variant">{stageTime(stage.at)}</span>
        )}
      </div>
    ))}
  </div>
</div>
```

Note the `data-testid` on the current stage is `stage-current` rather than both — keeping one id per element is what makes the "exactly one current" assertion meaningful. Also swap the status chip in `OrderCard` to `{label(order.status)}`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd client && npx vitest run src/pages/Orders.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Orders.jsx client/src/pages/Orders.test.jsx
git commit -m "feat: render the order timeline from stored status history"
```

---

## Task 22: End-to-end verification against the P0 exit checklist

No new behaviour — this task only proves the twelve exit criteria in spec §6.13 actually hold. If any check fails, fix it here rather than declaring P0 done.

**Files:**
- Create: `server/tests/e2e/p0-journey.test.js`, `docs/superpowers/plans/2026-08-23-p0-verification.md`
- Modify: `server/package.json`, `client/package.json` (test scripts), `README.md` (setup steps)

- [ ] **Step 1: Write the full-journey test**

```js
const { describe, it, expect, beforeEach } = require("vitest");
const request = require("supertest");
const app = require("../../src/app");
const Product = require("../../src/models/Product");
const Coupon = require("../../src/models/Coupon");

const address = {
  label: "Home", line1: "12 Park Street", city: "Kolkata",
  state: "West Bengal", pincode: "700016", phone: "+919830000000",
};
const cookieOf = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0] : null;
};

let med;
beforeEach(async () => {
  med = await Product.create({
    kind: "medicine", name: "Paracetamol 500", slug: "para-500", brand: "Acme",
    pricePaise: 30000, mrpPaise: 40000, stock: 50,
  });
  await Coupon.create({ code: "SAVE10", type: "percent", value: 10, minOrderPaise: 0, isActive: true });
});

describe("P0 journey: browse → guest cart → register → order", () => {
  it("carries a guest cart through registration into a correctly priced order", async () => {
    // 1. Browse anonymously.
    const catalog = await request(app).get("/api/medicines");
    expect(catalog.status).toBe(200);
    const item = catalog.body[0];
    expect(item.price).toBe(30000);

    // 2. Add to cart as a guest.
    const added = await request(app).post("/api/cart/add")
      .send({ id: item.id, type: "medicine", quantity: 2 });
    const gid = cookieOf(added, "so_gid");
    expect(added.body.itemCount).toBe(2);
    expect(added.body.subtotal).toBe(60000);

    // 3. Register, carrying the guest cookie.
    const reg = await request(app).post("/api/auth/register").set("Cookie", gid)
      .send({ name: "Subhasis", email: "s@example.com", password: "correct-horse-1" });
    expect(reg.status).toBe(201);
    const at = cookieOf(reg, "so_at");

    // 4. The cart followed the user across.
    const merged = await request(app).get("/api/cart").set("Cookie", at);
    expect(merged.body.itemCount).toBe(2);

    // 5. Save an address.
    const addr = await request(app).post("/api/me/addresses").set("Cookie", at).send(address);
    expect(addr.body.addresses[0].isDefault).toBe(true);

    // 6. Check a coupon.
    const coupon = await request(app).post("/api/coupons/validate").set("Cookie", at)
      .send({ code: "SAVE10", subtotal: 60000 });
    expect(coupon.body.valid).toBe(true);
    expect(coupon.body.discountPaise).toBe(6000);

    // 7. Place the order — subtotal ₹600, less ₹60, free delivery over ₹499.
    const order = await request(app).post("/api/checkout").set("Cookie", at)
      .send({ address, paymentMethod: "COD", couponCode: "SAVE10" });
    expect(order.status).toBe(201);
    expect(order.body.subtotal).toBe(60000);
    expect(order.body.couponDiscount).toBe(6000);
    expect(order.body.deliveryFee).toBe(0);
    expect(order.body.total).toBe(54000);

    // 8. It appears in the user's history, and the cart is empty.
    const list = await request(app).get("/api/orders").set("Cookie", at);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(order.body.id);
    expect((await request(app).get("/api/cart").set("Cookie", at)).body.itemCount).toBe(0);

    // 9. Every money field is an integer.
    Object.entries(order.body).forEach(([key, value]) => {
      if (typeof value === "number" && /total|subtotal|fee|discount|savings/i.test(key)) {
        expect(Number.isInteger(value), `${key} must be integer paise`).toBe(true);
      }
    });
  });

  it("survives a restart — the order is still there", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "S", email: "s@example.com", password: "correct-horse-1" });
    const at = cookieOf(reg, "so_at");
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 1 });
    const order = await request(app).post("/api/checkout").set("Cookie", at)
      .send({ address, paymentMethod: "COD" });

    // Re-read straight from the database, bypassing every in-process cache.
    const Order = require("../../src/models/Order");
    const stored = await Order.findOne({ orderNumber: order.body.id });
    expect(stored).toBeTruthy();
    expect(stored.totalPaise).toBe(order.body.total);
  });

  it("cannot be tricked into a cheaper order by any client payload", async () => {
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "S", email: "s@example.com", password: "correct-horse-1" });
    const at = cookieOf(reg, "so_at");
    await request(app).post("/api/cart/add").set("Cookie", at)
      .send({ id: String(med._id), type: "medicine", quantity: 1 });

    const attempts = [
      { items: [{ id: String(med._id), type: "medicine", price: 1, quantity: 1 }] },
      { subtotal: 1, total: 1, deliveryFee: -100 },
      { couponCode: "SAVE10", couponDiscount: 999999 },
    ];
    for (const payload of attempts) {
      const res = await request(app).post("/api/checkout").set("Cookie", at)
        .send({ address, paymentMethod: "COD", ...payload });
      if (res.status === 201) {
        expect(res.body.total).toBeGreaterThan(0);
        expect(res.body.subtotal).toBe(30000);
        // Re-stock the cart for the next attempt.
        await request(app).post("/api/cart/add").set("Cookie", at)
          .send({ id: String(med._id), type: "medicine", quantity: 1 });
      }
    }
  });
});
```

- [ ] **Step 2: Run the whole suite on both sides**

```bash
cd server && npx vitest run
cd ../client && npx vitest run && npm run build
```

Expected: every suite green, clean build.

- [ ] **Step 3: Walk the twelve exit criteria and record evidence**

Run each check and paste the real output into `docs/superpowers/plans/2026-08-23-p0-verification.md`. A criterion is met only when its command's output is in the file.

```bash
# 1. store.js is gone and unreferenced.
test ! -f server/src/services/store.js && echo "OK: store.js deleted"
grep -rn "services/store" server/src client/src || echo "OK: no importers"

# 2. No rupee interpolation bypasses inr() on the client.
grep -rn '₹{' client/src && echo "FAIL: bypass found" || echo "OK: no bypasses"

# 3. No in-memory mutable state left in the service layer.
grep -rn "^let \|^var " server/src/services/ || echo "OK: no module-level mutable state"

# 4. Checkout never reads client items.
grep -n "body.items\|req.body.items" server/src/routes/checkout.js && echo "FAIL" || echo "OK"

# 5. Orders are scoped.
grep -n "listOrders()\|find({})" server/src/routes/orders.js && echo "FAIL" || echo "OK"

# 6. Secrets are not hard-coded.
grep -rn "JWT_SECRET\s*=\s*[\"']" server/src && echo "FAIL" || echo "OK"

# 7. Every money field name carries its unit, server-side.
grep -rn "pricePaise\|totalPaise\|subtotalPaise" server/src/models | head

# 8. A fresh seed is idempotent.
cd server && node src/scripts/seed.js && node src/scripts/seed.js
```

Criteria 9 through 12 are manual: start both servers, then confirm in a browser that (9) a guest can add to the cart, register, and see the cart survive; (10) a hard refresh keeps the user signed in; (11) the orders page shows a real timeline with real timestamps; (12) `docker stop` on Mongo produces a readable error rather than a hung request.

- [ ] **Step 4: Update the README**

Document the new setup: `.env` keys with a note that `JWT_SECRET` needs 32+ characters and `OTP_PEPPER` 16+, the single-node replica set requirement with the `docker run --replSet` command, `npm run seed`, `npm test` on both sides, and the fact that OTP codes print to the server console while `SMS_PROVIDER=dev`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: verify the P0 exit criteria end to end"
```

---

## Done when

All twelve criteria in spec §6.13 are recorded with evidence in `docs/superpowers/plans/2026-08-23-p0-verification.md`, both test suites are green, the client builds, and a guest can browse, add to the cart, register, save an address, apply a coupon and place an order that survives a server restart — with no code path anywhere that lets a client influence a price.

P1 picks up from here: the real `Checkout.jsx`, stock reservation, delivery slots and coupon redemption records.


