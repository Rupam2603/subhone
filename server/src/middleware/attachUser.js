const User = require("../models/User");
const tokenService = require("../services/tokenService");

// Never throws — downstream requireAuth decides whether anonymity is acceptable.
// Every route in the app sits behind this, so a bad cookie must not become a 500.
module.exports = async function attachUser(req, res, next) {
  const token = req.cookies && req.cookies.so_at;
  if (!token) return next();
  try {
    const claims = tokenService.verifyAccessToken(token);
    const user = await User.findById(claims.sub);
    // `ver` is the tokenVersion the token was minted with. A mismatch means the
    // user changed their password or was force-signed-out since — treat as anonymous.
    if (user && !user.disabledAt && user.tokenVersion === claims.ver) req.user = user;
  } catch {
    /* invalid or expired token — treat as anonymous */
  }
  return next();
};
