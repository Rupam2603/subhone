const AppError = require("../utils/AppError");

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Defence in depth behind SameSite=Lax. A missing Origin means a non-browser
// client (curl, mobile app), which carries no ambient-cookie risk.
module.exports = (allowed) => {
  const list = (Array.isArray(allowed) ? allowed : [allowed])
    .map((o) => String(o).trim())
    .filter(Boolean);

  return function originCheck(req, res, next) {
    if (!MUTATING.has(req.method)) return next();
    const origin = req.get("Origin");
    if (!origin) return next();
    if (list.includes(origin)) return next();
    return next(new AppError(403, "BAD_ORIGIN", "Request origin not allowed."));
  };
};
