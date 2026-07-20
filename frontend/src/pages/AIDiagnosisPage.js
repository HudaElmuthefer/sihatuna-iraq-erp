/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import { buildFallback } from '../utils/fallbackDiagnosis';
import { FaBrain, FaPlus, FaTimes, FaChevronRight, FaExclamationTriangle, FaCheckCircle, FaFileMedical, FaUserMd, FaPhone, FaRobot, FaListAlt } from 'react-icons/fa';

const SYMPTOMS_DATA = [
  {ar:'صداع',en:'Headache'},{ar:'حمى',en:'Fever'},{ar:'سعال',en:'Cough'},{ar:'ضيق تنفس',en:'Shortness of breath'},
  {ar:'آلام صدر',en:'Chest pain'},{ar:'غثيان',en:'Nausea'},{ar:'قيء',en:'Vomiting'},{ar:'إسهال',en:'Diarrhea'},
  {ar:'آلام بطن',en:'Abdominal pain'},{ar:'دوار',en:'Dizziness'},{ar:'إرهاق',en:'Fatigue'},{ar:'فقدان شهية',en:'Loss of appetite'},
  {ar:'آلام مفاصل',en:'Joint pain'},{ar:'طفح جلدي',en:'Rash'},{ar:'التهاب حلق',en:'Sore throat'},
  {ar:'احتقان أنف',en:'Nasal congestion'},{ar:'آلام ظهر',en:'Back pain'},{ar:'اضطرابات نوم',en:'Sleep disorders'},
  {ar:'قلق',en:'Anxiety'},{ar:'ارتفاع ضغط دم',en:'High blood pressure'},{ar:'سكري',en:'Diabetes'},
  {ar:'آلام قلب',en:'Heart pain'},{ar:'تورم',en:'Swelling'},{ar:'حكة',en:'Itching'},
  {ar:'تساقط شعر',en:'Hair loss'},{ar:'ضعف بصر',en:'Blurred vision'},{ar:'ألم أذن',en:'Ear pain'},{ar:'عسر بلع',en:'Difficulty swallowing'}
];

const commonSymptoms = [
  'صداع', 'حمى', 'سعال', 'ضيق تنفس', 'آلام صدر', 'غثيان', 'قيء', 'إسهال',
  'آلام بطن', 'دوار', 'إرهاق', 'فقدان شهية', 'آلام مفاصل', 'طفح جلدي', 'التهاب حلق',
  'احتقان أنف', 'آلام ظهر', 'اضطرابات نوم', 'قلق', 'ارتفاع ضغط دم', 'سكري',
  'آلام قلب', 'تورم', 'حكة', 'تساقط شعر', 'ضعف بصر', 'ألم أذن', 'عسر بلع'
];

