// backend/utils/backup.js
//
// A dual backup system:
// 1) audit-log.json (unchanged -- a simple extra backup for the audit log
//    only. db.json used to be here too, before the users module's final
//    migration fully to PostgreSQL -- see routes/usersRoutes.js and
//    scripts/migrateUsersFromJson.js. It no longer serves any purpose, so
//    it was removed from this list).
// 2) A real, full copy of the PostgreSQL database via pg_dump -- this
//    part was added after discovering that all the real data (patients,
//    invoices, payments) had no backup at all after moving away from
//    db.json -- a critical gap that meant losing everything permanently
//    on any disk failure or accidental deletion. This now includes the
//    users table too (same database, pg_dump copies it in full).
//
// An optional external destination (EXTERNAL_BACKUP_DIR in .env): without
// this, every backup is stored on your machine's own physical disk -- if
// that disk fails or the machine is stolen, the backups are lost along
// with the original data together. Setting up an external path (a
// permanently-connected external USB drive, or a locally-synced cloud
// folder like Google Drive / OneDrive) ensures a copy genuinely exists in
// a different location.
//
// Both kinds: an automatic periodic backup (every hour), keeping only the last N copies.
//
// ── Addition: a manual backup with a user-chosen destination ─────────────────────
// runBackupWithDestination() is only used from the POST /backups/run
// route when the user passes a destination (pgadmin / computer / cloud).
// It is never called from the automatic schedule (startAutoBackup), and
// doesn't change the existing periodic backup's behavior in any way -- it
// just reuses runBackup() itself and then decides what to do with the
// resulting file depending on the requested destination.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const FILES_TO_BACKUP = ['audit-log.json'];
const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // every hour
const MAX_BACKUPS = 48; // keep the last 48 backups (roughly two days of coverage at one per hour)

