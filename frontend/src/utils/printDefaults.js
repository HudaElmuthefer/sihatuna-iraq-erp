// frontend/src/utils/printDefaults.js
//
// Single source of truth for the print header/footer's *original hardcoded*
// fallback text — used by PrintButton.js (to pre-fill the per-print text
// inputs) and SettingsPage.js (to show what the global default falls back to
// when left blank). Keeping this in one place avoids the two screens drifting
// out of sync on what "the default" actually is.
export function getDefaultHeaderText(tr) {
  return `${tr('app_name')} — ${tr('app_subtitle')}`;
}

export function getDefaultFooterText(lang) {
  const now = new Date();
  return lang === 'ar'
    ? `طُبع بتاريخ ${now.toLocaleString('ar-IQ')}`
    : `Printed on ${now.toLocaleString('en-US')}`;
}
