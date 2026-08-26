const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // The string ID from the old prototype (e.g. "m1")
    type: { type: String, required: true, enum: ["medicine", "supplement", "babyfood"] },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    pricePaise: { type: Number, required: true },
    mrpPaise: { type: Number, required: true }, // was originalPrice
    dosageForm: { type: String },
    category: { type: String, required: true },
    packSize: { type: String },
    prescriptionRequired: { type: Boolean, default: false },
    inStock: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    image: { type: String },
    description: { type: String },
    tags: [String],
    bestseller: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
