const mongoose = require("mongoose");

const consultationSchema = new mongoose.Schema(
  {
    // Human-facing number, e.g. CON-000123. Gap-free via the Counter collection.
    consultationNumber: { type: String, required: true, unique: true },
    // The account that booked. Always present — bookings require auth.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    // Frozen at booking so the consultation page is correct even if the doctor is
    // later edited or removed — the same reason orders snapshot catalog lines.
    doctor: {
      name: { type: String, required: true },
      specialty: { type: String },
      image: { type: String },
    },
    date: { type: String },
    slot: { type: String },
    mode: { type: String },
    patientName: { type: String },
    concern: { type: String, default: "" },
    // Paise. Integer validator mirrors Doctor.consultationFeePaise.
    feePaise: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "feePaise must be an integer number of paise",
      },
    },
    status: {
      type: String,
      enum: ["BOOKED", "COMPLETED", "CANCELLED"],
      default: "BOOKED",
    },
  },
  { timestamps: true }
);

consultationSchema.index({ userId: 1, createdAt: -1 });

const Consultation = mongoose.model("Consultation", consultationSchema);
module.exports = Consultation;
