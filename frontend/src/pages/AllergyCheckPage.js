// frontend/src/pages/AllergyCheckPage.js
//
// فحص تضارب الحساسية الدوائية — صفحة مستقلة تماماً بقرار صريح (نفس مبدأ
// DosageCheckPage.js بالضبط: لا علاقة بالصيدلية أو قارئ الوصفات إطلاقاً):
// المستخدم يختار مريضاً موجوداً (تُعبَّأ حساسياته تلقائياً، قابلة للتعديل
// بعدها) أو يُدخلها يدوياً، ثم يُدخل اسم دواء ليُفحَص. الفحص عبر
// backend/agents/allergyAgent.js (نفس نمط الوكلاء الأخرى بالضبط: قاعدة
// بيانات أولاً، AI احتياطياً).
//
// ── ثلاث حالات نتيجة مختلفة بصرياً، لا يجوز خلطها أبداً ─────────────────────
// 1) "لا حساسيات مسجَّلة لهذا المريض" (رمادي محايد بلون مختلف) — ليست نفسها
//    "فُحص ولا يوجد تضارب" (أخضر)، لأن الأولى تعني ببساطة لا يوجد شيء
//    نتحقق منه، لا أننا فحصنا وتأكدنا من السلامة.
// 2) "لا يوجد تضارب" (أخضر) — فُحص فعلياً (بقاعدة بيانات أو AI) ولا تطابق.
// 3) "لا بيانات كافية" (رمادي محايد، أيقونة مختلفة) — لا تطابق بالجدول وAI
//    غير متاح/فشل. راجع نفس المبدأ بـDosageCheckPage.js.
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import { FaExclamationTriangle, FaCheckCircle, FaListAlt, FaRobot } from 'react-icons/fa';
import PageBanner from '../components/PageBanner';
import AiModeSelect from '../components/AiModeSelect';
import AllergyPicker from '../components/AllergyPicker';

const BANNER_GRADIENT = 'linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)';

