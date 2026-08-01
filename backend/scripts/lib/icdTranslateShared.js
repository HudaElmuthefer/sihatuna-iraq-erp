// backend/scripts/lib/icdTranslateShared.js
//
// Shared engine reused by three standalone scripts:
//   - translate-icd-arabic.js  (manual/ad-hoc CLI: calibration, --limit,
//     --offset-rows, --commit-from — everything used earlier this session)
//   - translate-icd-daily.js   (Task Scheduler entry point, zero args)
//   - commit-icd-week.js       (weekly manual commit to sihatuna_iraq_test)
//
// None of this is imported by the live app — same isolation principle as
// the rest of the ICD import/translate tooling (see import-icd-codes.js).
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// إصلاح: جُرِّب التبديل لـgemini-flash-latest لتفادي سقف 20 طلب/يوم على
// gemini-3-flash-preview المجاني، لكن مقارنة مباشرة على نفس الـ100 سطر
// كشفت أخطاء إملائية عربية منهجية (محدده بدل محددة، إلتهاب بدل التهاب،
// إسقاط "(eltor)" الموافَق عليه صراحة) — رُفض التبديل. مشكلة الفوترة لم
// تُحل أيضاً — نبقى على gemini-3-flash-preview المجاني نفسه (نفس النموذج
// المُختبَر والموافَق عليه بمعايرة الـ300 سطر الأصلية)، ونتعامل مع سقف
// الـ20 طلب/يوم عبر تجزئة يومية بدل محاولة تجاوزه.
const TRANSLATE_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

// الطبقة المجانية: السقف الفعلي 20 طلب/يوم إجمالاً (وليس معدلاً بالدقيقة)،
// فحتى فاصل متواضع هنا لا يقترب أبداً من أي حد آخر بهذا الحجم القليل يومياً.
const MIN_MS_BETWEEN_CALLS = 5000;

// ملف الحالة: cursorId (آخر معرّف صف "جديد" وصلنا إليه، نجح أو فشل — يتقدّم
// دائماً، لا يتكرر أبداً) وfailedCodes (أي رمز فشلت ترجمته بكل محاولاته
// الثلاث بيوم معيّن — تُعاد محاولتها تلقائياً بأول تشغيل لاحق، فلا يُفقَد أي
// رمز نهائياً حتى لو تعثّر يوماً كاملاً بسبب استنفاد الحصة كما حصل فعلياً
// أول يوم تشغيل).
const STATE_PATH = path.join(__dirname, '..', '..', '..', 'icd-arabic-daily-state.json');
const LOG_PATH = path.join(__dirname, '..', '..', '..', 'icd-translation-daily-log.md');
// حجم مجموعة بيانات ICD-10-CM المستورَدة بالكامل (import-icd-codes.js) —
// ثابت معروف، فقط لحساب "المترجَم تراكمياً" بسجل التقدّم اليومي.
const TOTAL_DATASET_ROWS = 73620;

function loadDailyState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { cursorId: 0, failedCodes: [], daysRun: 0 };
  }
}

function saveDailyState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SYSTEM_INSTRUCTION = `أنتِ مختصة بترجمة المصطلحات الطبية إلى العربية السريرية الفعلية (كما يكتبها الأطباء
ومسؤولو التسجيل الطبي الناطقون بالعربية في العراق/الخليج)، وليس ترجمة عامة أو أكاديمية حرفية.

قواعد ثابتة يجب اتباعها بدقة:
1. التزمي بنفس مصطلحات الجدول أدناه حرفياً أينما وردت، للحفاظ على الاتساق عبر آلاف الأسطر.
2. لا تكرري نفس الكلمة مرتين بنفس العبارة — استخدمي مرادفاً طبياً معترفاً به بدلاً من التكرار الحرفي
   (مثال: "biovar cholerae" -> "النمط الحيوي الكلاسيكي"، وليس تكرار اسم النوع).
3. للرموز من نوع "مراجعة لـ..." (encounter for...) وما شابهها من الرموز الإدارية: التزمي بالنص
   الحرفي، ولا تُضيفي أي تفصيل توضيحي غير موجود بالإنجليزية إلا إذا كان هو المصطلح الطبي العربي
   المعتمد فعلياً لتلك الحالة بالضبط.
4. المصطلحات غير القابلة للترجمة (أسماء أعلام مثل "torus fracture") تُترجَم بمصطلح عربي موجز
   يشرح المعنى مع إبقاء اللفظ الأجنبي بين قوسين عند الحاجة.

جدول مصطلحات ثابتة (استخدميها حرفياً):
| English | Arabic |
|---|---|
| initial encounter | مراجعة أولى |
| subsequent encounter | مراجعة لاحقة |
| sequela | عُقبى |
| displaced fracture | كسر مزاح |
| nondisplaced fracture | كسر غير مزاح |
| open fracture type I or II | كسر مفتوح من النمط الأول أو الثاني |
| malunion | التئام معيب |
| nonunion | عدم التئام |
| routine healing | التئام طبيعي (روتيني) |
| unspecified | غير محدد / غير محددة (حسب الجنس النحوي) |
| accidental (unintentional) | عرضي (غير مقصود) |

أعيدي الناتج كمصفوفة JSON فقط (بدون أي نص أو شرح خارجها)، بنفس الترتيب وبنفس العدد تماماً
المُرسَل، بهذا الشكل بالضبط: [{"code": "...", "ar": "..."}, ...]`;

