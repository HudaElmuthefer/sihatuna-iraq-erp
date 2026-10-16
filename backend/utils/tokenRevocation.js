// backend/utils/tokenRevocation.js
//
// ── Security fix: actually revoke the session on logout ────────────────────────
// Before this file, logging out only cleared the cookie from the browser
// -- the token (JWT) itself stayed fully valid on the server side until
// its natural expiry (one day), even after logging out. So if the token
// was stolen in any way (a shared device, an attack, etc.) before its
// owner logged out, there was no way to stop it immediately.
//
// ── Phase 2: moving from a file on disk to Redis ─────────────────────────
// The previous version was an in-memory Map plus a JSON file on disk,
// with periodic sync every 5 seconds between PM2 cluster-mode processes
// (each process has its own separate copy in memory) -- an acceptable
// temporary solution, but not immediately consistent (a delay window of
// up to five seconds between revoking a token in one process and another
// process, which hasn't re-read the file yet, still accepting it). Redis
// (a single source genuinely shared across every process, with no
// separate local copies) solves this with immediate consistency and no
// delay at all, with automatic expiry (EXAT -- at the exact same moment
// the token itself expires) instead of a manual periodic cleanup job.
//
// ── Fail-open when Redis is unreachable ────────────────────────────────
// If Redis is temporarily unavailable, isRevoked() returns false
// (treating the token as not revoked) instead of rejecting every
// authenticated request in the system because of an outage in a
// supporting system -- the same fail-open philosophy explained at the top
// of utils/redisService.js. The practical effect: a revoked token
// (logged out) might stay valid for a very short time if that exactly
// coincides with a Redis outage -- far better than failing login and
// authentication for every user in the system because of a temporarily
// unavailable supporting system.
const { getClient } = require('./redisService');

const KEY_PREFIX = process.env.REVOKED_TOKENS_KEY_PREFIX || 'revoked';

// Returns a Promise that's best awaited on the /auth/logout route (a
// single, very fast round-trip to Redis, which guarantees that a
// "logout succeeded" response actually means the token was revoked, not
// just that a Redis command was fired in the background with no
// confirmation) -- but it never throws (fail-open, see
// utils/redisService.js), so it's also safe to call without await if
// that's ever needed somewhere else in the future.
function revoke(jti, exp) {
  if (!jti || !exp) return Promise.resolve();
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) return Promise.resolve(); // already expired anyway -- no need to store it at all
  return getClient()
    .set(`${KEY_PREFIX}:${jti}`, '1', 'EXAT', exp)
    .catch((err) => console.warn('[tokenRevocation] Could not record the revocation in Redis (fail-open):', err.message));
}

async function isRevoked(jti) {
  if (!jti) return false;
  try {
    const exists = await getClient().exists(`${KEY_PREFIX}:${jti}`);
    return exists === 1;
  } catch (err) {
    console.warn('[tokenRevocation] Could not check revocation in Redis (fail-open -- token treated as not revoked):', err.message);
    return false;
  }
}

module.exports = { revoke, isRevoked };
