const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { loadEnv } = require("./config/env");
const attachUser = require("./middleware/attachUser");
const originCheck = require("./middleware/originCheck");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const catalogRoutes = require("./routes/catalog");
const labTestRoutes = require("./routes/labTests");
const cartRoutes = require("./routes/cart");
const checkoutRoutes = require("./routes/checkout");
const orderRoutes = require("./routes/orders");
const prescriptionRoutes = require("./routes/prescriptions");
const consultationRoutes = require("./routes/consultations");
const searchRoutes = require("./routes/search");
const contentRoutes = require("./routes/content");

const cfg = loadEnv();

// Exported without calling listen() so supertest can mount the app in-process.
const app = express();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const origins = String(cfg.CORS_ORIGIN)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// credentials:true is required — both auth cookies are httpOnly and the browser
// will not send them cross-origin otherwise. That in turn forbids origin "*",
// so the allow-list from env is the origin of record.
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
// The secret signs the so_gid guest-cart cookie, preventing session-fixation
// from a planted cookie. Auth cookies (so_at, so_rt) are JWTs that carry their
// own cryptographic verification and do not need to be signed here in addition.
app.use(cookieParser(cfg.JWT_SECRET));

// Defence in depth behind CORS: rejects mutating requests carrying a foreign
// Origin, which a browser preflight would normally have stopped first.
app.use(originCheck(origins));

// Populates req.user from the access-token cookie when one is present and still
// valid. Never rejects — requireAuth is what turns absence into a 401.
app.use(attachUser);

app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "subhone-api", time: new Date().toISOString() })
);

app.use("/api/auth", authRoutes);
app.use("/api/otp", authRoutes);
app.use("/api", catalogRoutes); // /api/medicines, /api/supplements, /api/products/:id, /api/brands
app.use("/api/lab-tests", labTestRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api", contentRoutes); // /api/banners, /api/categories, /api/wellness, /api/doctors, /api/flash-sale, /api/coupons/validate

app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found", code: "NOT_FOUND" })
);

app.use(errorHandler);

module.exports = app;
