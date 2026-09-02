// نظام الأصوات الهولوغرافية — Web Audio API خالص (بلا أي ملفات صوتية
// خارجية أو محتوى محمي بحقوق نشر). طبقات صوتية قصيرة مُركَّبة (نغمات +
// ضجيج مفلتر) بسياق واحد مُعاد استخدامه (لا AudioContext جديد لكل تشغيل).
// موديول عادي (لا React) — مصدر الحقيقة الوحيد لحالة الكتم أيضاً، حتى يبقى
// متسقاً بين أي مكوّن يقرأه (راجع useHolographicOrbit.js).
//
// إعادة تصميم صريحة (بند Part G بالمواصفة): لا نغمات oscillator واحدة
// مجرّدة ("beep")، بل تركيب طبقي دائماً — ضجيج مفلتر (BiquadFilterNode
// bandpass/lowpass/highpass) + رنين sine/triangle + شظايا shimmer عالية
// خافتة جداً — يمنح طابعاً "زجاجياً/كهرومغناطيسياً" سينمائياً بدل "قديم/آركيد".
const MUTE_KEY = 'sihatuna-holographic-sound-muted';
const MASTER_VOLUME = 0.17; // بند صريح: 0.14-0.20

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
// تحقّق من قيمة localStorage قبل الوثوق بها (بند صريح: "old invalid stored
// values are not forcing permanent mute") — أي قيمة غير 'true'/'false'
// حرفياً (تلف، تعديل يدوي، نسخة قديمة من مفتاح مختلف) تُعامَل كأنها غير
// موجودة، فيُطبَّق الافتراضي (غير مكتوم) بدل قفل صامت دائم بالخطأ.
let muted = (() => {
  try {
    const raw = localStorage.getItem(MUTE_KEY);
    return raw === 'true' ? true : false; // أي قيمة أخرى (بما فيها null) → false
  } catch { return false; }
})();
const listeners = new Set();
const statusListeners = new Set();

function notify() { listeners.forEach(fn => fn(muted)); }

export function subscribeMute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isMuted() { return muted; }

// ══════════════════════════════════════════════════════════════════════
// تشخيص حالة الصوت الفعلية — بند Part 6/30-36 صراحةً: وجود ملف/دالة لا يعني
// أن الصوت مسموع فعلياً؛ الحالة الحقيقية الوحيدة الموثوقة هي
// AudioContext.state. getAudioStatus() تُستخدَم من شارة تطوير مرئية
// (Layout.js) حتى يمكن التحقق البصري المباشر بدل افتراض النجاح من مجرد
// عدم وجود استثناء بـconsole.
// ══════════════════════════════════════════════════════════════════════
// بند حرج: useSyncExternalStore (useHolographicSound.js) يقارن اللقطات
// بـObject.is — إرجاع كائن جديد بكل استدعاء لـgetAudioStatus() (كما كان)
// يجعلها "تتغيّر" دائماً حتى بلا أي تغيّر فعلي، ما يُسبِّب حلقة إعادة تصيير
// لا نهائية فعلية (مؤكَّد: "Maximum update depth exceeded" بالتشغيل
// الحقيقي). الإصلاح: كائن واحد مُخبَّأ يُعاد بناؤه فقط داخل computeStatus
// عند تغيّر حقيقي (notifyStatus)، وgetAudioStatus() تُعيد نفس المرجع دوماً
// بينهما.
let cachedStatus = computeStatus();

function computeStatus() {
  const supported = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  if (!supported) return { supported: false, ctxState: null, muted, label: 'UNSUPPORTED' };
  if (!audioCtx) return { supported: true, ctxState: null, muted, label: muted ? 'MUTED' : 'NOT_STARTED' };
  const ctxState = audioCtx.state;
  let label;
  if (muted) label = 'MUTED';
  else if (ctxState === 'running') label = 'READY';
  else if (ctxState === 'suspended') label = 'SUSPENDED';
  else label = ctxState.toUpperCase();
  return { supported: true, ctxState, muted, label };
}

function notifyStatus() {
  cachedStatus = computeStatus();
  statusListeners.forEach(fn => fn(cachedStatus));
}

