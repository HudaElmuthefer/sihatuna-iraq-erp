// backend/routes/authRoutes.js
//
// Login/logout routes and checking the current session.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { pool } = require('../config/database');
const { mapUserRow } = require('../utils/userMapper');
const { logAudit } = require('../utils/auditLog');
const { revoke: revokeToken, isRevoked } = require('../utils/tokenRevocation');
const { JWT_SECRET } = require('../config/jwtConfig');
const { loginLimiter } = require('../config/rateLimiters');

const router = express.Router();

router.post('/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) {
      logAudit({ module: 'auth', action: 'login_failed', userId: null, userRole: null, after: { attemptedUsername: username, reason: 'user_not_found' } });
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // A deactivated account (bulk deactivation of a facility's users, see usersRoutes.js bulk-deactivate)
    if (user.is_active === false) {
      logAudit({ module: 'auth', action: 'login_failed', userId: user.id, userRole: user.role, after: { attemptedUsername: username, reason: 'account_deactivated' } });
      return res.status(401).json({ message: 'هذا الحساب معطّل، يرجى التواصل مع الإدارة' });
    }

    // Every account is always created with a bcrypt-hashed password
    // (routes/usersRoutes.js, scripts/migrateUsersFromJson.js) — there is no plain-text comparison path at all.
    const valid = user.password && bcrypt.compareSync(password, user.password);
    if (!valid) {
      logAudit({ module: 'auth', action: 'login_failed', userId: user.id, userRole: user.role, after: { attemptedUsername: username, reason: 'wrong_password' } });
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const safeUser = mapUserRow(user);
    // permissions is now embedded in the token itself so requirePermission
    // (the permissions middleware in pgCrud modules) can check it with no
    // extra database query on every request. An admin account always
    // bypasses this check regardless of the value here.
    // jti (JWT ID) is a unique identifier for this specific token — it
    // allows logout to actually revoke it later (see
    // utils/tokenRevocation.js) instead of waiting for its natural expiry.
    const jti = uuidv4();
    const token = jwt.sign({ id: safeUser.id, role: safeUser.role, hospitalId: safeUser.hospitalId || null, permissions: safeUser.permissions || [], jti }, JWT_SECRET, { expiresIn: '1d' });
    logAudit({ module: 'auth', action: 'login_success', userId: safeUser.id, userRole: safeUser.role });
    // ── Security fix ──────────────────────────────────────────────────────────
    // The token is now also sent via an httpOnly cookie — this is what the
    // frontend actually relies on (JavaScript code can never read this
    // cookie at all, even if XSS happens anywhere in the app). It's still
    // included in the response body too, only for compatibility with
    // direct API tools and automated jest tests — the frontend no longer
    // stores it or reads it from the body.
    // ── Security fix ──────────────────────────────────────────────────────────
    // sameSite: 'strict' (instead of 'lax' before) prevents the browser
    // from ever sending the cookie with any request originating from
    // another site (even GET requests from a link on an external site) --
    // this closes a CSRF vulnerability almost completely with no need for
    // a separate CSRF token mechanism. This fits an internal system like
    // this one perfectly (there's no legitimate use case for opening a link
    // from an external site that enters the user's session). Note: this
    // assumes the frontend and backend run on the same "site" (Same Site)
    // -- the same base domain, even on different ports (localhost:3000 and
    // localhost:8000 are considered the same site). If the project is
    // deployed in the future so the frontend and backend are on two
    // completely different subdomains (like app.sihatuna.iq and
    // api.sihatuna.iq), this setting would prevent the cookie from being
    // sent between them entirely and break login -- it must be reverted to
    // 'lax' specifically in that case.
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.USE_HTTPS === 'true', // tied to actual HTTPS (an independent variable), not to production mode generally -- your system currently runs over HTTP on a local network, so it stays false by default even if NODE_ENV=production. Only enable it if you've installed a real SSL certificate.
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // one day, the same as the token's own expiry
      path: '/',
    });
    res.json({ token, user: safeUser });
  } catch (err) { next(err); }
});

router.post('/auth/logout', async (req, res) => {
  // ── Security fix: actual revocation instead of just clearing the cookie ────────────────────────
  // We try to extract the jti from the current token (cookie or header) and
  // add it to the revocation list -- this way, even if someone kept a copy
  // of the raw token before logging out (e.g. in old network logs), it's
  // rejected immediately, not only after a full day. We await the
  // revocation completing in Redis before responding -- a single very
  // fast round-trip, guaranteeing that "logout succeeded" in the response
  // actually means the token was revoked (see utils/tokenRevocation.js --
  // it never throws an exception even if Redis is unavailable).
  const cookieToken = req.cookies?.auth_token;
  const header = req.headers.authorization;
  const headerToken = header ? header.split(' ')[1] : null;
  const token = cookieToken || headerToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.jti && decoded.exp) await revokeToken(decoded.jti, decoded.exp);
    } catch { /* the token was never valid to begin with -- no need to revoke it, it will be rejected anyway */ }
  }
  res.clearCookie('auth_token', { httpOnly: true, secure: process.env.USE_HTTPS === 'true', sameSite: 'strict', path: '/' });
  res.json({ success: true });
});

router.get('/auth/me', auth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
    res.json(mapUserRow(result.rows[0]));
  } catch (err) { next(err); }
});

// Silent session probe, used only by the frontend's mount-time session
// recovery (AppContext.js) when it has no local user yet and needs to know
// whether the httpOnly cookie still carries a valid session. Deliberately
// a separate route from /auth/me instead of reusing the shared `auth`
// middleware there: that route's 401-on-no-token contract is relied on by
// existing tests and by any caller that's actually trying to access an
// authenticated resource, which a visitor loading /login is not — for them
// "not logged in" is the normal, expected outcome, not an error. Returning
// 200 with a null body for that case means the browser doesn't log a
// failed-resource console error on every anonymous page load.
router.get('/auth/session', async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.auth_token;
    const header = req.headers.authorization;
    const headerToken = header ? header.split(' ')[1] : null;
    const token = cookieToken || headerToken;
    if (!token) return res.json(null);

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.json(null);
    }
    if (await isRevoked(decoded.jti)) return res.json(null);

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) return res.json(null);
    res.json(mapUserRow(result.rows[0]));
  } catch (err) { next(err); }
});

module.exports = router;
