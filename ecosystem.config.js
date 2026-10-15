// ecosystem.config.js — runs the backend and frontend together via PM2
// Place this in C:\ERP\sihatuna (project root, next to the backend and frontend folders)
module.exports = {
  apps: [
    {
      name: 'sihatuna-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 'max', // one worker per CPU core
      exec_mode: 'cluster',
      // The HL7 TCP listener and the hourly auto-backup job are both guarded in
      // server.js to run on NODE_APP_INSTANCE '0' only (see comments there) —
      // otherwise every worker would open its own HL7 port and fire its own
      // backup, duplicating both.
      env: { NODE_ENV: 'production' }, // enables protections already built into the code (stops logging every SQL query, enforces HTTPS on the cookie, enables the JWT_SECRET safety check)
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      time: true,
    },
    {
      // ── Phase two: a separate worker process for the BullMQ queue ─────────────────
      // Consumes the "ocr-jobs" queue (AI invoice reading — see
      // backend/services/queue/ocrWorker.js for the full explanation of why
      // it's kept separate from sihatuna-backend, not inside it). fork mode
      // with a single process (instances:1): BullMQ itself manages
      // concurrency within the one process (see OCR_WORKER_CONCURRENCY in
      // ocrWorker.js) — running several PM2 copies of the same worker
      // process is possible later if load actually increases (BullMQ safely
      // distributes jobs across several workers on the same queue), but one
      // copy is enough for a single hospital's usage size for now.
      name: 'sihatuna-worker',
      cwd: './backend',
      script: 'services/queue/ocrWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      max_memory_restart: '300M',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      time: true,
    },
    {
      name: 'sihatuna-frontend',
      cwd: './frontend',
      // Serves the production build (run `npm run build` first) instead of
      // the dev server -- a real JS file, bypassing the npm.cmd issue on
      // Windows, same as the backend app above.
      script: 'node_modules/serve/build/main.js',
      args: '-s build -l 3000',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      time: true,
    },
  ],
};
