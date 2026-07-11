// server/config/database.js
// اتصال PostgreSQL عبر مكتبة pg (خفيفة، بدون ORM ثقيل، متوافقة مع النمط الحالي للمشروع)
// ثبّت المكتبة أولاً: npm install pg

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'sihatuna_iraq',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected connection error:', err);
});

// دالة مساعدة موحّدة للاستعلامات (يمكن استخدامها بكل الملفات بدل تكرار pool.query)
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[PG QUERY]', { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };
