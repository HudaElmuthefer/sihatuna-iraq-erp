// backend/middleware/auth.js
//
// Shared JWT authentication middleware. It used to be defined only inside
// server.js, and was extracted here so the newer PostgreSQL routes
// (pgCrud.js) can use it too without duplicating the same code in two
// places, while keeping its behavior exactly the same as before.
//
// Fix: this file used to define its own JWT_SECRET with a separate default
// value (a literal string duplicated from config/jwtConfig.js) -- if either
// one ever changed without the other, every token issued with one key
// would silently fail verification against the other key. Now there is
// only one trusted source (jwtConfig.js) -- no circular import here
// because jwtConfig.js doesn't import anything at all.
const jwt = require('jsonwebtoken');
const { isRevoked } = require('../utils/tokenRevocation');
const { JWT_SECRET } = require('../config/jwtConfig');

// ── Security fix ─────────────────────────────────────────────────────────────
// Before this change, the frontend stored the token in localStorage and
// sent it in the Authorization header on every request -- any XSS
// vulnerability anywhere in the app (even a future one) would be enough to
// steal the whole token and fully impersonate the user, because any
// JavaScript code running on the page can easily read localStorage.
// Now: the frontend relies on an httpOnly cookie (the browser sends it
// automatically, and JavaScript code can never read it even if an XSS
// occurs). The cookie is checked first, and support for the Authorization
// header is kept only as a fallback (for direct API tools like Postman, or
// the automated test files under tests/) -- the frontend itself no longer
// uses this second path at all.
const auth = async (req, res, next) => {
  const cookieToken = req.cookies?.auth_token;
  const header = req.headers.authorization;
  const headerToken = header ? header.split(' ')[1] : null;
  const token = cookieToken || headerToken;

  if (!token) return res.status(401).json({ message: 'غير مصرح' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // ── Security fix: actually revoke on logout ──────────────────────────────
    // Without this check, logging out only cleared the cookie in the
    // browser -- the token itself stayed valid on the server side until its
    // natural expiry. Now the revocation list is checked (see
    // utils/tokenRevocation.js -- Redis since phase 2, genuinely shared
    // across every cluster-mode process) -- any token explicitly logged out
    // is rejected immediately even if its signature is valid and it hasn't
    // expired yet.
    if (await isRevoked(decoded.jti)) {
      return res.status(401).json({ message: 'انتهت الجلسة، الرجاء تسجيل الدخول من جديد' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'رمز منتهي الصلاحية' });
  }
};

module.exports = auth;
