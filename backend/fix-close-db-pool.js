// fix-close-db-pool.js
//
// سكربت لمرة واحدة: يمرّ على كل ملفات backend/tests/*.test.js ويضيف تلقائياً
// استدعاء closeDbPool() داخل afterAll، حتى Jest يقدر يخرج (exit) طبيعياً بعد
// انتهاء الاختبارات بدل ما يعلّق منتظراً اتصال PostgreSQL مفتوح.
//
// طريقة التشغيل:
//   1) انسخي هذا الملف داخل مجلد backend (نفس مستوى مجلد tests)
//   2) من الطرفية (PowerShell) داخل مجلد backend:
//        node fix-close-db-pool.js
//   3) السكربت يطبع تقرير: أي ملف عُدِّل، وأي ملف تجاهله (ولماذا) — راجعي
//      الملفات المتجاهَلة يدوياً إذا وُجدت.
//
// آمن: يعمل نسخة احتياطية (.bak) من كل ملف قبل تعديله.

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'tests');
const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.js'));

let modified = 0;
let skippedNoImport = 0;
let skippedNoAfterAll = 0;
let skippedAlreadyDone = 0;

for (const file of files) {
  const filePath = path.join(testsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // لو الملف ما يستورد شي من testUtils أصلاً (نادر لكن ممكن)، تجاهليه
  if (!content.includes("require('./testUtils')")) {
    console.log(`⏭️  تجاهلته (لا يستورد testUtils): ${file}`);
    skippedNoImport++;
    continue;
  }

  // لو already فيه closeDbPool مُضاف مسبقاً، تجاهليه (تجنّب التكرار لو شغّلنا السكربت مرتين)
  if (content.includes('closeDbPool')) {
    console.log(`✅ متجاهَل (معدَّل مسبقاً): ${file}`);
    skippedAlreadyDone++;
    continue;
  }

  // 1) إضافة closeDbPool لسطر الاستيراد
  //    يطابق أي تركيبة من: setupTestEnv, cleanupTestEnv, assertPgAvailable (بأي ترتيب)
  const importRegex = /require\(['"]\.\/testUtils['"]\)/;
  if (importRegex.test(content)) {
    content = content.replace(
      /const\s*\{([^}]+)\}\s*=\s*require\(['"]\.\/testUtils['"]\)/,
      (match, names) => {
        const trimmedNames = names.trim().replace(/,\s*$/, '');
        return `const { ${trimmedNames}, closeDbPool } = require('./testUtils')`;
      }
    );
  }

  // 2) إضافة استدعاء closeDbPool() داخل afterAll
  //    يطابق: afterAll(() => { ... }); أو afterAll(async () => { ... });
  const afterAllRegex = /afterAll\((async\s*)?\(\)\s*=>\s*\{([\s\S]*?)\}\);/;
  const afterAllMatch = content.match(afterAllRegex);

  if (!afterAllMatch) {
    console.log(`⚠️  لم أجد afterAll بصيغة متوقَّعة — راجعيه يدوياً: ${file}`);
    skippedNoAfterAll++;
    continue;
  }

  const isAsync = !!afterAllMatch[1];
  const body = afterAllMatch[2];
  const newBody = isAsync
    ? `${body}\n  await closeDbPool();\n`
    : `${body}\n  await closeDbPool();\n`; // نضيف await دائماً، ونجعل afterAll نفسه async بالخطوة التالية

  const newAfterAll = `afterAll(async () => {${newBody}});`;
  content = content.replace(afterAllRegex, newAfterAll);

  // نسخة احتياطية قبل الكتابة
  fs.writeFileSync(filePath + '.bak', fs.readFileSync(filePath));
  fs.writeFileSync(filePath, content, 'utf8');

  console.log(`✏️  عُدِّل بنجاح: ${file}`);
  modified++;
}

console.log('\n──────────── التقرير النهائي ────────────');
console.log(`✏️  عُدِّلت: ${modified}`);
console.log(`✅ متجاهَلة (معدَّلة مسبقاً): ${skippedAlreadyDone}`);
console.log(`⏭️  متجاهَلة (لا تستورد testUtils): ${skippedNoImport}`);
console.log(`⚠️  تحتاج مراجعة يدوية (afterAll غير قياسي): ${skippedNoAfterAll}`);
console.log('───────────────────────────────────────────');
console.log('\nبعد المراجعة، احذفي ملفات .bak إذا كل شي تمام:');
console.log('  Get-ChildItem tests\\*.bak | Remove-Item');
