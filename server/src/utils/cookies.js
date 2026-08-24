const ACCESS_COOKIE = "so_at";
const REFRESH_COOKIE = "so_rt";
const GUEST_COOKIE = "so_gid";

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Read at call time, not module load, so tests and the dev server can flip it.
const secure = () => String(process.env.COOKIE_SECURE) === "true";

// httpOnly so no script can read a token; SameSite=Lax so a cross-site form POST
// cannot carry the session (originCheck is the belt to this braces).
const base = () => ({ httpOnly: true, sameSite: "lax", secure: secure() });

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...base(), path: "/", maxAge: ACCESS_MAX_AGE_MS });
  if (refreshToken) {
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    // Scoped to /api/auth: the refresh token is only ever presented to the refresh
    // and logout endpoints, so no other route can leak it in a log or a proxy hop.
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...base(), path: "/api/auth", maxAge: days * DAY_MS,
    });
  }
}

// clearCookie must be given the same path/flags the cookie was set with or the
// browser silently keeps the original.
function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...base(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: "/api/auth" });
}

// Path "/" because the cart is read from every page. The lifetime tracks
// GUEST_CART_TTL_DAYS — the same window the Cart model's TTL index uses — so the
// cookie and the cart it points at cannot expire on different days.
//
// signed:true because possessing this id *is* possessing the cart. Unsigned, an
// attacker who could plant a cookie (via XSS or a sibling-subdomain foothold)
// could pin a visitor onto a cart the attacker also holds, and watch what they
// buy — or have their items merged into an account on login. The signature makes
// an id the server did not mint unusable. Readers must use req.signedCookies.
function setGuestCookie(res, guestId) {
  const days = Number(process.env.GUEST_CART_TTL_DAYS || 30);
  res.cookie(GUEST_COOKIE, guestId, {
    ...base(), path: "/", maxAge: days * DAY_MS, signed: true,
  });
}

// Signed or not, the browser is told to drop the same name at the same path, so
// this needs no signed flag — clearCookie only ever writes an expiry.
function clearGuestCookie(res) {
  res.clearCookie(GUEST_COOKIE, { ...base(), path: "/" });
}

// The one place that knows the guest id arrives signed. Everything that needs the
// id calls this instead of reaching into req.cookies, so no future reader can
// silently accept an unsigned value.
//
// cookie-parser puts a *failed* signature in req.signedCookies as `false`, and
// leaves a cookie that was never signed at all in req.cookies. Both are treated
// as "no guest id": callers mint a fresh one. That means the deploy of signing
// orphans guest carts created before it, which costs those visitors an
// unsubmitted cart once — the alternative is honouring exactly the unsigned
// values this change exists to reject.
function readGuestId(req) {
  const value = req.signedCookies && req.signedCookies[GUEST_COOKIE];
  return typeof value === "string" && value ? value : null;
}

// GUEST_COOKIE is deliberately not exported. Its only legitimate reader is
// readGuestId above; handing the name out again is how a future caller ends up
// back at req.cookies, silently accepting the unsigned values signing rejects.
module.exports = {
  setAuthCookies, clearAuthCookies, setGuestCookie, clearGuestCookie, readGuestId,
  ACCESS_COOKIE, REFRESH_COOKIE,
};
