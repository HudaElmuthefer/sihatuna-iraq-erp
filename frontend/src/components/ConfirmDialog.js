import React from 'react';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';

// نافذة تأكيد عامة واحدة تُعرَض فوق أي صفحة — تقرأ confirmState من AppContext
// (يضبطها استدعاء confirmDialog(message) من أي مكان بالتطبيق) وتحل الـ Promise
// بـ true/false حسب ضغطة المستخدم. راجعي تعليق confirmDialog بـ AppContext.js.
export default function ConfirmDialog() {
  const { confirmState, resolveConfirm, lang } = useApp();
  const tr = useT(lang);
  if (!confirmState) return null;

  return (
    <div className="modal-overlay" onClick={() => resolveConfirm(false)}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>{tr('x_takidalhdhf')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, whiteSpace: 'pre-line' }}>
            {confirmState.message || tr('x_hlantmtakd_laimknaltraja')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => resolveConfirm(false)}>{tr('btn_cancel')}</button>
            <button className="btn btn-danger" onClick={() => resolveConfirm(true)}>{tr('btn_delete')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
