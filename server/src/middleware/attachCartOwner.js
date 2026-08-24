const crypto = require("crypto");
const { setGuestCookie, readGuestId } = require("../utils/cookies");

// Shape of crypto.randomUUID(). The cookie is signed, so a value that reaches here
// was minted by this server — but the check is kept as the second lock: it costs
// nothing and it is what holds if the signing secret is ever mis-wired. An
// unrecognised value is replaced, not rejected — a mangled cookie should cost the
// visitor their guest cart, not their ability to shop.
const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A signed-in user always owns their own cart. Anonymous visitors get a stable
// guest id in a cookie so their cart survives a page reload and can be merged into
// the account on login.
//
// The cookie is minted on any cart request, including a plain GET: the alternative
// is that the visitor's first POST /add writes a cart under an id the very next
// request has no way to name.
module.exports = function attachCartOwner(req, res, next) {
  // req.user is already resolved — attachUser runs globally, ahead of the mounts.
  // Signed in wins outright; the guest cookie is left untouched for the login flow
  // to merge and clear, because a cart route is the wrong place to edit session state.
  if (req.user) {
    req.cartOwner = { userId: req.user._id };
    return next();
  }

  const existing = readGuestId(req);
  let guestId = GUEST_ID.test(String(existing || "")) ? existing : null;
  if (!guestId) {
    guestId = crypto.randomUUID();
    setGuestCookie(res, guestId);
  }

  req.cartOwner = { guestId };
  return next();
};
