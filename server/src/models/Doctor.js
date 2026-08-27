const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // URL-safe, unique across doctors. Seeded from the prototype's string id so
    // legacy links keep working; treated as the public handle, not Mongo _id.
    slug: { type: String, required: true, unique: true },
    specialty: { type: String },
    qualifications: { type: [String], default: [] },
    experienceYears: { type: Number, default: 0 },
    languages: { type: [String], default: [] },
    rating: { type: Number, default: 0 },
    image: { type: String },
    // Paise. Integer validator matches Product so money can never be fractional.
    consultationFeePaise: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "consultationFeePaise must be an integer number of paise",
      },
    },
    nextAvailable: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Doctor = mongoose.model("Doctor", doctorSchema);
module.exports = Doctor;
