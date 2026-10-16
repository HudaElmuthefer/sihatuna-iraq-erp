// backend/middleware/requireAdmin.js
//
// Middleware that checks for the "admin" role only. Always used after auth
// (needs req.user to already be set by it). This check used to be
// duplicated line-by-line in several places in server.js (hospitals,
// backups, audit-log, system-settings) -- extracted here into a shared
// file so the sensitive payment routes (paymentRoutes.js), which had no
// check at all, can use it too.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'هذه الصفحة للإدمن فقط' });
  }
  next();
};

module.exports = requireAdmin;
