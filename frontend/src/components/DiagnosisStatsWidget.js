// frontend/src/components/DiagnosisStatsWidget.js
//
// Real practical payoff of ICD coding: aggregate statistics on the most
// common diagnoses across all patients — something free-text diagnosis
// fields can never provide reliably (can't group "ارتفاع الضغط" and
// "ضغط عالي" and "hypertension" as the same thing; a shared code can).
import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function DiagnosisStatsWidget({ lang }) {
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [stats, setStats] = useState({ icd: [], snomed: [] });
  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState('icd');

  useEffect(() => {
    api.get('/medical-codes/stats')
      .then((data) => setStats({ icd: data.icd || [], snomed: data.snomed || [] }))
      .catch(() => setStats({ icd: [], snomed: [] }))
      .finally(() => setLoading(false));
  }, []);

  const current = stats[system];
  const maxCount = current.length > 0 ? current[0].occurrences : 1;

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{L('أكثر التشخيصات شيوعاً', 'Most Common Diagnoses')}</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{L('مبني على التشخيصات المرمَّزة فعلياً لكل مريض.', 'Based on actual coded diagnoses per patient.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setSystem('icd')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: system === 'icd' ? '#1a6bab' : '#fff', color: system === 'icd' ? '#fff' : '#333', fontSize: 12 }}>ICD-10</button>
          <button onClick={() => setSystem('snomed')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: system === 'snomed' ? '#1a6bab' : '#fff', color: system === 'snomed' ? '#fff' : '#333', fontSize: 12 }}>SNOMED CT</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{L('جارٍ التحميل...', 'Loading...')}</p>
        ) : current.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{L('لا توجد تشخيصات مرمَّزة بهذا النظام بعد.', 'No coded diagnoses in this system yet.')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {current.map((s) => (
              <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 70, fontFamily: 'monospace', fontSize: 12, color: '#1a6bab' }}>{s.code}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, marginBottom: 2 }}>{L(s.nameAr, s.nameEn)}</div>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${(s.occurrences / maxCount) * 100}%`, background: '#1a6bab', height: '100%' }} />
                  </div>
                </div>
                <span style={{ width: 30, textAlign: 'end', fontSize: 12, fontWeight: 700 }}>{s.occurrences}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
