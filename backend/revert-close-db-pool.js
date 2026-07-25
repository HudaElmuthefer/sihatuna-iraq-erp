// revert-close-db-pool.js
//
// يعكس ما فعله fix-close-db-pool.js: يزيل استدعاء closeDbPool() من afterAll
// ويزيل استيرادها، بكل ملفات backend/tests/*.test.js. نحتاج هذا لأن إغلاق
// pool بعد كل ملف اختبار على حدة يكسر الملفات التالية عندما تعمل الاختبارات
// بنفس العملية (jest --runInBand) — الحل الصحيح هو إغلاق pool مرة واحدة فقط
// بعد انتهاء كل الاختبارات، عبر globalTeardown (ملف منفصل).
//
// طريقة التشغيل: نفس طريقة fix-close-db-pool.js
//   node revert-close-db-pool.js

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'tests');
const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.js'));

let reverted = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(testsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('closeDbPool')) {
    skipped++;
    continue;
  }

  // 1) إزالة closeDbPool من سطر الاستيراد
  content = content.replace(/,\s*closeDbPool\s*\}\s*=\s*require\(['"]\.\/testUtils['"]\)/, ' } = require(\'./testUtils\')');

  // 2) إزالة استدعاء "await closeDbPool();" (مع السطر الفارغ المحتمل قبله)
  content = content.replace(/\n\s*await closeDbPool\(\);\s*\n/, '\n');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`↩️  أُعيد بنجاح: ${file}`);
  reverted++;
}

console.log('\n──────────── التقرير النهائي ────────────');
console.log(`↩️  أُعيدت: ${reverted}`);
console.log(`⏭️  متجاهَلة (لا تحتوي closeDbPool أصلاً): ${skipped}`);
console.log('───────────────────────────────────────────');
