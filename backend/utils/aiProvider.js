// backend/utils/aiProvider.js
//
// A unified layer for calling a real AI provider (free Gemini first, paid
// Claude as a fallback) -- extracted from routes/aiDiagnosisRoutes.js so
// that any second feature in the system (drug interactions, future smart
// reports...) can use the same logic without duplicating code. See
// routes/aiDiagnosisRoutes.js for the full explanation of why this call is
// made from the backend (server-to-server) and not directly from the
// frontend.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// ── Note: the actual model available to new accounts changes quickly on Google's side ──
// If you get a 404 error "no longer available to new users", open
// aistudio.google.com -> Playground -> Build -> Code and Chat, see which
// model is actually listed there, and update GEMINI_MODEL in the .env file
// (no code change needed).
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

// Which provider is currently active? (free Gemini always has priority)
function activeProvider() {
  if (GEMINI_API_KEY) return 'gemini';
  if (ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

async function callGemini(systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      // Gemini supports forcing explicit JSON output -- this entirely prevents Markdown-wrapping issues
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(rawText);
}

async function callAnthropic(systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';
  // Claude sometimes wraps the JSON in ```json fences -- strip them before parsing
  const cleaned = rawText.replace(/```json\s*|\s*```/g, '').trim();
  return JSON.parse(cleaned);
}

// A unified function: calls whichever provider is currently active, and
// returns a uniformly-shaped result instead of throwing an exception that
// would break the request -- whatever API path uses it decides for itself
// what to do if it fails (usually: fall back to the local backup system
// instead of a dry error message to the user).
async function callAI(systemPrompt, userPrompt) {
  const provider = activeProvider();
  if (!provider) return { available: false };
  try {
    const parsed = provider === 'gemini'
      ? await callGemini(systemPrompt, userPrompt)
      : await callAnthropic(systemPrompt, userPrompt);
    return { available: true, provider, parsed };
  } catch (err) {
    return { available: false, provider, error: err.message };
  }
}

async function callGeminiVision(systemPrompt, userPrompt, imageBase64, mimeType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: userPrompt },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText) throw new Error(`Empty response from Gemini: ${JSON.stringify(data).slice(0, 300)}`);
  const cleaned = rawText.replace(/```json\s*|\s*```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Invalid response from Gemini: ${cleaned.slice(0, 300)}`);
  }
}

async function callAnthropicVision(systemPrompt, userPrompt, imageBase64, mimeType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: userPrompt },
        ],
      }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';
  const cleaned = rawText.replace(/```json\s*|\s*```/g, '').trim();
  return JSON.parse(cleaned);
}

// Same idea as callAI() above, but for prompts that include an image (used
// by the AI invoice reader). imageBase64 must be raw base64 (no
// "data:image/...;base64," prefix) — strip that on the caller side.
async function callAIWithImage(systemPrompt, userPrompt, imageBase64, mimeType) {
  const provider = activeProvider();
  if (!provider) return { available: false };
  try {
    const parsed = provider === 'gemini'
      ? await callGeminiVision(systemPrompt, userPrompt, imageBase64, mimeType)
      : await callAnthropicVision(systemPrompt, userPrompt, imageBase64, mimeType);
    return { available: true, provider, parsed };
  } catch (err) {
    return { available: false, provider, error: err.message };
  }
}

module.exports = { activeProvider, callAI, callAIWithImage };