function buildUserPrompt(rows) {
  const lines = rows.map((r) => `${r.code}: ${r.name_en}`).join('\n');
  return `ترجمي كل رمز ووصفه الإنجليزي التالي إلى وصف عربي سريري دقيق:\n\n${lines}`;
}

async function callGeminiBatch(rows) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TRANSLATE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: buildUserPrompt(rows) }] }],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      responseMimeType: 'application/json',
      // gemini-3-flash-preview يقبل thinkingBudget:0 مباشرة (بخلاف
      // gemini-flash-latest الذي رفضه بـ400 — جُرِّب ورُفِض التبديل).
      thinkingConfig: { thinkingBudget: 0 },
      // بدون maxOutputTokens صريح، القيمة الافتراضية كانت غير كافية لبعض
      // الدفعات (وصف إنجليزي أطول من المتوسط) — 8192 حد سخي جداً لـ100 سطر.
      maxOutputTokens: 8192,
    },
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini ${response.status}: ${errText.slice(0, 500)}`);
    // 429 حقيقي: رسالة الخادم نفسها تتضمّن "Please retry in Xs" (مهلة فعلية
    // من Google، وليست تخميناً) — نستخرجها ونحترمها حرفياً.
    if (response.status === 429) {
      const match = errText.match(/retry in ([\d.]+)s/i);
      if (match) err.retryAfterMs = Math.ceil(parseFloat(match[1]) * 1000) + 2000;
    }
    throw err;
  }
  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const finishReason = data.candidates?.[0]?.finishReason || 'unknown';
  if (!rawText) throw new Error(`Empty Gemini response (finishReason=${finishReason}): ${JSON.stringify(data).slice(0, 300)}`);
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (parseErr) {
    const debugPath = path.join(__dirname, '..', '..', '..', `icd-debug-failed-batch-${Date.now()}.txt`);
    fs.writeFileSync(debugPath, rawText, 'utf8');
    throw new Error(`Non-JSON Gemini response (finishReason=${finishReason}, length=${rawText.length}, parseError="${parseErr.message}"). Full text written to ${debugPath}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== rows.length) {
    throw new Error(`Expected ${rows.length} translations, got ${Array.isArray(parsed) ? parsed.length : typeof parsed}`);
  }
  const usage = data.usageMetadata || {};
  return {
    translations: parsed,
    promptTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    thoughtsTokens: usage.thoughtsTokenCount || 0,
  };
}

// Parses the "| Code | English | Proposed Arabic |" table this same engine
// writes in dry-run mode, back into { code, ar } rows — lets commitFromFile
// write the exact reviewed text without calling Gemini a second time.
function parseReviewMarkdown(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('| ') || line.startsWith('| Code') || line.startsWith('|---')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length !== 3) continue;
    const [code, , ar] = cells;
    rows.push({ code, ar });
  }
  return rows;
}

// Writes a review file's exact (already human-reviewed) translations to
// medical_codes.name_ar on `db`. Only ever overwrites rows still at the
// untranslated placeholder (name_ar = name_en) — safe to call more than
// once on the same file (already-committed codes are silently skipped, not
// re-written), which is what makes the weekly commit script idempotent.
async function commitFromFile(db, filePath) {
  const rows = parseReviewMarkdown(filePath);
  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: db,
  });
  await client.connect();
  let updated = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const res = await client.query(
        `UPDATE medical_codes SET name_ar = $1 WHERE system = 'icd' AND code = $2 AND name_ar = name_en`,
        [row.ar, row.code]
      );
      if (res.rowCount > 0) updated++; else skipped++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
  return { updated, skipped, total: rows.length };
}

