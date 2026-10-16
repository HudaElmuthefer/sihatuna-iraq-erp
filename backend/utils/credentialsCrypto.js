// server/utils/credentialsCrypto.js
// Encrypts/decrypts payment gateway credentials (API keys/secrets) before storing them in the table
// Uses AES-256-GCM. The key must come from a secret environment variable (32 bytes / 64 hex characters)
//
// Important security note: never store CREDENTIALS_ENCRYPTION_KEY in the code or the repository.
// Add it in the .env file (not pushed to GitHub) -- example of generating a key:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_HEX = '0'.repeat(64); // an all-zeros key -- known to everyone, never usable as a real key
const KEY_HEX = process.env.CREDENTIALS_ENCRYPTION_KEY || DEFAULT_KEY_HEX;
const KEY = Buffer.from(KEY_HEX, 'hex');

// ── Security fix ─────────────────────────────────────────────────────────────
// Before this change, the key would silently fall back to all zeros if
// .env didn't set it, with no warning at all -- meaning payment gateway
// credentials (sensitive API keys) were effectively "encrypted" with a
// key already known to anyone who looks at the code, i.e. with no real
// protection. Same warning logic used for JWT_SECRET in server.js.
if (KEY_HEX === DEFAULT_KEY_HEX) {
  console.error('\nSECURITY WARNING: the default payment credentials encryption key is in use!');
  console.error('CREDENTIALS_ENCRYPTION_KEY is not set in .env, so payment gateway credentials');
  console.error('(API keys) are "encrypted" with a key known to everyone (all zeros) --');
  console.error('anyone who gets access to the database can decrypt them.');
  console.error('Set CREDENTIALS_ENCRYPTION_KEY in backend/.env to a strong random value.');
  console.error('Generate a valid key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
  if (process.env.NODE_ENV === 'production') {
    console.error('Startup aborted: NODE_ENV=production and the default key is still in use.\n');
    process.exit(1);
  }
}

function encryptCredentials(credentialsObject) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(credentialsObject), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // store iv + authTag + ciphertext as a single Buffer
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptCredentials(buffer) {
  if (!buffer) return {};
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = { encryptCredentials, decryptCredentials };
