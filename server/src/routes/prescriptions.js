const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../utils/asyncHandler");
const upload = require("../config/upload");
const Prescription = require("../models/Prescription");
const Counter = require("../models/Counter");
const AppError = require("../utils/AppError");

// Every prescription route is account-scoped.
router.use(requireAuth);

// POST /api/prescriptions/upload  (multipart field: "file")
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) {
        return next(new AppError(422, "FILE_REQUIRED", "A prescription file is required."));
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const seq = await Counter.getNextSequence("prescriptions");
    const prescriptionNumber = `RX-${String(seq).padStart(6, "0")}`;

    const record = await Prescription.create({
      prescriptionNumber,
      userId: req.user._id,
      filePath: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      note: req.body.note || "",
    });

    res.status(201).json({
      id: record.prescriptionNumber,
      status: record.status,
      filePath: record.filePath,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      note: record.note,
      message: "Prescription received — a pharmacist will review it shortly.",
    });
  })
);

// GET /api/prescriptions — upload history for the caller
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const list = await Prescription.find({ userId: req.user._id });
    res.json(list);
  })
);

module.exports = router;