// The naming pattern of a data backup folder (from timestamp() below: ISO
// with : and . replaced by -, e.g. 2026-07-28T08-11-48-690Z). Used to
// exclude backups/code/ (the completely separate source-code backup
// folder -- utils/codeBackup.js) from the listing/cleanup here, which is
// specific to data backups only, because it's another subfolder under the
// same BACKUPS_DIR but doesn't represent a real data backup.
const BACKUP_FOLDER_NAME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// A real, full backup of the PostgreSQL database using the official
// pg_dump command (the same tool pgAdmin uses internally). Saved as a
// plain SQL text file -- can be restored later by pasting it into the
// Query Tool or directly via the psql command, with no extra complexity,
// matching your usual workflow with pgAdmin.
function runPostgresBackup(backupFolder) {
  return new Promise((resolve) => {
    const outFile = path.join(backupFolder, 'postgres_backup.sql');
    const args = [
      '-h', process.env.PG_HOST || 'localhost',
      '-p', process.env.PG_PORT || '5432',
      '-U', process.env.PG_USER || 'postgres',
      '-d', process.env.PG_DATABASE || 'sihatuna_iraq',
      '-f', outFile,
      '--no-owner', '--no-privileges',
    ];
    execFile('pg_dump', args, { env: { ...process.env, PGPASSWORD: process.env.PG_PASSWORD || '' } }, (err) => {
      if (err) {
        // Never stop the server from running because a backup failed --
        // just log a clear warning with the most common cause (pg_dump
        // not found in PATH)
        console.warn('PostgreSQL backup failed:', err.message);
        console.warn('    Make sure the PostgreSQL\\bin folder is added to PATH (same requirement as the psql command).');
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Copies a whole backup folder to the external destination set via
// EXTERNAL_BACKUP_DIR (if present in .env). A failure in this step (for
// example, the external drive wasn't connected at the time) never stops
// the local backup process -- just logs a clear warning.
function copyToExternalDestination(backupFolder, ts) {
  const externalRoot = process.env.EXTERNAL_BACKUP_DIR;
  if (!externalRoot || !externalRoot.trim()) return { attempted: false, ok: false };

  try {
    if (!fs.existsSync(externalRoot)) {
      console.warn(`External backup path not currently available: ${externalRoot}`);
      console.warn('    (normal if this is an external drive that was not connected at backup time)');
      return { attempted: true, ok: false };
    }
    const externalFolder = path.join(externalRoot, ts);
    ensureDir(externalFolder);
    fs.readdirSync(backupFolder).forEach((filename) => {
      fs.copyFileSync(path.join(backupFolder, filename), path.join(externalFolder, filename));
    });
    return { attempted: true, ok: true };
  } catch (err) {
    console.warn('Failed to copy the backup to the external destination:', err.message);
    return { attempted: true, ok: false };
  }
}

// Deletes external backups beyond MAX_BACKUPS, following the same policy as the local folder
function cleanupOldExternalBackups() {
  const externalRoot = process.env.EXTERNAL_BACKUP_DIR;
  if (!externalRoot || !externalRoot.trim() || !fs.existsSync(externalRoot)) return;
  try {
    const backups = fs.readdirSync(externalRoot)
      .filter(name => fs.statSync(path.join(externalRoot, name)).isDirectory())
      .sort();
    if (backups.length > MAX_BACKUPS) {
      backups.slice(0, backups.length - MAX_BACKUPS).forEach(name => {
        fs.rmSync(path.join(externalRoot, name), { recursive: true, force: true });
      });
    }
  } catch (err) {
    console.warn('Could not clean up old external backups:', err.message);
  }
}

// ── Note: now returns information about the backup created
// (backupFolder, pgOk, backedUpAny) instead of returning nothing -- an
// addition that doesn't affect the current callers (startAutoBackup,
// restoreFromBackup) since they don't use the return value at all, but
// it's necessary for the new runBackupWithDestination() so it knows where
// the resulting file is.
async function runBackup() {
  ensureDir(BACKUPS_DIR);
  const ts = timestamp();
  const backupFolder = path.join(BACKUPS_DIR, ts);

  let backedUpAny = false;
  FILES_TO_BACKUP.forEach((filename) => {
    const src = path.join(DATA_DIR, filename);
    if (fs.existsSync(src)) {
      ensureDir(backupFolder);
      fs.copyFileSync(src, path.join(backupFolder, filename));
      backedUpAny = true;
    }
  });

  ensureDir(backupFolder);
  const pgOk = await runPostgresBackup(backupFolder);
  if (pgOk) backedUpAny = true;

  let externalNote = '';
  if (backedUpAny) {
    const ext = copyToExternalDestination(backupFolder, ts);
    if (ext.attempted) externalNote = ext.ok ? ' (external: ok)' : ' (external: failed -- see the warning above)';
    cleanupOldExternalBackups();
  }

  if (backedUpAny) {
    console.log(`New backup created: backend/backups/${ts}${pgOk ? ' (PostgreSQL: ok)' : ' (PostgreSQL: failed -- see the warning above)'}${externalNote}`);
  } else if (fs.existsSync(backupFolder)) {
    fs.rmdirSync(backupFolder); // nothing was actually copied, delete the empty folder
  }

  cleanupOldBackups();

  return { backupFolder, pgOk, backedUpAny };
}

function cleanupOldBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return;
  const backups = fs.readdirSync(BACKUPS_DIR)
    // BACKUP_FOLDER_NAME_PATTERN is defined below -- excludes backups/code/
    // (the separate source-code backups) from this cleanup, which is
    // specific to data backups only
    .filter(name => BACKUP_FOLDER_NAME_PATTERN.test(name) && fs.statSync(path.join(BACKUPS_DIR, name)).isDirectory())
    .sort(); // names are built from a timestamp, so alphabetical order = chronological order

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(0, backups.length - MAX_BACKUPS);
    toDelete.forEach(name => {
      fs.rmSync(path.join(BACKUPS_DIR, name), { recursive: true, force: true });
    });
  }
}

// Returns a list of every available backup (newest first), noting
// whether each one was actually also copied to the external destination
// (to display in the UI)
function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  const externalRoot = process.env.EXTERNAL_BACKUP_DIR;
  return fs.readdirSync(BACKUPS_DIR)
    .filter(name => BACKUP_FOLDER_NAME_PATTERN.test(name) && fs.statSync(path.join(BACKUPS_DIR, name)).isDirectory())
    .sort()
    .reverse()
    .map(name => ({
      name,
      externalCopyExists: !!(externalRoot && fs.existsSync(path.join(externalRoot, name))),
    }));
}

// Restores a specific backup of db.json (overwrites the current db.json
// -- use with care). Note: restoring the PostgreSQL copy is currently
// done manually by pasting the postgres_backup.sql file into the Query
// Tool, not automatically -- restoring a live database carries real risk
// (losing later data), which calls for a conscious human decision about
// timing, not silent automation.
function restoreFromBackup(backupName) {
  // ── Security fix ────────────────────────────────────────────────────────────
  // backupName arrives directly from req.params on the API route (see
  // server.js) -- without this check, a name containing "../" could make
  // it read/write outside the BACKUPS_DIR folder (path traversal). The
  // route is already protected by an admin-only permission, but the
  // problem is prevented at its root instead of relying only on the
  // permissions layer.
  if (typeof backupName !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(backupName)) {
    throw new Error('اسم النسخة الاحتياطية غير صالح');
  }
  const backupFolder = path.join(BACKUPS_DIR, backupName);
  if (!backupFolder.startsWith(BACKUPS_DIR + path.sep)) {
    throw new Error('اسم النسخة الاحتياطية غير صالح');
  }
  if (!fs.existsSync(backupFolder)) {
    throw new Error(`النسخة الاحتياطية "${backupName}" غير موجودة`);
  }
  // Take a safety backup of the current state before restoring (extra precaution)
  runBackup();

  FILES_TO_BACKUP.forEach((filename) => {
    const src = path.join(backupFolder, filename);
    const dest = path.join(DATA_DIR, filename);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  });
  console.log(`Restored from backup: ${backupName}`);
  console.log(`    Note: to also restore the PostgreSQL data, open the file`);
  console.log(`    backend/backups/${backupName}/postgres_backup.sql manually in pgAdmin`);
}

// Uploads a single file to a cloud URL via PUT (a webhook or a pre-signed URL)
function uploadFileToCloud(filePath, cloudUrl) {
  return new Promise(async (resolve) => {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const response = await fetch(cloudUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/sql' },
        body: fileBuffer,
      });
      resolve({ ok: response.ok, status: response.status });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

// A manual backup with a user-chosen destination -- only called from the
// POST /backups/run route when a destination is passed in the body. Runs
// the normal runBackup() first (which produces db.json + audit-log.json +
// postgres_backup.sql through the same mechanism as the automatic
// backup), then decides based on the destination:
//   - pgadmin: nothing extra, the file is already local and ready to open in pgAdmin
//   - computer: returns the postgres_backup.sql file's path so the route can send it as a download
//   - cloud: uploads the same file to the given URL
async function runBackupWithDestination(destination, cloudUrl) {
  const result = await runBackup();
  if (!result.backedUpAny) {
    const err = new Error('فشل إنشاء النسخة الاحتياطية');
    err.statusCode = 500;
    throw err;
  }

  const sqlFilePath = path.join(result.backupFolder, 'postgres_backup.sql');

  if (destination === 'pgadmin') {
    return { type: 'pgadmin', backupFolder: result.backupFolder, sqlFilePath };
  }

  if (destination === 'computer') {
    return { type: 'computer', sqlFilePath };
  }

  if (destination === 'cloud') {
    if (!cloudUrl || !cloudUrl.trim()) {
      const err = new Error('رابط الخزن السحابي مطلوب');
      err.statusCode = 400;
      throw err;
    }
    const uploadResult = await uploadFileToCloud(sqlFilePath, cloudUrl);
    if (!uploadResult.ok) {
      const err = new Error(`فشل الرفع على الكلاود (${uploadResult.status || uploadResult.error})، لكن النسخة محفوظة محلياً`);
      err.statusCode = 502;
      throw err;
    }
    return { type: 'cloud', backupFolder: result.backupFolder };
  }

  const err = new Error('وجهة غير معروفة');
  err.statusCode = 400;
  throw err;
}

// Starts the automatic schedule -- called once when the server starts up
function startAutoBackup() {
  // Immediate backup on startup is opt-in (BACKUP_ON_STARTUP=true), off by
  // default: every nodemon-triggered restart during development used to run
  // a fresh pg_dump instantly, which itself wrote a new file into
  // backend/backups/, which nodemon then saw as a change and restarted
  // again -- a restart loop (see backend/nodemon.json's backups/** ignore
  // entry, which closes the other half of this). The scheduled hourly
  // backup below is unaffected either way.
  if (process.env.BACKUP_ON_STARTUP === 'true') runBackup();
  setInterval(runBackup, BACKUP_INTERVAL_MS);
  const extNote = process.env.EXTERNAL_BACKUP_DIR ? ` + external (${process.env.EXTERNAL_BACKUP_DIR})` : ' (no external destination configured)';
  console.log(`Auto-backup enabled (every ${BACKUP_INTERVAL_MS / 60000} min, keeping last ${MAX_BACKUPS} backups)${extNote}`);

  if (!process.env.EXTERNAL_BACKUP_DIR) {
    console.warn('\nWARNING: no external backup destination configured!');
    console.warn('  All backups are currently stored on this same machine\'s disk only.');
    console.warn('  If this machine fails (disk failure, theft, fire...) all data is lost');
    console.warn('  permanently with no way to recover it, including the backups themselves.');
    console.warn('  Add EXTERNAL_BACKUP_DIR in backend/.env pointing to a second location');
    console.warn('  (a permanently-connected external drive, or a synced Google Drive/OneDrive folder).\n');
  }
}

module.exports = { startAutoBackup, runBackup, listBackups, restoreFromBackup, runBackupWithDestination };
