// frontend/src/components/AllergyPicker.js
//
// حقل حساسيات دوائية متعدد لسجل المريض — نفس نمط DiagnosisPicker.js
// (مصفوفة عناصر، لا حقل نصي واحد) لكن أبسط: لا بحث بواجهة برمجية خارجية،
// فقط اسم المادة/الدواء + درجة الشدة، لأن الحساسيات غالباً أسماء عامة (مثل
// "بنسلين") لا رموز طبية معيارية كـICD-10.
import React, { useState } from 'react';

// allergies shape: [{ id, name, severity, dateAdded }]
const SEVERITIES = ['mild', 'moderate', 'severe'];

export default function AllergyPicker({ allergies, onChange, lang }) {
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('moderate');

  const severityLabel = (s) => ({
    mild: L('خفيفة', 'Mild'),
    moderate: L('متوسطة', 'Moderate'),
    severe: L('شديدة', 'Severe'),
  }[s] || s);

  const severityColor = (s) => ({ mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' }[s] || '#6b7280');

  const addAllergy = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const already = allergies.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());
    if (already) { setName(''); return; }
    onChange([...allergies, { id: Date.now(), name: trimmed, severity, dateAdded: new Date().toISOString().split('T')[0] }]);
    setName('');
  };

  const removeAllergy = (id) => onChange(allergies.filter((a) => a.id !== id));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-control"
          placeholder={L('مثال: بنسلين', 'e.g. Penicillin')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }}
          style={{ flex: 2 }}
        />
        <select className="form-control" value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ flex: 1 }}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{severityLabel(s)}</option>)}
        </select>
        <button type="button" className="btn btn-outline" onClick={addAllergy} style={{ whiteSpace: 'nowrap' }}>+ {L('إضافة', 'Add')}</button>
      </div>

      {allergies.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allergies.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: severityColor(a.severity), background: `${severityColor(a.severity)}1a`, padding: '2px 8px', borderRadius: 10 }}>{severityLabel(a.severity)}</span>
              <button type="button" onClick={() => removeAllergy(a.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
