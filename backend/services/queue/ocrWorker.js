// backend/services/queue/ocrWorker.js
//
// The process that consumes the invoice-reading queue (OCR/AI) -- run as a
// PM2 process completely separate from the main server (sihatuna-backend),
// see ecosystem.config.js ("sihatuna-worker"). Run directly with
// `node services/queue/ocrWorker.js`.
//
// ── Why a separate process, not inside the same Express processes (cluster mode)? ──
// 1) sihatuna-backend runs with instances:'max' (one process per CPU
//    core) -- if the Worker ran inside each of those processes, the
//    number of concurrent queue processors would automatically equal the
//    number of cores with no deliberate tuning, and would change with any
//    change to the core count or hosting plan -- unpredictable behavior
//    that's hard to control or trace.
// 2) Fault isolation: one job hanging or crashing during processing (for
//    example, an oddly-shaped AI response, or a stuck network call) must
//    not affect the stability of the main HTTP server -- and the reverse
//    too: restarting the main server after deploying an update must not
//    cut off a processing job midway through.
// 3) A logically different lifecycle/restart policy: the HTTP server must
//    stay running at all times with the highest possible stability, while
//    the Worker process can tolerate a short outage or more frequent
//    restarts with no noticeable impact on users (jobs stay in the queue
//    and are processed as soon as it's back, thanks to BullMQ's
//    persistence in Redis).
// Same philosophy of "one process dedicated to a background task" already
// applied by the NODE_APP_INSTANCE=='0' guard for the HL7 server and the
// backup in server.js -- here at a clearer level (a whole separate PM2
// process instead of a condition inside the same process), because BullMQ
// is designed from the start to run as an independent Worker process.
require('dotenv').config();
const { Worker } = require('bullmq');
const { createQueueConnection } = require('./queueConnection');
const { QUEUE_NAME } = require('./ocrQueue');
const { processInvoiceReadJob } = require('./invoiceReadProcessor');
const { processPrescriptionReadJob } = require('./prescriptionReadProcessor');
const { devLog } = require('../../utils/logger');

// Dispatches each job to its correct processor based on its name (see
// ocrQueue.js: 'read-invoice' vs. 'read-prescription' -- one queue, two
// different processors).
function processJob(job) {
  if (job.name === 'read-prescription') return processPrescriptionReadJob(job.data);
  return processInvoiceReadJob(job.data);
}

// Number of concurrent jobs within this single Worker process: the AI
// call is fundamentally I/O-bound (waiting on a network response from
// Gemini/Anthropic), not CPU-bound -- so processing several jobs
// concurrently in the same process is safe and effective here (Node.js
// efficiently manages waiting on several async network requests at
// once), unlike if the job were, say, decoding large images or
// compressing files (genuinely CPU-bound, needing real separate processes
// instead of concurrency within the same process). The PaddleOCR step
// itself is genuinely CPU-bound, but it runs in a completely separate
// Python process (see agents/ocrAgent.js) -- it never blocks this Node
// event loop at all.
const CONCURRENCY = parseInt(process.env.OCR_WORKER_CONCURRENCY, 10) || 3;

const worker = new Worker(
  QUEUE_NAME,
  async (job) => processJob(job),
  { connection: createQueueConnection(), concurrency: CONCURRENCY }
);

worker.on('completed', (job) => devLog(`[ocr-worker] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[ocr-worker] Job ${job?.id} failed:`, err.message));
worker.on('error', (err) => console.error('[ocr-worker] Redis connection error:', err.message));

devLog(`[ocr-worker] Ready, consuming queue "${QUEUE_NAME}" (concurrency: ${CONCURRENCY})`);

// Clean shutdown when PM2 stops the process (redeploy, restart...) -- lets
// BullMQ safely finish any in-progress job instead of cutting it off
// abruptly midway through.
process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
process.on('SIGINT', async () => { await worker.close(); process.exit(0); });

module.exports = worker;
