const express = require("express");
const router = express.Router();
const store = require("../services/store");

// POST /api/consultations/book  { doctorId, date, slot, patientName, mode, concern }
router.post("/book", (req, res) => {
  const { doctorId } = req.body || {};
  if (!doctorId) return res.status(400).json({ error: "Please choose a doctor." });
  const booking = store.bookConsultation(req.body);
  if (booking.error) return res.status(404).json(booking);
  res.status(201).json(booking);
});

// GET /api/consultations — booking history
router.get("/", (req, res) => res.json(store.listConsultations()));

module.exports = router;
