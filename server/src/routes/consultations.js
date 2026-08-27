const express = require("express");
const { z } = require("zod");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const consultationService = require("../services/consultationService");

// Every consultation route is account-scoped.
router.use(requireAuth);

const bookSchema = z.object({
  doctorId: z.string().regex(/^[0-9a-fA-F]{24}$/, "doctorId must be a Mongo ObjectId"),
  date: z.string().optional(),
  slot: z.string().optional(),
  patientName: z.string().min(2),
  mode: z.string().optional(),
  concern: z.string().optional(),
});

// POST /api/consultations/book
router.post(
  "/book",
  validate({ body: bookSchema }),
  asyncHandler(async (req, res) => {
    const booking = await consultationService.bookConsultation(req.user._id, req.body);
    res.status(201).json({
      id: booking.consultationNumber,
      doctor: { name: booking.doctor.name },
      feePaise: booking.feePaise,
      status: booking.status,
    });
  })
);

// GET /api/consultations — booking history for the caller
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const list = await consultationService.listConsultations(req.user._id);
    res.json(list);
  })
);

module.exports = router;
