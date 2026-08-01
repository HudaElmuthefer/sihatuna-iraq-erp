// backend/scripts/commit-icd-week.js
//
// Standalone, manually-run script. NOT imported or called from anywhere
// else in the app, and NOT run by Task Scheduler — you run this by hand,
// once a week, after spot-checking that week's daily review files.
//
// Finds every icd-translation-review-*.md file in the repo root (written
// by translate-icd-daily.js) and commits each one's exact, already-
// reviewed translations to medical_codes.name_ar — hardcoded to
// sihatuna_iraq_test ONLY. There is deliberately no --db override: this
// script can never target production, even by mistake.
//
// Safe to re-run: commitFromFile() only ever updates rows still at the
// untranslated placeholder (name_ar = name_en), so a review file already
// committed last week is silently skipped (0 updated) if processed again,
// never double-applied or overwritten. This means you don't need to track
// "which files were already committed" — just always process every file
// found; anything already done is a fast no-op.
//
// Usage:
//   node backend/scripts/commit-icd-week.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { commitFromFile } = require('./lib/icdTranslateShared');

const REPO_ROOT = path.join(__dirname, '..', '..');
const TARGET_DB = 'sihatuna_iraq_test'; // hardcoded on purpose — see comment above

async function main() {
  const files = fs.readdirSync(REPO_ROOT)
    .filter((f) => /^icd-translation-review-\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log('No icd-translation-review-*.md files found in the repo root — nothing to commit.');
    return;
  }

  console.log(`Target database: ${TARGET_DB} (hardcoded, never production)`);
  console.log(`Found ${files.length} review file(s):`);
  files.forEach((f) => console.log(`  - ${f}`));
  console.log('');

  let totalUpdated = 0;
  let totalSkipped = 0;
  for (const file of files) {
    const fullPath = path.join(REPO_ROOT, file);
    const { updated, skipped, total } = await commitFromFile(TARGET_DB, fullPath);
    console.log(`${file}: ${total} rows in file -> ${updated} updated, ${skipped} skipped (already translated or not found)`);
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log('\n--- Weekly commit summary ---');
  console.log(`Files processed: ${files.length}`);
  console.log(`Total rows updated: ${totalUpdated}`);
  console.log(`Total rows skipped (already committed previously, or code not found): ${totalSkipped}`);
  console.log(`\nDone — sihatuna_iraq_test now has this week's reviewed translations. Production is untouched.`);
}

main().catch((err) => {
  console.error('Weekly commit failed:', err.message);
  process.exit(1);
});
