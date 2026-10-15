/**
 * SIHATUNA IRAQ - Backend Server
 * Eng. Huda Abduladheem Abdulkareem
 * halmuthefer@gmail.com
 *
 * ── Note after the refactor (splitting the file) ──────────────────────────
 * This file used to hold everything in one place (~1000 lines): every
 * route, every setting, every helper function. Now it's just an
 * "orchestration" file that pulls the pieces together from their
 * dedicated locations:
 *   - config/*         -> static settings (JWT, file uploads, rate limiting)
 *   - utils/*           -> general helper functions (db.json, audit log, token revocation)
 *   - middleware/*      -> reusable middleware (auth, permissions, validation)
 *   - routes/*          -> each route group in its own file by domain
 * Any actual logic (how login works, how SQL queries are built...) lives
 * in its own dedicated place, not here. This file just wires them together
 * in the right order.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { JWT_SECRET } = require('./config/jwtConfig'); // automatically prints a security warning if the key is the default
const { generalLimiter } = require('./config/rateLimiters');
const { testConnection, pool } = require('./config/database');
const { UPLOADS_DIR } = require('./config/uploadConfig');
const auth = require('./middleware/auth');
const { startAutoBackup } = require('./utils/backup');
const { devLog } = require('./utils/logger');
const { sendAlert } = require('./utils/alerts');

const app = express();
const PORT = process.env.PORT || 8000;

// ── Last-resort safety net (Defense in Depth) ─────────────────────────────
// Critical fix: we found an actual bug (a delete route in pgCrud.js) where
// an unhandled exception inside a single async route handler used to crash
// **the entire server** -- in modern Node.js versions (v15+), any uncaught
// unhandledRejection terminates the process by default. We fixed the
// specific case (an unprotected ROLLBACK), but this stays as a last line
// of defense: any similar bug in the future gets logged clearly instead of
// silently taking down the whole server (which would kill every user's
// session for one failed request). The real fix is always to handle every
// Promise in its own place (try/catch) -- this is just a safety net for
// anywhere we forgot to.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection -- almost crashed the server:', reason);
});

// ── Middleware ─────────────────────────────────────────────────────────────────
// ── Helmet (standard HTTP security headers) ──────────────────────────────────────
// Adds ready-made protective headers recommended by OWASP with no manual
// setup (prevents the browser from guessing content types, prevents the
// site from being embedded in an external iframe to protect against
// Clickjacking, hides the X-Powered-By header that reveals it's Express,
// and more). We specifically disable two default policies that could break
// this system's current behavior with no real security benefit in our case:
//   - crossOriginResourcePolicy: the frontend (port 3000) displays images
//     uploaded to the backend (port 8000) via <img src>; the default
//     same-origin setting would have blocked loading them because of the
//     different port. We set it to cross-origin instead of disabling it entirely.
//   - contentSecurityPolicy: designed mainly for HTML pages, with no real
//     benefit on a pure API server that doesn't serve web pages directly;
//     disabling it avoids unnecessary complexity with no loss of real
//     protection in our case.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ── CORS ───────────────────────────────────────────────────────────────────────
// Used to be open to everyone (origin: '*') -- any site in the world could
// call the API if it got hold of a login token (e.g. via XSS on another
// site). Now it's restricted to the actual frontend origin only. The
// default value fits local development (localhost:3000); when deploying to
// a real server, add FRONTEND_URL in the .env file with your actual site
// address (e.g. https://sihatuna-iraq.example.com) instead of relying on
// the default.
//
// Fix: FRONTEND_URL used to be a single string value -- enough for one
// real production address, but it silently fails (CORS rejects the
// response) for any additional legitimate local address (such as previewing
// a locally-built production bundle on a different port than the dev
// server's 3000, which is exactly what happened here). We now support an
// optional comma-separated list of addresses -- the default value (with no
// comma) stays exactly as it was for any existing real deployment.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean);
// credentials: true is required so the browser can send and receive the
// httpOnly cookie -- without it, the browser refuses to attach the cookie
// to fetch requests even if the frontend code passes credentials:'include'.
// origin must be an explicitly specific address (not '*') for the browser
// to allow this at all -- which is already how it's set above.
app.use(cors({ origin: ALLOWED_ORIGINS.length > 1 ? ALLOWED_ORIGINS : ALLOWED_ORIGINS[0], credentials: true, methods: ['GET','POST','PUT','DELETE','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ── Security fix ────────────────────────────────────────────────────────────────
// Uploaded files (medical documents, retired employees' files...) used to
// be served via express.static with no login check at all -- any file link
// (if leaked or guessed) opened directly in the browser for anyone, even
// without an account in the system. Now viewing any file requires a valid
// login token, exactly like the rest of the API routes.
app.use('/uploads', auth, express.static(UPLOADS_DIR));

// ── Routes ─────────────────────────────────────────────────────────────────────
const router = express.Router();
router.use(generalLimiter);

// ── Fix: a real health check instead of just a token response ────────────────
// Before this, /health always returned "ok" as long as Express itself was
// running, even if the database was completely down -- giving a false
// impression that the system was "healthy" while every actual function was
// disabled. Now it actually checks the PostgreSQL connection.
//
// ── Security fix ────────────────────────────────────────────────────────
// This route *must* intentionally stay without a login (auth) requirement
// -- external monitoring tools (monitor.js, or any future cloud uptime
// monitor) need to check it without credentials. But that means any
// visitor (even without an account) can call it -- so it must not return
// internal database error details (dbCheck.error.message could reveal the
// database username, the internal server name, or other structural
// details). The full details are logged to the server log (console) for
// diagnosis, and the client only receives "connected"/"disconnected" --
// entirely sufficient for any monitoring tool to decide whether to alert,
// without exposing any sensitive internal detail.
router.get('/health', async (req, res) => {
  const dbCheck = await testConnection();
  if (!dbCheck.ok) console.error('[health] Database connection failed:', dbCheck.error.message);
  res.status(dbCheck.ok ? 200 : 503).json({
    status: dbCheck.ok ? 'ok' : 'degraded',
    system: 'SIHATUNA IRAQ',
    time: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbCheck.ok ? 'connected' : 'disconnected',
    memoryUsedMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

router.use(require('./routes/hospitalsRoutes'));
router.use(require('./routes/dashboardRoutes'));
router.use(require('./routes/brandingRoutes'));
router.use(require('./routes/dicomWebhookRoutes'));
router.use(require('./routes/invoiceReaderRoutes'));
router.use(require('./routes/prescriptionReaderRoutes'));
router.use(require('./routes/aiProviderSettingsRoutes'));
router.use(require('./routes/documentLookupRoutes'));
router.use(require('./routes/bookingRoutes'));
router.use(require('./routes/medicalCodesRoutes'));
router.use(require('./routes/backupsRoutes'));
router.use(require('./routes/codeBackupRoutes'));
router.use(require('./routes/gitUpdateRoutes'));
router.use(require('./routes/authRoutes'));

// -- Public queue display endpoint (no login required) ----------------------
// Meant for a TV/monitor screen in a waiting area, not for staff use — so it
// intentionally has NO auth requirement (a screen mounted on a wall can't log
// in) and deliberately returns ONLY ticket numbers, departments and status —
// never patient names, since anyone walking past a public screen can read it.
// Optional ?hospitalId=X query param to scope to one hospital in a
// multi-hospital deployment; omit it to show all (fine for a single-hospital
// setup, which is the current deployment).
router.get('/queue-display', async (req, res, next) => {
  try {
    const { hospitalId } = req.query;
    // ── Fix: the query used to fetch "the last 200 tickets by id" with no
    // date filtering at all -- meaning any old ticket (a smaller id) that
    // gets called now (only a status update, the id doesn't change)
    // disappears from the screen once there are 200+ newer-id tickets after
    // it (exactly what happened after importing a large batch of test
    // tickets) -- even though the update actually succeeded in the
    // database. We now filter by today's date only (using the same "local
    // today" logic fixed in QueuePage.js, not UTC), so no active ticket
    // disappears due to ordering.
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const params = [todayLocal];
    let where = `WHERE data->>'createdAt' LIKE $1 || '%'`;
    if (hospitalId) {
      params.push(hospitalId);
      where += ` AND data->>'hospitalId' = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT id, department, status, data->>'ticketNo' AS "ticketNo", data->>'calledBy' AS "calledBy"
       FROM queue_tickets
       ${where}
       ORDER BY id DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});
router.use(require('./routes/usersRoutes'));
router.use(require('./routes/revenueRoutes'));
router.use(require('./routes/profitSharingRoutes'));
// Fix: the "personal dossiers" route (upload/view/delete an employee
// document with a real attached file) was not registered on the server at
// all -- see the comment above employeeDossierRoutes.js.
router.use(require('./routes/employeeDossierRoutes'));
router.use(require('./routes/aiDiagnosisRoutes'));
router.use(require('./routes/drugInteractionRoutes'));
router.use(require('./routes/dosageRoutes'));
router.use(require('./routes/allergyRoutes'));
router.use(require('./routes/billingAnomalyRoutes'));
router.use(require('./routes/inventoryPredictionRoutes'));
require('./routes/modules')(router); // registers every pgCrud module + Excel import (41 modules)
router.use('/recycle-bin', require('./routes/recycleBinRoutes'));
router.use(require('./routes/miscRoutes'));

// ── Health check (used by the frontend to confirm the server is running) ──────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'SIHATUNA IRAQ Backend' }));

// ── Mount router ───────────────────────────────────────────────────────────────
app.use('/api', router);

// ── Payment Gateway (PostgreSQL) — an advanced backup, only works once .env is configured ──
// Note: the old multi-hospital CRM system (routes/crmRoutes.js) has been
// permanently removed from here -- it used to query columns (channel,
// follow_up_type, ...) that no longer exist after rebuilding the CRM tables
// in the new pattern (flexible JSONB, see pgCrud in routes/modules.js), and
// it would have crashed any request that happened to reach it. The actual
// CRM now works directly through pgCrud.
try {
  const paymentRoutes = require('./routes/paymentRoutes');
  app.use('/api', generalLimiter, paymentRoutes);
  devLog('✅ Payment module loaded (/api/payments, /api/admin/payment-gateways)');
} catch (err) {
  console.warn('⚠️  Payment module not loaded — check that "pg" is installed and .env is configured:', err.message);
}

// 404
app.use((req, res) => res.status(404).json({ message: 'المسار غير موجود' }));

// ── Central error handler ────────────────────────────────────────────────────
// A single point for every server error (synchronous and asynchronous via
// asyncHandler), instead of repeating try/catch and building the response
// separately in every controller.
// The error is classified by type to produce an appropriate status code
// and message, and internal error details (err.stack) are never sent to
// the user in production.
// ── Alert cooldown ────────────────────────────────────────────
// If the same error repeats many times in a short period (e.g. a broken
// query that repeats on every request to a particular page), we don't send
// a separate alert email every single time -- we send at most one alert
// every 15 minutes per error type (route + message), and the rest just
// stays logged normally without flooding you with repeated messages about
// the same problem.
const alertCooldowns = new Map();
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
function shouldAlert(key) {
  const last = alertCooldowns.get(key);
  const now = Date.now();
  if (last && now - last < ALERT_COOLDOWN_MS) return false;
  alertCooldowns.set(key, now);
  return true;
}

app.use((err, req, res, next) => {
  console.error(`❌ [${req.method} ${req.originalUrl}]`, err.message);

  // A PostgreSQL connection error (the server is unreachable or not configured)
  if (err.code === 'ECONNREFUSED' || err.code === '3D000') {
    return res.status(503).json({ message: 'تعذّر الاتصال بقاعدة البيانات، حاول لاحقاً' });
  }
  // An invalid or expired JWT token error (if the auth middleware passed it via next(err))
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'رمز الدخول غير صالح أو منتهي الصلاحية' });
  }
  // A data validation error (any controller can throw an Error with statusCode = 400)
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // ── An unexpected error (500) — alerts immediately instead of staying buried in the file log only ──────
  // Reserved for genuinely unclassified errors only (not 400/401/404, which
  // are ordinary "bad request" errors, so we don't flood ourselves with
  // alerts for every person who typed a wrong password, for example).
  // sendAlert is deliberately called without await (fire-and-forget) -- we
  // don't delay the user's response waiting for an email that might take a
  // few seconds to send.
  const alertKey = `${req.method} ${req.originalUrl} :: ${err.message}`;
  if (shouldAlert(alertKey)) {
    sendAlert(
      `Unexpected server error -- ${req.method} ${req.originalUrl}`,
      `Message: ${err.message}\nUser: ${req.user?.username || 'not logged in'}\nTime: ${new Date().toLocaleString('ar-IQ')}`
    ).catch(() => {}); // if the alert itself fails, we don't let that break the original response
  }

  res.status(500).json({
    message: 'خطأ في الخادم',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

// ── Actual startup ────────────────────────────────────────────────────────────
// We only start actually listening on the port when this file is run
// directly (node server.js), not when it's imported as a module (e.g. by
// test files via require('../server')). Without this condition, any
// automated attempt to test the app would have started a real server on
// port 8000 and written over the real database the moment the file was
// imported -- which is exactly what has been preventing safe tests from
// being written for this project until now.
if (require.main === module) {
  const server = app.listen(PORT, async () => {
    devLog(`\n╔════════════════════════════════════════╗`);
    devLog(`║     SIHATUNA IRAQ — Backend Server     ║`);
    devLog(`║  Developer: Huda Abduladheem           ║`);
    devLog(`╠════════════════════════════════════════╣`);
    devLog(`║  🟢 Server: http://localhost:${PORT}     ║`);
    devLog(`║  📁 DB:     PostgreSQL (${process.env.PG_DATABASE || 'sihatuna_iraq'})  ║`);
    devLog(`║  📎 Uploads: /uploads                  ║`);
    devLog(`╚════════════════════════════════════════╝\n`);

    // ── A uniqueness guard under PM2 cluster mode ──────────────────────────────
    // After switching to cluster mode (several worker processes for the
    // same server), any code that runs inside this callback is
    // automatically repeated once per process (e.g. 8 times on an 8-core
    // machine) -- acceptable for Express's own setup (no shared state), but
    // destructive for any task that's supposed to run exactly once: the
    // automatic backup (several simultaneous copies racing on the same
    // files) and the HL7 server (every process trying to open the same TCP
    // port). PM2 gives every process a unique NODE_APP_INSTANCE variable
    // ('0', '1', '2'...) -- we only run these tasks in process '0'. When run
    // directly without PM2 (node server.js during development), this
    // variable doesn't exist at all, so it runs normally as before.
    const isPrimaryWorker = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0';

    if (isPrimaryWorker) {
      startAutoBackup();

      // ── The HL7 server (lab results) — runs on a separate port, alongside the main backend
      // We wrap it in try/catch: if there's a port conflict or any error, the
      // core system keeps working normally (lab integration is an extra
      // feature, not something the system's operation depends on)
      try {
        const { startHL7Listener } = require('./services/hl7/hl7Listener');
        startHL7Listener();
      } catch (err) {
        console.error('Failed to start the HL7 server (lab integration):', err.message);
      }
    }

    // ── Checking the PostgreSQL connection immediately after startup ────────────────────────
    // The server keeps running even if this check fails (some uses don't
    // need the database immediately), but we print a clear warning instead
    // of letting the user discover the problem later as a vague 503 error
    // in the middle of using the system.
    const dbCheck = await testConnection();
    if (dbCheck.ok) {
      devLog('Connected to the PostgreSQL database successfully.\n');
    } else {
      console.error('\nCould not connect to the PostgreSQL database!');
      console.error(`  Error: ${dbCheck.error.message}`);
      console.error('  The server is running, but every request that needs the database (patients, doctors...)');
      console.error('  will fail with a 503 until this is fixed. Make sure:');
      console.error('  1) The PostgreSQL service is actually running on this machine');
      console.error('  2) The connection details in backend/.env are correct (PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE)');
      console.error('  3) The database "sihatuna_iraq" (or the name set in .env) has actually been created\n');
    }
  });

  // Explicit handling of a port-in-use error (EADDRINUSE): without this
  // handler, trying to start a second copy of the server while a previous
  // copy is still stuck running in the background (e.g. after closing a CMD
  // window without actually ending the process) ends in a vague error that
  // is hard for the user to diagnose.
  // Here we print a clear message and a practical fix, instead of letting
  // Node print an unreadable stack trace.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${PORT} is already in use by another process.`);
      console.error('   This usually means a previous copy of the server is still running in the background');
      console.error('   (even if its window was closed) and it is the one actually answering on localhost:8000 --');
      console.error('   which explains old or unexpected responses despite restarting the server.\n');
      console.error('   Fix: close the stuck process first, from PowerShell:');
      console.error(`     netstat -ano | findstr :${PORT}`);
      console.error('     (note the PID in the last column, then:)');
      console.error('     taskkill /PID <PID> /F\n');
      console.error('   Or simply: open Task Manager and end all "Node.js" processes manually,');
      console.error('   then restart start-backend.bat.\n');
      process.exit(1);
    } else {
      console.error('Unexpected error while starting the server:', err.message);
      process.exit(1);
    }
  });
}

module.exports = app;
