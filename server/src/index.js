const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const catalogRoutes = require("./routes/catalog");
const labTestRoutes = require("./routes/labTests");
const cartRoutes = require("./routes/cart");
const checkoutRoutes = require("./routes/checkout");
const orderRoutes = require("./routes/orders");
const prescriptionRoutes = require("./routes/prescriptions");
const consultationRoutes = require("./routes/consultations");
const searchRoutes = require("./routes/search");
const contentRoutes = require("./routes/content");

const app = express();
const PORT = process.env.PORT || 5000;

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

// Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "subhone-api", time: new Date().toISOString() })
);

// Routes
app.use("/api", catalogRoutes); // /api/medicines, /api/supplements, /api/products/:id, /api/brands
app.use("/api/lab-tests", labTestRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api", contentRoutes); // /api/banners, /api/categories, /api/wellness, /api/doctors, /api/flash-sale, /api/coupons/validate

// 404 for unmatched API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found" }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n  🌿 SubhOne API running on http://localhost:${PORT}`);
  console.log(`     Health:  http://localhost:${PORT}/api/health\n`);
});
