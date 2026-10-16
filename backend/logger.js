// backend/logger.js
//
// A lightweight logger for diagnostic/informational messages (server
// startup, manual migrations, backups...) -- only prints if NODE_ENV is
// not "production" (i.e. during local development, or running a migration
// script manually without setting NODE_ENV). In production (PM2 with
// NODE_ENV=production), it's automatically silenced -- this also includes
// hiding the list of default passwords from production logs, which is an
// extra security improvement alongside reducing noise.
//
// Don't use this for real error messages (use console.error directly, or
// the sendAlert system in utils/alerts.js for critical errors) -- this is
// only for "informational, not a problem" messages.
const isProd = process.env.NODE_ENV === 'production';

const devLog = (...args) => {
  if (!isProd) console.log(...args);
};

module.exports = { devLog };
