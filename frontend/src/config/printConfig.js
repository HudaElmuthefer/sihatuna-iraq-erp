// frontend/src/config/printConfig.js
//
// Routes where a page already ships its own print/export flow (Results page's
// per-report/combined print, Smart Reports' export-to-PDF button). The global
// PrintButton in Layout.js is suppressed on these routes to avoid two
// competing "print" actions on the same screen. Add a route here whenever a
// new page grows its own custom print/export logic instead of using the
// universal PrintButton.
export const PRINT_BUTTON_HIDDEN_ROUTES = ['/results', '/smart-reports'];

export function isPrintButtonHidden(pathname) {
  return PRINT_BUTTON_HIDDEN_ROUTES.includes(pathname);
}
