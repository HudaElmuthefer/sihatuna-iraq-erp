// frontend/src/components/PrintButton.js
//
// Universal "Print to PDF" button — rendered once in Layout.js's header so it
// appears on every page automatically (see Layout.js), instead of being
// copy-pasted into each page component. This component only opens the shared
// pre-print options panel (see PrintOptionsModal.js) to collect the per-print
// overrides (header/footer/logo); the actual print mechanics (marking chrome
// as .no-print, wrapping page content in .printable-content, rendering the
// print-only header/footer blocks) live in Layout.js, since that's the
// component that owns the surrounding DOM structure being printed.
import React, { useState } from 'react';
import { FaPrint } from 'react-icons/fa';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import PrintOptionsModal from './PrintOptionsModal';

export default function PrintButton({ hidden, onPrint }) {
  const { lang } = useApp();
  const tr = useT(lang);
  const [showOptions, setShowOptions] = useState(false);

  if (hidden) return null;

  const confirmPrint = (options) => {
    setShowOptions(false);
    onPrint(options);
  };

  return (
    <>
      <button
        onClick={() => setShowOptions(true)}
        title={tr('btn_print')}
        style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <FaPrint />
      </button>

      <PrintOptionsModal show={showOptions} onClose={() => setShowOptions(false)} onConfirm={confirmPrint} />
    </>
  );
}
