const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

// Provides atomic, gap-free increments for generating sequential IDs (like Order numbers)
counterSchema.statics.getNextSequence = async function (name, session = null) {
  const result = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return result.seq;
};

const Counter = mongoose.model("Counter", counterSchema);
module.exports = Counter;
