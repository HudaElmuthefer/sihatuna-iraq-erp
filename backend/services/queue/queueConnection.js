// backend/services/queue/queueConnection.js
//
// A Redis connection completely separate from utils/redisService.js (used
// for caching/rate limiting/token revocation) -- dedicated only to BullMQ
// (the queue in services/queue/*).
//
// The reason is a hard requirement, not a design choice: BullMQ explicitly
// requires maxRetriesPerRequest:null on the Redis connection passed to it
// (see the official BullMQ documentation's "Production Checklist") -- it
// internally relies on "blocking" Redis commands (like BRPOPLPUSH) that
// must wait patiently rather than fail after a single attempt, unlike the
// cache/rate-limiting connection which is deliberately designed to fail
// fast (fail-open -- see the comment in utils/redisService.js). That's why
// there are two completely separate connections, not one connection with
// different settings depending on use.
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function createQueueConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

module.exports = { createQueueConnection };
