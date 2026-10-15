# SIHATUNA IRAQ -- End-to-end tests (Playwright)

Full-stack browser tests. **Runs only against the isolated `sihatuna_iraq_test`
database -- never against real data.**

## One-time setup

```
cd e2e
npm install
npx playwright install chromium
```

## Running

1. Prepare the test database schema (once, or after schema changes) -- same
   steps as `backend/tests`:
   ```
   createdb -U postgres sihatuna_iraq_test
   psql -U postgres -d sihatuna_iraq_test -f ../database/postgres_schema.sql
   PG_DATABASE=sihatuna_iraq_test node ../backend/run-migrations.js
   ```
2. Seed a clean admin account (wipes users/hospitals/patients/employees in
   the test DB, nothing else):
   ```
   PG_DATABASE=sihatuna_iraq_test npm run seed
   ```
3. Start the backend against the test database on port 8000 (matching the
   frontend's baked-in `REACT_APP_API_URL`), with `NODE_APP_INSTANCE=1` so it
   doesn't fire the hourly auto-backup / HL7 listener during test runs:
   ```
   cd ../backend
   PG_DATABASE=sihatuna_iraq_test NODE_APP_INSTANCE=1 NODE_ENV=test node server.js
   ```
4. Start the frontend -- either mode, one at a time:
   - Dev server: `cd frontend && npm start` (port 3000)
   - Production build: `cd frontend && npm run build && npx serve -s build -l 3000`
5. Run the suite:
   ```
   cd e2e
   npx playwright test
   ```
   Re-run `npm run seed` between the two frontend modes for a clean slate.

`BASE_URL` env var overrides the default `http://localhost:3000` if the
frontend is on a different port.
