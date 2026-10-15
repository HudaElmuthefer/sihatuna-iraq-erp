// backend/middleware/requireGlobalAdmin.js
//
// ── Fixing a security gap in the multi-hospital system ──────────────────────
// The system supports two kinds of "admin" accounts: a ministry-level
// global admin (no hospitalId -- sees and manages everything across every
// facility), and a local admin tied to one specific facility
// (hospitalId set on their account). middleware/requireAdmin.js only
// checked role === 'admin' regardless of hospitalId -- meaning a local
// admin for one hospital could (via a direct API call) manage users,
// backups, or facility records **belonging to completely different
// hospitals**, even though the frontend never exposes this to them at
// all -- the same kind of gap fixed earlier in the general permissions
// (RBAC), but this time at the facility level instead of the module
// level.
//
// This middleware is used for operations that *must* stay exclusive to
// the global admin, regardless of any facility (managing the list of
// facilities itself, a full system backup, the full audit log) --
// operations that make no sense to delegate to a single local admin
// because they inherently touch every facility's data at once (like a
// single backup file containing every hospital's data together).
const requireGlobalAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin' || req.user?.hospitalId) {
    return res.status(403).json({ message: 'هذه الصفحة للإدمن العام (مستوى الوزارة) فقط' });
  }
  next();
};

module.exports = requireGlobalAdmin;
