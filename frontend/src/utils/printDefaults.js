// frontend/src/utils/printDefaults.js
//
// Single source of truth for the print header/footer's *original hardcoded*
// fallback text — used by PrintButton.js (to pre-fill the per-print text
// inputs) and SettingsPage.js (to show what the global default falls back to
// when left blank). Keeping this in one place avoids the two screens drifting
// out of sync on what "the default" actually is.
//
// appNameText: the resolved (possibly admin-customized) app name for the
// current language — see AppContext.js's `appName`. Passed in rather than
// read from translations.js directly so this stays in sync with the editable
// app name setting automatically, same precedence everywhere: per-print
// override > global Print Settings override > this (app-name-aware) default.
export function getDefaultHeaderText(tr, appNameText) {
  return `${appNameText} ERP — ${tr('app_subtitle')}`;
}

export function getDefaultFooterText(lang) {
  const now = new Date();
  return lang === 'ar'
    ? `طُبع بتاريخ ${now.toLocaleString('ar-IQ')}`
    : `Printed on ${now.toLocaleString('en-US')}`;
}
