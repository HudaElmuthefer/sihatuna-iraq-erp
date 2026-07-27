// frontend/src/components/PrintButton.js
//
// Universal "Print to PDF" button — rendered once in Layout.js's header so it
// appears on every page automatically (see Layout.js), instead of being
// copy-pasted into each page component. This component only collects the
// per-print overrides (header/footer/logo) via a small options panel; the
// actual print mechanics (marking chrome as .no-print, wrapping page content
// in .printable-content, rendering the print-only header/footer blocks) live
// in Layout.js, since that's the component that owns the surrounding DOM
// structure being printed.
import React, { useState } from 'react';
import { FaPrint } from 'react-icons/fa';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';
import { getDefaultHeaderText, getDefaultFooterText } from '../utils/printDefaults';

export default function PrintButton({ hidden, onPrint }) {
  const { lang, printSettings } = useApp();
  const tr = useT(lang);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState(printSettings);
  // Snapshot of what "the default" resolved to when the panel was opened
  // (global override from Settings if set, else the original hardcoded
  // default) — kept separate from `options` so that clearing the text input
  // back to blank falls back to *this*, not straight to the hardcoded text,
  // preserving the header_text > global default > hardcoded precedence.
  const [resolvedDefaults, setResolvedDefaults] = useState({ header: '', footer: '' });

  if (hidden) return null;

  const openPanel = () => {
    // Always start from the current global defaults — toggling/editing below
    // never writes back to printSettings, it only affects this one print.
    const header = (printSettings.headerText || '').trim() || getDefaultHeaderText(tr);
    const footer = (printSettings.footerText || '').trim() || getDefaultFooterText(lang);
    setResolvedDefaults({ header, footer });
    setOptions({ ...printSettings, headerText: header, footerText: footer });
    setShowOptions(true);
  };

  const toggle = (key) => setOptions(p => ({ ...p, [key]: !p[key] }));
  const setText = (key, value) => setOptions(p => ({ ...p, [key]: value }));

  const confirmPrint = () => {
    setShowOptions(false);
    onPrint({
      includeHeader: options.includeHeader,
      includeFooter: options.includeFooter,
      includeLogo: options.includeLogo,
      // Empty/unchanged field → fall back to whatever this panel resolved as
      // "the default" when it opened (global override, or else hardcoded).
      headerText: options.headerText.trim() || resolvedDefaults.header,
      footerText: options.footerText.trim() || resolvedDefaults.footer,
    });
  };

  return (
    <>
      <button
        onClick={openPanel}
        title={tr('btn_print')}
        style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <FaPrint />
      </button>

      {showOptions && (
        <div className="modal-overlay" onClick={() => setShowOptions(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>🖨️ {tr('print_options_title')}</h3>
              <button onClick={() => setShowOptions(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {tr('print_options_desc')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={options.includeHeader} onChange={() => toggle('includeHeader')} />
                  {tr('print_include_header')}
                </label>
                {options.includeHeader && (
                  <div style={{ marginInlineStart: 24 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{tr('print_header_text')}</label>
                    <input
                      type="text"
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      value={options.headerText}
                      onChange={e => setText('headerText', e.target.value)}
                      className="form-control"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={options.includeFooter} onChange={() => toggle('includeFooter')} />
                  {tr('print_include_footer')}
                </label>
                {options.includeFooter && (
                  <div style={{ marginInlineStart: 24 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{tr('print_footer_text')}</label>
                    <input
                      type="text"
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      value={options.footerText}
                      onChange={e => setText('footerText', e.target.value)}
                      className="form-control"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={options.includeLogo} onChange={() => toggle('includeLogo')} />
                  {tr('print_include_logo')}
                </label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                  {tr('print_logo_note')}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowOptions(false)}>{tr('btn_cancel')}</button>
              <button className="btn btn-primary" onClick={confirmPrint}>🖨️ {tr('print_confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
