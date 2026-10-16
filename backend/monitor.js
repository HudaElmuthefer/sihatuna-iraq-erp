// backend/monitor.js
//
// A standalone monitoring script -- checks the server's health (and the
// database behind it) with a single check per run, designed to be
// scheduled with Windows Task Scheduler (every 5 minutes, for example)
// instead of staying a process that runs in the background without
// stopping -- this is simpler and more reliable on Windows.
//
// The most important logic: **only one alert when the status changes**,
// not a message on every check if the problem continues for hours --
// otherwise this would flood you with repeated messages about the same
// problem. It also reports on "recovery" (the system returning to normal)
// so you know when the problem was resolved without having to watch it
// manually.
//
// Usage: node monitor.js   (or via monitor.bat)
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { sendAlert } = require('./utils/alerts');

const PORT = process.env.PORT || 8000;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const STATE_PATH = process.env.MONITOR_STATE_PATH || path.join(__dirname, 'data', 'monitor-state.json');
const TIMEOUT_MS = 8000;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { lastStatus: 'unknown', lastCheckedAt: null };
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save monitor state:', err.message);
  }
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ reachable: true, healthy: res.statusCode === 200 && json.status === 'ok', details: json });
        } catch {
          resolve({ reachable: true, healthy: false, details: { error: 'Invalid response' } });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ reachable: false, healthy: false, details: { error: `No response within ${TIMEOUT_MS / 1000} seconds` } }); });
    req.on('error', (err) => resolve({ reachable: false, healthy: false, details: { error: err.message } }));
  });
}

async function main() {
  const result = await checkHealth();
  const state = readState();
  const currentStatus = result.healthy ? 'healthy' : 'unhealthy';
  const now = new Date().toISOString();

  console.log(`[${now}] check: ${currentStatus}${result.details?.database ? ` | database: ${result.details.database}` : ''}`);

  // Only alert when the status *changes* -- prevents flooding you with repeated messages about the same problem
  if (currentStatus !== state.lastStatus) {
    if (currentStatus === 'unhealthy') {
      const reason = !result.reachable
        ? 'The server is not responding at all (stopped or hung)'
        : `The server responds but is unhealthy: ${JSON.stringify(result.details)}`;
      await sendAlert(
        'SIHATUNA IRAQ -- server problem',
        `${reason}\n\nTime: ${now}\nChecked URL: ${HEALTH_URL}\n\nNext step: confirm start-backend.bat is running, and run check-system.bat for a more detailed diagnosis.`
      );
    } else if (state.lastStatus === 'unhealthy') {
      // It was down, and now it's back to normal — a "recovery" alert so you know the problem was resolved
      await sendAlert(
        'SIHATUNA IRAQ -- server recovered',
        `The server and its response are healthy now.\n\nTime: ${now}`
      );
    }
    // The very first run ever (lastStatus === 'unknown') and the result was healthy — no alert, this is the normal case
  }

  writeState({ lastStatus: currentStatus, lastCheckedAt: now, lastDetails: result.details });
}

main().catch((err) => {
  console.error('Unexpected error in the monitor script:', err.message);
  process.exit(1);
});