export function subscribeAudioStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

export function getAudioStatus() { return cachedStatus; }

export function setMuted(next) {
  muted = next;
  try { localStorage.setItem(MUTE_KEY, String(next)); } catch { /* تخزين تقديري فقط */ }
  if (masterGain) masterGain.gain.setTargetAtTime(next ? 0 : MASTER_VOLUME, ctxNow(), 0.05);
  if (next) stopDragSound();
  // بند صريح (Part 33/34): زر السماعة نفسه إيماءة مستخدم حقيقية صالحة —
  // إلغاء الكتم يُسخِّن/يستأنف AudioContext فوراً بدل الانتظار حتى أول سحب.
  else ensureContext();
  soundDebug('muted', next, '| ctxState:', audioCtx?.state);
  notify();
  notifyStatus();
}

function ctxNow() { return audioCtx ? audioCtx.currentTime : 0; }

function ensureContext() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      // بند Part 32 صراحةً: تتبّع اكتمال resume() فعلياً (لا استدعاء بلا
      // تحقّق) — يُحدِّث الحالة المرئية (الشارة) فور وصول السياق لـ'running'
      // فعلياً، لا فور استدعاء resume نفسه.
      audioCtx.resume().then(() => {
        soundDebug('context resumed →', audioCtx.state);
        notifyStatus();
      }).catch(() => {});
    }
    return audioCtx;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
  masterGain.connect(audioCtx.destination);
  audioCtx.onstatechange = () => {
    soundDebug('context state change →', audioCtx.state);
    notifyStatus();
  };
  // الحالة الحقيقية فور الإنشاء — لا افتراض نجاح؛ إن بقيت 'suspended' هنا
  // (بعض المتصفحات/السياقات تُنشِئ السياق مُعلَّقاً حتى مع إيماءة مستخدم
  // حقيقية) نحاول استئنافها فوراً أيضاً.
  soundDebug('context created, state:', audioCtx.state);
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => soundDebug('context resumed →', audioCtx.state)).catch(() => {});
  }
  notifyStatus();
  return audioCtx;
}

// أداة تطوير فقط (بند Part 35/36 صراحةً) — تشغّل نغمة تأكيد قصيرة وآمنة عبر
// console مباشرة، للتحقق اليدوي من خروج صوت فعلي من المتصفح بمعزل عن أي
// تفاعل سحب. مُطفأة تماماً بأي production build.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  window.__testHoloSound = () => {
    ensureContext();
    playConfirm();
    // eslint-disable-next-line no-console
    console.log('[HoloAudio] __testHoloSound → ctxState:', audioCtx?.state, '| muted:', muted);
  };
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

