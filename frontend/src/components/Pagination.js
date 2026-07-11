// frontend/src/components/Pagination.js
//
// شريط تصفح بسيط (السابق / أرقام الصفحات / التالي) — يُستخدم مع usePagination.
// يُخفي نفسه تلقائياً لو صفحة واحدة بس (لا داعي لعرضه لقوائم قصيرة).
import React from 'react';

export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize, lang = 'ar' }) {
  if (totalPages <= 1) return null;

  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  // نعرض أرقام صفحات محدودة حول الصفحة الحالية بدل كل الأرقام (تفادياً لشريط طويل جداً)
  const pageNumbers = [];
  const windowSize = 2;
  for (let i = Math.max(1, currentPage - windowSize); i <= Math.min(totalPages, currentPage + windowSize); i++) {
    pageNumbers.push(i);
  }

  const btnStyle = (active) => ({
    minWidth: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
    background: active ? 'var(--primary, #1a6bab)' : 'var(--bg-primary)',
    color: active ? '#fff' : 'var(--text-primary)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16, padding: '10px 4px' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {L(`عرض ${from}–${to} من ${totalItems}`, `Showing ${from}–${to} of ${totalItems}`)}
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} style={{ ...btnStyle(false), opacity: currentPage === 1 ? 0.4 : 1 }}>
          {L('السابق', 'Prev')}
        </button>
        {pageNumbers[0] > 1 && <span style={{ color: 'var(--text-secondary)' }}>…</span>}
        {pageNumbers.map(n => (
          <button key={n} onClick={() => onPageChange(n)} style={btnStyle(n === currentPage)}>{n}</button>
        ))}
        {pageNumbers[pageNumbers.length - 1] < totalPages && <span style={{ color: 'var(--text-secondary)' }}>…</span>}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} style={{ ...btnStyle(false), opacity: currentPage === totalPages ? 0.4 : 1 }}>
          {L('التالي', 'Next')}
        </button>
      </div>
    </div>
  );
}
