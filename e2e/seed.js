// e2e/seed.js
//
// Resets the isolated e2e database (sihatuna_iraq_test -- never the real
// database) to a known clean state and creates the one bootstrap admin
// account the tests log in with. Everything else the tests need (hospitals,
// patients, employees...) is created through the real UI during the tests
// themselves, not seeded here, so the suite exercises the real create flows.
//
// Run before each full suite run: `npm run seed` (see README.md).
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'sihatuna_iraq_test',
});

const ADMIN_USERNAME = 'e2eadmin';
const ADMIN_PASSWORD = 'E2eAdminPass123!';

async function main() {
  if (pool.options.database !== 'sihatuna_iraq_test' && !pool.options.database.endsWith('_test')) {
    throw new Error(`Refusing to seed a database that doesn't look like a test database: ${pool.options.database}`);
  }

  // Delete in FK-safe order (children before the hospitals/users they reference).
  await pool.query('DELETE FROM patients');
  await pool.query('DELETE FROM employees');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM hospitals');
  // Deterministic starting state for the hospital-switching test -- it turns
  // this on itself and asserts on that transition.
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ('multi_hospital_enabled', 'false'::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb`
  );

  const hashed = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (full_name, username, email, password, role, permissions, is_active)
     VALUES ('E2E Admin', $1, 'e2eadmin@sihatuna.iq', $2, 'admin', '[]'::jsonb, true)`,
    [ADMIN_USERNAME, hashed]
  );

  console.log(`Seeded e2e database "${pool.options.database}" with admin user "${ADMIN_USERNAME}".`);
  await pool.end();
}

main().catch((err) => {
  console.error('e2e seed failed:', err);
  process.exit(1);
});
