// frontend/src/pages/MedicalCodesPage.js
//
// Lets staff add missing ICD-10 / SNOMED CT codes themselves, without
// needing a code change — directly answers "most diseases aren't in the
// list, I need a place to add more myself".
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';

export default function MedicalCodesPage() {
  const { lang, showToast } = useApp();
  const L = (ar, en) => (lang === 'ar' ? ar : en);

  const [system, setSystem] = useState('icd');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDiagnosisImport, setShowDiagnosisImport] = useState(false);
  const [form, setForm] = useState({ code: '', nameAr: '', nameEn: '', icdLink: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/medical-codes/browse?system=${system}&q=${encodeURIComponent(query.trim())}&page=${page}`)
      .then((data) => { setRows(data.data || []); setTotalPages(data.totalPages || 1); })
      .catch(() => { setRows([]); setTotalPages(1); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [system, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); load(); };

  const openAdd = () => { setForm({ code: '', nameAr: '', nameEn: '', icdLink: '' }); setShowAdd(true); };

  const save = async () => {
    if (!form.code.trim() || !form.nameAr.trim() || !form.nameEn.trim()) {
      showToast(L('الرمز والاسم بالعربي والإنكليزي مطلوبة', 'Code, Arabic name, and English name are required'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/medical-codes', { system, code: form.code, nameAr: form.nameAr, nameEn: form.nameEn, icdLink: system === 'snomed' ? form.icdLink : undefined });
      showToast(L('تمت إضافة الرمز', 'Code added'), 'success');
      setShowAdd(false);
      setPage(1);
      load();
    } catch {
      showToast(L('تعذّرت الإضافة', 'Could not add'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(L('حذف هذا الرمز؟', 'Delete this code?'))) return;
    try {
      await api.delete(`/medical-codes/${id}`);
      load();
    } catch {
      showToast(L('تعذّر الحذف', 'Could not delete'), 'error');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 4 }}>{L('إدارة رموز التصنيف الطبي', 'Medical Classification Codes')}</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>{L('ابحث عن رمز موجود، أو أضف رمزاً جديداً غير موجود بالقائمة.', 'Search for an existing code, or add a new one not in the list.')}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { setSystem('icd'); setPage(1); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: system === 'icd' ? '#1a6bab' : '#fff', color: system === 'icd' ? '#fff' : '#333', fontSize: 13 }}>ICD-10</button>
        <button onClick={() => { setSystem('snomed'); setPage(1); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: system === 'snomed' ? '#1a6bab' : '#fff', color: system === 'snomed' ? '#fff' : '#333', fontSize: 13 }}>SNOMED CT</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowImport(true)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #1a6bab', background: 'transparent', color: '#1a6bab', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>📊 {L('استيراد من Excel', 'Import from Excel')}</button>
        <ExcelExportButton apiName={`medical-codes-${system}`} lang={lang} onError={(m) => showToast(m, 'error')} />
        <button onClick={openAdd} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ {L('إضافة رمز جديد', 'Add New Code')}</button>
      </div>

      {/* ── ربط رموز بمرضى — مختلف عن إدارة قائمة الرموز نفسها أعلاه ── */}
      <div style={{ background: 'var(--bg-secondary, #f9fafb)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{L('ربط تشخيصات بمرضى', 'Link Diagnoses to Patients')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{L('يضيف رمزاً لملف مريض حقيقي — منفصل عن قائمة الرموز أعلاه، ويُستخدَم لتغذية تقرير "أكثر التشخيصات شيوعاً".', 'Adds a code to a real patient\'s file — separate from the code list above, feeds the "Most Common Diagnoses" report.')}</div>
        </div>
        <button onClick={() => setShowDiagnosisImport(true)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #7c3aed', background: 'transparent', color: '#7c3aed', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>📊 {L('استيراد دفعة من Excel', 'Bulk Import from Excel')}</button>
      </div>

      {showDiagnosisImport && (
        <ExcelImportModal
          apiName="patient-diagnoses"
          title={L('ربط تشخيصات ICD-10 بمرضى من Excel', 'Link ICD-10 Diagnoses to Patients from Excel')}
          lang={lang}
          onClose={() => setShowDiagnosisImport(false)}
          onImported={() => {}}
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="form-control" placeholder={L('ابحث بالرمز أو الاسم...', 'Search by code or name...')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        <button onClick={handleSearch} style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: '#1a6bab', color: '#fff', cursor: 'pointer' }}>{L('بحث', 'Search')}</button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{L('جارٍ التحميل...', 'Loading...')}</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{L('لا توجد نتائج — أضف رمزاً جديداً بالزر أعلاه.', 'No results — add a new code with the button above.')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
              <th style={{ textAlign: 'start', padding: 8 }}>{L('الرمز', 'Code')}</th>
              <th style={{ textAlign: 'start', padding: 8 }}>{L('بالعربي', 'Arabic')}</th>
              <th style={{ textAlign: 'start', padding: 8 }}>{L('بالإنكليزي', 'English')}</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                <td style={{ padding: 8, fontFamily: 'monospace', color: '#1a6bab' }}>{r.code}</td>
                <td style={{ padding: 8 }}>{r.nameAr}</td>
                <td style={{ padding: 8 }}>{r.nameEn}</td>
                <td style={{ padding: 8, textAlign: 'end' }}>
                  <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>‹</button>
          <span style={{ fontSize: 13, padding: '4px 8px' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>›</button>
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{ background: 'var(--bg-primary, #fff)', borderRadius: 14, padding: 24, width: 'min(420px, 90vw)' }}>
            <h3 style={{ margin: '0 0 16px' }}>{L('إضافة رمز جديد', 'Add New Code')} — {system === 'icd' ? 'ICD-10' : 'SNOMED CT'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>{L('الرمز', 'Code')}</label>
                <input className="form-control" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder={system === 'icd' ? 'J45' : '195967001'} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>{L('الاسم بالعربي', 'Arabic Name')}</label>
                <input className="form-control" value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>{L('الاسم بالإنكليزي', 'English Name')}</label>
                <input className="form-control" value={form.nameEn} onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))} />
              </div>
              {system === 'snomed' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>{L('رمز ICD المقابل (اختياري)', 'Matching ICD Code (Optional)')}</label>
                  <input className="form-control" value={form.icdLink} onChange={(e) => setForm((p) => ({ ...p, icdLink: e.target.value }))} placeholder="J45" />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', cursor: 'pointer' }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a6bab', color: '#fff', cursor: 'pointer' }}>{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}
      {showImport && (
        <ExcelImportModal
          apiName={`medical-codes-${system}`}
          title={L(`استيراد رموز ${system === 'icd' ? 'ICD-10' : 'SNOMED CT'} من Excel`, `Import ${system === 'icd' ? 'ICD-10' : 'SNOMED CT'} Codes from Excel`)}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={() => { setPage(1); load(); }}
        />
      )}
    </div>
  );
}
