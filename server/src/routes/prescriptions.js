const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const store = require("../services/store");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP or PDF files up to 8MB are allowed."));
  },
});

// POST /api/prescriptions/upload  (multipart field: "prescription")
router.post("/upload", (req, res) => {
  upload.single("prescription")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const record = store.addPrescription({
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: `/uploads/${req.file.filename}`,
      notes: req.body.notes || "",
    });

    res.status(201).json({
      ...record,
      message: "Prescription received — a pharmacist will review it within 30 minutes.",
    });
  });
});

// GET /api/prescriptions
router.get("/", (req, res) => res.json(store.listPrescriptions()));

module.exports = router;
