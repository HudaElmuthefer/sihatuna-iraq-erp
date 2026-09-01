// نظام الأصوات الهولوغرافية — Web Audio API خالص (بلا أي ملفات صوتية
// خارجية أو محتوى محمي بحقوق نشر). طبقات صوتية قصيرة مُركَّبة (نغمات +
// ضجيج مفلتر) بسياق واحد مُعاد استخدامه (لا AudioContext جديد لكل تشغيل).
// موديول عادي (لا React) — مصدر الحقيقة الوحيد لحالة الكتم أيضاً، حتى يبقى
// متسقاً بين أي مكوّن يقرأه (راجع useHolographicRing.js).
//
// إعادة تصميم صريحة (بند Part G بالمواصفة): لا نغمات oscillator واحدة
// مجرّدة ("beep")، بل تركيب طبقي دائماً — ضجيج مفلتر (BiquadFilterNode
// bandpass/lowpass/highpass) + رنين sine/triangle + شظايا shimmer عالية
// خافتة جداً — يمنح طابعاً "زجاجياً/كهرومغناطيسياً" سينمائياً بدل "قديم/آركيد".
const MUTE_KEY = 'sihatuna-holographic-sound-muted';
const MASTER_VOLUME = 0.15; // بند صريح: 0.10-0.18

function soundDebug(...args) {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window !== 'undefined' && window.__HOLO_AUDIO_DEBUG__) {
    // eslint-disable-next-line no-console
    console.log('[HoloAudio]', ...args);
  }
}

let audioCtx = null;
let masterGain = null;
let noiseBufferCache = null;
let muted = (() => {
  try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch { return false; }
})();
const listeners = new Set();

function notify() { listeners.forEach(fn => fn(muted)); }

export function subscribeMute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isMuted() { return muted; }

export function setMuted(next) {
  muted = next;
  try { localStorage.setItem(MUTE_KEY, String(next)); } catch { /* تخزين تقديري فقط */ }
  if (masterGain) masterGain.gain.setTargetAtTime(next ? 0 : MASTER_VOLUME, ctxNow(), 0.05);
  if (next) stopDragSound();
  soundDebug('muted', next);
  notify();
}

function ctxNow() { return audioCtx ? audioCtx.currentTime : 0; }

function ensureContext() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
  masterGain.connect(audioCtx.destination);
  soundDebug('context unlocked');
  return audioCtx;
}

// مخزن ضجيج أبيض قصير (2 ثانية، قابل للتكرار loop) — يُبنى مرة واحدة فقط
// ويُعاد استخدامه لكل عقدة BufferSource جديدة (بند صريح: لا ملفات خارجية،
// توليد إجرائي محلي).
function getNoiseBuffer(ctx) {
  if (noiseBufferCache) return noiseBufferCache;
  const len = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBufferCache = buffer;
  return buffer;
}

function tone(ctx, { freq, delay = 0, duration = 0.12, type = 'sine', peak = 1, freqEnd = null }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  const t0 = ctx.currentTime + delay;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration * 0.85);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// شظية ضجيج مفلتر قصيرة — لبنة "زجاجية" تُستخدَم بالنقرات/الفتح/الإغلاق
// بدل نغمة oscillator مجرَّدة وحدها.
function noiseBurst(ctx, { type = 'bandpass', freq, freqEnd = null, Q = 1, delay = 0, duration = 0.06, peak = 0.1 }) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  const t0 = ctx.currentTime + delay;
  filt.frequency.setValueAtTime(freq, t0);
  if (freqEnd) filt.frequency.linearRampToValueAtTime(freqEnd, t0 + duration * 0.9);
  filt.Q.value = Q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0006, t0 + duration);
  src.connect(filt);
  filt.connect(gain);
  gain.connect(masterGain);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

function play(build) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  try { build(ctx); } catch { /* الصوت زخرفي بحت — أي فشل هنا لا يجب أن يكسر التفاعل نفسه */ }
}

// ── الأحداث المُعرَّفة ────────────────────────────────────────────────────
export function playSelect() {
  play(ctx => {
    tone(ctx, { freq: 880, duration: 0.09, type: 'sine', peak: 0.5 });
    tone(ctx, { freq: 1320, duration: 0.07, type: 'sine', peak: 0.22, delay: 0.01 });
  });
}

// نقرة "detent" زجاجية-ميكانيكية — عبور فهرس أثناء السحب (حد أقصى نقرة
// واحدة لكل تغيّر فهرس، لا لكل إطار). طبقتان: شظية ضجيج مفلتر قصيرة جداً +
// شظية سينية عالية خافتة جداً — لا نغمة beep مفردة (بند 46 صراحةً).
export function playTick() {
  play(ctx => {
    noiseBurst(ctx, { type: 'bandpass', freq: 2100, Q: 2.5, duration: 0.045, peak: 0.09 });
    tone(ctx, { freq: 1700, duration: 0.03, type: 'sine', peak: 0.05, delay: 0.002 });
  });
}

