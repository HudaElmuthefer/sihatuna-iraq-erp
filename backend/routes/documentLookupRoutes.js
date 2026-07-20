// backend/routes/documentLookupRoutes.js
//
// Looks up an official letter (outgoing or incoming) by its reference
// number — used by the barcode page: scan a barcode, get the letter's
// details immediately, no manual search needed.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const auth = require('../middleware/auth');

router.get('/document-lookup/search', auth, async (req, res, next) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const cols = `id, data->>'ref' AS ref, data->>'title' AS title, data->>'to' AS "to", data->>'from' AS "from", data->>'subject' AS subject, data->>'date' AS date`;
    const where = `WHERE data->>'ref' ILIKE $1 OR data->>'title' ILIKE $1 OR data->>'to' ILIKE $1 OR data->>'from' ILIKE $1`;

    const outgoing = await pool.query(`SELECT ${cols}, 'outgoing' AS type FROM outgoing ${where} LIMIT 20`, [q]);
    const incoming = await pool.query(`SELECT ${cols}, 'incoming' AS type FROM incoming ${where} LIMIT 20`, [q]);

    res.json([...outgoing.rows, ...incoming.rows]);
  } catch (err) { next(err); }
});

router.get('/document-lookup-ref', auth, async (req, res, next) => {
  try {
    const ref = (req.query.ref || '').trim();
    if (!ref) return res.status(400).json({ message: 'ref required' });

    const outgoing = await pool.query(
      `SELECT id, data FROM outgoing WHERE TRIM(data->>'ref') = $1 LIMIT 1`,
      [ref]
    );
    if (outgoing.rows.length > 0) {
      return res.json({ found: true, type: 'outgoing', id: outgoing.rows[0].id, ...outgoing.rows[0].data });
    }

    const incoming = await pool.query(
      `SELECT id, data FROM incoming WHERE TRIM(data->>'ref') = $1 LIMIT 1`,
      [ref]
    );
    if (incoming.rows.length > 0) {
      return res.json({ found: true, type: 'incoming', id: incoming.rows[0].id, ...incoming.rows[0].data });
    }

    res.json({ found: false });
  } catch (err) { next(err); }
});

module.exports = router;
