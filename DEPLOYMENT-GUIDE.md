# DEPLOYMENT-GUIDE.md — Moving SIHATUNA IRAQ ERP to a New Server

This guide covers the **Docker-based deployment path** (`docker-compose.yml` +
`Dockerfile` + `nginx/nginx.conf`) — the recommended way to stand up this
system on a new server computer from scratch, including migrating the real
database from wherever it currently lives.

This is a companion to [`README-Docker.md`](./README-Docker.md), which
documents day-to-day Docker operation (logs, exec, stop/start) in more
depth. This guide focuses specifically on the **one-time move to a new
machine**, especially the database migration step, which `README-Docker.md`
doesn't cover.

Two other docs exist for different scenarios — don't confuse them with this one:
- [`README.md`](./README.md) — the non-Docker local path (`setup.bat` /
  `start-all.bat`), for running directly on a single Windows machine without
  containers.
- [`PRODUCTION.md`](./PRODUCTION.md) — HTTPS via Caddy + a real public domain,
  for the non-Docker path with public internet exposure. **Not the plan
  here** — this project's actual remote-access plan is VPN/WireGuard, not a
  public domain, so the Docker + Nginx stack intentionally runs HTTP-only for
  now (see `nginx/nginx.conf`'s own comments, and Section 6 below).

---

## 1. Prerequisites

Since the primary deployment path is Docker, **the new server does NOT need
Node.js, PM2, PostgreSQL, Redis, or Memurai installed directly on the host**
— all of that runs *inside* the containers (`Dockerfile` builds Node 24,
installs PM2 inside the image, and `docker-compose.yml` runs official
`postgres:18` and `redis:7-alpine` images). Installing any of those on the
host is unnecessary and not how this stack is wired.

Install on the new server:

| Software | Notes |
|---|---|
| **Docker Desktop** (Windows/Mac) or **Docker Engine + the `docker compose` plugin** (headless Linux server) | This is the only hard requirement. `README-Docker.md` confirms this is the full list. |
| **Git** | To clone the repository (Section 2). |

That's it. Everything else — Node.js 24, PM2, `postgresql-client-18`,
Python 3 + PaddleOCR, `nginx` — is baked into the Docker image or run as a
separate official image; none of it needs to exist on the host OS itself.

Optional, only if you'll use these specific features:
- **Ollama** (local/offline AI) — this runs *outside* Docker on the host if
  you want it (see `.env.docker.example`'s note on `OLLAMA_URL` needing
  `host.docker.internal` instead of `localhost` from inside the container).
  Not required for the app to function — it's one of three optional AI
  provider fallbacks.

---

## 2. Transferring the Project

**Use `git clone`, not a folder copy.** A folder copy risks dragging along
stale `node_modules`, local `.env` secrets that shouldn't move to the new
machine as-is, and — critically — it does **not** include the database at
all (see Section 3; the real data lives in a Docker-managed volume, not in
the project folder, so copying the folder gives you code with an empty
database).

On the new server:

```bash
git clone https://github.com/HudaElmuthefer/sihatuna-iraq-erp.git
cd sihatuna-iraq-erp
```

This gets you the code, `docker-compose.yml`, `Dockerfile`,
`nginx/nginx.conf`, and `.env.docker.example` — everything needed to build
and run the stack, but with no data and no `.env` yet (both handled next).

---

## 3. Database Migration (the real risk area)

`docker-compose.yml`'s `postgres` service stores its data in a **named Docker
volume** (`postgres_data`), mounted at `/var/lib/postgresql` inside the
container. That volume is **not part of the project folder** and is **not**
transferred by `git clone` or a folder copy. If you skip this section, the
new server will boot with a completely empty (but correctly-schema'd)
database.

### 3a. Dump the source database

Depending on where the *current* real data lives:

**If the source is already running via Docker Compose** (on the old machine, or this same dev machine):

```bash
docker compose exec -T postgres pg_dump -U postgres -d sihatuna_iraq \
  --no-owner --no-privileges > sihatuna_dump.sql
```

**If the source is a local (non-Docker) PostgreSQL install** (e.g. the current
dev setup on this machine, matching `backend/.env`'s `PG_HOST=localhost`):

```bash
pg_dump -h localhost -p 5432 -U postgres -d sihatuna_iraq \
  --no-owner --no-privileges -f sihatuna_dump.sql
```

(`--no-owner --no-privileges` matches exactly what this project's own
built-in backup job uses — see `backend/utils/backup.js`'s
`runPostgresBackup()` — so the same dump format the app already produces
hourly works here too. `PGPASSWORD` env var or a `~/.pgpass` entry avoids
the interactive password prompt: `PGPASSWORD=<your PG_PASSWORD> pg_dump ...`.)

This is a **plain SQL text dump** (not `pg_dump -Fc` custom format), so it's
restored with `psql`, not `pg_restore` — see 3c below.

### 3b. Transfer the dump file to the new server

Any method works — `scp`, a USB drive, a cloud-drive sync folder. Example:

```bash
scp sihatuna_dump.sql user@new-server-ip:/path/to/sihatuna-iraq-erp/
```

### 3c. Bring up the stack, then restore

You need `postgres` (and ideally the rest of the stack) up first, because a
fresh `postgres_data` volume auto-applies `database/postgres_schema.sql` on
its very first boot (via Docker's standard
`docker-entrypoint-initdb.d` mechanism — see `docker-compose.yml`'s
`postgres` volumes), and the `app` container then runs
`node run-migrations.js` on every startup (see `Dockerfile`'s `CMD`) to apply
anything not yet covered by that schema file. So by the time `postgres` is
reachable at all, it already has the full table structure — just no rows.

1. On the new server, first set up `.env` (Section 4), then:
   ```bash
   docker compose up -d
   ```
   Wait for `app` to report healthy (`docker compose ps` — see Section 5),
   confirming schema + migrations have been applied.

2. Because the target database already has the schema (empty tables), a
   plain `psql -f sihatuna_dump.sql` would fail with "relation already
   exists" errors on every `CREATE TABLE` statement in the dump. Clear the
   schema back to empty first, then restore:
   ```bash
   docker compose exec -T postgres psql -U postgres -d sihatuna_iraq \
     -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   docker compose exec -T postgres psql -U postgres -d sihatuna_iraq \
     < sihatuna_dump.sql
   ```

3. Re-run migrations once more, in case the dump came from an older schema
   version than this checkout of the code expects (all files under
   `backend/migrations-sql/*.sql` are idempotent — safe to re-run):
   ```bash
   docker compose exec app sh -c "cd backend && node run-migrations.js"
   ```

4. Verify row counts landed correctly (Section 7 has the full checklist):
   ```bash
   docker compose exec -T postgres psql -U postgres -d sihatuna_iraq \
     -c "SELECT count(*) FROM employees;" \
     -c "SELECT count(*) FROM promotions_allowances;"
   ```
   Compare against the source database's counts before you consider this
   step done.

### 3d. Other data that is NOT in PostgreSQL

`backend/data/db.json` still holds user accounts (per `README-Docker.md`:
"لم تنتقل بعد بالكامل لـPostgreSQL" — not fully migrated to PostgreSQL yet).
This lives in the `backend_data` Docker volume, not in Postgres, so a
`pg_dump`/restore alone will **not** carry it over. If real user accounts
(beyond the default `admin`/`admin`) need to move too, copy that volume's
contents directly:

```bash
# on the OLD server
docker compose cp app:/app/backend/data/db.json ./db.json.bak

# on the NEW server, after `docker compose up -d` has created the volume once
docker compose cp ./db.json.bak app:/app/backend/data/db.json
docker compose restart app
```

Uploaded files (`backend_uploads` volume — employee/medical attachments) can
be migrated the same way if needed:
`docker compose cp app:/app/backend/uploads ./uploads-backup` /
`docker compose cp ./uploads-backup app:/app/backend/uploads`.

---

## 4. Environment Configuration

Copy the template and fill it in — this file is the actual source of
`docker-compose.yml`'s environment (it auto-loads `.env` from the project
root):

```bash
cp .env.docker.example .env
```

**Must be changed for this specific new server** (do not reuse the old
server's values, and do not leave blank — the app enforces these):

| Variable | Why it must be new | What happens if you don't |
|---|---|---|
| `PG_PASSWORD` | Real database password for this server's Postgres instance. | `docker-compose.yml` line 27 (`${PG_PASSWORD:?...}`) makes Compose **refuse to start at all** without it. |
| `JWT_SECRET` | Signs all login tokens. Reusing the old server's value isn't a security requirement, but shipping the *code's built-in default* is a real hole — the default (`sihatuna-secret-2026`) is hardcoded in `backend/config/jwtConfig.js` and public on GitHub; anyone who knows it can forge an admin login token. | With `NODE_ENV=production` (which the `app` container always sets), the server **exits immediately on boot** (`process.exit(1)`) if this is left as the default. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CREDENTIALS_ENCRYPTION_KEY` | Encrypts stored third-party credentials (payment gateway keys, etc. — see `backend/utils/credentialsCrypto.js`). Same default-value problem as `JWT_SECRET`. | Same `process.exit(1)` on boot if left default. Generate a 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

**Can be copied as-is / left at template defaults**, unless the new server's
situation specifically differs:

- `PG_USER`, `PG_DATABASE`, `PG_PORT` — the template defaults
  (`postgres` / `sihatuna_iraq` / `5432`) work fine unless you have a
  specific reason to change them.
- `FRONTEND_URL` / `REACT_APP_API_URL` — only need changing if the new
  server will be reached by a hostname/IP other than `localhost` (e.g.
  `http://192.168.1.10`) or the frontend/API end up on different origins.
  With Nginx as the single entry point on port 80, this is rarely necessary.
- AI keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`), SMTP settings, payment
  gateway keys, `ORTHANC_*`, `HL7_PORT` — copy over if those integrations
  are actually used on the new server; all optional, the app runs fine
  without them (each AI feature just reports itself unavailable).
- `EXTERNAL_BACKUP_DIR` — see Section 9; new server likely needs its own
  path here, not a copy of the old one (Section 9 explains why).

---

## 5. Building and Starting the Stack

```bash
docker compose build      # builds the `app` image — includes the full frontend build,
                           # PaddleOCR model download, and postgresql-client-18 install;
                           # takes several minutes the first time
docker compose up -d
```

`docker compose up -d` alone also triggers a build on first run if the image
doesn't exist yet, but running `build` explicitly first makes failures
easier to spot.

**Verify everything is healthy:**

```bash
docker compose ps
```

Look for `app` and `nginx` both reporting `healthy`/`Up`. `app`'s healthcheck
(`docker-compose.yml` line 140) directly curls `http://localhost:8000/api/health`
inside the container; `nginx` won't even start accepting the `app`
dependency as satisfied until that check passes (`depends_on: app: condition:
service_healthy`).

Then from outside the containers:
- **Frontend**: open `http://<server-address>/` in a browser — should show
  the login page.
- **API health**: `curl http://<server-address>/api/health` — should return
  `{"status":"ok","database":"connected",...}` with HTTP 200. (`503` with
  `"status":"degraded"` means the app is up but can't reach Postgres — check
  Section 8.)

---

## 6. Network / Firewall

Only **port 80** needs to be open on the new server — Nginx is the single
entry point (`docker-compose.yml`: `nginx` is the only service with a `ports:`
mapping to the host; `postgres`, `redis`, and `app`'s web port are all
intentionally *not* exposed to the host or any external network — see the
security-hardening comments in `docker-compose.yml` next to each service).

- `postgres` and `redis`: no host ports at all — reachable only from other
  containers on the internal Docker network, by service name.
- `app`: only port `2575` (HL7 lab-results listener, raw TCP — not something
  Nginx can proxy) is exposed directly, and only if that feature is actually
  used. Its web port (`8000`) is **not** exposed to the host; all web traffic
  goes through Nginx on port 80.

**Remote access plan**: per `nginx/nginx.conf`'s own header comment, this
deployment runs **HTTP-only intentionally** — remote access is planned via
**VPN/WireGuard**, not public HTTPS exposure. Do not open port 80 (or any
port) to the public internet on this server; it should only be reachable
from inside the VPN/local network. If that changes later, `README-Docker.md`
has a full section ("إضافة SSL/TLS لاحقاً") on adding SSL — it's designed as
a small addition, not a rebuild, for exactly that future scenario.

---

## 7. Post-Deployment Verification Checklist

After the migration, manually confirm each of these:

- [ ] **Login works** — open `http://<server-address>/`, log in with a real
      account (or `admin`/`admin` if user accounts weren't migrated — see
      Section 3d).
- [ ] **Real data counts match the source** — e.g. HR → Employees page
      shows the same employee count as the old server; Accounts → سجل
      الترفيعات والعلاوات shows the same record count. Cross-check with a
      direct query if in doubt:
      ```bash
      docker compose exec -T postgres psql -U postgres -d sihatuna_iraq \
        -c "SELECT count(*) FROM employees;" \
        -c "SELECT count(*) FROM promotions_allowances;"
      ```
- [ ] **At least one AI feature works** — e.g. Drug Interactions page: run a
      real check and confirm it returns a result (not just "AI unavailable").
      Requires `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` to be set in `.env`
      (Section 4) if this wasn't configured yet.
- [ ] **Excel import/export works** — export any table, confirm the file
      downloads and opens with real rows; import a small test file and
      confirm the row appears in the table afterward.
- [ ] **Promotion/allowance alarms show expected counts** — HR → Employees
      page's due-date banner, and Accounts → سجل الترفيعات والعلاوات's due
      banners, should show non-zero counts consistent with the migrated
      employee data (calculated live from `lastPromotion`/`lastAllowance`/
      `hireDate`/`certificate` — not stored anywhere, so if data migrated
      correctly these populate automatically with no separate step).
- [ ] **`docker compose logs -f app`** shows no repeating errors on startup
      (one-time migration-log lines are expected and fine).

---

## 8. Troubleshooting

Real issues hit during this project's own Docker setup work — documented
directly in the source files, restated here so they don't need
rediscovering:

**"database directory is not empty" / Postgres crash-loops on startup**
`postgres:18`'s official image changed its expected mount point — it wants
the volume mounted at `/var/lib/postgresql` (not
`/var/lib/postgresql/data` directly), and creates its own version-specific
subfolder underneath automatically. `docker-compose.yml`'s `postgres`
service already mounts it correctly this way (line 35:
`postgres_data:/var/lib/postgresql`) — if you ever change this, mounting
directly at `.../data` was confirmed to make the image refuse to boot with
an explicit error asking for the parent path instead.

**`pm2-runtime` reports it can't find `ecosystem.docker.config.js`, or the
container falls back to running the wrong process list**
`ecosystem.docker.config.js` does `require('./ecosystem.config.js')` to
reuse the backend/worker process definitions — so **both** files must exist
in the image, not just the docker-specific one. The `Dockerfile`'s `COPY`
step (`COPY ecosystem.docker.config.js ecosystem.config.js ./`) already
copies both explicitly for this reason. If you ever restructure the
Dockerfile's COPY steps, keep both files together.

**`pg_dump` fails or produces an incomplete dump, with a version-mismatch
warning**
The base image (`node:24-slim`, Debian bookworm) only ships
`postgresql-client` version 15 in its default repos, but this project's
`postgres` service runs version 18 — an older client dumping a newer server
isn't officially supported. The `Dockerfile` already works around this by
adding the official PostgreSQL APT repo (PGDG) specifically to install
`postgresql-client-18`, matching the server version exactly (see the
`Dockerfile` comment block right before the `apt-get install
postgresql-client-18` step). If you're running `pg_dump` from *outside* the
container (e.g. directly on a host machine per Section 3a's second option),
make sure that host's own `psql`/`pg_dump` is also version 18 — same
mismatch risk applies there.

**`/api/health` returns 503 / `"database":"disconnected"`**
Almost always means `app` started before `postgres` was actually ready to
accept connections, or `.env`'s `PG_PASSWORD` doesn't match what Postgres
was initialized with. `docker-compose.yml` already guards the first case
(`depends_on: postgres: condition: service_healthy`), so this is more likely
a password mismatch — especially if `postgres_data` is an *existing* volume
from a previous run with a different password than what's currently in
`.env` (changing `.env`'s `PG_PASSWORD` after the volume already exists does
**not** change the actual database password; the volume's original password
sticks). Fix: either update `.env` back to match the volume's real password,
or reset via `docker compose down -v` (⚠️ destroys all data — only for a
genuine fresh start).

**Frontend loads but every API call fails / CORS errors in the browser console**
Check `REACT_APP_API_URL` in `.env` — it's baked into the frontend's JS
bundle at *build* time (Create React App), so changing it in `.env` after
the image is already built has no effect until you `docker compose build`
again. The default (`/api`, a relative path) should work for the standard
single-origin-via-Nginx setup; only override it if frontend and API are
deliberately split across different origins.

---

## 9. Backup Recommendation

This app already has a **built-in automatic backup job** — no separate cron
setup needed for the baseline. `backend/utils/backup.js`'s `startAutoBackup()`
runs every hour (`BACKUP_INTERVAL_MS = 60 * 60 * 1000`), producing a real
`pg_dump` of the full Postgres database (`--no-owner --no-privileges`,
plain SQL, same format used in Section 3) plus copies of `db.json` and
`audit-log.json`, keeping the last 48 backups (~2 days of hourly history —
`MAX_BACKUPS = 48`) under `backend/backups/<timestamp>/`, which in the
Docker setup is the `backend_backups` named volume. It only runs on PM2's
primary worker process (`NODE_APP_INSTANCE === '0'`) so cluster mode doesn't
produce duplicate backup jobs.

For a production server, do two things beyond what's already automatic:

1. **Set `EXTERNAL_BACKUP_DIR` in `.env`** (Section 4) so backups don't only
   live on the same disk as the live database — `backup.js`'s own comments
   are explicit about this: without it, a disk failure or lost machine takes
   the backups down with the live data. Point it at a genuinely separate
   location (mounted network share, external drive, cloud-sync folder) —
   this needs a matching volume mount added to the `app` service in
   `docker-compose.yml` pointing at that real host path, since the env var
   alone only sets the path *inside* the container.
2. **Periodically pull a copy off the server entirely** — the hourly job
   protects against accidental deletion/corruption, but a copy that never
   leaves the server (or its immediate network) doesn't protect against
   losing the server itself. A simple scheduled `docker compose cp` (or,
   if `EXTERNAL_BACKUP_DIR` is set, a scheduled sync of that external path)
   to true off-site storage is worth setting up on whatever job scheduler
   the new server's OS provides (systemd timer / cron on Linux, Task
   Scheduler on Windows).
