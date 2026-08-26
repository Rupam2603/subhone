const express = require("express");
const { z } = require("zod");
const { randomUUID } = require("crypto");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

// Every route below is scoped to req.user, populated by attachUser + requireAuth.
// An address id belonging to another user simply is not found on this user's array
// (Mongoose DocumentArray.id returns null), so it yields 404, never 403.
router.use(requireAuth);

const addressBody = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Include the country code"),
  street: z.string().trim().min(4, "Street address is required"),
  city: z.string().trim().min(2, "City is required"),
  state: z.string().trim().min(2, "State is required"),
  pinCode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
  isDefault: z.boolean().optional(),
});

// Always answer with the whole addresses array so the client never has to
// reconcile local state against the server — it just replaces what it has.
const reply = (res, user, status = 200) => res.status(status).json({ addresses: user.addresses });

// Scoped to req.user: an id that isn't on this user's array is not found → 404.
const findOwn = (user, id) => {
  if (typeof id !== "string" || !id) throw new AppError(400, "BAD_ID", "Address id is required");
  const found = user.addresses.id(id);
  if (!found) throw new AppError(404, "ADDRESS_NOT_FOUND", "We couldn't find that address.");
  return found;
};

// Clear every entry's default flag, then set the target true. The User model has
// no setDefaultAddress method, so this is done inline on the document array.
const setDefault = (user, id) => {
  user.addresses.forEach((a) => { a.isDefault = a._id.toString() === id; });
};

router.get("/addresses", (req, res) => reply(res, req.user));

router.post("/addresses", validate({ body: addressBody }), asyncHandler(async (req, res) => {
  // First address is default automatically; an explicit isDefault:true promotes.
  const makeDefault = req.body.isDefault === true || req.user.addresses.length === 0;
  req.user.addresses.push({ id: randomUUID(), ...req.body, isDefault: false });
  const added = req.user.addresses[req.user.addresses.length - 1];
  if (makeDefault) setDefault(req.user, added._id.toString());
  await req.user.save();
  return reply(res, req.user, 201);
}));

router.patch("/addresses/:id",
  validate({ body: addressBody.partial() }),
  asyncHandler(async (req, res) => {
    const address = findOwn(req.user, req.params.id);
    const { isDefault, ...fields } = req.body;
    Object.assign(address, fields);
    // Promoting via PATCH only flips the default when explicitly true; a partial
    // update that omits isDefault leaves the existing default untouched.
    if (isDefault === true) setDefault(req.user, address._id.toString());
    await req.user.save();
    return reply(res, req.user);
  }));

router.post("/addresses/:id/default", asyncHandler(async (req, res) => {
  const address = findOwn(req.user, req.params.id);
  setDefault(req.user, address._id.toString());
  await req.user.save();
  return reply(res, req.user);
}));

router.delete("/addresses/:id", asyncHandler(async (req, res) => {
  const address = findOwn(req.user, req.params.id);
  const wasDefault = address.isDefault;
  address.deleteOne();
  // If we just removed the default and others remain, promote the first survivor
  // so there is always at most one default and never zero while addresses exist.
  if (wasDefault && req.user.addresses.length > 0) {
    setDefault(req.user, req.user.addresses[0]._id.toString());
  }
  await req.user.save();
  return reply(res, req.user);
}));

module.exports = router;
