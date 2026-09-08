// frontend/src/components/DiagnosisPicker.js
//
// A real clinical-style diagnosis picker: search ICD-10 or SNOMED CT by
// name or code, add multiple diagnoses per patient (not just one), mark
// one as primary. This is what makes the coding actually useful —
// structured, searchable data instead of a single free-text field.
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../api';

// diagnoses shape: [{ id, icdCode, icdNameAr, icdNameEn, snomedCode, snomedNameAr, snomedNameEn, isPrimary, dateAdded }]
export default function DiagnosisPicker({ diagnoses, onChange, lang }) {
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [system, setSystem] = useState('icd'); // icd | snomed
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  // ── إصلاح: هذا الحقل يُستخدَم دائماً ضمن نموذج داخل .modal (راجع
  // PatientsPage.js) — و.modal له overflow خاص بالتمرير، وبالوضع الليلي
  // الصفحة الموجَّهة كلها تُلَفّ إضافياً بـCentralHolographicWorkspace
  // (.chw-shell، له overflow:hidden تزييني — راجع الشرح المفصَّل بـ
  // ResultsPage.js). القائمة كانت position:absolute عادية فتُقَصّ بأي من
  // الاثنين. نفس حل HeaderFloatingPanel.js: بوابة مباشرة لـdocument.body
  // بموضع مقيس فعلياً (fixed)، تتخطى كل الأسلاف دفعة واحدة.
  const wrapperRef = useRef(null);
  const [suggestRect, setSuggestRect] = useState(null);
  useLayoutEffect(() => {
    if (!showSuggestions || !wrapperRef.current) { setSuggestRect(null); return undefined; }
    const measure = () => setSuggestRect(wrapperRef.current.getBoundingClientRect());
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [showSuggestions]);

  useEffect(() => {
    if (!showSuggestions) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get(`/medical-codes/search?system=${system}&q=${encodeURIComponent(query.trim())}`)
        .then((data) => setSuggestions(Array.isArray(data) ? data : []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, system, showSuggestions]);

  const addDiagnosis = (item) => {
    const already = diagnoses.some((d) => (system === 'icd' ? d.icdCode : d.snomedCode) === item.code);
    if (already) { setQuery(''); setShowSuggestions(false); return; }

    const entry = system === 'icd'
      ? { id: Date.now(), icdCode: item.code, icdNameAr: item.nameAr, icdNameEn: item.nameEn, snomedCode: '', snomedNameAr: '', snomedNameEn: '', isPrimary: diagnoses.length === 0, dateAdded: new Date().toISOString().split('T')[0] }
      : { id: Date.now(), icdCode: '', icdNameAr: '', icdNameEn: '', snomedCode: item.code, snomedNameAr: item.nameAr, snomedNameEn: item.nameEn, isPrimary: diagnoses.length === 0, dateAdded: new Date().toISOString().split('T')[0] };

    onChange([...diagnoses, entry]);
    setQuery('');
    setShowSuggestions(false);
  };

  const removeDiagnosis = (id) => {
    const remaining = diagnoses.filter((d) => d.id !== id);
    // لو حذفنا التشخيص الأساسي، نجعل أول تشخيص متبقٍ (إن وُجد) هو الأساسي تلقائياً
    if (remaining.length > 0 && !remaining.some((d) => d.isPrimary)) remaining[0].isPrimary = true;
    onChange(remaining);
  };

  const setPrimary = (id) => {
    onChange(diagnoses.map((d) => ({ ...d, isPrimary: d.id === id })));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => setSystem('icd')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: system === 'icd' ? '#1a6bab' : '#fff', color: system === 'icd' ? '#fff' : '#333', fontSize: 12 }}>ICD-10</button>
        <button type="button" onClick={() => setSystem('snomed')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: system === 'snomed' ? '#1a6bab' : '#fff', color: system === 'snomed' ? '#fff' : '#333', fontSize: 12 }}>SNOMED CT</button>
      </div>

      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <input
          className="form-control"
          placeholder={L('ابحث عن تشخيص بالاسم أو الرمز...', 'Search diagnosis by name or code...')}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
        />
      </div>
      {showSuggestions && suggestRect && ReactDOM.createPortal(
        // إصلاح تباين الوضع الليلي: كانت الخلفية بيضاء ثابتة (#fff) بينما
        // النص يرث color:var(--text-primary) من body — بالوضع الليلي هذه
        // القيمة فاتحة تقريباً، فيصير النص غير مقروء على الخلفية البيضاء
        // الثابتة. var(--bg-card)/var(--border) نفس المتغيرات المستخدَمة
        // بكل القوائم المنسدلة المشابهة الأخرى بالتطبيق.
        // إصلاح: نفس خلل ResultsPage.js — position:fixed بارتفاع ثابت يتجاوز
        // أسفل الشاشة المرئية يُرسَم خارجها فعلياً بلا أي تمرير يقدر يظهره
        // (لا الصفحة ولا القائمة نفسها). نحسب أقصى ارتفاع متاح حتى أسفل
        // الشاشة (بهامش 16px) بدل رقم ثابت.
        <div style={{ position: 'fixed', top: suggestRect.bottom + 4, left: suggestRect.left, width: suggestRect.width, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 2000, maxHeight: Math.max(120, Math.min(260, window.innerHeight - suggestRect.bottom - 16)), overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {suggestions.length === 0 ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text-secondary)' }}>{L('لا توجد نتائج', 'No results')}</div>
          ) : suggestions.map((s) => (
            <div key={s.code} onClick={() => addDiagnosis(s)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontFamily: 'monospace', color: '#1a6bab', marginInlineEnd: 8 }}>{s.code}</span>
              {L(s.nameAr, s.nameEn)}
            </div>
          ))}
          <div style={{ padding: '6px 12px', textAlign: 'center' }}>
            <button type="button" onClick={() => setShowSuggestions(false)} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>{L('إغلاق', 'Close')}</button>
          </div>
        </div>,
        document.body
      )}

      {diagnoses.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {diagnoses.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: d.isPrimary ? '#eff6ff' : '#fff' }}>
              <input type="radio" checked={d.isPrimary} onChange={() => setPrimary(d.id)} title={L('تشخيص أساسي', 'Primary diagnosis')} />
              <div style={{ flex: 1, fontSize: 13 }}>
                {d.icdCode && <span><span style={{ fontFamily: 'monospace', color: '#1a6bab' }}>{d.icdCode}</span> {L(d.icdNameAr, d.icdNameEn)}</span>}
                {d.snomedCode && <span><span style={{ fontFamily: 'monospace', color: '#7c3aed' }}>{d.snomedCode}</span> {L(d.snomedNameAr, d.snomedNameEn)}</span>}
                {d.isPrimary && <span style={{ fontSize: 10, background: '#1a6bab', color: '#fff', padding: '1px 6px', borderRadius: 4, marginInlineStart: 6 }}>{L('أساسي', 'Primary')}</span>}
              </div>
              <button type="button" onClick={() => removeDiagnosis(d.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
