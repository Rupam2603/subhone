const mongoose = require("mongoose");
const { MAX_CART_ITEM_QTY } = require("../config/constants");

// Deliberately price-free: a cart line records *what* and *how many*, never *for
// how much*. Pricing is resolved from the catalog on every read, which makes
// server-authoritative pricing structural rather than a rule a validator has to
// remember — a client cannot send a price because there is nowhere to put one.
const cartItemSchema = new mongoose.Schema(
  {
    // The public catalog id ("m1", "t3") — not Mongo's _id. Two reasons:
    //  1. scripts/seed.js deletes and re-inserts the catalog, so every _id changes
    //     on a reseed. Storing _id here would silently empty every saved cart.
    //  2. It is the identity the API and the frozen client already speak, so
    //     nothing has to be translated on the way in or out.
    refId: { type: String, required: true, trim: true },
    // Which collection refId belongs to. Internal only: never leaves the server.
    refModel: { type: String, required: true, enum: ["Product", "LabTest"] },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      // The cap is enforced in cartService too; repeating it here means no code
      // path — present or future — can persist an over-cap line.
      max: MAX_CART_ITEM_QTY,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number.",
      },
    },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    // Exactly one of these identifies the owner. Both default to null so the
    // partial indexes below can tell "no owner of this kind" from a real value.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestId: { type: String, default: null },
    items: { type: [cartItemSchema], default: [] },
    // Present on guest carts only — a TTL index cannot be conditional, so an
    // absent field is how a signed-in cart opts out of expiry.
    guestExpiresAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

// One cart per owner. Partial so the null placeholder on the other field does not
// collide across every document.
cartSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });
cartSchema.index({ guestId: 1 }, { unique: true, partialFilterExpression: { guestId: { $type: "string" } } });
// Mongo expires a document when this date passes; documents without the field are
// never touched, which is exactly the behaviour signed-in carts want.
cartSchema.index({ guestExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Cart", cartSchema);
