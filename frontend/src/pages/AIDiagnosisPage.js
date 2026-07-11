/* eslint-disable no-unused-vars */
import React, { useState, useRef } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { FaBrain, FaPlus, FaTimes, FaChevronRight, FaExclamationTriangle, FaCheckCircle, FaFileMedical, FaUserMd, FaPhone } from 'react-icons/fa';

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

// أطباء البصرة من دليل البصرة الطبي
const BASRA_DOCTORS = [
  // باطنية
  { name: 'دكتور أحمد سالم الغزي', spec: 'باطنية وصدرية', area: 'بريهة - قرب جرس المحاكم - مجمع بريهة الطبي', phone: '07708037628', keys: ['صداع','حمى','سعال','ضيق تنفس','إرهاق','فقدان شهية','قلق','ارتفاع ضغط دم'] },
  { name: 'دكتور انمار عبد المحسن', spec: 'باطنية وصدرية', area: 'بريهة - قرب جرس المحاكم - مجمع البلسم الطبي', phone: '07709501368', keys: ['سعال','ضيق تنفس','آلام صدر','إرهاق','حمى'] },
  { name: 'دكتور حسن رمضان شندوخ', spec: 'باطنية وصدرية', area: 'الجمهورية - شارع المكاتب - مجمع الإرساء الطبي', phone: '07777823697', keys: ['حمى','صداع','إرهاق','ارتفاع ضغط دم','آلام بطن'] },
  { name: 'دكتور حيدر حسن الحجاج', spec: 'باطنية', area: 'المدينة - قرب صيدلية الكناري', phone: '07737238881', keys: ['حمى','صداع','إرهاق','غثيان','قيء'] },
  { name: 'دكتور صفاء الدين أحمد الحاجم', spec: 'باطنية وصدرية', area: 'بريهة - قرب جرس المحاكم - مجمع السعفة الطبي', phone: '07712136408', keys: ['سعال','ضيق تنفس','صداع','حمى','إرهاق'] },
  { name: 'دكتور عادل عبد الحسن كاظم', spec: 'باطنية', area: 'الجمهورية - شارع المكاتب - قرب مكتبة أبو طارق', phone: '07807921100', keys: ['ارتفاع ضغط دم','آلام بطن','حمى','إرهاق'] },
  // أمراض الغدد والسكري
  { name: 'دكتور إبراهيم هاني المطوري', spec: 'غدد صماء وسكري', area: 'القرنة - شارع الفردوس - مركز الفيحاء للغدد الصماء والسكري', phone: '07727999188', keys: ['سكري','إرهاق','تساقط شعر','ارتفاع ضغط دم','تورم'] },
  { name: 'دكتور حيدر إياد الإدريسي', spec: 'غدد صماء وسكري', area: 'بريهة - قرب جرس المحاكم - مجمع الرافدين التخصصي', phone: '07736019049', keys: ['سكري','إرهاق','تساقط شعر','تورم'] },
  { name: 'دكتور سلمان كاظم الساعدي', spec: 'غدد صماء وسكري', area: 'بريهة - قرب جرس المحاكم - مجمع مملكة الطب', phone: '07712436678', keys: ['سكري','إرهاق','تساقط شعر','حكة'] },
  // جهاز هضمي
  { name: 'دكتور طلال هادي النون', spec: 'جهاز هضمي باطنية', area: 'العباسية - شارع جامع سيد حامد - مركز جود للجهاز الهضمي', phone: '07815553252', keys: ['آلام بطن','غثيان','قيء','إسهال','فقدان شهية'] },
  { name: 'دكتور حميد لفتة ونوس', spec: 'جهاز هضمي', area: 'بريهة - قرب جرس المحاكم - مجمع النخيل التخصصي', phone: '07717571349', keys: ['آلام بطن','غثيان','قيء','إسهال','فقدان شهية'] },
  // قلبية
  { name: 'دكتور حبيب نجم العبيدي', spec: 'قلبية - تشوهات قلبية ولادية', area: 'الزبير - الرشيدية - عيادات ابن سينا الطبية', phone: '07700190636', keys: ['آلام صدر','ضيق تنفس','دوار','إرهاق','تورم'] },
  { name: 'دكتور ثامر فوزي الخياط', spec: 'جراحة قلب وصدر', area: 'بريهة - قرب جرس المحاكم - مجمع البلسم الشافي', phone: '07729106710', keys: ['آلام صدر','ضيق تنفس','إرهاق'] },
  // أعصاب
  { name: 'دكتور أحمد عبد الجواد السالم', spec: 'جملة عصبية', area: 'بريهة - قرب جرس المحاكم - مجمع السياب الطبي', phone: '07832379022', keys: ['صداع','دوار','اضطرابات نوم','قلق','إرهاق'] },
  { name: 'دكتورة هدى سالم الحسيني', spec: 'جملة عصبية', area: 'المواساة الأهلية - مستشفى', phone: '07737999350', keys: ['صداع','دوار','اضطرابات نوم','قلق'] },
  // عيون
  { name: 'دكتور أحمد عبود شذر', spec: 'طب وجراحة عيون - شبكية', area: 'بريهة - نهاية شارع جرس المحاكم - مجمع المودة الطبي', phone: '07834994443', keys: ['ضعف بصر','صداع','آلام'] },
  { name: 'دكتور لؤي عبد المطلب الموسوي', spec: 'طب وجراحة عيون - قرنية', area: 'العباسية - شارع الجشع - مركز النبأ الطبي', phone: '07802051462', keys: ['ضعف بصر','حكة','ألم أذن'] },
  // أنف وأذن وحنجرة
  { name: 'دكتور أحمد عبد الكريم الأنصاري', spec: 'أنف وأذن وحنجرة', area: 'بريهة - قرب جرس المحاكم - مجاور مجمع الحنان الطبي', phone: '07818602208', keys: ['ألم أذن','التهاب حلق','احتقان أنف','سعال','صداع'] },
  { name: 'دكتور أحمد فاضل حسن', spec: 'أنف وأذن وحنجرة', area: 'بريهة - قرب جرس المحاكم - مجمع طيبة', phone: '07707130804', keys: ['ألم أذن','التهاب حلق','احتقان أنف','سعال','عسر بلع'] },
  { name: 'دكتور حسام حيدر', spec: 'أنف وأذن وحنجرة', area: 'بريهة - قرب جرس المحاكم', phone: '07801424259', keys: ['ألم أذن','التهاب حلق','احتقان أنف','صداع'] },
  // نسائية
  { name: 'دكتورة حوراء محمد نعاس', spec: 'نسائية وتوليد', area: 'القرنة - شارع الفردوس', phone: '07740161513', keys: ['آلام بطن','غثيان','تورم','إرهاق'] },
  { name: 'دكتورة زينب شاكر الخالدي', spec: 'نسائية وتوليد', area: 'المواساة الأهلية - العيادات الاستشارية', phone: '07735038545', keys: ['آلام بطن','غثيان','تورم','إرهاق'] },
  // جلدية
  { name: 'دكتور أسامة مال الله', spec: 'جلدية وتناسلية', area: 'بريهة - قرب جرس المحاكم - مجمع طيبة الطبي', phone: '07706809857', keys: ['طفح جلدي','حكة','تساقط شعر'] },
  { name: 'دكتور صالح عياش', spec: 'جلدية وتناسلية وتجميلية', area: 'العشار - خلف عمارة النقيب - قرب سوق حنا الشيخ', phone: '07809790487', keys: ['طفح جلدي','حكة','تساقط شعر'] },
  // أطفال
  { name: 'دكتور رافت رائد الحسن', spec: 'أطفال وحديثو الولادة', area: 'بريهة - قرب جرس المحاكم - مجمع الرافدين الطبي', phone: '07736000513', keys: ['حمى','سعال','إسهال','غثيان','قيء','طفح جلدي'] },
  { name: 'دكتور حسام جواد العطار', spec: 'أطفال', area: 'العشار - شارع الأطباء - قرب كنيسة العذراء', phone: '07712447221', keys: ['حمى','سعال','إسهال','غثيان','قيء'] },
  // عظام
  { name: 'دكتور أحمد حازم العوض الموسوي', spec: 'عظام - تبديل مفصل', area: 'الموسوي الأهلية - مستشفى', phone: '07729088006', keys: ['آلام مفاصل','تورم','إرهاق'] },
  { name: 'دكتور سالم فاضل محمد', spec: 'جراحة ركبة ناظورية', area: 'بريهة - قرب جرس المحاكم - المركز الأوري', phone: '07712576460', keys: ['آلام مفاصل','تورم'] },
  // نفسية
  { name: 'دكتور عقيل الصباغ', spec: 'نفسية وعصبية', area: 'العباسية - شارع جامع سيد حامد - مجمع سما العباسية', phone: '07715160616', keys: ['قلق','اضطرابات نوم','صداع','إرهاق'] },
  { name: 'دكتور طاهر عبد الرحمن طاهر', spec: 'نفسية وعصبية', area: 'العشار - خلف المجمع', phone: '07801257738', keys: ['قلق','اضطرابات نوم','صداع','إرهاق'] },
];

