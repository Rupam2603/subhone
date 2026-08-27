const Doctor = require("../models/Doctor");
const Consultation = require("../models/Consultation");
const Counter = require("../models/Counter");
const AppError = require("../utils/AppError");

// Books a consultation for a user against an existing doctor. The doctor is
// loaded (not trusted from the client) and snapshotted so the booking page is
// correct even if the doctor is later edited. Fee comes from the doctor record
// server-side — never a client-supplied value.
async function bookConsultation(userId, { doctorId, date, slot, patientName, mode, concern }) {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new AppError(404, "DOCTOR_NOT_FOUND", "That doctor isn't available.");

  const seq = await Counter.getNextSequence("consultations");
  const consultationNumber = `CON-${String(seq).padStart(6, "0")}`;

  const booking = await Consultation.create({
    consultationNumber,
    userId,
    doctorId: doctor._id,
    doctor: { name: doctor.name, specialty: doctor.specialty, image: doctor.image },
    date: date || null,
    slot: slot || null,
    mode: mode || null,
    patientName: patientName || null,
    concern: concern || "",
    feePaise: doctor.consultationFeePaise,
    status: "BOOKED",
  });

  return booking;
}

// History for one user, newest first.
async function listConsultations(userId) {
  return Consultation.find({ userId }).sort({ createdAt: -1 });
}

module.exports = { bookConsultation, listConsultations };
