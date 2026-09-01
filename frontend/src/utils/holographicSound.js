// نظام الأصوات الهولوغرافية — Web Audio API خالص (بلا أي ملفات صوتية
// خارجية أو محتوى محمي بحقوق نشر)، نغمات قصيرة زجاجية رقمية أصلية مُركَّبة
// عبر OscillatorNode/GainNode بسياق واحد مُعاد استخدامه (لا AudioContext
// جديد لكل تشغيل). موديول عادي (لا React) — مصدر الحقيقة الوحيد لحالة
// الكتم أيضاً، حتى يبقى متسقاً بين أي مكوّن يقرأه (راجع useHolographicSound.js).
const MUTE_KEY = 'sihatuna-holographic-sound-muted';
const MASTER_VOLUME = 0.16; // بند صريح: 0.12-0.22

// تشخيص تطوير فقط (نفس نمط FuturisticCursor.js's cursorDebug تحديداً) —
// مُطفأ دائماً بأي production build؛ للتفعيل يدوياً أثناء التطوير:
// window.__HOLO_AUDIO_DEBUG__ = true بالـConsole.
function soundDebug(...args) {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window !== 'undefined' && window.__HOLO_AUDIO_DEBUG__) {
    // eslint-disable-next-line no-console
    console.log('[HoloAudio]', ...args);
  }
}

let audioCtx = null;
let masterGain = null;
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
  // بند صريح: الكتم يوقف أي صوت سحب مستمر جارٍ فوراً، لا ينتظر رفع المؤشر.
  if (next) stopDragSound();
  soundDebug('muted', next);
  notify();
}

function ctxNow() { return audioCtx ? audioCtx.currentTime : 0; }

// لا يُنشِئ AudioContext إلا عند أول استدعاء فعلي لتشغيل صوت — ويجب أن يقع
// هذا الاستدعاء الأول ضمن معالج تفاعل مستخدم حقيقي (pointerdown/click/
// keydown) احتراماً لسياسة المتصفحات ضد التشغيل التلقائي بلا تفاعل.
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

