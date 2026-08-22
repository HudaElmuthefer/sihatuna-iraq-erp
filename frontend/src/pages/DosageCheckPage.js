// frontend/src/pages/DosageCheckPage.js
//
// فحص الجرعات — صفحة مستقلة تماماً بقرار صريح (لا علاقة بالصيدلية أو قارئ
// الوصفات إطلاقاً): المستخدم يُدخل دواء + جرعة + عمر/وزن يدوياً (أو يختار
// مريضاً موجوداً لتعبئة العمر تلقائياً فقط — الوزن ليس حقلاً محفوظاً بسجل
// المريض حالياً، يبقى إدخالاً يدوياً دائماً)، والصفحة تفحص القيمة عبر
// backend/agents/dosageAgent.js (نفس نمط DrugInteractionsPage.js بالضبط:
// قاعدة بيانات أولاً، AI احتياطياً).
//
// ── مبدأ أمان بصري جوهري ─────────────────────────────────────────────────
// "لا بيانات كافية" (رمادي محايد) مختلف تماماً بصرياً عن "آمن" (أخضر) —
// لا نعرضهما بنفس الطريقة أبداً، حتى لا يُفهَم غياب المعلومة كتطمين خاطئ.
// راجعي نفس الملاحظة بأعلى backend/agents/dosageAgent.js.
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import { FaExclamationTriangle, FaCheckCircle, FaListAlt, FaRobot, FaBan } from 'react-icons/fa';
import PageBanner from '../components/PageBanner';
import AiModeSelect from '../components/AiModeSelect';

const BANNER_GRADIENT = 'linear-gradient(135deg, #78350f 0%, #b45309 100%)';

const COMMON_DRUGS = [
  { ar: 'باراسيتامول', en: 'Paracetamol' },
  { ar: 'إيبوبروفين', en: 'Ibuprofen' },
  { ar: 'أموكسيسيلين', en: 'Amoxicillin' },
  { ar: 'أسبرين', en: 'Aspirin' },
  { ar: 'ميتفورمين', en: 'Metformin' },
  { ar: 'أوميبرازول', en: 'Omeprazole' },
];