// إفلات خارج المستقبِل — إشارة عودة هادئة جداً جداً، لا نغمة خطأ (بند 46
// صراحةً: "Do NOT play error beep").
export function playReturn() {
  play(ctx => {
    tone(ctx, { freq: 260, freqEnd: 195, duration: 0.14, type: 'sine', peak: 0.1 });
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

// بند Part 38 صراحةً: "differentiate subtly" بين تدوير الحلقة (أفقي، هوائي
// أخفّ) وسحب الصفحة المباشر نحو المركز (أكثر تركيزاً/مغناطيسية) — تردد
// أساسي وخليط طبقات مختلف قليلاً حسب mode، لا نظامان منفصلان بالكامل.
const DRAG_MODES = {
  ring: { baseFreq: 92, freqRange: 55, noiseCutoff: 620, noiseGain: 0.55, shimmerBase: 2500 },
  page: { baseFreq: 118, freqRange: 65, noiseCutoff: 520, noiseGain: 0.4, shimmerBase: 3100 },
};
const DRAG_OSC_BASE_CUTOFF = 360;
const DRAG_OSC_CUTOFF_RANGE = 1200;
const DRAG_NOISE_CUTOFF_RANGE = 2100;
// بند صريح Part 39: سطوع فعلي مسموع أثناء حركة متوسطة تقريباً 0.025-0.05.
const DRAG_MASTER_MIN = 0.018;
const DRAG_MASTER_MAX = 0.052;
let dragMode = 'ring';
let dragProximityBoost = 0; // 0=FAR, 0.5=NEAR, 1=LOCKED — بند 44: بريق/توتر إضافي طفيف قرب المستقبِل

export function setDragProximity(tier) {
  dragProximityBoost = tier === 'locked' ? 1 : tier === 'near' ? 0.5 : 0;
}

// mode: 'ring' (تدوير الحلقة) أو 'page' (سحب اللوحة المختارة مباشرة نحو
// المركز) — بند 38 صراحةً.
export function startDragSound(mode = 'ring') {
  if (muted || dragActive) return;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  dragActive = true;
  dragMode = DRAG_MODES[mode] ? mode : 'ring';
  const cfg = DRAG_MODES[dragMode];

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
  dragNoiseFilter.frequency.value = cfg.noiseCutoff;
  dragNoiseFilter.Q.value = 0.8;
  dragNoiseGain = ctx.createGain();
  dragNoiseGain.gain.value = cfg.noiseGain;
  dragNoiseSrc.connect(dragNoiseFilter);
  dragNoiseFilter.connect(dragNoiseGain);
  dragNoiseGain.connect(dragMasterGain);
  dragNoiseSrc.start();

  // طبقة B — رنين ناعم (جسم الصوت)
  dragOsc = ctx.createOscillator();
  dragOsc.type = 'triangle';
  dragOsc.frequency.value = cfg.baseFreq;
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
  dragShimmerOsc.frequency.value = cfg.shimmerBase;
  dragShimmerGain = ctx.createGain();
  dragShimmerGain.gain.value = 0.045;
  dragShimmerOsc.connect(dragShimmerGain);
  dragShimmerGain.connect(dragMasterGain);
  dragShimmerOsc.start();

  dragProximityBoost = 0;
  dragMasterGain.gain.setTargetAtTime(DRAG_MASTER_MIN, ctx.currentTime, 0.05);
  soundDebug('drag start (' + dragMode + ') ctxState:', ctx.state);
}

// velocity01: سرعة مُطبَّعة 0..1. pointerX/stageWidth (اختياريان): لموضع
// الانحراف الصوتي الطفيف (بند 45) — بلا قفزات أبداً (setTargetAtTime دائماً).
// بريق/توتر إضافي طفيف حسب القرب من المستقبِل (dragProximityBoost، بند 44)
// — يُضبَط عبر setDragProximity() من طبقة السحب المباشر فقط.
export function updateDragSound(velocity01, pointerX, stageWidth) {
  if (!dragActive || !audioCtx) return;
  const v = Math.max(0, Math.min(1, velocity01));
  const cfg = DRAG_MODES[dragMode];
  const now = audioCtx.currentTime;
  if (dragOsc) dragOsc.frequency.setTargetAtTime(cfg.baseFreq + v * cfg.freqRange, now, 0.08);
  if (dragOscFilter) dragOscFilter.frequency.setTargetAtTime(DRAG_OSC_BASE_CUTOFF + v * DRAG_OSC_CUTOFF_RANGE, now, 0.1);
  if (dragNoiseFilter) dragNoiseFilter.frequency.setTargetAtTime(cfg.noiseCutoff + v * DRAG_NOISE_CUTOFF_RANGE, now, 0.1);
  if (dragShimmerGain) dragShimmerGain.gain.setTargetAtTime(0.03 + v * 0.07 + dragProximityBoost * 0.05, now, 0.1);
  if (dragMasterGain && !muted) {
    const target = DRAG_MASTER_MIN + v * (DRAG_MASTER_MAX - DRAG_MASTER_MIN) + dragProximityBoost * 0.006;
    dragMasterGain.gain.setTargetAtTime(target, now, 0.1);
  }
  if (dragPanner && typeof pointerX === 'number' && stageWidth) {
    const pan = Math.max(-0.2, Math.min(0.2, (pointerX / stageWidth - 0.5) * 0.4));
    dragPanner.pan.setTargetAtTime(pan, now, 0.15);
  }
  soundDebug('drag velocity:', v.toFixed(2), '| proximity:', dragProximityBoost);
}

export function stopDragSound() {
  dragProximityBoost = 0;
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
