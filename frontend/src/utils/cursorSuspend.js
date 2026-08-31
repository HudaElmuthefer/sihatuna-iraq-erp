// عدّاد مرجعي (reference count) بدل تبديل صنف مباشر — أكثر من مصدر واحد قد
// يطلب تعليق المؤشر المخصّص بالتوازي (مثلاً: لوحة منسدلة مفتوحة + المؤشر
// يمرّ فوق مقبض التمرير الخاص بها في نفس اللحظة). لو استخدم كل مصدر
// classList.add/remove مباشرة، إغلاق أحدهما كان يُعيد المؤشر المخصّص رغم
// بقاء الآخر يطلب التعليق. العدّاد يضمن ألا يُعاد المؤشر الأصلي إلا بعد
// توقّف كل الطلبات المعلَّقة.
let suspendCount = 0;

export function suspendCursor() {
  suspendCount += 1;
  document.documentElement.classList.add('custom-cursor-suspended');
}

export function restoreCursor() {
  suspendCount = Math.max(0, suspendCount - 1);
  if (suspendCount === 0) {
    document.documentElement.classList.remove('custom-cursor-suspended');
  }
}