const sevColor = (s) => ({ mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' }[s] || '#6b7280');
const sevLabelAr = (s) => ({ mild: 'خفيفة', moderate: 'متوسطة', severe: 'شديدة' }[s] || (s || 'غير محدَّدة'));
const sevLabelEn = (s) => ({ mild: 'Mild', moderate: 'Moderate', severe: 'Severe' }[s] || (s || 'Unspecified'));

export default function AllergyCheckPage() {
  const { lang, showToast, patients } = useApp();
  const tr = useT(lang);
  const L = (ar, en) => (lang === 'ar' ? ar : en);

  const [drugName, setDrugName] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [allergies, setAllergies] = useState([]);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState(null);

  const [aiMode, setAiMode] = useState('online');
  useEffect(() => {
    api.get('/allergy-check/status').then(r => { if (r?.mode) setAiMode(r.mode); }).catch(() => {});
  }, []);

  // اختيار مريض موجود صراحةً (لا مطابقة تلقائية بالاسم — نفس مبدأ
  // DosageCheckPage.js تماماً) يُعبّي قائمة حساسياته المسجَّلة، تبقى قابلة
  // للتعديل بعدها (إضافة/حذف) بلا أي تأثير على السجل الأصلي للمريض.
  const handlePatientSelect = (id) => {
    setSelectedPatientId(id);
    setResult(null); setChecked(false);
    if (!id) { setAllergies([]); return; }
    const p = (patients || []).find(x => String(x.id) === String(id));
    setAllergies(Array.isArray(p?.allergies) ? p.allergies : []);
  };

  const check = async () => {
    if (!drugName.trim()) { showToast(L('اسم الدواء مطلوب', 'Drug name is required'), 'error'); return; }

    setChecking(true);
    setResult(null);
    try {
      const res = await api.post('/allergy-check/check', {
        allergies,
        drugs: [drugName.trim()],
        lang,
        mode: aiMode,
      });
      setResult(res);
      setChecked(true);
    } catch (err) {
      showToast(err.message || L('فشل الفحص', 'Check failed'), 'error');
    } finally {
      setChecking(false);
    }
  };

  const sourceBadge = () => {
    const badges = {
      db: { icon: <FaListAlt />, color: '#0f766e', bg: 'rgba(15,118,110,0.12)', ar: 'نتيجة من جدول عائلات الحساسية الدوائية (فورية، بلا ذكاء اصطناعي)', en: 'Result from the drug allergy-class table (instant, no AI needed)' },
      ai: { icon: <FaRobot />, color: '#7c3aed', bg: 'rgba(139,92,246,0.12)', ar: 'فحص بذكاء اصطناعي حقيقي (عبر الإنترنت)', en: 'Real AI-powered check (Online AI)' },
      mixed: { icon: <FaRobot />, color: '#7c3aed', bg: 'rgba(139,92,246,0.12)', ar: 'نتيجة مدمجة: جدول موثوق + ذكاء اصطناعي', en: 'Combined result: trusted table + AI' },
    };
    const b = badges[result?.source] || badges.db;
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: b.bg, color: b.color }}>
        {b.icon}
        {lang === 'ar' ? b.ar : b.en}
      </div>
    );
  };

  return (
    <div className="page-content">
      <PageBanner icon="🚫" title={tr('allergy_title')} subtitle={tr('allergy_subtitle')} gradient={BANNER_GRADIENT} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left — form */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{tr('allergy_drug_name')}</h3>
          <div style={{ marginBottom: 16 }}>
            <input
              value={drugName}
              onChange={e => setDrugName(e.target.value)}
              placeholder={tr('allergy_drug_placeholder')}
              className="form-control"
            />
          </div>

          {Array.isArray(patients) && patients.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">{tr('allergy_link_patient')}</label>
              <select value={selectedPatientId} onChange={e => handlePatientSelect(e.target.value)} className="form-control">
                <option value="">{tr('allergy_no_patient')}</option>
                {patients.slice(0, 300).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">{tr('allergy_patient_allergies')}</label>
            <AllergyPicker allergies={allergies} onChange={setAllergies} lang={lang} />
            {allergies.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{tr('allergy_none_entered_hint')}</p>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">{tr('allergy_provider_label')}</label>
            <AiModeSelect value={aiMode} onChange={setAiMode} lang={lang} disabled={checking} style={{ maxWidth: 260 }} />
          </div>

          <button className="btn btn-primary" onClick={check} disabled={checking} style={{ width: '100%', padding: 12 }}>
            {checking ? `⏳ ${tr('allergy_checking')}` : `🚫 ${tr('allergy_check_btn')}`}
          </button>
        </div>

        {/* Right — result */}
        <div>
          {!checked ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🚫</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('allergy_subtitle')}</p>
            </div>
          ) : !result?.available ? (
            <div className="card" style={{ padding: 24, border: '1px solid var(--border)', background: 'rgba(107,114,128,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontWeight: 700 }}>
                <FaListAlt /> {tr('allergy_result_unknown')}
              </div>
            </div>
          ) : result.noAllergiesOnFile ? (
            <div className="card" style={{ padding: 24, border: '1px solid var(--border)', background: 'rgba(107,114,128,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontWeight: 700 }}>
                <FaListAlt /> {tr('allergy_none_on_file')}
              </div>
            </div>
          ) : (
            <>
              {sourceBadge()}
              {(result.conflicts || []).length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <FaCheckCircle size={52} color="#22c55e" style={{ marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px', color: '#22c55e' }}>{tr('allergy_result_safe')}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('allergy_result_safe_msg')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* ── إصلاح: البطاقة نفسها حمراء دائماً (نفس نمط "شديد") بغض النظر عن
                      شدة الحساسية المسجَّلة — أي تضارب حساسية دوائية حقيقي يستحق أعلى
                      درجة انتباه بصري، ولا يجوز أبداً أن يتشابه بصرياً مع بطاقة "لا يوجد
                      تضارب" الخضراء أعلاه لمجرد أن شدة الحساسية المسجَّلة "خفيفة". الشدة
                      الفعلية تُعرَض فقط كشارة داخلية ملوَّنة، لا كلون البطاقة كلها —
                      راجع نفس المبدأ بالضبط بـPharmacyPage.js. */}
                  {result.conflicts.map((c, i) => (
                    <div key={i} style={{ padding: 20, border: '2px solid #ef4444', borderRadius: 12, background: '#fef2f2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: '#991b1b', fontWeight: 700, fontSize: 16 }}>
                        <FaExclamationTriangle /> {tr('allergy_result_conflict')}
                        <span style={{ fontSize: 11, fontWeight: 700, color: sevColor(c.severity), background: `${sevColor(c.severity)}22`, padding: '2px 10px', borderRadius: 10 }}>
                          {lang === 'ar' ? sevLabelAr(c.severity) : sevLabelEn(c.severity)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, marginBottom: 6 }}>
                        <strong>{tr('allergy_conflict_drug')}:</strong> {c.drug} — <strong>{tr('allergy_conflict_allergen')}:</strong> {c.allergyName}
                      </div>
                      {c.explanation && <div style={{ fontSize: 13, marginBottom: 6 }}>ℹ️ {c.explanation}</div>}
                      {c.recommendation && <div style={{ fontSize: 13 }}>💡 {c.recommendation}</div>}
                    </div>
                  ))}
                </div>
              )}
              {result.incomplete && (
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 10 }}>
                  ⚠️ {tr('allergy_incomplete_hint')}
                </div>
              )}
            </>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.6 }}>⚠️ {tr('allergy_disclaimer')}</p>
        </div>
      </div>
    </div>
  );
}