// نغمة واحدة قصيرة (envelope هجوم/تلاشٍ سريع) — لبنة البناء الأساسية لكل
// الأصوات أدناه. sine/triangle فقط (لا square/sawtooth حادّة) — طابع
// "زجاجي دقيق" لا "لعبة فيديو".
function tone(ctx, { freq, delay = 0, duration = 0.12, type = 'sine', peak = 1, detune = 0 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (detune) osc.detune.value = detune;
  const t0 = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function play(build) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  try { build(ctx); } catch { /* الصوت زخرفي بحت — أي فشل هنا لا يجب أن يكسر التفاعل نفسه */ }
}

// ── الأحداث المُعرَّفة (بند 48 بالمواصفة) ───────────────────────────────────
export function playSelect() {
  // نغمة تأكيد زجاجية رقمية قصيرة — لحظة اختيار لوحة على الحلقة.
  play(ctx => {
    tone(ctx, { freq: 880, duration: 0.09, type: 'sine', peak: 0.5 });
    tone(ctx, { freq: 1320, duration: 0.07, type: 'sine', peak: 0.22, delay: 0.01 });
  });
}

export function playTick() {
  // نقرة زجاجية دقيقة جداً — عبور فهرس أثناء السحب المستمر (بند صريح: حد
  // أقصى نقرة واحدة لكل تغيّر فهرس، لا لكل إطار حركة). أخفت وأقصر بكثير
  // من playSnap (تلك للاستقرار النهائي بعد رفع المؤشر).
  play(ctx => { tone(ctx, { freq: 1040, duration: 0.035, type: 'sine', peak: 0.14 }); });
}

export function playSnap() {
  // نقرة مغناطيسية ناعمة — الحلقة استقرّت على أقرب لوحة بعد سحب/عجلة.
  soundDebug('snap');
  play(ctx => {
    tone(ctx, { freq: 520, duration: 0.08, type: 'triangle', peak: 0.4 });
  });
}

export function playOpen() {
  // نغمة صاعدة قصيرة — لوحة تنفصل وتتوسّع لمساحة العمل.
  soundDebug('page open');
  play(ctx => {
    tone(ctx, { freq: 440, duration: 0.05, type: 'sine', peak: 0.35 });
    tone(ctx, { freq: 660, duration: 0.09, type: 'sine', peak: 0.4, delay: 0.05 });
    tone(ctx, { freq: 990, duration: 0.14, type: 'sine', peak: 0.3, delay: 0.1 });
  });
}

export function playClose() {
  // نغمة عكسية هادئة — العودة من صفحة مفتوحة نحو الحلقة.
  play(ctx => {
    tone(ctx, { freq: 700, duration: 0.08, type: 'sine', peak: 0.3 });
    tone(ctx, { freq: 460, duration: 0.1, type: 'sine', peak: 0.28, delay: 0.05 });
  });
}

export function playConfirm() {
  play(ctx => { tone(ctx, { freq: 760, duration: 0.1, type: 'sine', peak: 0.35 }); });
}

export function playError() {
  play(ctx => {
    tone(ctx, { freq: 220, duration: 0.16, type: 'triangle', peak: 0.3 });
    tone(ctx, { freq: 180, duration: 0.18, type: 'triangle', peak: 0.24, delay: 0.06 });
  });
}

// ══════════════════════════════════════════════════════════════════════
// صوت سحب الحلقة المستمر — "زجاج/سيرفو هولوغرافي ناعم" يتفاعل مع سرعة
// السحب (بند صريح بالمواصفة: ليس صوتاً واحداً لكل حركة، بل عقدة صوت واحدة
// تبقى حيّة طوال إيماءة السحب وتتغيّر معاييرها تدريجياً). لا يُنشِئ عقداً
// جديدة كل إطار — osc/filter/gain واحدة تُنشَأ مرة عند بدء السحب فقط.
// ══════════════════════════════════════════════════════════════════════
let dragOsc = null;
let dragOsc2 = null; // طبقة ثانية خفيفة مُزاحة قليلاً (detune) — نسيج هوائي، لا محرك
let dragFilter = null;
let dragGain = null;
let dragActive = false;

const DRAG_BASE_FREQ = 95;
const DRAG_FREQ_RANGE = 70; // 95-165Hz حسب السرعة
const DRAG_BASE_CUTOFF = 380;
const DRAG_CUTOFF_RANGE = 1300;
const DRAG_MIN_GAIN = 0.015;
const DRAG_MAX_GAIN = 0.045; // بند صريح: 0.015-0.05

export function startDragSound() {
  if (muted || dragActive) return;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  dragActive = true;
  dragGain = ctx.createGain();
  dragGain.gain.value = 0;
  dragFilter = ctx.createBiquadFilter();
  dragFilter.type = 'lowpass';
  dragFilter.frequency.value = DRAG_BASE_CUTOFF;
  dragFilter.Q.value = 0.7;
  dragOsc = ctx.createOscillator();
  dragOsc.type = 'triangle';
  dragOsc.frequency.value = DRAG_BASE_FREQ;
  dragOsc2 = ctx.createOscillator();
  dragOsc2.type = 'sine';
  dragOsc2.frequency.value = DRAG_BASE_FREQ * 1.5;
  dragOsc2.detune.value = 6;
  const osc2Gain = ctx.createGain();
  osc2Gain.gain.value = 0.35; // أخفت من الطبقة الأساسية — نسيج فقط
  dragOsc.connect(dragFilter);
  dragOsc2.connect(osc2Gain);
  osc2Gain.connect(dragFilter);
  dragFilter.connect(dragGain);
  dragGain.connect(masterGain);
  dragOsc.start();
  dragOsc2.start();
  dragGain.gain.setTargetAtTime(DRAG_MIN_GAIN, ctx.currentTime, 0.05);
  soundDebug('drag start');
}

// velocity01: سرعة مُطبَّعة 0..1 (مقصوصة من المستدعي) — كلما زادت، ارتفعت
// حدّة/سطوع الصوت قليلاً، بلا أي قفزة حادة (setTargetAtTime دائماً، لا
// setValueAtTime فوري، بند صريح بالمواصفة).
export function updateDragSound(velocity01) {
  if (!dragActive || !dragOsc || !dragFilter || !dragGain || !audioCtx) return;
  const v = Math.max(0, Math.min(1, velocity01));
  const now = audioCtx.currentTime;
  dragOsc.frequency.setTargetAtTime(DRAG_BASE_FREQ + v * DRAG_FREQ_RANGE, now, 0.08);
  dragOsc2.frequency.setTargetAtTime((DRAG_BASE_FREQ + v * DRAG_FREQ_RANGE) * 1.5, now, 0.08);
  dragFilter.frequency.setTargetAtTime(DRAG_BASE_CUTOFF + v * DRAG_CUTOFF_RANGE, now, 0.1);
  if (!muted) dragGain.gain.setTargetAtTime(DRAG_MIN_GAIN + v * (DRAG_MAX_GAIN - DRAG_MIN_GAIN), now, 0.1);
  soundDebug('drag velocity:', v.toFixed(2));
}

export function stopDragSound() {
  if (!dragActive || !audioCtx) { dragActive = false; return; }
  dragActive = false;
  soundDebug('drag stop');
  const ctx = audioCtx;
  const osc = dragOsc, osc2 = dragOsc2, gain = dragGain;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04); // يتلاشى خلال ~80-180ms (بند صريح)
  window.setTimeout(() => {
    try { osc.stop(); osc2.stop(); osc.disconnect(); osc2.disconnect(); gain.disconnect(); } catch { /* عقد قد تكون أُوقفت أصلاً */ }
  }, 200);
  dragOsc = null; dragOsc2 = null; dragFilter = null; dragGain = null;
}

export function isDragSoundActive() { return dragActive; }
