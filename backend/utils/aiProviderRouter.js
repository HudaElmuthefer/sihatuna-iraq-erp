// backend/utils/aiProviderRouter.js
//
// A single unified routing point for all AI features (invoice reading,
// drug interactions, prescription reading, smart diagnosis, dosage
// checking, drug allergy checking, and billing-anomaly explanation) --
// reads the user's choice saved in the system_settings table (not
// localStorage -- the choice stays unified across all of a user's
// devices/browsers, and an admin can manage it centrally) as the default,
// or takes an explicit choice for a single request (requestedMode below --
// from the frontend's AiModeSelect.js) if one is sent, and routes each
// call to its correct source:
//   'bot'     -- no AI call at all. For drug interactions: means relying
//               only on the drug_interactions table (see
//               agents/interactionAgent.js -- it handles an
//               {available:false} response here exactly as it handles "AI
//               isn't configured at all", returning the table result
//               alone). For invoice/prescription reading: means plain OCR
//               text with no AI structuring of the fields at all.
//   'online'  -- Gemini/Claude (utils/aiProvider.js) -- needs an internet connection.
//   'offline' -- local Ollama (utils/ollamaService.js) -- works without
//               internet, but needs an actually running Ollama server on
//               the machine (or host.docker.internal if inside Docker).
//
// ── Important note: OCR is not one of the three options above ─────────────
// PaddleOCR (see agents/ocrAgent.js) is always a preliminary step that
// happens before any of the three options, not a replacement for them --
// it runs regardless of the choice here (even in 'bot' mode,
// invoices/prescriptions are still read visually via OCR first; only no AI
// structures the result afterward).
const { query } = require('../config/database');
const { activeProvider, callAI, callAIWithImage } = require('./aiProvider');
const { ollamaAvailable, callOllama, callOllamaWithImage } = require('./ollamaService');

const SETTINGS_KEY = 'ai_provider_settings';
// Feature names exactly as used in the saved settings keys.
const FEATURES = ['invoiceReader', 'drugInteractions', 'prescriptionReader', 'aiDiagnosis', 'dosageValidation', 'allergyCheck', 'billingAnomaly', 'inventoryPrediction'];
const VALID_MODES = ['bot', 'online', 'offline'];
// The default 'online' exactly matches the existing behavior before this
// feature (Gemini always first) -- doesn't break any existing deployment
// that hasn't explicitly changed the setting yet.
const DEFAULT_MODE = 'online';

function normalizeSettings(raw) {
  const settings = {};
  for (const feature of FEATURES) {
    const value = raw?.[feature];
    settings[feature] = VALID_MODES.includes(value) ? value : DEFAULT_MODE;
  }
  return settings;
}

async function getSettings() {
  const result = await query('SELECT value FROM system_settings WHERE key=$1', [SETTINGS_KEY]);
  return normalizeSettings(result.rows[0]?.value);
}

async function getMode(feature) {
  const settings = await getSettings();
  return settings[feature] || DEFAULT_MODE;
}

// updates: { invoiceReader?, drugInteractions?, prescriptionReader? } --
// partial update (only the fields sent); everything else stays as is. An
// invalid value for any field is silently ignored (doesn't break other
// valid updates in the same request).
async function setSettings(updates) {
  const current = await getSettings();
  const merged = { ...current };
  for (const feature of FEATURES) {
    if (VALID_MODES.includes(updates?.[feature])) merged[feature] = updates[feature];
  }
  await query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(merged)]
  );
  return merged;
}

// requestedMode: the user's choice for this specific request (from the
// page itself, see frontend/src/components/AiModeSelect.js) -- if valid,
// it overrides the saved default setting in system_settings with no extra
// database read. Any invalid value (not sent, empty, or random text) is
// silently ignored and falls back to the usual behavior (the saved
// setting) -- doesn't break any existing caller that hasn't passed this
// argument yet.
async function resolveMode(feature, requestedMode) {
  if (VALID_MODES.includes(requestedMode)) return requestedMode;
  return getMode(feature);
}

// ── Never expose the real "online" provider's name (Gemini/Claude/...) in any response ──
// Not even in the raw provider field in the JSON, not just in text shown in
// the UI -- the real provider is set via .env and may change, so no
// consumer of this API (the current frontend, or any future client) ends
// up depending on a specific provider's name. 'bot' and 'ollama' are
// allowed because they're explicitly named in the selection UI itself
// (AiModeSelect.js: "Bot only" / "Offline AI (Ollama)") -- the only hidden
// name is specifically the 'online' mode's provider (currently
// gemini/anthropic in utils/aiProvider.js).
function sanitizeProvider(provider) {
  if (!provider || provider === 'bot' || provider === 'ollama') return provider;
  return 'online';
}

// Exactly the same shape as callAI()/callAIWithImage() ({available,
// provider, parsed} or {available:false, ...}) -- any existing caller
// (interactionAgent.js, invoiceReadProcessor.js, prescriptionAgent.js)
// replaces a direct aiProvider call with this one with no other change to
// its logic. The provider field is sanitized here before it's returned to
// any caller -- see sanitizeProvider above.
async function routeTextCall(feature, systemPrompt, userPrompt, requestedMode) {
  const mode = await resolveMode(feature, requestedMode);
  if (mode === 'bot') return { available: false, provider: 'bot' };
  if (mode === 'offline') return callOllama(systemPrompt, userPrompt);
  const result = await callAI(systemPrompt, userPrompt);
  return result.provider ? { ...result, provider: sanitizeProvider(result.provider) } : result;
}

async function routeImageCall(feature, systemPrompt, userPrompt, imageBase64, mimeType, requestedMode) {
  const mode = await resolveMode(feature, requestedMode);
  if (mode === 'bot') return { available: false, provider: 'bot' };
  if (mode === 'offline') return callOllamaWithImage(systemPrompt, userPrompt, imageBase64, mimeType);
  const result = await callAIWithImage(systemPrompt, userPrompt, imageBase64, mimeType);
  return result.provider ? { ...result, provider: sanitizeProvider(result.provider) } : result;
}

// An honest status for a specific feature -- replaces the old check
// "is Gemini/Claude configured or not" used by the three /status routes
// (it used to ignore the 'bot'/'offline' choice entirely). An actual live
// check based on whichever mode is actually selected, not one assumption
// for everyone:
//   'bot'     -- always available (a local table/OCR only, doesn't depend on an external service).
//   'online'  -- available if a Gemini or Claude key is configured (the same old check).
//   'offline' -- available if the Ollama server is actually responding right now (a live check, no assumption).
async function getFeatureStatus(feature) {
  const mode = await getMode(feature);
  if (mode === 'bot') return { mode, available: true, provider: 'bot' };
  if (mode === 'offline') return { mode, available: await ollamaAvailable(), provider: 'ollama' };
  const provider = activeProvider();
  return { mode, available: Boolean(provider), provider: sanitizeProvider(provider) };
}

module.exports = { getSettings, setSettings, getMode, getFeatureStatus, routeTextCall, routeImageCall, sanitizeProvider, FEATURES, VALID_MODES, DEFAULT_MODE };
