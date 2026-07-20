// ecosystem.config.js — runs the backend and frontend together via PM2
// Place this in C:\ERP\sihatuna (project root, next to the backend and frontend folders)
module.exports = {
  apps: [
    {
      name: 'sihatuna-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork', // forced explicitly — PM2's default "cluster" mode (which appeared without being requested) conflicts with the manual HL7 TCP server
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
