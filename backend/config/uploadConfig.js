// backend/config/uploadConfig.js
//
// Shared multer setup for file uploads (documents, records, retiree
// attachments...). Extracted from server.js to keep it smaller and make it
// usable from any route file without duplicating it.
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ── Security fix ──────────────────────────────────────────────────────────────
// There used to be no restriction at all on the uploaded file type -- any
// extension was accepted (even executables, or HTML/SVG that could contain
// JavaScript). Now only the file types the system actually needs are
// allowed (regular documents and medical/administrative attachments), and
// both the extension *and* the content type are checked together so
// disguising a dangerous file under a fake name doesn't work.
const ALLOWED_UPLOAD_TYPES = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
};

const uploadFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const expectedMime = ALLOWED_UPLOAD_TYPES[ext];
  if (!expectedMime) {
    const err = new Error('نوع الملف غير مسموح به. الأنواع المسموحة: PDF, JPG, PNG, GIF, WEBP, DOC, DOCX, XLS, XLSX, TXT');
    err.statusCode = 400;
    return cb(err);
  }
  // Some browsers send a generic mimetype (application/octet-stream) for
  // otherwise valid files -- that case is tolerated (the extension alone is
  // enough), but if the browser specified an explicit type that's
  // completely different from the extension (a clear disguise attempt),
  // the file is rejected.
  if (file.mimetype !== expectedMime && file.mimetype !== 'application/octet-stream') {
    const err = new Error('نوع محتوى الملف لا يطابق امتداده — الملف مرفوض');
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter: uploadFileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

// ── Actually delete an uploaded file from disk ───────────────────────────────
// Fix: deleting a record with an attachment (an employee/retiree dossier
// document) used to only delete the row from the database, leaving the
// actual file in UPLOADS_DIR orphaned forever -- see the call sites in
// employeeDossierRoutes.js and recycleBinRoutes.js (specifically the final
// purge from the recycle bin, not the move into the recycle bin itself --
// the file must stay in place as long as the record can still be
// restored).
// path.basename here is deliberate protection against tampering with the
// stored file path (path traversal) -- any directories in the stored path
// are ignored and only the filename itself is used within UPLOADS_DIR, even
// if filePath is an unexpected value coming from the database's data
// column.
async function deleteUploadedFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return;
  const filename = path.basename(filePath);
  if (!filename) return;
  try {
    await fs.promises.unlink(path.join(UPLOADS_DIR, filename));
  } catch (err) {
    // ENOENT (the file didn't exist in the first place) isn't an error
    // worth warning about -- any other error (permissions, disk, etc.) is
    // just logged and doesn't fail the request (the same fail-open
    // philosophy used elsewhere in this system -- deleting the record
    // matters more than successfully cleaning up the file). Awaited
    // (async/await), not "fire and forget" -- so it actually finishes
    // before the response, making it deterministic to test without needing
    // an arbitrary wait.
    if (err.code !== 'ENOENT') {
      console.warn(`[uploadConfig] Could not delete the attached file from disk (${filename}):`, err.message);
    }
  }
}

module.exports = { upload, UPLOADS_DIR, ALLOWED_UPLOAD_TYPES, deleteUploadedFile };
