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
function setGuestCookie(res, guestId) {
  const days = Number(process.env.GUEST_CART_TTL_DAYS || 30);
  res.cookie(GUEST_COOKIE, guestId, { ...base(), path: "/", maxAge: days * DAY_MS });
}

function clearGuestCookie(res) {
  res.clearCookie(GUEST_COOKIE, { ...base(), path: "/" });
}

module.exports = {
  setAuthCookies, clearAuthCookies, setGuestCookie, clearGuestCookie,
  GUEST_COOKIE, ACCESS_COOKIE, REFRESH_COOKIE,
};
