// backend/utils/redisService.js
//
// A shared Redis client -- used in three places: caching for data that's
// read often and rarely changes (see the options.cache setting in
// routes/pgCrud.js), rate limiting across several processes
// (config/redisRateLimitStore.js), and token revocation on logout
// (utils/tokenRevocation.js). One client is enough for all three
// (lightweight read/write operations). The only exception is BullMQ
// (services/queue/*) -- it has a completely separate connection because
// it needs fundamentally different settings (maxRetriesPerRequest:null is
// a hard requirement from BullMQ itself), see
// services/queue/queueConnection.js for details.
//
// ── Philosophy for handling Redis failures: fail-open ────────────────────
// Redis here improves performance (caching) and fixes behavior that was
// actually broken across PM2 cluster-mode processes (rate limiting, token
// revocation) -- but it isn't a core system the app depends on to
// function (unlike PostgreSQL). If Redis becomes temporarily unavailable
// (a restart, a network issue...), it's better for the system to keep
// running (slightly slower, and with temporarily weaker rate
// limiting/token revocation protection) instead of stopping every login
// and every API request because of an outage in a supporting system. The
// same philosophy followed everywhere else in this project (the HL7
// server, backups, AI providers, the payment gateway) -- their failure
// doesn't bring down the system's core functionality. Every function here
// catches its own errors and never throws any exception to its caller.
const Redis = require('ioredis');
const { devLog } = require('./logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let client = null;
let lastErrorLogAt = 0;
const ERROR_LOG_COOLDOWN_MS = 60 * 1000; // at most one warning per minute -- don't flood the log with a warning for every failed request during a long outage

function logRedisError(context, err) {
  const now = Date.now();
  if (now - lastErrorLogAt < ERROR_LOG_COOLDOWN_MS) return;
  lastErrorLogAt = now;
  console.warn(`[redis] ${context} -- the system continues running without Redis (fail-open):`, err.message);
}

function getClient() {
  if (client) return client;
  client = new Redis(REDIS_URL, {
    // Fail fast instead of waiting: better for an HTTP interface than
    // repeated retries that extend every request's response time during a
    // Redis outage.
    maxRetriesPerRequest: 1,
    // Don't queue up commands in memory during an outage -- they fail
    // immediately and get caught by the caller's try/catch (fail-open),
    // instead of accumulating pending commands that might all run at once
    // later when the connection comes back (unexpected behavior for HTTP
    // requests that have already ended).
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 500, 10000), // keeps retrying the connection automatically in the background
  });
  client.on('error', (err) => logRedisError('Connection error', err));
  client.on('connect', () => devLog('[redis] Connected to Redis successfully.'));
  return client;
}

// ── Caching -- a "generation-versioned" pattern ────────────────────
// Instead of deleting cache keys one by one on every change (needing
// SCAN/KEYS, slow and can momentarily block Redis on large tables), every
// module+scope (hospital) has a single "generation number" in Redis.
// Every read is stored under a key that includes the current generation
// number at read time. Any write (POST/PUT/DELETE) increments the
// generation number with a single INCR operation (O(1)) -- which makes
// every old cache key automatically "orphaned" (its old generation number
// in the key never matches again), and it's deleted automatically later
// when its TTL expires, with no explicit delete operation at all.
function cacheVersionKey(namespace, scope) {
  return `cv:${namespace}:${scope}`;
}

// Returns null only if Redis is genuinely unreachable -- the caller
// understands this as "skip the cache entirely for this request" (see
// routes/pgCrud.js), unlike '0' which is a perfectly valid first
// generation value (no real difference between it and any other real
// generation number).
async function getCacheVersion(namespace, scope) {
  try {
    const v = await getClient().get(cacheVersionKey(namespace, scope));
    return v || '0';
  } catch (err) {
    logRedisError(`getCacheVersion(${namespace})`, err);
    return null;
  }
}

async function bumpCacheVersion(namespace, scope) {
  try {
    await getClient().incr(cacheVersionKey(namespace, scope));
  } catch (err) {
    // Not a critical problem if this fails -- worst case: a stale cache
    // stays valid until its natural TTL expires (a few minutes), not an
    // error that stops the write operation itself.
    logRedisError(`bumpCacheVersion(${namespace})`, err);
  }
}

async function cacheGet(key) {
  try {
    const raw = await getClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logRedisError(`cacheGet(${key})`, err);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  try {
    await getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logRedisError(`cacheSet(${key})`, err);
  }
}

// Only used to safely close the connection when a process explicitly
// needs that (such as automated test cleanup -- see tests/testUtils.js).
// Outside the test environment, the main Node.js process (server.js)
// never calls this at all -- the connection stays open for the process's
// whole lifetime, the same pattern as the PostgreSQL pool.
async function closeClient() {
  if (!client) return;
  const c = client;
  client = null;
  try { await c.quit(); } catch { c.disconnect(); }
}

module.exports = { getClient, getCacheVersion, bumpCacheVersion, cacheGet, cacheSet, closeClient };
