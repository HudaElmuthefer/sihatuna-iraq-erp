// نظام الأصوات الهولوغرافية — Web Audio API خالص (بلا أي ملفات صوتية
// خارجية أو محتوى محمي بحقوق نشر)، نغمات قصيرة زجاجية رقمية أصلية مُركَّبة
// عبر OscillatorNode/GainNode بسياق واحد مُعاد استخدامه (لا AudioContext
// جديد لكل تشغيل). موديول عادي (لا React) — مصدر الحقيقة الوحيد لحالة
// الكتم أيضاً، حتى يبقى متسقاً بين أي مكوّن يقرأه (راجع useHolographicSound.js).
const MUTE_KEY = 'sihatuna-holographic-sound-muted';
const MASTER_VOLUME = 0.16; // بند صريح: 0.12-0.22

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

export function playSnap() {
  // نقرة مغناطيسية ناعمة — الحلقة استقرّت على أقرب لوحة بعد سحب/عجلة.
  play(ctx => {
    tone(ctx, { freq: 520, duration: 0.08, type: 'triangle', peak: 0.4 });
  });
}

export function playOpen() {
  // نغمة صاعدة قصيرة — لوحة تنفصل وتتوسّع لمساحة العمل.
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