// نقرة مغناطيسية ناعمة — جسم منخفض-متوسط قصير + بريق زجاجي عالٍ خافت جداً
// (بند 47: "no loud click").
export function playSnap() {
  soundDebug('snap');
  play(ctx => {
    tone(ctx, { freq: 340, duration: 0.11, type: 'sine', peak: 0.3 });
    tone(ctx, { freq: 175, duration: 0.09, type: 'triangle', peak: 0.16, delay: 0.004 });
    tone(ctx, { freq: 2500, duration: 0.05, type: 'sine', peak: 0.06, delay: 0.02 });
  });
}

// مسحة صاعدة رنّانة هادئة + بريق هوائي (ضجيج مفلتر صاعد التردد) — بند 48:
// 250-450ms.
export function playOpen() {
  soundDebug('page open');
  play(ctx => {
    tone(ctx, { freq: 300, freqEnd: 880, duration: 0.36, type: 'sine', peak: 0.26 });
    noiseBurst(ctx, { type: 'highpass', freq: 1800, freqEnd: 5200, Q: 0.7, duration: 0.34, peak: 0.045, delay: 0.04 });
  });
}

// إحساس عكسي هادئ متحكَّم به — مسحة هابطة التردد (بند 49).
export function playClose() {
  play(ctx => {
    tone(ctx, { freq: 700, freqEnd: 280, duration: 0.28, type: 'sine', peak: 0.22 });
  });
}

export function playConfirm() {
  play(ctx => { tone(ctx, { freq: 760, duration: 0.1, type: 'sine', peak: 0.32 }); });
}

export function playError() {
  play(ctx => {
    tone(ctx, { freq: 220, duration: 0.16, type: 'triangle', peak: 0.28 });
    tone(ctx, { freq: 180, duration: 0.18, type: 'triangle', peak: 0.22, delay: 0.06 });
  });
}

// ══════════════════════════════════════════════════════════════════════
// صوت سحب مستمر — "قضيب زجاجي كهرومغناطيسي" ثلاثي الطبقات (بند 42 صراحةً):
//   طبقة A: ضجيج مفلتر خافت جداً (bandpass) — نسيج هوائي للحركة.
//   طبقة B: رنين sine/triangle ناعم — جسم الصوت.
//   طبقة C: بريق علوي خافت جداً جداً (sine عالي التردد) — لمعان زجاجي.
// جميعها تُنشَأ مرة واحدة فقط عند بدء السحب (لا عقد جديدة كل إطار)، وتُدار
// عبر gain واحد مشترك (dragMasterGain) لضبط سطوع/كتم موحَّد. StereoPannerNode
// اختياري (بند 45) يربط موضع X للمؤشر بانحراف صوتي طفيف جداً (±0.25 كحد أقصى).
// ══════════════════════════════════════════════════════════════════════
let dragMasterGain = null;
let dragPanner = null;
let dragNoiseSrc = null, dragNoiseFilter = null, dragNoiseGain = null;
let dragOsc = null, dragOscFilter = null, dragOscGain = null;
let dragShimmerOsc = null, dragShimmerGain = null;
let dragActive = false;

const DRAG_OSC_BASE_FREQ = 92;
const DRAG_OSC_FREQ_RANGE = 55;
const DRAG_OSC_BASE_CUTOFF = 360;
const DRAG_OSC_CUTOFF_RANGE = 1200;
const DRAG_NOISE_BASE_CUTOFF = 620;
const DRAG_NOISE_CUTOFF_RANGE = 2100;
const DRAG_MASTER_MIN = 0.012;
const DRAG_MASTER_MAX = 0.032; // بند صريح: 0.01-0.035

