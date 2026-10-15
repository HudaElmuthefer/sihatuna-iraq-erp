// backend/services/queue/ocrQueue.js
//
// A processing queue for reading invoices and prescriptions with AI (OCR +
// AI vision) -- moved from a direct HTTP path (routes/invoiceReaderRoutes.js
// and routes/prescriptionReaderRoutes.js) to a background job via BullMQ,
// because the actual AI call (Gemini/Claude) can take several seconds per
// image (and OCR before it adds a few more seconds -- see
// agents/ocrAgent.js), and keeping an HTTP request hanging that whole time
// ties up a whole Express worker for no real benefit. Now: the request
// returns immediately with a job id, and the frontend polls for its status
// periodically.
//
// One queue for both kinds (the job name distinguishes them:
// 'read-invoice' vs. 'read-prescription' -- see ocrWorker.js for the
// dispatch logic) instead of two separate queues: it's exactly the same
// processing pattern (OCR + AI vision), and there's no real benefit to
// isolating them into a whole extra Worker process (a new PM2 app, extra
// Docker setup) just because the end feature differs -- a simple
// distinction by job name is enough.
//
// This queue is consumed by a process completely separate from the main
// server -- see ocrWorker.js and ecosystem.config.js for why it's kept
// apart from Express's own worker processes.
const { Queue } = require('bullmq');
const { createQueueConnection } = require('./queueConnection');

const QUEUE_NAME = 'ocr-jobs';

let queue = null;
function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 2, // one extra retry if the AI call fails for a temporary reason (a brief network outage)
        backoff: { type: 'fixed', delay: 3000 },
        removeOnComplete: { age: 60 * 60 }, // keep a completed job's result for a full hour (enough for the frontend to poll it), then it's removed automatically instead of accumulating without limit in Redis
        removeOnFail: { age: 24 * 60 * 60 }, // keep failed jobs for a full day -- useful for diagnosing a recurring AI call failure
      },
    });
  }
  return queue;
}

// Adds a new invoice-read job to the queue -- throws if Redis is
// unreachable. The caller in invoiceReaderRoutes.js explicitly catches
// this and returns available:false to the frontend, matching the existing
// "AI is not enabled" pattern used by every AI feature in this system.
async function enqueueInvoiceReadJob(data) {
  const job = await getQueue().add('read-invoice', data);
  return job.id;
}

async function enqueuePrescriptionReadJob(data) {
  const job = await getQueue().add('read-prescription', data);
  return job.id;
}

// The status of a specific job -- used by the frontend's polling route.
// Returns null if the job doesn't exist (a wrong id, or it was removed
// after removeOnComplete/removeOnFail expired).
async function getJobStatus(jobId) {
  const job = await getQueue().getJob(jobId);
  if (!job) return null;
  const state = await job.getState(); // 'waiting' | 'active' | 'delayed' | 'completed' | 'failed' | ...
  return {
    id: job.id,
    state,
    result: state === 'completed' ? job.returnvalue : null,
    error: state === 'failed' ? (job.failedReason || 'فشلت المعالجة') : null,
  };
}

module.exports = { getQueue, enqueueInvoiceReadJob, enqueuePrescriptionReadJob, getJobStatus, QUEUE_NAME };
