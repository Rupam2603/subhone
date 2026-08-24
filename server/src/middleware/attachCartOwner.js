const crypto = require("crypto");
const { GUEST_COOKIE, setGuestCookie } = require("../utils/cookies");

// Shape of crypto.randomUUID(). Checked rather than trusted because the cookie is
// attacker-controlled: possessing the id *is* possessing the cart, so an id chosen
// by someone else (say a planted "so_gid=1") must not be honoured as an owner. An
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

  const existing = req.cookies && req.cookies[GUEST_COOKIE];
  let guestId = GUEST_ID.test(String(existing || "")) ? existing : null;
  if (!guestId) {
    guestId = crypto.randomUUID();
    setGuestCookie(res, guestId);
  }

  req.cartOwner = { guestId };
  return next();
};
