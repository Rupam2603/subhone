const AppError = require("../utils/AppError");

// Roles are stored upper-case on the User model. Comparing case-insensitively means
// requireRole("admin") and requireRole("ADMIN") behave identically, so a caller can
// never accidentally write an always-false guard.
const norm = (role) => String(role || "").toUpperCase();

module.exports = (...roles) => {
  const allowed = new Set(roles.map(norm));
  return function requireRole(req, res, next) {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Please sign in to continue."));
    if (!allowed.has(norm(req.user.role))) {
      return next(new AppError(403, "FORBIDDEN", "You don't have access to that."));
    }
    return next();
  };
};
