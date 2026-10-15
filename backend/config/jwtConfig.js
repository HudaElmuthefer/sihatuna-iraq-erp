// backend/config/jwtConfig.js
//
// A single trusted source for the JWT key across the whole system --
// extracted from server.js so that separate route files
// (routes/authRoutes.js and others) can use exactly the same key without
// duplicating it or risking a mismatch between two places (if that
// happened, tokens issued with one key would fail verification against
// the other).
const DEFAULT_JWT_SECRET = 'sihatuna-secret-2026'; // published openly in the repository -- never usable as a real key
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

// ── Startup security warning ─────────────────────────────────────────────────
// The default key above is written explicitly in the code (and therefore
// published with any copy of the project on GitHub), so anyone who knows it
// can issue a forged login token with full admin access. If the real .env
// doesn't set a different JWT_SECRET, the developer must be warned very
// clearly -- and in production, the server refuses to start at all instead
// of running with a known security hole.
if (JWT_SECRET === DEFAULT_JWT_SECRET) {
  console.error('\nSECURITY WARNING: the default JWT_SECRET is still in use!');
  console.error('This key is written directly in the source code and is not secret at all --');
  console.error('anyone who sees it can forge a login token with full admin access.');
  console.error('Set JWT_SECRET in backend/.env to a strong random value, then restart.');
  console.error('Generate a random key: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  if (process.env.NODE_ENV === 'production') {
    console.error('Startup aborted: NODE_ENV=production and the default key is still in use.\n');
    process.exit(1);
  }
}

module.exports = { JWT_SECRET };
