// frontend/src/components/PrintOptionsModal.js
//
// The pre-print options panel (header/footer/logo toggles + editable text,
// three-tier precedence: per-print > global Settings default > hardcoded
// default) — extracted out of PrintButton.js so pages with their own custom
// export flow (e.g. Smart Reports' "تصدير PDF" button) can reuse the exact
// same panel instead of rebuilding it, while still triggering the shared
// print-overlay mechanism owned by Layout.js.
import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';
import { getDefaultHeaderText, getDefaultFooterText } from '../utils/printDefaults';

export default function PrintOptionsModal({ show, onClose, onConfirm }) {
  const { lang, printSettings, appName } = useApp();
  const tr = useT(lang);
  const [options, setOptions] = useState(printSettings);
  // Snapshot of what "the default" resolved to when the panel was opened
  // (global override from Settings if set, else the original hardcoded
  // default) — kept separate from `options` so that clearing the text input
  // back to blank falls back to *this*, not straight to the hardcoded text,
  // preserving the header_text > global default > hardcoded precedence.
  const [resolvedDefaults, setResolvedDefaults] = useState({ header: '', footer: '' });

  // Re-resolve defaults every time the panel opens (not just on mount) so a
  // freshly-saved global default is picked up on the next open.
  React.useEffect(() => {
    if (!show) return;
    const header = (printSettings.headerText || '').trim() || getDefaultHeaderText(tr, appName);
    const footer = (printSettings.footerText || '').trim() || getDefaultFooterText(lang);
    setResolvedDefaults({ header, footer });
    setOptions({ ...printSettings, headerText: header, footerText: footer });
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const toggle = (key) => setOptions(p => ({ ...p, [key]: !p[key] }));
  const setText = (key, value) => setOptions(p => ({ ...p, [key]: value }));

  const confirm = () => {
    onConfirm({
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 16 }}>🖨️ {tr('print_options_title')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
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
          <button className="btn btn-outline" onClick={onClose}>{tr('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={confirm}>🖨️ {tr('print_confirm')}</button>
        </div>
      </div>
    </div>
  );
}
