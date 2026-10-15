// backend/utils/alerts.js
//
// A tool for sending alerts for critical events (the server is down, the
// database is disconnected...). The system has no email service set up
// by default, so this is designed around two layers:
//   1) An always-on local log (data/alerts-log.json) -- always works with
//      no setup at all, and can be opened at any time or hooked up to any
//      log-reading tool later.
//   2) An *optional* real email -- only works if SMTP details are set in
//      .env (see .env.example). Without these details, the alert still
//      stays in the local log, along with a clear console message that
//      immediately draws attention.
const fs = require('fs');
const path = require('path');

const ALERTS_LOG_PATH = process.env.ALERTS_LOG_PATH || path.join(__dirname, '..', 'data', 'alerts-log.json');
const MAX_ALERTS = 500;

function logAlertLocally(alert) {
  try {
    let log = [];
    if (fs.existsSync(ALERTS_LOG_PATH)) {
      log = JSON.parse(fs.readFileSync(ALERTS_LOG_PATH, 'utf8'));
    }
    log.push({ id: log.length > 0 ? log[log.length - 1].id + 1 : 1, timestamp: new Date().toISOString(), ...alert });
    if (log.length > MAX_ALERTS) log = log.slice(log.length - MAX_ALERTS);
    fs.writeFileSync(ALERTS_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to log the alert locally:', err.message);
  }
}

async function sendEmailAlert(subject, message) {
  // ── Fix: disable real email only during automated (Jest) tests ──────────
  // During npm test, many 500 errors are deliberately triggered to check
  // the code's behavior (they aren't real events in the system), and each
  // one used to actually open a real SMTP connection (sending a real
  // email to your inbox, and keeping the connection open after the tests
  // finish, which prevents Jest from exiting normally). This has no
  // effect at all on real alerts on an actually deployed server -- there,
  // NODE_ENV is 'production' or unset, not 'test', so email is sent as
  // usual.
  if (process.env.NODE_ENV === 'test') {
    return { sent: false, reason: 'Disabled during the test environment (NODE_ENV=test)' };
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ALERT_EMAIL_TO) {
    return { sent: false, reason: 'SMTP is not configured in .env (see SMTP_HOST/SMTP_USER/SMTP_PASS/ALERT_EMAIL_TO)' };
  }
  try {
    // nodemailer is a lazy require -- so the whole file doesn't fail to
    // load if the library isn't installed in a project that doesn't use
    // this feature at all
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"SIHATUNA IRAQ - System Monitor" <${SMTP_USER}>`,
      to: ALERT_EMAIL_TO,
      subject: subject,
      text: message,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

// The main entry point -- called from anywhere in the system (the server
// itself, or the standalone monitor.js) on a critical event. Always logs
// locally, tries an email if configured, and always prints very clearly
// to the console either way.
async function sendAlert(subject, message) {
  console.error(`\nAlert: ${subject}`);
  console.error(`  ${message}\n`);

  logAlertLocally({ subject, message });

  const emailResult = await sendEmailAlert(subject, message);
  if (emailResult.sent) {
    console.error('  Alert email sent.\n');
  } else {
    console.error(`  No alert email sent (${emailResult.reason}) -- the alert is logged locally only.\n`);
  }
  return emailResult;
}

module.exports = { sendAlert, ALERTS_LOG_PATH };
