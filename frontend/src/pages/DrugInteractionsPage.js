import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { FaPlus, FaTimes, FaExclamationTriangle, FaCheckCircle, FaSearch } from 'react-icons/fa';

const drugDatabaseBilingual = [
  {ar:'أسبرين',en:'Aspirin'},{ar:'إيبوبروفين',en:'Ibuprofen'},{ar:'باراسيتامول',en:'Paracetamol'},
  {ar:'أموكسيسيلين',en:'Amoxicillin'},{ar:'سيبروفلوكساسين',en:'Ciprofloxacin'},
  {ar:'ميتفورمين',en:'Metformin'},{ar:'ليسينوبريل',en:'Lisinopril'},{ar:'أتورفاستاتين',en:'Atorvastatin'},
  {ar:'أوميبرازول',en:'Omeprazole'},{ar:'لوزارتان',en:'Losartan'},{ar:'ألوبيورينول',en:'Allopurinol'},
  {ar:'ميترونيدازول',en:'Metronidazole'},{ar:'كلاريثروميسين',en:'Clarithromycin'},
  {ar:'ديكلوفيناك',en:'Diclofenac'},{ar:'ريفامبيسين',en:'Rifampicin'},
  {ar:'وارفارين',en:'Warfarin'},{ar:'هيبارين',en:'Heparin'},{ar:'أملوديبين',en:'Amlodipine'},
  {ar:'بيتافيرون',en:'Betaferon'},{ar:'بروبرانولول',en:'Propranolol'}
];
// Internal keys always Arabic for interaction matching


const interactions = [
  { drugs: ['أسبرين', 'وارفارين'], severity: 'high', effectAr: 'زيادة خطر النزيف بشكل كبير', effectEn: 'Significantly increases bleeding risk', recAr: 'تجنب الاستخدام المشترك أو مراقبة دقيقة', recEn: 'Avoid combined use or monitor closely' },
  { drugs: ['إيبوبروفين', 'ليسينوبريل'], severity: 'med', effectAr: 'إضعاف تأثير مخفض ضغط الدم', effectEn: 'Reduces effectiveness of blood pressure medication', recAr: 'استخدم باراسيتامول بديلاً', recEn: 'Use paracetamol as an alternative' },
  { drugs: ['ميتفورمين', 'ألوبيورينول'], severity: 'low', effectAr: 'قد يزيد من تأثير خفض السكر', effectEn: 'May enhance blood sugar lowering effect', recAr: 'مراقبة مستوى السكر بانتظام', recEn: 'Monitor blood sugar regularly' },
  { drugs: ['سيبروفلوكساسين', 'ريفامبيسين'], severity: 'high', effectAr: 'تقليل فعالية المضاد الحيوي بشكل حاد', effectEn: 'Severely reduces antibiotic effectiveness', recAr: 'تجنب الاستخدام المشترك', recEn: 'Avoid combined use' },
  { drugs: ['أوميبرازول', 'كلاريثروميسين'], severity: 'low', effectAr: 'زيادة مستوى الأوميبرازول في الدم', effectEn: 'Increases omeprazole blood levels', recAr: 'مراقبة الآثار الجانبية', recEn: 'Monitor for side effects' },
];

export default function DrugInteractionsPage() {
  const { showToast, lang } = useApp();
  const tr = useT(lang);
  const [selectedDrugs, setSelectedDrugs] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [checked, setChecked] = useState(false);

  // filtered now inline above
  const filtered = drugDatabaseBilingual.filter(d =>
    ((lang==='ar'?d.ar:d.en).toLowerCase().includes(search.toLowerCase()) || d.ar.includes(search))
    && !selectedDrugs.includes(d.ar)
  );

  const addDrug = (d) => { setSelectedDrugs(p => [...p, d]); setSearch(''); setResults(null); setChecked(false); };
  const removeDrug = (d) => { setSelectedDrugs(p => p.filter(x => x !== d)); setResults(null); setChecked(false); };

  const checkInteractions = () => {
    if (selectedDrugs.length < 2) { showToast(tr('drug_no_drugs'), 'error'); return; }
    const found = [];
    interactions.forEach(inter => {
      const match = inter.drugs.every(d => selectedDrugs.includes(d));
      if (match) found.push(inter);
    });
    setResults(found);
    setChecked(true);
  };

  const sevColor = (s) => ({ high: '#ef4444', med: '#f59e0b', low: '#22c55e' }[s] || '#6b7280');
  const sevLabel = (s) => ({ high: tr('drug_severity_high'), med: tr('drug_severity_med'), low: tr('drug_severity_low') }[s] || s);

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4c0519 0%, #9f1239 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 40 }}>💊</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{tr('drug_title')}</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 13 }}>{tr('drug_subtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left - Drug selector */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{tr('auto_pair_120')}</h3>

            {/* Selected drugs */}
            {selectedDrugs.length > 0 && (
              <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedDrugs.map(ar => {
                  const d = drugDatabaseBilingual.find(x => x.ar === ar) || { ar, en: ar };
                  return (
                    <span key={ar} style={{ background: '#1a6bab', color: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {lang === 'ar' ? d.ar : d.en} <FaTimes size={10} style={{ cursor: 'pointer' }} onClick={() => removeDrug(ar)} />
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <FaSearch style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tr('drug_add_placeholder')}
                className="form-control"
                style={{ paddingRight: 36 }}
              />
            </div>

            {/* Suggestions */}
            {search && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                {filtered.slice(0, 8).map(d => (
                  <div key={d.ar} onClick={() => addDrug(d.ar)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span>{lang==='ar'?d.ar:d.en}</span>
                    <FaPlus size={12} color="#1a6bab" />
                  </div>
                ))}
                {filtered.length === 0 && <div style={{ padding: 12, color: 'var(--text-secondary)', fontSize: 13 }}>{tr('auto_pair_121')}</div>}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={checkInteractions}
              style={{ width: '100%', marginTop: 16, padding: '12px' }}
            >
              🔍 {tr('drug_check')}
            </button>
          </div>

          {/* Common drugs quick add */}
          <div className="card">
            <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>{tr('auto_pair_122')}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {drugDatabaseBilingual.slice(0, 10).filter(d => !selectedDrugs.includes(d.ar)).map(d => (
                <button key={d.ar} onClick={() => addDrug(d.ar)} style={{ padding: '5px 12px', borderRadius: 16, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>
                  + {lang==='ar'?d.ar:d.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Results */}
        <div>
          {!checked ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>💊</div>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-secondary)' }}>{tr('auto_pair_123')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('drug_choose_hint')}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
              <FaCheckCircle size={52} color="#22c55e" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px', color: '#22c55e' }}>{tr('drug_no_interaction')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('drug_safe_msg')}</p>
              <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 12 }}>⚠️ {tr('drug_consult_warning')}</p>
            </div>
          ) : (
            <div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 8 }}>
                <FaExclamationTriangle color="#ef4444" style={{ marginTop: 2 }} />
                <span style={{ fontSize: 13, color: '#991b1b' }}>{tr('drug_found_count').replace('{count}', results.length)}</span>
              </div>
              {results.map((r, i) => (
                <div key={i} className="card" style={{ marginBottom: 12, border: `2px solid ${sevColor(r.severity)}30` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.drugs.map(d => <span key={d} style={{ background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{lang==='ar'?d.ar:d.en}</span>)}
                    </div>
                    <span style={{ background: `${sevColor(r.severity)}15`, color: sevColor(r.severity), padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {sevLabel(r.severity)}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>⚠️ {lang==='ar' ? r.effectAr : r.effectEn}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>💡 {lang==='ar' ? r.recAr : r.recEn}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