export function startDragSound() {
  if (muted || dragActive) return;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  dragActive = true;

  dragMasterGain = ctx.createGain();
  dragMasterGain.gain.value = 0;
  if (ctx.createStereoPanner) {
    dragPanner = ctx.createStereoPanner();
    dragMasterGain.connect(dragPanner);
    dragPanner.connect(masterGain);
  } else {
    dragPanner = null;
    dragMasterGain.connect(masterGain);
  }

  // طبقة A — ضجيج مفلتر (نسيج هوائي)
  dragNoiseSrc = ctx.createBufferSource();
  dragNoiseSrc.buffer = getNoiseBuffer(ctx);
  dragNoiseSrc.loop = true;
  dragNoiseFilter = ctx.createBiquadFilter();
  dragNoiseFilter.type = 'bandpass';
  dragNoiseFilter.frequency.value = DRAG_NOISE_BASE_CUTOFF;
  dragNoiseFilter.Q.value = 0.8;
  dragNoiseGain = ctx.createGain();
  dragNoiseGain.gain.value = 0.55;
  dragNoiseSrc.connect(dragNoiseFilter);
  dragNoiseFilter.connect(dragNoiseGain);
  dragNoiseGain.connect(dragMasterGain);
  dragNoiseSrc.start();

  // طبقة B — رنين ناعم (جسم الصوت)
  dragOsc = ctx.createOscillator();
  dragOsc.type = 'triangle';
  dragOsc.frequency.value = DRAG_OSC_BASE_FREQ;
  dragOscFilter = ctx.createBiquadFilter();
  dragOscFilter.type = 'lowpass';
  dragOscFilter.frequency.value = DRAG_OSC_BASE_CUTOFF;
  dragOscFilter.Q.value = 0.7;
  dragOscGain = ctx.createGain();
  dragOscGain.gain.value = 0.4;
  dragOsc.connect(dragOscFilter);
  dragOscFilter.connect(dragOscGain);
  dragOscGain.connect(dragMasterGain);
  dragOsc.start();

  // طبقة C — بريق علوي خافت جداً (لا يجب أن يهيمن — بند 42)
  dragShimmerOsc = ctx.createOscillator();
  dragShimmerOsc.type = 'sine';
  dragShimmerOsc.frequency.value = 2500;
  dragShimmerGain = ctx.createGain();
  dragShimmerGain.gain.value = 0.045;
  dragShimmerOsc.connect(dragShimmerGain);
  dragShimmerGain.connect(dragMasterGain);
  dragShimmerOsc.start();

  dragMasterGain.gain.setTargetAtTime(DRAG_MASTER_MIN, ctx.currentTime, 0.05);
  soundDebug('drag start');
}

// velocity01: سرعة مُطبَّعة 0..1. pointerX/stageWidth (اختياريان): لموضع
// الانحراف الصوتي الطفيف (بند 45) — بلا قفزات أبداً (setTargetAtTime دائماً).
export function updateDragSound(velocity01, pointerX, stageWidth) {
  if (!dragActive || !audioCtx) return;
  const v = Math.max(0, Math.min(1, velocity01));
  const now = audioCtx.currentTime;
  if (dragOsc) dragOsc.frequency.setTargetAtTime(DRAG_OSC_BASE_FREQ + v * DRAG_OSC_FREQ_RANGE, now, 0.08);
  if (dragOscFilter) dragOscFilter.frequency.setTargetAtTime(DRAG_OSC_BASE_CUTOFF + v * DRAG_OSC_CUTOFF_RANGE, now, 0.1);
  if (dragNoiseFilter) dragNoiseFilter.frequency.setTargetAtTime(DRAG_NOISE_BASE_CUTOFF + v * DRAG_NOISE_CUTOFF_RANGE, now, 0.1);
  if (dragShimmerGain) dragShimmerGain.gain.setTargetAtTime(0.03 + v * 0.08, now, 0.1);
  if (dragMasterGain && !muted) {
    dragMasterGain.gain.setTargetAtTime(DRAG_MASTER_MIN + v * (DRAG_MASTER_MAX - DRAG_MASTER_MIN), now, 0.1);
  }
  if (dragPanner && typeof pointerX === 'number' && stageWidth) {
    const pan = Math.max(-0.25, Math.min(0.25, (pointerX / stageWidth - 0.5) * 0.5));
    dragPanner.pan.setTargetAtTime(pan, now, 0.15);
  }
  soundDebug('drag velocity:', v.toFixed(2));
}

export function stopDragSound() {
  if (!dragActive || !audioCtx) { dragActive = false; return; }
  dragActive = false;
  soundDebug('drag stop');
  const ctx = audioCtx;
  const gain = dragMasterGain;
  const nodes = { src: dragNoiseSrc, osc: dragOsc, shimmer: dragShimmerOsc };
  const cleanupRefs = { dragNoiseFilter, dragNoiseGain, dragOscFilter, dragOscGain, dragShimmerGain, dragPanner };
  if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.035); // يتلاشى خلال ~80-180ms
  window.setTimeout(() => {
    try {
      nodes.src?.stop(); nodes.osc?.stop(); nodes.shimmer?.stop();
      nodes.src?.disconnect(); nodes.osc?.disconnect(); nodes.shimmer?.disconnect();
      Object.values(cleanupRefs).forEach(n => { try { n?.disconnect(); } catch { /* already gone */ } });
      gain?.disconnect();
    } catch { /* عقد قد تكون أُوقفت أصلاً */ }
  }, 200);
  dragNoiseSrc = dragNoiseFilter = dragNoiseGain = null;
  dragOsc = dragOscFilter = dragOscGain = null;
  dragShimmerOsc = dragShimmerGain = null;
  dragMasterGain = null;
  dragPanner = null;
}

export function isDragSoundActive() { return dragActive; }