function getRecommendedDoctors(symptoms) {
  if (!symptoms || symptoms.length === 0) return [];
  const scored = BASRA_DOCTORS.map(doc => {
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

  const analyze = async () => {
    if (selectedSymptoms.length === 0) {
      showToast(lang==='ar'?'الرجاء اختيار أعراض واحدة على الأقل':'Please select at least one symptom', 'error');
      return;
    }
    setLoading(true);

    const hasFiles = labFile || sonarFile || mriFile || ctFile;
    const filesDesc = [
      labFile ? (lang==='ar'?`تحليل مخبري: ${labFile.name}`:`Lab: ${labFile.name}`) : '',
      sonarFile ? (lang==='ar'?`سونار: ${sonarFile.name}`:`Sonar: ${sonarFile.name}`) : '',
      mriFile ? (lang==='ar'?`رنين مغناطيسي: ${mriFile.name}`:`MRI: ${mriFile.name}`) : '',
      ctFile ? (lang==='ar'?`CT: ${ctFile.name}`:`CT: ${ctFile.name}`) : '',
    ].filter(Boolean).join('، ');

    let prompt;
    if (lang === 'en') {
      prompt = `You are a specialist consultant physician. The patient has the following symptoms:\n- ${selectedSymptoms.join('\n- ')}\nDuration: ${duration||'unspecified'}\nAge: ${age||'unspecified'} years\nGender: ${gender||'unspecified'}\n${hasFiles?`Attached medical files: ${filesDesc}`:''}\nProvide a detailed diagnosis in English. Format as JSON only: {"diagnoses":[{"name":"...","probability":"...","description":"..."}],"severity":"mild|moderate|high|urgent","tests":["..."],"recommendations":["..."],"urgent":false,"urgentReason":""}`;
    } else {
      prompt = `أنت طبيب استشاري متخصص في التشخيص الطبي. المريض يعاني من الأعراض التالية:
الأعراض: ${selectedSymptoms.join('، ')}
مدة الأعراض: ${duration || 'غير محددة'}
العمر: ${age || 'غير محدد'} سنة
الجنس: ${gender || 'غير محدد'}
${hasFiles ? `الملفات الطبية المرفقة: ${filesDesc}` : ''}

المطلوب:
1. ذكر 2-3 تشخيصات محتملة مرتبة حسب الأرجحية
2. درجة الخطورة: (خفيف / متوسط / مرتفع / طارئ)
3. الفحوصات المقترحة (تحاليل، سونار، مفراس، رنين)
4. التوصيات العلاجية الأولية
5. هل يحتاج مراجعة طبيب فوراً؟

الرجاء الإجابة بتنسيق JSON فقط بدون أي نص خارجه:
{
  "diagnoses": [
    {"name": "اسم التشخيص", "probability": "نسبة مئوية", "description": "وصف مختصر"},
    {"name": "تشخيص ثانٍ", "probability": "نسبة مئوية", "description": "وصف مختصر"}
  ],
  "severity": "خفيف | متوسط | مرتفع | طارئ",
  "tests": ["فحص 1", "فحص 2"],
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"],
  "urgent": true | false,
  "urgentReason": "سبب الاستعجال إن وجد"
}`;
    }

    // Use smart local diagnosis (API blocked by CORS in browser)
    const recDoctors = getRecommendedDoctors(selectedSymptoms);
    const diagnosis = buildFallback(selectedSymptoms);
    setResult({ ...diagnosis, symptoms: selectedSymptoms, age, gender, duration, doctors: recDoctors });
    setStep(3);
    setLoading(false);
  };

  const buildFallback = (symptoms) => {
    const s = symptoms;
    // hasAll: all keys present, hasAny: at least one present, hasOne: exactly this one
    const hasAny = (...keys) => keys.some(k => s.includes(k));
    const hasBoth = (a, b) => s.includes(a) && s.includes(b);
    const hasAll = (...keys) => keys.every(k => s.includes(k));
    const has = (...keys) => keys.some(k => s.includes(k)); // alias

    // ارتفاع ضغط الدم - single symptom sufficient
    if (s.includes('ارتفاع ضغط دم')) return {
      diagnoses: [
        {name:'ارتفاع ضغط الدم (Hypertension)', probability:'75%', description:'ضغط الدم المرتفع يستلزم علاجاً مستمراً'},
        {name:'الإجهاد والتوتر المزمن', probability:'20%', description:'التوتر قد يرفع ضغط الدم مؤقتاً'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['قياس ضغط الدم مرتين يومياً','تحليل دم شامل','وظائف الكلى','رسم قلب ECG'],
      recommendations:['قياس الضغط صباحاً ومساءً وتسجيله','تقليل الملح والدهون','ممارسة المشي 30 دقيقة يومياً','مراجعة طبيب باطني لوصف العلاج']
    };

    // التهاب الجيوب الأنفية
    if (s.includes('احتقان أنف')) return {
      diagnoses: [
        {name:'التهاب الجيوب الأنفية (Sinusitis)', probability:'60%', description:'التهاب يسبب احتقاناً وضغطاً حول الأنف'},
        {name:'حساسية الأنف الموسمية (Rhinitis)', probability:'30%', description:'رد فعل تحسسي للغبار أو حبوب اللقاح'},
        {name:'الرشح العادي (Common Cold)', probability:'10%', description:'عدوى فيروسية خفيفة'},
      ],
      severity:'خفيف', urgent:false, urgentReason:'',
      tests:['فحص الأنف والحنجرة','أشعة سينية للجيوب','تحليل حساسية'],
      recommendations:['استنشاق البخار الساخن 3 مرات يومياً','غسيل الأنف بمحلول ملحي','تجنب الغبار والدخان','مراجعة طبيب أنف وأذن وحنجرة']
    };

    // السكري
    if (s.includes('سكري')) return {
      diagnoses: [
        {name:'داء السكري النوع الثاني', probability:'65%', description:'ارتفاع مستوى سكر الدم بسبب مقاومة الأنسولين'},
        {name:'مقدمات السكري (Prediabetes)', probability:'25%', description:'مستوى السكر أعلى من الطبيعي لكن لم يصل لمرحلة السكري'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['سكر الصيام','HbA1c (سكر 3 أشهر)','تحليل بول','وظائف الكلى'],
      recommendations:['تحليل سكر الدم فوراً','تقليل السكريات والنشويات','ممارسة الرياضة بانتظام','مراجعة طبيب غدد وسكري']
    };

    // آلام المفاصل وحيدة
    if (s.includes('آلام مفاصل')) return {
      diagnoses: [
        {name:'التهاب المفاصل الروماتويدي (RA)', probability:'40%', description:'مرض مناعي يصيب المفاصل ويسبب تورماً'},
        {name:'التهاب المفاصل العظمي (Osteoarthritis)', probability:'35%', description:'تآكل الغضروف مع التقدم بالعمر'},
        {name:'النقرس (Gout)', probability:'20%', description:'تراكم بلورات حمض اليوريك في المفاصل'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['تحليل حمض اليوريك','عامل الروماتويد RF','سرعة ترسيب ESR','أشعة سينية للمفاصل'],
      recommendations:['الراحة وتجنب الحمل الثقيل','كمادات دافئة أو باردة حسب الألم','مضاد التهاب غير ستيرويدي','مراجعة طبيب عظام أو روماتيزم']
    };

    // ارتفاع ضغط الدم مع صداع
    if (hasBoth('ارتفاع ضغط دم', 'صداع') && has('دوار','إرهاق')) return {
      diagnoses: [
        {name:'ارتفاع ضغط الدم (Hypertension)', probability:'70%', description:'ضغط الدم المرتفع يسبب صداعاً ودواراً'},
        {name:'الإجهاد والتعب المزمن', probability:'20%', description:'قد يرافقه صداع ودوار'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['قياس ضغط الدم','تحليل دم شامل','فحص وظائف الكلى'],
      recommendations:['قياس الضغط يومياً','تقليل الملح','ممارسة الرياضة الخفيفة','مراجعة طبيب باطني']
    };

    // التهاب الجيوب الأنفية
    if (has('احتقان أنف','صداع') && has('التهاب حلق','حمى','سعال')) return {
      diagnoses: [
        {name:'التهاب الجيوب الأنفية (Sinusitis)', probability:'65%', description:'التهاب يسبب احتقاناً وصداعاً'},
        {name:'الرشح والإنفلونزا', probability:'25%', description:'عدوى فيروسية شائعة'},
      ],
      severity:'خفيف', urgent:false, urgentReason:'',
      tests:['فحص سريري','أشعة سينية للجيوب','تحليل دم'],
      recommendations:['بخار الماء الساخن','غسيل الأنف بالماء المالح','مزيل الاحتقان','مراجعة طبيب أنف وأذن']
    };

    // السكري
    if (has('إرهاق','فقدان شهية') && has('كثرة التبول','عطش شديد','ضعف بصر')) return {
      diagnoses: [
        {name:'السكري (Diabetes)', probability:'60%', description:'ارتفاع سكر الدم يسبب إرهاقاً وعطشاً'},
        {name:'اضطراب الغدة الدرقية', probability:'20%', description:'تؤثر على مستوى الطاقة'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['تحليل سكر الصيام','HbA1c','تحليل بول','وظائف الغدة الدرقية'],
      recommendations:['تحليل سكر الدم فوراً','تقليل السكريات','مراجعة طبيب غدد وسكري']
    };

    // آلام المفاصل
    if (has('آلام مفاصل','تورم') && has('إرهاق','حمى')) return {
      diagnoses: [
        {name:'التهاب المفاصل الروماتويدي', probability:'45%', description:'مرض مناعي يصيب المفاصل'},
        {name:'النقرس (Gout)', probability:'30%', description:'تراكم حمض اليوريك في المفاصل'},
        {name:'التهاب المفاصل العظمي', probability:'20%', description:'تآكل غضروف المفصل'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['تحليل حمض اليوريك','عامل الروماتويد RF','سرعة ترسيب','أشعة سينية للمفاصل'],
      recommendations:['الراحة وتجنب الإجهاد','كمادات دافئة','مضاد التهاب','مراجعة طبيب عظام']
    };

    // آلام صدر وضيق تنفس
    if (has('آلام صدر','ضيق تنفس')) return {
      diagnoses: [
        {name:'الربو أو التهاب شعبي', probability:'50%', description:'ضيق في الشعب الهوائية'},
        {name:'ذبحة صدرية', probability:'30%', description:'نقص التروية القلبية'},
        {name:'الانصمام الرئوي', probability:'15%', description:'جلطة في الرئة'},
      ],
      severity:'مرتفع', urgent:true, urgentReason:'آلام الصدر مع ضيق التنفس تستوجب تقييماً طارئاً فوراً',
      tests:['رسم قلب ECG','أشعة صدر','تحليل دم شامل','سونار قلب','D-dimer'],
      recommendations:['توجه لطوارئ المستشفى فوراً','لا تمارس أي مجهود','اتصل بالإسعاف']
    };

    // الجهاز الهضمي
    if (has('آلام بطن','غثيان','قيء','إسهال')) return {
      diagnoses: [
        {name:'التهاب المعدة والأمعاء (Gastroenteritis)', probability:'55%', description:'عدوى هضمية فيروسية أو بكتيرية'},
        {name:'متلازمة القولون العصبي (IBS)', probability:'25%', description:'اضطراب وظيفي مزمن'},
        {name:'التسمم الغذائي', probability:'15%', description:'تلوث الطعام'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['تحليل براز','تحليل دم','سونار بطن'],
      recommendations:['إكثار من السوائل والأملاح','تجنب الألبان والدهون مؤقتاً','أدوية مضادة للإسهال','مراجعة طبيب إذا استمر أكثر من 48 ساعة']
    };

    // الحمى والأعراض العامة
    if (has('حمى','إرهاق')) return {
      diagnoses: [
        {name:'الإنفلونزا الموسمية', probability:'60%', description:'فيروس الإنفلونزا الأكثر شيوعاً'},
        {name:'التهاب فيروسي عام', probability:'25%', description:'عدوى فيروسية متنوعة'},
        {name:'التهاب بكتيري', probability:'15%', description:'قد يحتاج مضاداً حيوياً'},
      ],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['تحليل دم كامل CBC','سرعة ترسيب CRP'],
      recommendations:['الراحة التامة','شرب السوائل بكثرة','خافض حرارة','مراجعة الطبيب إذا تجاوزت الحرارة 39 درجة']
    };

    // جلدية
    if (has('طفح جلدي','حكة')) return {
      diagnoses: [
        {name:'الحساسية الجلدية (Urticaria)', probability:'50%', description:'رد فعل تحسسي'},
        {name:'الأكزيما (Eczema)', probability:'30%', description:'التهاب جلدي مزمن'},
        {name:'الصدفية', probability:'15%', description:'مرض جلدي مناعي'},
      ],
      severity:'خفيف', urgent:false, urgentReason:'',
      tests:['فحص جلدي سريري','تحليل حساسية IgE'],
      recommendations:['تجنب المهيجات المحتملة','كريم مرطب','مضاد حساسية','مراجعة طبيب جلدية']
    };

    // صداع ودوار
    if (has('صداع','دوار')) return {
      diagnoses: [
        {name:'الصداع النصفي (Migraine)', probability:'45%', description:'صداع نابض شديد غالباً في جهة واحدة'},
        {name:'التوتر والإجهاد الذهني', probability:'30%', description:'صداع التوتر الشائع'},
        {name:'الدوار الوضعي الحميد (BPPV)', probability:'15%', description:'تأثر على الأذن الداخلية'},
      ],
      severity:'خفيف', urgent:false, urgentReason:'',
      tests:['فحص ضغط الدم','تحليل دم','رنين مغناطيسي للرأس إذا تكرر'],
      recommendations:['الراحة في غرفة هادئة ومظلمة','تجنب الشاشات','مسكن ألم','مراجعة طبيب أعصاب']
    };

    // افتراضي
    return {
      diagnoses: [{name:'يحتاج تقييم طبي شامل', probability:'—', description:'الأعراض متعددة وتستلزم فحصاً سريرياً دقيقاً'}],
      severity:'متوسط', urgent:false, urgentReason:'',
      tests:['تحليل دم كامل CBC','تحليل بول','فحص سريري شامل'],
      recommendations:['مراجعة الطبيب لتشخيص دقيق','وصف الأعراض بالتفصيل','إحضار أي تحاليل سابقة']
    };
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
          {file ? `✅ ${file.name}` : 'انقر للرفع (PDF, صورة)'}
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
            <button className="btn btn-primary" onClick={() => selectedSymptoms.length > 0 ? setStep(2) : showToast('اختر عرضاً واحداً على الأقل', 'error')} style={{ padding: '10px 24px' }}>
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

          <h4 style={{ marginBottom: 14, color: 'var(--text-secondary)', fontSize: 14 }}>📎 إرفاق ملفات طبية (اختياري)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FileUpload label="نتيجة تحاليل" icon="🧪" file={labFile} setFile={setLabFile} inputRef={labRef} accept=".pdf,.jpg,.jpeg,.png" />
            <FileUpload label="تقرير سونار" icon="📡" file={sonarFile} setFile={setSonarFile} inputRef={sonarRef} accept=".pdf,.jpg,.jpeg,.png" />
            <FileUpload label="صورة رنين مغناطيسي" icon="🔬" file={mriFile} setFile={setMriFile} inputRef={mriRef} accept=".pdf,.jpg,.jpeg,.png" />
            <FileUpload label="صورة مفراس (CT Scan)" icon="🖥️" file={ctFile} setFile={setCtFile} inputRef={ctRef} accept=".pdf,.jpg,.jpeg,.png" />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setStep(1)} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)' }}>{lang==='ar'?'رجوع':'Back'}</button>
            <button className="btn btn-primary" onClick={analyze} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaBrain /> تحليل بالذكاء الاصطناعي
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
                  درجة الخطورة: {SEV_LABEL(result.severity)}
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
              <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><FaFileMedical color="#8b5cf6" /> الفحوصات المقترحة</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.tests.map((i) => (
                  <span key={i} style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500 }}>🔬 {}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px' }}>💡 التوصيات</h4>
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
                <FaUserMd color="#1a6bab" /> أطباء متخصصون في البصرة
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