export default function DosageCheckPage() {
  const { lang, showToast, patients } = useApp();
  const tr = useT(lang);

  const [drugName, setDrugName] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState('mg');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState(null);

  // اختيار مزوّد الذكاء الاصطناعي لهذا الفحص — راجعي components/AiModeSelect.js
  const [aiMode, setAiMode] = useState('online');
  useEffect(() => {
    api.get('/dosage-check/status').then(r => { if (r?.mode) setAiMode(r.mode); }).catch(() => {});
  }, []);

  // اختيار مريض موجود صراحةً (لا مطابقة تلقائية بالاسم — تجنّباً لخطر ربط
  // بيانات مريض خاطئ بصمت) يُعبّي العمر فقط، يبقى قابلاً للتعديل اليدوي بعدها.
  const handlePatientSelect = (id) => {
    setSelectedPatientId(id);
    if (!id) return;
    const p = (patients || []).find(x => String(x.id) === String(id));
    if (p && p.age) setAge(String(p.age));
  };

  const check = async () => {
    if (!drugName.trim()) { showToast(lang === 'ar' ? 'اسم الدواء مطلوب' : 'Drug name is required', 'error'); return; }
    if (!dose || Number(dose) <= 0) { showToast(lang === 'ar' ? 'الجرعة مطلوبة ويجب أن تكون رقماً موجباً' : 'Dose is required and must be a positive number', 'error'); return; }
    if (!age && !weight) { showToast(tr('dosage_age_or_weight_hint'), 'error'); return; }

    setChecking(true);
    setResult(null);
    try {
      const res = await api.post('/dosage-check/check', {
        drugName: drugName.trim(),
        dose: Number(dose),
        unit,
        ageYears: age ? Number(age) : null,
        weightKg: weight ? Number(weight) : null,
        lang,
        mode: aiMode,
      });
      setResult(res);
      setChecked(true);
    } catch (err) {
      showToast(err.message || (lang === 'ar' ? 'فشل الفحص' : 'Check failed'), 'error');
    } finally {
      setChecking(false);
    }
  };

  const statusConfig = {
    safe:            { color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: '#16a34a', icon: <FaCheckCircle />, labelKey: 'dosage_result_safe' },
    exceeds:         { color: '#ef4444', bg: '#fef2f2',              border: '#ef4444', icon: <FaExclamationTriangle />, labelKey: 'dosage_result_exceeds' },
    contraindicated: { color: '#991b1b', bg: '#fef2f2',              border: '#991b1b', icon: <FaBan />,                 labelKey: 'dosage_result_contraindicated' },
    unknown:         { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'var(--border)', icon: <FaListAlt />,     labelKey: 'dosage_result_unknown' },
  };

  return (
    <div className="page-content">
      <PageBanner icon="⚖️" title={tr('dosage_title')} subtitle={tr('dosage_subtitle')} gradient={BANNER_GRADIENT} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left — form */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{tr('dosage_drug_name')}</h3>

          <div style={{ marginBottom: 12 }}>
            <input
              value={drugName}
              onChange={e => setDrugName(e.target.value)}
              placeholder={tr('dosage_drug_placeholder')}
              className="form-control"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {COMMON_DRUGS.map(d => (
                <button
                  key={d.ar}
                  type="button"
                  onClick={() => setDrugName(lang === 'ar' ? d.ar : d.en)}
                  style={{ padding: '4px 10px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}
                >
                  {lang === 'ar' ? d.ar : d.en}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="form-label">{tr('dosage_dose')}</label>
              <input type="number" min="0" step="0.1" value={dose} onChange={e => setDose(e.target.value)} className="form-control" />
            </div>
            <div>
              <label className="form-label">{tr('dosage_unit')}</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} className="form-control">
                <option value="mg">mg</option>
                <option value="ml">ml</option>
                <option value="mcg">mcg</option>
              </select>
            </div>
          </div>

          {Array.isArray(patients) && patients.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">{tr('dosage_link_patient')}</label>
              <select value={selectedPatientId} onChange={e => handlePatientSelect(e.target.value)} className="form-control">
                <option value="">{tr('dosage_no_patient')}</option>
                {patients.slice(0, 300).map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
            <div>
              <label className="form-label">{tr('dosage_age')}</label>
              <input type="number" min="0" step="0.1" value={age} onChange={e => setAge(e.target.value)} className="form-control" />
            </div>
            <div>
              <label className="form-label">{tr('dosage_weight')}</label>
              <input type="number" min="0" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="form-control" />
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 16px' }}>{tr('dosage_age_or_weight_hint')}</p>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">{tr('dosage_provider_label')}</label>
            <AiModeSelect value={aiMode} onChange={setAiMode} lang={lang} disabled={checking} style={{ maxWidth: 260 }} />
          </div>

          <button className="btn btn-primary" onClick={check} disabled={checking} style={{ width: '100%', padding: 12 }}>
            {checking ? `⏳ ${tr('dosage_checking')}` : `⚖️ ${tr('dosage_check_btn')}`}
          </button>
        </div>

        {/* Right — result */}
        <div>
          {!checked ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚖️</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('dosage_subtitle')}</p>
            </div>
          ) : !result?.available ? (
            <div className="card" style={{ padding: 24, border: '1px solid var(--border)', background: 'rgba(107,114,128,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontWeight: 700 }}>
                <FaListAlt /> {tr('dosage_result_unknown')}
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const cfg = statusConfig[result.status] || statusConfig.unknown;
                return (
                  <div className="card" style={{ padding: 20, border: `2px solid ${cfg.border}`, background: cfg.bg, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: cfg.color, fontWeight: 700, fontSize: 16 }}>
                      {cfg.icon} {tr(cfg.labelKey)}
                    </div>
                    {result.source === 'db' && result.limit && (
                      <div style={{ fontSize: 13, marginBottom: 8 }}>
                        <strong>{tr('dosage_limit_label')}:</strong> {result.limit.maxDailyDose} {result.limit.unit}/{lang === 'ar' ? 'يوم' : 'day'}
                      </div>
                    )}
                    {result.notes && <div style={{ fontSize: 13, marginBottom: 6 }}>ℹ️ {result.notes}</div>}
                    {result.reasoning && <div style={{ fontSize: 13, marginBottom: 6 }}>ℹ️ {result.reasoning}</div>}
                    {result.recommendation && <div style={{ fontSize: 13 }}>💡 {result.recommendation}</div>}
                  </div>
                );
              })()}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: result.source === 'db' ? 'rgba(15,118,110,0.12)' : 'rgba(139,92,246,0.12)',
                color: result.source === 'db' ? '#0f766e' : '#7c3aed',
              }}>
                {result.source === 'db' ? <FaListAlt /> : <FaRobot />}
                {tr(result.source === 'db' ? 'dosage_source_db' : 'dosage_source_ai')}
              </div>
            </>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.6 }}>⚠️ {tr('dosage_disclaimer')}</p>
        </div>
      </div>
    </div>
  );
}