// دورة يومية واحدة: تعيد محاولة أي رموز فشلت بيوم سابق أولاً (failedCodes)،
// ثم تكمل بصفوف جديدة (id > cursorId)، محدودة بعدد طلبات API حقيقي (وليس
// عدد دفعات مفترَض) — أي إعادة محاولة داخلية لدفعة تُحسَب من نفس ميزانية
// اليوم. لا تكتب لقاعدة البيانات إطلاقاً (dry run فقط) — تنتج ملف مراجعة
// مؤرَّخ وتُلحِق سطر ملخّص بسجل تراكمي، وتحدّث ملف الحالة.
async function runDailyBatch({ db, dailyRequests = 20, batchSize = 100, reviewPathPrefix, logPath }) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in backend/.env');
  }

  const state = loadDailyState();
  const today = new Date().toISOString().slice(0, 10);
  const prefix = reviewPathPrefix || path.join(__dirname, '..', '..', '..', 'icd-translation-review');
  const log = logPath || LOG_PATH;

  console.log(`Mode: DAILY BATCH (dry run only — no database writes)`);
  console.log(`Source database (read-only for English text): ${db}`);
  console.log(`Model: ${TRANSLATE_MODEL} (thinkingBudget: 0, free tier — 20 requests/day cap)`);
  console.log(`Day: ${today} | Run #${state.daysRun + 1} for this dataset`);
  console.log(`Resuming from cursorId: ${state.cursorId} | pending retries from prior days: ${state.failedCodes.length}`);

  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: db,
  });
  await client.connect();

  let freshRows;
  let totalRemaining;
  try {
    const freshRes = await client.query(
      `SELECT id, code, name_en FROM medical_codes
       WHERE system = 'icd' AND name_ar = name_en AND id > $1
       ORDER BY id LIMIT $2`,
      [state.cursorId, dailyRequests * batchSize]
    );
    freshRows = freshRes.rows;
    const totalRes = await client.query(
      `SELECT count(*) FROM medical_codes WHERE system = 'icd' AND name_ar = name_en AND id > $1`,
      [state.cursorId]
    );
    totalRemaining = parseInt(totalRes.rows[0].count, 10);
  } finally {
    await client.end();
  }

  const retryItems = state.failedCodes.map((c) => ({ code: c.code, name_en: c.name_en }));
  const freshItems = freshRows.map((r) => ({ code: r.code, name_en: r.name_en }));
  const workItems = [...retryItems, ...freshItems];

  console.log(`Retry queue: ${retryItems.length} | Fresh rows fetched: ${freshItems.length} | Total remaining (all days): ${totalRemaining + retryItems.length}`);

  const summary = {
    date: today,
    runNumber: state.daysRun + 1,
    requestsUsed: 0,
    rowsTranslatedToday: 0,
    pendingRetry: state.failedCodes.length,
    remainingAfterToday: totalRemaining + retryItems.length,
    reviewFile: null,
  };

  if (workItems.length === 0) {
    console.log('\nNothing left to translate — the full dataset is done!');
    appendLog(log, { ...summary, remainingAfterToday: 0, note: 'DATASET COMPLETE' });
    return summary;
  }

  const batches = [];
  for (let i = 0; i < workItems.length; i += batchSize) {
    batches.push(workItems.slice(i, i + batchSize));
  }

  const outPath = `${prefix}-${today}.md`;
  const lines = [
    `# ICD-10-CM Arabic Translation — Daily Batch (${today}, run #${state.daysRun + 1})`,
    '',
    '| Code | English | Proposed Arabic |',
    '|---|---|---|',
  ];

  let requestsUsedToday = 0;
  let rowsDone = 0;
  const stillFailed = new Map(state.failedCodes.map((c) => [c.code, c]));
  let maxFreshIdAttempted = state.cursorId;
  const freshIdByCode = new Map(freshRows.map((r) => [r.code, r.id]));

  const MAX_RETRIES_PER_BATCH = 3;
  for (const batch of batches) {
    if (requestsUsedToday >= dailyRequests) {
      console.log(`Daily request budget (${dailyRequests}) reached — stopping here, remaining rows saved for tomorrow.`);
      break;
    }

    let result = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_BATCH && requestsUsedToday < dailyRequests; attempt++) {
      requestsUsedToday++;
      try {
        result = await callGeminiBatch(batch);
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES_PER_BATCH && requestsUsedToday < dailyRequests) {
          const waitMs = err.retryAfterMs || MIN_MS_BETWEEN_CALLS;
          console.log(`  attempt ${attempt} failed (request ${requestsUsedToday}/${dailyRequests} used today), waiting ${(waitMs / 1000).toFixed(1)}s: ${err.message.slice(0, 150)}`);
          await sleep(waitMs);
        }
      }
    }

    for (const item of batch) {
      if (freshIdByCode.has(item.code)) {
        maxFreshIdAttempted = Math.max(maxFreshIdAttempted, freshIdByCode.get(item.code));
      }
    }

    if (!result) {
      console.log(`  Batch FAILED after exhausting today's attempts: ${lastErr.message.slice(0, 150)}`);
      for (const item of batch) stillFailed.set(item.code, item);
      continue;
    }

    const byCode = new Map(result.translations.map((t) => [t.code, t.ar]));
    for (const item of batch) {
      const ar = byCode.get(item.code);
      if (!ar) {
        stillFailed.set(item.code, item);
        continue;
      }
      stillFailed.delete(item.code);
      lines.push(`| ${item.code} | ${item.name_en.replace(/\|/g, '/')} | ${ar.replace(/\|/g, '/')} |`);
      rowsDone++;
    }

    if (requestsUsedToday < dailyRequests) await sleep(MIN_MS_BETWEEN_CALLS);
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  const newState = {
    cursorId: maxFreshIdAttempted,
    failedCodes: [...stillFailed.values()],
    daysRun: state.daysRun + 1,
  };
  saveDailyState(newState);

  const advancedFreshCount = freshItems.filter((it) => freshIdByCode.get(it.code) <= maxFreshIdAttempted).length;
  // إصلاح: remainingAfterToday يحتسب أصلاً failedCodes.length ضمنه (الصفوف
  // الفاشلة "متبقّية" بمعنى لم تُترجَم بعد) — طرحها مرة ثانية هنا كان يُنتج
  // رقماً سالباً خاطئاً بالسجل (-700 لُوحِظ فعلياً). الصيغة الصحيحة: كل ما
  // تبقّى (سواء صفوف جديدة لم نصلها بعد، أو صفوف بقائمة إعادة المحاولة)
  // يُحسَب مرة واحدة فقط.
  const remainingAfterToday = Math.max(totalRemaining - advancedFreshCount + newState.failedCodes.length, 0);
  const cumulativeTranslated = TOTAL_DATASET_ROWS - remainingAfterToday;

  console.log('\n--- Daily batch summary ---');
  console.log(`Requests used today: ${requestsUsedToday} / ${dailyRequests}`);
  console.log(`Rows translated today: ${rowsDone}`);
  console.log(`Rows now pending retry (carried to next run): ${newState.failedCodes.length}`);
  console.log(`Review file written: ${outPath}`);
  console.log(`Estimated rows still remaining after today: ~${remainingAfterToday} (~${Math.ceil(remainingAfterToday / (dailyRequests * batchSize))} more daily runs)`);
  console.log('\nDry run complete. No database writes were made.');

  summary.requestsUsed = requestsUsedToday;
  summary.rowsTranslatedToday = rowsDone;
  summary.pendingRetry = newState.failedCodes.length;
  summary.remainingAfterToday = remainingAfterToday;
  summary.reviewFile = outPath;
  summary.cumulativeTranslated = cumulativeTranslated;
  summary.estimatedDaysLeft = Math.ceil(remainingAfterToday / (dailyRequests * batchSize));

  appendLog(log, summary);
  return summary;
}

function appendLog(logPath, summary) {
  const line = summary.note
    ? `| ${summary.date} | run #${summary.runNumber} | — | — | — | ${summary.note} |\n`
    : `| ${summary.date} | run #${summary.runNumber} | ${summary.rowsTranslatedToday} | ${summary.cumulativeTranslated ?? '—'} | ${summary.remainingAfterToday} | ~${summary.estimatedDaysLeft ?? '—'} days |\n`;
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(
      logPath,
      '# ICD-10-CM Arabic Translation — Daily Log\n\n' +
      '| Date | Run | Rows Today | Cumulative Translated | Rows Remaining | Est. Days Left |\n' +
      '|---|---|---|---|---|---|\n' + line,
      'utf8'
    );
  } else {
    fs.appendFileSync(logPath, line, 'utf8');
  }
}

module.exports = {
  GEMINI_API_KEY,
  TRANSLATE_MODEL,
  MIN_MS_BETWEEN_CALLS,
  STATE_PATH,
  LOG_PATH,
  loadDailyState,
  saveDailyState,
  sleep,
  callGeminiBatch,
  parseReviewMarkdown,
  commitFromFile,
  runDailyBatch,
};
