// backend/middleware/requirePermission.js
//
// ── Critical security fix ───────────────────────────────────────────────────
// Before this file, the pgCrud routes (patients, invoices, salaries,
// accounts...) only checked that the token was valid (auth) -- not who its
// owner was. This meant any logged-in user, regardless of their role
// (nurse, accountant, doctor), could edit or delete any record in any
// module, even financial ones (salaries, accounts, invoices).
//
// Every user in the system already has a "permissions" array (page keys,
// like 'accounts', 'hr', 'inventory'...) defined in the frontend's
// AppContext.js, currently used only to show/hide sidebar menu items -- a
// purely cosmetic check that anyone can easily bypass by calling the API
// directly (with Postman, for example). This file enforces the same
// permissions logic, but actually on the server side.
//
// How it works: the user's permissions are now embedded directly inside
// the JWT token itself at login time (see the /auth/login route in
// server.js) -- this way no extra database query is needed on every
// request just to check permissions.
//
// Important note: an admin account (role === 'admin') always bypasses
// this check and sees everything, exactly matching the frontend's current
// behavior (see AppContext.js around line ~828).
//
// Compatibility note: any old token issued before this update (before
// logging in again) won't carry a permissions field, so it will be
// rejected from protected modules until the user logs in again. This is
// expected and intentional -- an old token carries no trustworthy
// permissions information.
const requirePermission = (pageKey) => (req, res, next) => {
  // A module with no permission key defined (not yet classified) passes
  // through without an extra check, so modules that haven't been reviewed
  // yet aren't blocked by mistake. But every current module is explicitly
  // classified in server.js (see the permission option on every pgCrud
  // call).
  if (!pageKey) return next();

  if (req.user?.role === 'admin') return next();

  const perms = req.user?.permissions;
  if (Array.isArray(perms) && perms.includes(pageKey)) return next();

  return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذا القسم' });
};

module.exports = requirePermission;
