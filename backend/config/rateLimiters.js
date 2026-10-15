// backend/config/rateLimiters.js
//
// All the rate limiters used across the system, in one place.
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./jwtConfig');
// ── Phase 2: a shared counter via Redis instead of per-process memory ──────
// See the comment in config/redisRateLimitStore.js for the full reason
// (PM2 cluster mode was automatically multiplying the effective limit by
// the number of CPU cores). Each limiter needs its own Store instance
// (a different prefix), even if their settings are otherwise identical.
const RedisRateLimitStore = require('./redisRateLimitStore');

// ── Disabling rate limiting during tests (skipInTest) ───────────────────────
// Every limiter in this file and in routes/*.js (dosageRoutes and others --
// anywhere that builds its own RedisRateLimitStore) shares a single Redis
// counter keyed by IP or by the fixed fake user id (1) that
// tests/testUtils.js seeds -- unlike db.json/PostgreSQL/the audit log, this
// counter isn't actually isolated between test files (it accumulates
// across all of them within the same 15-minute window), so running the
// full test suite (28+ files that log in, plus other files making dozens
// of requests to the same route) quickly exceeds the real limit and fails
// tests that have nothing to do with the code actually being tested, with
// random 429s. So: `skip` (an official express-rate-limit option)
// disables rate limiting entirely under NODE_ENV=test, instead of
// adjusting the limit values or touching RedisRateLimitStore itself
// (which is deliberately tested directly in
// tests/redisRateLimitStore.test.js -- disabling it there would invalidate
// that test).
const skipInTest = () => process.env.NODE_ENV === 'test';

// ── Shared helper: extracts the user's identity from the token if present
// and valid, otherwise falls back to IP ──────────────────────────────────
// The token is read manually here (the exact same way as
// middleware/auth.js: cookie first, then the Authorization header) because
// generalLimiter runs *before* the auth middleware in server.js's current
// order -- so req.user doesn't exist yet at this stage. If decoding the
// token fails (expired, invalid, or simply absent -- like on the login
// page itself), it falls back to the IP address instead of failing the
// whole request with an unexpected error.
const keyByUserOrIP = (req) => {
  const cookieToken = req.cookies?.auth_token;
  const header = req.headers.authorization;
  const headerToken = header ? header.split(' ')[1] : null;
  const token = cookieToken || headerToken;
  if (!token) return req.ip;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return `user:${decoded.id}`;
  } catch (e) {
    return req.ip; // Invalid/expired token -- treat it as an anonymous visitor by IP
  }
};

// ── Limiting login attempts ─────────────────────────────────────────────
// Always stays keyed by IP (unchanged) -- this is deliberate: there is no
// authenticated user yet for login itself, so "per user" doesn't make
// sense here. This is the main defense against password guessing
// (brute force), and it must stay strict and IP-based.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  message: { message: 'محاولات دخول كثيرة جداً، حاول مرة أخرى بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('login'),
});

// ── General rate limit for all API routes ────────────────────────────────
// Every logged-in user now gets their own quota of 300 requests/5 minutes,
// regardless of how many other staff are working at the same time or on
// the same network (even behind a shared NAT). Unauthenticated visitors
// (invalid or missing token) remain limited by IP as a fallback.
const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  keyGenerator: keyByUserOrIP,
  skip: skipInTest,
  message: { message: 'طلبات كثيرة جداً، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('general'),
});

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: keyByUserOrIP,
  skip: skipInTest,
  message: { message: 'عمليات استيراد كثيرة جداً، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('import'),
});

module.exports = { loginLimiter, generalLimiter, importLimiter, skipInTest };
