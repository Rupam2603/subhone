const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const attachUser = require("./middleware/attachUser");
const originCheck = require("./middleware/originCheck");
const errorHandler = require("./middleware/errorHandler");

// Exports the configured app without listening, so supertest can mount it in-process
// and later tasks have a single place to add routers. index.js does the booting.
const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const ORIGINS = CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// credentials: true is required for the browser to send the httpOnly auth cookies;
// with it, the allow-list must be explicit — "*" is rejected by the CORS spec.
app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(originCheck(ORIGINS));
app.use(attachUser);

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "subhone-api", time: new Date().toISOString() }));

app.use("/api/auth", require("./routes/auth"));

// /api/medicines, /api/supplements, /api/products/:id, /api/brands
app.use("/api", require("./routes/catalog"));
app.use("/api/lab-tests", require("./routes/labTests"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/checkout", require("./routes/checkout"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/prescriptions", require("./routes/prescriptions"));
app.use("/api/consultations", require("./routes/consultations"));
app.use("/api/search", require("./routes/search"));
// /api/banners, /api/categories, /api/wellness, /api/doctors, /api/flash-sale,
// /api/coupons/validate
app.use("/api", require("./routes/content"));
// Remaining routers are mounted here as later tasks land.

app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found", code: "NOT_FOUND" }));
app.use(errorHandler);

module.exports = app;
