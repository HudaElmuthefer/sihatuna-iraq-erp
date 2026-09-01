// مصدر سرعة تفاعل واحد مُطبَّع (0..1) يُغذّي في آن واحد: توهّج حبل الطاقة،
// سطوع صوت السحب، وأي تأثير حركة أخرى — بند صريح بالمواصفة: "Sound And
// Laser Must Share Velocity... one normalized value... used for BOTH". لا
// React state هنا إطلاقاً (كائن عادي بذاكرة مغلقة/closure) — يُستدعى من
// معالجات pointermove مباشرة بمعدّل الإطار، لا يُسبِّب أي إعادة تصيير.
export function createVelocityTracker() {
  let lastX = null;
  let lastY = null;
  let lastT = null;
  return {
    update(x, y) {
      const now = performance.now();
      let v = 0;
      if (lastT != null) {
        const dt = Math.max(1, now - lastT);
        const dist = Math.hypot(x - lastX, y - lastY);
        const speed = dist / dt; // px/ms
        v = Math.max(0, Math.min(1, speed / 2.2)); // ~2.2px/ms يُعتبَر سريعاً جداً
      }
      lastX = x;
      lastY = y;
      lastT = now;
      return v;
    },
    reset() {
      lastX = null;
      lastY = null;
      lastT = null;
    },
  };
}
