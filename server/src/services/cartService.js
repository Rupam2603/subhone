// STUB — the real cart service arrives with the Cart model task, which replaces
// this file wholesale and brings its own tests.
//
// It exists now only because the auth routes fold a guest cart into the user's own
// cart on sign-in, and a top-level require of a missing module would take the whole
// app down at boot. Returning null is the correct behaviour while there is no Cart
// collection to merge: a guest has nothing stored, so there is nothing to move.

async function mergeGuestCart(/* { guestId, userId } */) {
  return null;
}

module.exports = { mergeGuestCart };
