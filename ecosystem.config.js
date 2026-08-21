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
      // ── المرحلة الثانية: عملية Worker منفصلة لطابور BullMQ ─────────────────
      // يستهلك طابور "ocr-jobs" (قراءة الفواتير بالذكاء الاصطناعي — راجعي
      // backend/services/queue/ocrWorker.js للشرح الكامل لسبب فصله عن
      // sihatuna-backend، لا داخله). fork mode بعملية واحدة (instances:1):
      // BullMQ نفسه يدير التزامن داخل العملية الواحدة (راجعي OCR_WORKER_CONCURRENCY
      // بـocrWorker.js) — تشغيل عدة نسخ PM2 من نفس عملية Worker ممكن لاحقاً
      // لو زاد الحمل فعلياً (BullMQ يوزّع المهام بأمان بين عدة Workers على
      // نفس الطابور)، لكن نسخة واحدة تكفي لحجم استخدام مستشفى واحد حالياً.
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
      script: 'node_modules/react-scripts/bin/react-scripts.js', // a real JS file, bypasses the npm.cmd issue on Windows
      args: 'start',
      exec_mode: 'fork',
      env: { NODE_OPTIONS: '--openssl-legacy-provider', BROWSER: 'none' }, // BROWSER=none: stops React from opening its own extra browser tab (start.bat already opens one with proper timing)
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
