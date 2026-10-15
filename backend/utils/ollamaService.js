// backend/utils/ollamaService.js
//
// Ollama (local/offline AI) -- a third alternative to Gemini/Claude
// alongside utils/aiProvider.js, with the exact same unified function
// shape (available/provider/parsed) so it's a direct drop-in replacement
// for callAI/callAIWithImage from the point of view of any route that
// calls them -- see phase five (aiProviderRouter.js) for the actual
// bot/online/offline selection logic; this file only provides the
// capability, with no selection logic built in here.
//
// ── Why is the Ollama server completely separate from Gemini/Anthropic? ───
// Gemini/Claude: an HTTP request to an external cloud server with just an
// API key -- no local infrastructure needed at all. Ollama: an actual
// server running locally (port 11434 by default) that loads a full AI
// model into the machine's own memory -- needs Ollama installed and a
// model downloaded in advance (`ollama pull <model>`), and then works even
// with no internet at all (this is what "offline" means here) -- unlike
// Gemini/Claude, which stop working immediately without internet.
//
// ── Two separate models: text and vision, not one model for both ─────────
// Not every Ollama model supports reading images (vision) -- actually
// confirmed (`ollama show <model>`): qwen2.5 is purely text-based (no
// "vision" in its capabilities list), while gemma3 supports both. The
// default text model here is much smaller (faster and lighter on memory)
// because drug-interaction checking (its main use) is purely text-based --
// no need to load a heavier vision model for a task that doesn't need it.
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:0.5b';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma3:4b';
// Local inference on the CPU -- no GPU acceleration is guaranteed on every
// machine -- can take much longer than a cloud call, especially for the
// heavier vision model on a machine with limited memory. A deliberately
// generous timeout (similar to OCR_TIMEOUT_MS in agents/ocrAgent.js for
// exactly the same reason), while still being bounded to prevent a truly
// infinite hang.
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 120_000;

// A quick check: is the Ollama server responding at all? (doesn't check
// whether a specific model is available -- just that the server itself is
// running). A deliberately short timeout (an availability check, not a
// real call).
async function ollamaAvailable() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

// A general call to /api/chat -- used internally by the two unified
// functions below. format:'json' forces Ollama to return only valid JSON
// (supported by most modern models, matching Gemini's responseMimeType) --
// prevents the same Markdown-wrapping issue that existed before this in
// callGemini/callAnthropic.
async function chatRequest(model, systemPrompt, userPrompt, images) {
  const message = { role: 'user', content: userPrompt };
  if (images) message.images = images;

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, message],
      format: 'json',
      stream: false,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const rawText = data.message?.content || '';
  if (!rawText) throw new Error(`Empty response from Ollama (${model}): ${JSON.stringify(data).slice(0, 300)}`);
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`Invalid response from Ollama (${model}): ${rawText.slice(0, 300)}`);
  }
}

// The exact same shape as callAI() in utils/aiProvider.js -- a direct replacement for it.
async function callOllama(systemPrompt, userPrompt) {
  try {
    const parsed = await chatRequest(OLLAMA_TEXT_MODEL, systemPrompt, userPrompt);
    return { available: true, provider: 'ollama', parsed };
  } catch (err) {
    return { available: false, provider: 'ollama', error: err.message };
  }
}

// The exact same shape as callAIWithImage() in utils/aiProvider.js --
// imageBase64 is raw (no "data:image/...;base64," prefix), with the exact
// same requirement on the caller side.
async function callOllamaWithImage(systemPrompt, userPrompt, imageBase64, mimeType) {
  try {
    const parsed = await chatRequest(OLLAMA_VISION_MODEL, systemPrompt, userPrompt, [imageBase64]);
    return { available: true, provider: 'ollama', parsed };
  } catch (err) {
    return { available: false, provider: 'ollama', error: err.message };
  }
}

module.exports = { ollamaAvailable, callOllama, callOllamaWithImage, OLLAMA_TEXT_MODEL, OLLAMA_VISION_MODEL };