// ── إصلاح: قائمة الأطباء المُقترَحين ما عادت مكتوبة هنا ────────────────────────
// كانت مصفوفة ثابتة (BASRA_DOCTORS) بهذا الملف — أي تحديث (رقم هاتف، طبيب
// جديد) كان يحتاج تعديل كود وبناء ونشر كامل. الآن تُجلَب من الباك إند
// (GET /api/ai-diagnosis/referral-doctors) اللي يقرأها من ملف بيانات بسيط
// (backend/data/basra-referral-doctors.json) يُعدَّل مباشرة بدون أي بناء.
function getRecommendedDoctors(symptoms, doctorsList) {
  if (!symptoms || symptoms.length === 0 || !doctorsList || doctorsList.length === 0) return [];
  const scored = doctorsList.map(doc => {
    const matches = symptoms.filter(s => doc.keys.includes(s)).length;
    return { ...doc, score: matches };
  }).filter(d => d.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

export default function AIDiagnosisPage() {
  const { showToast, lang } = useApp();
  const tr = useT(lang);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [duration, setDuration] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  // File uploads
  const [labFile, setLabFile] = useState(null);
  const [sonarFile, setSonarFile] = useState(null);
  const [mriFile, setMriFile] = useState(null);
  const [ctFile, setCtFile] = useState(null);

  const labRef = useRef();
  const sonarRef = useRef();
  const mriRef = useRef();
  const ctRef = useRef();

  // ── إصلاح: التحقق الصادق من توفّر ذكاء اصطناعي حقيقي ──────────────────────
  // نفحص هذا فوراً عند فتح الصفحة (مو بس بعد الضغط على "تحليل") حتى يعرف
  // المستخدم من البداية هل التشخيص القادم بذكاء اصطناعي حقيقي أو نظام مساعدة
  // أولي محلي — بدل ما يتفاجأ بالنتيجة بعد ما يعبّي النموذج كامل.
  const [aiAvailable, setAiAvailable] = useState(null); // null = لسا يتحقق
  const [referralDoctors, setReferralDoctors] = useState([]);
  useEffect(() => {
    api.get('/ai-diagnosis/status')
      .then(r => setAiAvailable(Boolean(r?.available)))
      .catch(() => setAiAvailable(false)); // أي خطأ اتصال = نفترض غير متاح، نستخدم النظام المحلي بأمان
    api.get('/ai-diagnosis/referral-doctors')
      .then(list => Array.isArray(list) && setReferralDoctors(list))
      .catch(() => {}); // فشل جلب قائمة الأطباء لا يمنع التشخيص نفسه من العمل
  }, []);

  const toggleSymptom = (s) => {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const addCustom = () => {
    if (customSymptom.trim() && !selectedSymptoms.includes(customSymptom.trim())) {
      setSelectedSymptoms(prev => [...prev, customSymptom.trim()]);
      setCustomSymptom('');
    }
  };

  // دالة مساعدة بسيطة: ترجع النص العربي أو الإنكليزي حسب اللغة الحالية —
  // مُعرَّفة هنا أعلى الملف (قبل analyze وbuildFallback) حتى تكون بمتناول كل
  // دوال المكوّن دون استثناء.
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const analyze = async () => {
    if (selectedSymptoms.length === 0) {
      showToast(L('الرجاء اختيار أعراض واحدة على الأقل','Please select at least one symptom'), 'error');
      return;
    }
    setLoading(true);

    const hasFiles = labFile || sonarFile || mriFile || ctFile;
    const filesDescription = [
      labFile ? `${L('تحليل مخبري','Lab')}: ${labFile.name}` : '',
      sonarFile ? `${L('سونار','Sonar')}: ${sonarFile.name}` : '',
      mriFile ? `${L('رنين مغناطيسي','MRI')}: ${mriFile.name}` : '',
      ctFile ? `CT: ${ctFile.name}` : '',
    ].filter(Boolean).join('، ');

    const recDoctors = getRecommendedDoctors(selectedSymptoms, referralDoctors);

    // ── إصلاح جذري ──────────────────────────────────────────────────────────
    // قبل هذا، الكود يبني prompt كامل للذكاء الاصطناعي... ثم يتجاهله تماماً
    // ويستخدم نظام قواعد محلي بدل ما يرسله لأي مكان (بحجة "الـ API محظور
    // بـCORS بالمتصفح" — وهذا صحيح، لكن الحل الصحيح هو مناداته من الباك إند
    // لا تجاهله بالكامل). الآن: نطلب من الباك إند فعلياً (بلا أي قيد CORS
    // لأنه اتصال خادم-لخادم)، وهو يقرر هل يستخدم ذكاء اصطناعي حقيقي (لو مُعدّ
    // مفتاح API) أو يرجع available:false لنستخدم النظام المحلي — بأمانة تامة
    // حول أي النظامين استُخدم فعلياً بكل مرة (راجعي result.source بالعرض).
    try {
      const aiResult = await api.post('/ai-diagnosis/analyze', {
        symptoms: selectedSymptoms, age, gender, duration, filesDescription, lang,
      });

      if (aiResult.available) {
        setResult({ ...aiResult, source: 'ai', symptoms: selectedSymptoms, age, gender, duration, doctors: recDoctors });
        setAiAvailable(true);
        setStep(3);
        setLoading(false);
        return;
      }
      // available: false (بلا مفتاح API، أو فشل الاتصال، أو رد غير صالح) — نستخدم النظام المحلي
      setAiAvailable(false);
    } catch {
      // فشل الطلب بالكامل (مثلاً السيرفر غير متاح مؤقتاً) — نستخدم النظام المحلي أيضاً بدل كسر التجربة
      setAiAvailable(false);
    }

    const diagnosis = buildFallback(selectedSymptoms, lang);
    setResult({ ...diagnosis, source: 'fallback', symptoms: selectedSymptoms, age, gender, duration, doctors: recDoctors });
    setStep(3);
    setLoading(false);
  };

  const reset = () => {
    setSelectedSymptoms([]); setCustomSymptom(''); setDuration('');
    setAge(''); setGender(''); setResult(null); setStep(1);
    setLabFile(null); setSonarFile(null); setMriFile(null); setCtFile(null);
  };

  const severityColor = (s) => {
    if (s === 'طارئ') return '#7c3aed';
    if (s === 'مرتفع') return '#ef4444';
    if (s === 'متوسط') return '#f59e0b';
    return '#22c55e';
  };
  const severityIcon = (s) => ({ 'طارئ':'🚨','مرتفع':'⚠️','متوسط':'🔔','خفيف':'✅' }[s]||'🔔');
  const SEV_LABEL = (s) => ({ 'طارئ': lang==='ar'?'طارئ':'Urgent', 'مرتفع': lang==='ar'?'مرتفع':'High', 'متوسط': lang==='ar'?'متوسط':'Moderate', 'خفيف': lang==='ar'?'خفيف':'Mild' }[s] || s);

  const FileUpload = ({ label, icon, file, setFile, inputRef, accept }) => (
    <div
      onClick={() => inputRef.current?.click()}
      style={{ border: `2px dashed ${file ? '#22c55e' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: file ? 'rgba(34,197,94,0.05)' : 'transparent', transition: 'all 0.2s' }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          {file ? `✅ ${file.name}` : L('انقر للرفع (PDF, صورة)','Click to upload (PDF, image)')}
        </div>
      </div>
      {file && <FaTimes size={14} color="#ef4444" onClick={e => { e.stopPropagation(); setFile(null); }} />}
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
    </div>
  );

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f1923 0%, #1a2940 50%, #0d3460 100%)', borderRadius: 16, padding: '28px 32px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧠</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{tr('ai_title')}</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 14 }}>{tr('ai_subtitle')}</p>
        </div>
      </div>

      {/* ── إصلاح: تلميح مبكر وصادق قبل ما يبدأ المستخدم أصلاً ────────────────────
          يعرف المستخدم من أول لحظة هل التشخيص القادم بذكاء اصطناعي حقيقي أو
          نظام محلي، بدل ما يتفاجأ بعد ما يعبّي النموذج كامل وينتظر النتيجة. */}
      {aiAvailable === false && step < 3 && (
        <div style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <FaListAlt />
          {L(
            'ملاحظة: الذكاء الاصطناعي الحقيقي غير مفعّل حالياً بهذا النظام — التشخيص القادم من نظام مساعدة أولية محلي (مطابقة أعراض شائعة)، وليس نموذج ذكاء اصطناعي.',
            'Note: Real AI is not currently enabled on this system — the upcoming result comes from a local preliminary matching system, not an AI model.'
          )}
        </div>
      )}

      {/* Steps */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
        {[1,2,3].map(s => (
          <React.Fragment key={s}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: step >= s ? '#1a6bab' : 'var(--border)', color: step >= s ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{lang==='ar'?s.ar:s.en}</div>
            {s < 3 && <div style={{ width: 60, height: 2, background: step > s ? '#1a6bab' : 'var(--border)' }} />}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 60, marginBottom: 28, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ color: step >= 1 ? '#1a6bab' : undefined }}>{tr('ai_step1')}</span>
        <span style={{ color: step >= 2 ? '#1a6bab' : undefined }}>{tr('ai_step2')}</span>
        <span style={{ color: step >= 3 ? '#1a6bab' : undefined }}>{tr('ai_step3')}</span>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>{tr('ai_select_symptom')}</h3>
          {selectedSymptoms.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(26,107,171,0.08)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedSymptoms.map(s => {
                const sym = SYMPTOMS_DATA.find(x => x.ar === s) || { ar: s, en: s };
                return (
                  <span key={s} style={{ background: '#1a6bab', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lang === 'ar' ? sym.ar : sym.en}
                    <FaTimes size={10} style={{ cursor: 'pointer' }} onClick={() => toggleSymptom(s)} />
                  </span>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {commonSymptoms.map(arKey => {
              const sym = SYMPTOMS_DATA.find(x => x.ar === arKey) || { ar: arKey, en: arKey };
              return (
                <button key={arKey} onClick={() => toggleSymptom(arKey)} style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${selectedSymptoms.includes(arKey) ? '#1a6bab' : 'var(--border)'}`, background: selectedSymptoms.includes(arKey) ? 'rgba(26,107,171,0.12)' : 'transparent', color: selectedSymptoms.includes(arKey) ? '#1a6bab' : 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                  {lang === 'ar' ? sym.ar : sym.en}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={customSymptom} onChange={e => setCustomSymptom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()} placeholder={lang==='ar'?'أضف عرضاً آخر...':'Add another symptom...'} className="form-control" style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={addCustom}><FaPlus /> {lang==='ar'?'إضافة':'Add'}</button>
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => selectedSymptoms.length > 0 ? setStep(2) : showToast(L('اختر عرضاً واحداً على الأقل','Select at least one symptom'), 'error')} style={{ padding: '10px 24px' }}>
              {lang==='ar'?'التالي':'Next'} <FaChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 20 }}>{tr('auto_pair_45')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div><label className="form-label">{tr('ai_age')}</label><input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="35" className="form-control" /></div>
            <div><label className="form-label">{tr('ai_gender')}</label><select value={gender} onChange={e => setGender(e.target.value)} className="form-control"><option value="">{tr('auto_pair_46')}</option><option value="ذكر">{tr('status_male')}</option><option value="أنثى">{tr('status_female')}</option></select></div>
            <div style={{ gridColumn: '1/-1' }}><label className="form-label">{tr('ai_duration')}</label><select value={duration} onChange={e => setDuration(e.target.value)} className="form-control"><option value="">{tr('auto_pair_47')}</option><option>{tr('auto_pair_48')}</option><option>{tr('auto_pair_49')}</option><option>{tr('auto_pair_50')}</option><option>{tr('auto_pair_51')}</option><option>{tr('auto_pair_52')}</option></select></div>
          </div>

          <h4 style={{ marginBottom: 14, color: 'var(--text-secondary)', fontSize: 14 }}>📎 {L('إرفاق ملفات طبية (اختياري)','Attach Medical Files (optional)')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FileUpload label={L('نتيجة تحاليل','Lab Results')} icon="🧪" file={labFile} setFile={setLabFile} inputRef={labRef} accept=".pdf,.jpg,.jpeg,.png" />
            <FileUpload label={L('تقرير سونار','Sonar Report')} icon="📡" file={sonarFile} setFile={setSonarFile} inputRef={sonarRef} accept=".pdf,.jpg,.jpeg,.png" />
            <FileUpload label={L('صورة رنين مغناطيسي','MRI Image')} icon="🔬" file={mriFile} setFile={setMriFile} inputRef={mriRef} accept=".pdf,.jpg,.jpeg,.png" />
            <FileUpload label={L('صورة مفراس (CT Scan)','CT Scan Image')} icon="🖥️" file={ctFile} setFile={setCtFile} inputRef={ctRef} accept=".pdf,.jpg,.jpeg,.png" />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setStep(1)} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)' }}>{lang==='ar'?'رجوع':'Back'}</button>
            <button className="btn btn-primary" onClick={analyze} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaBrain /> {L('تحليل بالذكاء الاصطناعي','Analyze with AI')}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{tr('ai_analyzing')}</p>
          <div style={{ width: 200, height: 4, background: 'var(--border)', borderRadius: 2, margin: '16px auto', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#1a6bab', borderRadius: 2, width: '70%', animation: 'none' }} />
          </div>
        </div>
      )}

      {/* Step 3 - Results */}
      {step === 3 && result && !loading && (
        <div>
          {/* ── إصلاح: شارة صادقة توضح مصدر التشخيص الفعلي ──────────────────────
              قبل هذا، الصفحة تدّعي "ذكاء اصطناعي" دائماً بغض النظر عن المصدر
              الحقيقي للنتيجة. الآن نوضح بصراحة تامة: هل هذا رد فعلي من نموذج
              ذكاء اصطناعي حقيقي (نعرض اسم المزوّد الفعلي: Gemini أو Claude)،
              أو نظام مطابقة قواعد محلي بسيط. */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14,
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: result.source === 'ai' ? 'rgba(139,92,246,0.12)' : 'rgba(107,114,128,0.12)',
            color: result.source === 'ai' ? '#7c3aed' : '#6b7280',
          }}>
            {result.source === 'ai' ? <FaRobot /> : <FaListAlt />}
            {result.source === 'ai'
              ? L(
                  `تشخيص بذكاء اصطناعي حقيقي (${result.provider === 'gemini' ? 'Google Gemini' : 'Claude'})`,
                  `Real AI-powered diagnosis (${result.provider === 'gemini' ? 'Google Gemini' : 'Claude'})`
                )
              : L('نظام مساعدة أولية محلي — تشخيص مبني على مطابقة أعراض شائعة، وليس ذكاءً اصطناعياً','Local preliminary assistant — based on common symptom matching, not AI')}
          </div>

          {/* Warning */}
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <FaExclamationTriangle color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>{tr('ai_disclaimer')}</p>
          </div>

          {/* Urgent Alert */}
          {result.urgent && (
            <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 24 }}>🚨</span>
              <div>
                <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>{tr('ai_urgent')}</div>
                <div style={{ fontSize: 13, color: '#7f1d1d' }}>{result.urgentReason}</div>
              </div>
            </div>
          )}

          {/* Diagnoses */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 28 }}>{severityIcon(result.severity)}</span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tr('ai_diagnoses')}</div>
                <span style={{ background: `${severityColor(result.severity)}15`, color: severityColor(result.severity), padding: '3px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  {L('درجة الخطورة','Severity')}: {SEV_LABEL(result.severity)}
                </span>
              </div>
            </div>
            {(result.diagnoses || []).map((d, i) => (
              <div key={i} style={{ background: i === 0 ? 'rgba(26,107,171,0.06)' : 'var(--bg-secondary)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, border: i === 0 ? '1px solid rgba(26,107,171,0.2)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{i + 1}. {d.name}</span>
                  {d.probability && <span style={{ background: '#1a6bab', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{d.probability}</span>}
                </div>
                {d.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.description}</div>}
              </div>
            ))}
          </div>

          {/* Tests */}
          {result.tests && result.tests.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><FaFileMedical color="#8b5cf6" /> {L('الفحوصات المقترحة','Suggested Tests')}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.tests.map((testName, i) => (
                  <span key={i} style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500 }}>🔬 {testName}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px' }}>💡 {L('التوصيات','Recommendations')}</h4>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                  <FaCheckCircle color="#22c55e" size={14} style={{ marginTop: 3, flexShrink: 0 }} />
                  <span style={{ fontSize: 14 }}>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Doctors from Basra */}
          {result.doctors && result.doctors.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaUserMd color="#1a6bab" /> {L('أطباء متخصصون في البصرة','Specialist Doctors in Basra')}
              </h4>
              {result.doctors.map((doc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 8, border: '1px solid var(--border)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1a6bab', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                    {doc.name.charAt(doc.name.indexOf('.')+2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{doc.name}</div>
                    <div style={{ fontSize: 12, color: '#1a6bab', marginTop: 2, fontWeight: 600 }}>{(() => { const specs = {'باطنية وصدرية':'Internal/Chest','باطنية':'Internal Medicine','غدد صماء وسكري':'Endocrinology','جهاز هضمي باطنية':'Gastroenterology','جهاز هضمي':'Gastroenterology','قلبية - تشوهات قلبية ولادية':'Cardiology','جراحة قلب وصدر':'Cardiothoracic Surgery','جملة عصبية':'Neurology','طب وجراحة عيون - شبكية':'Ophthalmology-Retina','طب وجراحة عيون - قرنية':'Ophthalmology-Cornea','أنف وأذن وحنجرة':'ENT','نسائية وتوليد':'OB/GYN','جلدية وتناسلية':'Dermatology','جلدية وتناسلية وتجميلية':'Derm/Cosmetic','أطفال وحديثو الولادة':'Pediatrics/Neonatology','أطفال':'Pediatrics','عظام - تبديل مفصل':'Orthopedics','جراحة ركبة ناظورية':'Knee Surgery','نفسية وعصبية':'Psychiatry'}; return lang==='ar'?doc.spec:(specs[doc.spec]||doc.spec); })()}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>📍 {doc.area}</div>
                  </div>
                  <a href={`tel:${doc.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#22c55e', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <FaPhone size={11} /> {doc.phone}
                  </a>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={reset}>{lang==='ar'?'تشخيص جديد':'New Diagnosis'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
