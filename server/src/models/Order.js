const mongoose = require("mongoose");
const { ORDER_STATUS, CUSTOMER_TIMELINE } = require("../config/constants");

// A line is a *snapshot* of the catalog item at purchase time. We store the public
// catalog id (refId) rather than Mongo _id for the same reason the cart does: the
// seed script deletes and re-inserts the catalog, so a _id-keyed line would dangle.
// Everything money-related is copied here at checkout so the price the customer paid
// is fixed forever, independent of later catalog edits.
const orderLineSchema = new mongoose.Schema(
  {
    refId: { type: String, required: true },
    refModel: { type: String, required: true, enum: ["Product", "LabTest"] },
    name: { type: String, required: true },
    brand: { type: String, default: "" },
    image: { type: String, default: "" },
    packSize: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    // All amounts in paise; the field names carry the unit on purpose.
    pricePaise: { type: Number, required: true },
    mrpPaise: { type: Number, required: true },
    lineTotalPaise: { type: Number, required: true },
    prescriptionRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Human-facing order number, e.g. SO-000123. Generated gap-free from the
    // Counter collection so support can read it out loud; distinct from Mongo _id.
    orderNumber: { type: String, required: true, unique: true },
    // The account that placed the order, when one exists. Guest checkouts have none.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // What was bought, frozen at purchase. Never re-read from the catalog.
    items: { type: [orderLineSchema], required: true },

    // Delivery details as supplied by the checkout form. Kept inline (not a ref)
    // because an address can change on a user's profile without rewriting history.
    address: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, required: true },
    },

    paymentMethod: { type: String, default: "cod" },
    couponCode: { type: String, default: null },
    couponDiscountPaise: { type: Number, default: 0 },

    // All totals in paise.
    subtotalPaise: { type: Number, required: true },
    mrpTotalPaise: { type: Number, required: true },
    savingsPaise: { type: Number, default: 0 },
    deliveryFeePaise: { type: Number, required: true },
    totalPaise: { type: Number, required: true },

    status: {
      type: String,
      enum: ORDER_STATUS,
      default: "PLACED",
    },
    // Customer-visible stages with timestamps, so the order page can render a real
    // timeline from history rather than guessing. Seeded with PLACED at creation.
    timeline: [{
      stage: { type: String, enum: CUSTOMER_TIMELINE },
      at: { type: Date, default: Date.now },
    }],

    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
