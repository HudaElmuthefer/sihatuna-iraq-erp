// backend/config/redisRateLimitStore.js
//
// A custom Store for express-rate-limit (v7 -- see the Store interface in
// node_modules/express-rate-limit/dist/index.d.ts) built on Redis, replacing
// the default in-memory store (MemoryStore). The problem was: after
// switching to PM2 cluster mode (several separate worker processes, each
// with its own memory -- see the comment in ecosystem.config.js), any limit
// like "300 requests/5 minutes" effectively multiplies by the number of CPU
// cores (each worker counts from zero in its own separate memory), and the
// same goes for the login-attempt limit -- weakening brute-force protection
// in direct proportion to the number of cores. Redis (a single counter
// actually shared across all processes) fixes this.
//
// ── Fail-open when Redis is unreachable ──────────────────────────────────
// Rate limiting matters far less than keeping the system running -- every
// login or API request in the system must not fail just because Redis had
// a momentary outage. Every error here is treated as "no limit yet" (as if
// it were the first request in this window), not as an error that blocks
// the request. See the same philosophy explained at the top of
// utils/redisService.js.
const { getClient } = require('../utils/redisService');

class RedisRateLimitStore {
  // prefix: required and separate per limiter (login/general/import/...) so
  // that several different limiters don't accidentally share the same
  // Redis key space even though they happen to use the same kind of key
  // (IP or user:id).
  constructor(prefix) {
    this.prefix = prefix;
  }

  // Called once automatically by express-rate-limit when setting up the
  // middleware, passing the limit settings (windowMs) -- needed to set the
  // Redis key's expiry to match each limiter's configured time window.
  init(options) {
    this.windowMs = options.windowMs;
  }

  key(k) {
    return `rl:${this.prefix}:${k}`;
  }

  async get(k) {
    try {
      const client = getClient();
      const redisKey = this.key(k);
      const [totalHitsRaw, ttl] = await Promise.all([client.get(redisKey), client.pttl(redisKey)]);
      if (totalHitsRaw === null) return undefined;
      return { totalHits: parseInt(totalHitsRaw, 10), resetTime: ttl > 0 ? new Date(Date.now() + ttl) : undefined };
    } catch {
      return undefined;
    }
  }

  async increment(k) {
    try {
      const client = getClient();
      const redisKey = this.key(k);
      const totalHits = await client.incr(redisKey);
      let ttl = await client.pttl(redisKey);
      if (ttl < 0) {
        // A new key (the first request in this window) -- set its expiry
        // only now, not on every increment (otherwise the limit window
        // would keep sliding forward with every request and never end).
        await client.pexpire(redisKey, this.windowMs);
        ttl = this.windowMs;
      }
      return { totalHits, resetTime: new Date(Date.now() + ttl) };
    } catch (err) {
      console.warn('[redis-rate-limit] Could not reach Redis (fail-open -- no limit for now):', err.message);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(k) {
    try { await getClient().decr(this.key(k)); } catch { /* Not critical -- rate limiting only */ }
  }

  async resetKey(k) {
    try { await getClient().del(this.key(k)); } catch { /* Not critical */ }
  }
}

module.exports = RedisRateLimitStore;
