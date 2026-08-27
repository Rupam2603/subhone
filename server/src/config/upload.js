const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { extname } = require("path");
const AppError = require("../utils/AppError");

// Plan-set of accepted upload types (4). NOTE: plan drops image/heic from the
// prototype's list — keep the plan's set.
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const rand = Math.random().toString(36).slice(2, 10);
    const ext = extname(file.originalname.toLowerCase()).slice(0, 8);
    cb(null, `${Date.now()}-${rand}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new AppError(415, "BAD_FILE_TYPE",
      "Only JPG, PNG, WEBP or PDF files up to 8MB are allowed."));
  },
});

module.exports = upload;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
module.exports.ALLOWED = ALLOWED;
module.exports.MAX_BYTES = MAX_BYTES;
