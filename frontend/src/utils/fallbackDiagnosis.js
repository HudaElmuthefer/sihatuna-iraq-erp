// frontend/src/utils/fallbackDiagnosis.js
//
// ── إصلاح: استخراج منطق التشخيص المحلي لملف مستقل قابل للاختبار ────────────────
// كانت هذه الدالة معرَّفة داخل مكوّن AIDiagnosisPage.js نفسه — لا توجد طريقة
// لاختبارها آلياً بمعزل عن باقي الصفحة (React rendering، حالة المكوّن...).
// نقلها لملف مستقل (دالة نقية pure function: نفس المدخل يعطي دائماً نفس
// المخرج، بدون أي اعتماد على DOM أو حالة React) يسمح باختبارات Jest مباشرة
// عليها — راجع src/utils/fallbackDiagnosis.test.js.
//
// نظام مطابقة أعراض بقواعد ثابتة (Rule-Based) — يُستخدم فقط لما ما يكون
// الذكاء الاصطناعي الحقيقي مفعّلاً (بدون ANTHROPIC_API_KEY بملف الباك إند).
// راجع AIDiagnosisPage.js للشارة الصادقة التي توضح للمستخدم أي نظام استُخدم.

export function buildFallback(symptoms, lang) {
const L = (ar, en) => lang === 'ar' ? ar : en;
const s = symptoms;
  // hasBoth: كلا العرضين موجودان، has: أي واحد منهم موجود
  const hasBoth = (a, b) => s.includes(a) && s.includes(b);
  const has = (...keys) => keys.some(k => s.includes(k));

  // ارتفاع ضغط الدم - single symptom sufficient
  if (s.includes('ارتفاع ضغط دم')) return {
    diagnoses: [
      {name:L('ارتفاع ضغط الدم (Hypertension)','Hypertension'), probability:'75%', description:L('ضغط الدم المرتفع يستلزم علاجاً مستمراً','High blood pressure requires ongoing treatment')},
      {name:L('الإجهاد والتوتر المزمن','Chronic Stress'), probability:'20%', description:L('التوتر قد يرفع ضغط الدم مؤقتاً','Stress may temporarily raise blood pressure')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('قياس ضغط الدم مرتين يومياً','Blood pressure measurement twice daily'),L('تحليل دم شامل','Complete blood count'),L('وظائف الكلى','Kidney function test'),L('رسم قلب ECG','ECG')],
    recommendations:[L('قياس الضغط صباحاً ومساءً وتسجيله','Measure and log blood pressure morning and evening'),L('تقليل الملح والدهون','Reduce salt and fat intake'),L('ممارسة المشي 30 دقيقة يومياً','Walk 30 minutes daily'),L('مراجعة طبيب باطني لوصف العلاج','See an internal medicine doctor for treatment')]
  };

  // التهاب الجيوب الأنفية
  if (s.includes('احتقان أنف')) return {
    diagnoses: [
      {name:L('التهاب الجيوب الأنفية (Sinusitis)','Sinusitis'), probability:'60%', description:L('التهاب يسبب احتقاناً وضغطاً حول الأنف','Inflammation causing congestion and pressure around the nose')},
      {name:L('حساسية الأنف الموسمية (Rhinitis)','Seasonal Rhinitis'), probability:'30%', description:L('رد فعل تحسسي للغبار أو حبوب اللقاح','Allergic reaction to dust or pollen')},
      {name:L('الرشح العادي (Common Cold)','Common Cold'), probability:'10%', description:L('عدوى فيروسية خفيفة','A mild viral infection')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('فحص الأنف والحنجرة','Nose and throat exam'),L('أشعة سينية للجيوب','Sinus X-ray'),L('تحليل حساسية','Allergy test')],
    recommendations:[L('استنشاق البخار الساخن 3 مرات يومياً','Steam inhalation 3 times daily'),L('غسيل الأنف بمحلول ملحي','Nasal saline rinse'),L('تجنب الغبار والدخان','Avoid dust and smoke'),L('مراجعة طبيب أنف وأذن وحنجرة','See an ENT doctor')]
  };

  // السكري
  if (s.includes('سكري')) return {
    diagnoses: [
      {name:L('داء السكري النوع الثاني','Type 2 Diabetes'), probability:'65%', description:L('ارتفاع مستوى سكر الدم بسبب مقاومة الأنسولين','Elevated blood sugar due to insulin resistance')},
      {name:L('مقدمات السكري (Prediabetes)','Prediabetes'), probability:'25%', description:L('مستوى السكر أعلى من الطبيعي لكن لم يصل لمرحلة السكري','Blood sugar higher than normal but not yet diabetic')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('سكر الصيام','Fasting blood sugar'),'HbA1c '+L('(سكر 3 أشهر)','(3-month average)'),L('تحليل بول','Urinalysis'),L('وظائف الكلى','Kidney function test')],
    recommendations:[L('تحليل سكر الدم فوراً','Check blood sugar immediately'),L('تقليل السكريات والنشويات','Reduce sugar and starch intake'),L('ممارسة الرياضة بانتظام','Exercise regularly'),L('مراجعة طبيب غدد وسكري','See an endocrinologist')]
  };

  // آلام المفاصل وحيدة
  if (s.includes('آلام مفاصل')) return {
    diagnoses: [
      {name:L('التهاب المفاصل الروماتويدي (RA)','Rheumatoid Arthritis (RA)'), probability:'40%', description:L('مرض مناعي يصيب المفاصل ويسبب تورماً','An autoimmune disease affecting joints, causing swelling')},
      {name:L('التهاب المفاصل العظمي (Osteoarthritis)','Osteoarthritis'), probability:'35%', description:L('تآكل الغضروف مع التقدم بالعمر','Cartilage wear with age')},
      {name:L('النقرس (Gout)','Gout'), probability:'20%', description:L('تراكم بلورات حمض اليوريك في المفاصل','Buildup of uric acid crystals in the joints')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل حمض اليوريك','Uric acid test'),L('عامل الروماتويد RF','Rheumatoid factor (RF)'),L('سرعة ترسيب ESR','ESR'),L('أشعة سينية للمفاصل','Joint X-ray')],
    recommendations:[L('الراحة وتجنب الحمل الثقيل','Rest and avoid heavy lifting'),L('كمادات دافئة أو باردة حسب الألم','Warm or cold compresses depending on pain'),L('مضاد التهاب غير ستيرويدي','NSAID anti-inflammatory'),L('مراجعة طبيب عظام أو روماتيزم','See an orthopedist or rheumatologist')]
  };

  // ارتفاع ضغط الدم مع صداع
  if (hasBoth('ارتفاع ضغط دم', 'صداع') && has('دوار','إرهاق')) return {
    diagnoses: [
      {name:L('ارتفاع ضغط الدم (Hypertension)','Hypertension'), probability:'70%', description:L('ضغط الدم المرتفع يسبب صداعاً ودواراً','High blood pressure causing headache and dizziness')},
      {name:L('الإجهاد والتعب المزمن','Chronic Fatigue'), probability:'20%', description:L('قد يرافقه صداع ودوار','May be accompanied by headache and dizziness')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('قياس ضغط الدم','Blood pressure measurement'),L('تحليل دم شامل','Complete blood count'),L('فحص وظائف الكلى','Kidney function test')],
    recommendations:[L('قياس الضغط يومياً','Measure blood pressure daily'),L('تقليل الملح','Reduce salt intake'),L('ممارسة الرياضة الخفيفة','Light exercise'),L('مراجعة طبيب باطني','See an internal medicine doctor')]
  };

  // التهاب الجيوب الأنفية
  if (has('احتقان أنف','صداع') && has('التهاب حلق','حمى','سعال')) return {
    diagnoses: [
      {name:L('التهاب الجيوب الأنفية (Sinusitis)','Sinusitis'), probability:'65%', description:L('التهاب يسبب احتقاناً وصداعاً','Inflammation causing congestion and headache')},
      {name:L('الرشح والإنفلونزا','Cold & Flu'), probability:'25%', description:L('عدوى فيروسية شائعة','A common viral infection')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('فحص سريري','Clinical exam'),L('أشعة سينية للجيوب','Sinus X-ray'),L('تحليل دم','Blood test')],
    recommendations:[L('بخار الماء الساخن','Steam inhalation'),L('غسيل الأنف بالماء المالح','Nasal saline rinse'),L('مزيل الاحتقان','Decongestant'),L('مراجعة طبيب أنف وأذن','See an ENT doctor')]
  };

  // السكري
  if (has('إرهاق','فقدان شهية') && has('كثرة التبول','عطش شديد','ضعف بصر')) return {
    diagnoses: [
      {name:L('السكري (Diabetes)','Diabetes'), probability:'60%', description:L('ارتفاع سكر الدم يسبب إرهاقاً وعطشاً','High blood sugar causing fatigue and thirst')},
      {name:L('اضطراب الغدة الدرقية','Thyroid Disorder'), probability:'20%', description:L('تؤثر على مستوى الطاقة','Affects energy levels')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل سكر الصيام','Fasting blood sugar'),'HbA1c',L('تحليل بول','Urinalysis'),L('وظائف الغدة الدرقية','Thyroid function test')],
    recommendations:[L('تحليل سكر الدم فوراً','Check blood sugar immediately'),L('تقليل السكريات','Reduce sugar intake'),L('مراجعة طبيب غدد وسكري','See an endocrinologist')]
  };

  // آلام المفاصل
  if (has('آلام مفاصل','تورم') && has('إرهاق','حمى')) return {
    diagnoses: [
      {name:L('التهاب المفاصل الروماتويدي','Rheumatoid Arthritis'), probability:'45%', description:L('مرض مناعي يصيب المفاصل','An autoimmune disease affecting joints')},
      {name:L('النقرس (Gout)','Gout'), probability:'30%', description:L('تراكم حمض اليوريك في المفاصل','Uric acid buildup in the joints')},
      {name:L('التهاب المفاصل العظمي','Osteoarthritis'), probability:'20%', description:L('تآكل غضروف المفصل','Wear of the joint cartilage')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل حمض اليوريك','Uric acid test'),L('عامل الروماتويد RF','Rheumatoid factor (RF)'),L('سرعة ترسيب','ESR'),L('أشعة سينية للمفاصل','Joint X-ray')],
    recommendations:[L('الراحة وتجنب الإجهاد','Rest and avoid exertion'),L('كمادات دافئة','Warm compresses'),L('مضاد التهاب','Anti-inflammatory medication'),L('مراجعة طبيب عظام','See an orthopedist')]
  };

  // آلام صدر وضيق تنفس
  if (has('آلام صدر','ضيق تنفس')) return {
    diagnoses: [
      {name:L('الربو أو التهاب شعبي','Asthma or Bronchitis'), probability:'50%', description:L('ضيق في الشعب الهوائية','Narrowing of the airways')},
      {name:L('ذبحة صدرية','Angina'), probability:'30%', description:L('نقص التروية القلبية','Reduced blood flow to the heart')},
      {name:L('الانصمام الرئوي','Pulmonary Embolism'), probability:'15%', description:L('جلطة في الرئة','A blood clot in the lung')},
    ],
    severity:'مرتفع', urgent:true, urgentReason:L('آلام الصدر مع ضيق التنفس تستوجب تقييماً طارئاً فوراً','Chest pain with shortness of breath requires immediate emergency evaluation'),
    tests:[L('رسم قلب ECG','ECG'),L('أشعة صدر','Chest X-ray'),L('تحليل دم شامل','Complete blood count'),L('سونار قلب','Echocardiogram'),'D-dimer'],
    recommendations:[L('توجه لطوارئ المستشفى فوراً','Go to the hospital emergency room immediately'),L('لا تمارس أي مجهود','Avoid any physical exertion'),L('اتصل بالإسعاف','Call an ambulance')]
  };

  // الجهاز الهضمي
  if (has('آلام بطن','غثيان','قيء','إسهال')) return {
    diagnoses: [
      {name:L('التهاب المعدة والأمعاء (Gastroenteritis)','Gastroenteritis'), probability:'55%', description:L('عدوى هضمية فيروسية أو بكتيرية','A viral or bacterial digestive infection')},
      {name:L('متلازمة القولون العصبي (IBS)','Irritable Bowel Syndrome (IBS)'), probability:'25%', description:L('اضطراب وظيفي مزمن','A chronic functional disorder')},
      {name:L('التسمم الغذائي','Food Poisoning'), probability:'15%', description:L('تلوث الطعام','Contaminated food')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل براز','Stool test'),L('تحليل دم','Blood test'),L('سونار بطن','Abdominal ultrasound')],
    recommendations:[L('إكثار من السوائل والأملاح','Increase fluids and electrolytes'),L('تجنب الألبان والدهون مؤقتاً','Temporarily avoid dairy and fatty foods'),L('أدوية مضادة للإسهال','Anti-diarrheal medication'),L('مراجعة طبيب إذا استمر أكثر من 48 ساعة','See a doctor if symptoms persist beyond 48 hours')]
  };

  // الحمى والأعراض العامة
  if (has('حمى','إرهاق')) return {
    diagnoses: [
      {name:L('الإنفلونزا الموسمية','Seasonal Flu'), probability:'60%', description:L('فيروس الإنفلونزا الأكثر شيوعاً','The most common flu virus')},
      {name:L('التهاب فيروسي عام','General Viral Infection'), probability:'25%', description:L('عدوى فيروسية متنوعة','Various viral infections')},
      {name:L('التهاب بكتيري','Bacterial Infection'), probability:'15%', description:L('قد يحتاج مضاداً حيوياً','May require antibiotics')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل دم كامل CBC','Complete blood count (CBC)'),L('سرعة ترسيب CRP','CRP / ESR')],
    recommendations:[L('الراحة التامة','Complete rest'),L('شرب السوائل بكثرة','Drink plenty of fluids'),L('خافض حرارة','Fever reducer'),L('مراجعة الطبيب إذا تجاوزت الحرارة 39 درجة','See a doctor if fever exceeds 39°C')]
  };

  // جلدية
  if (has('طفح جلدي','حكة')) return {
    diagnoses: [
      {name:L('الحساسية الجلدية (Urticaria)','Urticaria (Hives)'), probability:'50%', description:L('رد فعل تحسسي','An allergic reaction')},
      {name:L('الأكزيما (Eczema)','Eczema'), probability:'30%', description:L('التهاب جلدي مزمن','A chronic skin inflammation')},
      {name:L('الصدفية','Psoriasis'), probability:'15%', description:L('مرض جلدي مناعي','An autoimmune skin condition')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('فحص جلدي سريري','Clinical skin exam'),L('تحليل حساسية IgE','IgE allergy test')],
    recommendations:[L('تجنب المهيجات المحتملة','Avoid potential irritants'),L('كريم مرطب','Moisturizing cream'),L('مضاد حساسية','Antihistamine'),L('مراجعة طبيب جلدية','See a dermatologist')]
  };

  // صداع ودوار
  if (has('صداع','دوار')) return {
    diagnoses: [
      {name:L('الصداع النصفي (Migraine)','Migraine'), probability:'45%', description:L('صداع نابض شديد غالباً في جهة واحدة','A severe throbbing headache, usually one-sided')},
      {name:L('التوتر والإجهاد الذهني','Tension & Mental Stress'), probability:'30%', description:L('صداع التوتر الشائع','Common tension headache')},
      {name:L('الدوار الوضعي الحميد (BPPV)','Benign Positional Vertigo (BPPV)'), probability:'15%', description:L('تأثر على الأذن الداخلية','Affects the inner ear')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('فحص ضغط الدم','Blood pressure check'),L('تحليل دم','Blood test'),L('رنين مغناطيسي للرأس إذا تكرر','Head MRI if recurrent')],
    recommendations:[L('الراحة في غرفة هادئة ومظلمة','Rest in a quiet, dark room'),L('تجنب الشاشات','Avoid screens'),L('مسكن ألم','Pain reliever'),L('مراجعة طبيب أعصاب','See a neurologist')]
  };

  // التهاب المسالك البولية
  if (has('حرقان بول','كثرة التبول') && has('آلام بطن','حمى')) return {
    diagnoses: [
      {name:L('التهاب المسالك البولية (UTI)','Urinary Tract Infection (UTI)'), probability:'70%', description:L('عدوى بكتيرية بالمثانة أو مجرى البول','A bacterial infection of the bladder or urinary tract')},
      {name:L('التهاب الكلى (Pyelonephritis)','Kidney Infection (Pyelonephritis)'), probability:'20%', description:L('عدوى صاعدة قد تصل للكلى','An ascending infection that may reach the kidneys')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل بول كامل','Urinalysis'),L('زرع بول','Urine culture'),L('وظائف الكلى','Kidney function test')],
    recommendations:[L('شرب الماء بكثرة','Drink plenty of water'),L('تجنب حبس البول','Avoid holding urine'),L('مضاد حيوي حسب وصفة الطبيب','Antibiotic per doctor prescription'),L('مراجعة طبيب مسالك بولية إذا صاحبها حمى أو ألم بالظهر','See a urologist if accompanied by fever or back pain')]
  };

  // التهاب الحلق واللوزتين
  if (has('التهاب حلق','صعوبة بلع') && has('حمى','سعال')) return {
    diagnoses: [
      {name:L('التهاب اللوزتين (Tonsillitis)','Tonsillitis'), probability:'55%', description:L('التهاب فيروسي أو بكتيري باللوزتين','A viral or bacterial infection of the tonsils')},
      {name:L('التهاب البلعوم الفيروسي','Viral Pharyngitis'), probability:'35%', description:L('التهاب شائع بالحلق','A common throat infection')},
      {name:L('التهاب اللوزتين العقدي (Strep Throat)','Strep Throat'), probability:'10%', description:L('عدوى بكتيرية تستلزم مضاداً حيوياً','A bacterial infection requiring antibiotics')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('مسحة حلق','Throat swab'),L('تحليل دم كامل CBC','Complete blood count (CBC)')],
    recommendations:[L('غرغرة بماء دافئ ومالح','Gargle with warm salt water'),L('سوائل دافئة','Warm fluids'),L('مسكن وخافض حرارة','Pain and fever reducer'),L('مراجعة الطبيب إذا استمر أكثر من 3 أيام','See a doctor if it persists beyond 3 days')]
  };

  // فقر الدم
  if (has('شحوب','إرهاق') && has('دوار','خفقان قلب','ضيق تنفس')) return {
    diagnoses: [
      {name:L('فقر الدم بعوز الحديد','Iron-Deficiency Anemia'), probability:'60%', description:L('نقص الحديد يقلل إنتاج خلايا الدم الحمراء','Low iron reduces red blood cell production')},
      {name:L('فقر الدم بعوز فيتامين B12','Vitamin B12-Deficiency Anemia'), probability:'25%', description:L('نقص فيتامين B12 يؤثر على تكوين الدم','B12 deficiency affects blood cell formation')},
    ],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل دم كامل CBC','Complete blood count (CBC)'),L('مخزون الحديد Ferritin','Ferritin'),L('فيتامين B12','Vitamin B12 level')],
    recommendations:[L('أطعمة غنية بالحديد (لحوم، سبانخ، عدس)','Iron-rich foods (meat, spinach, lentils)'),L('مكملات حديد حسب وصفة الطبيب','Iron supplements per doctor prescription'),L('مراجعة طبيب باطني لتحديد السبب','See an internist to determine the cause')]
  };

  // حصى الكلى
  if (has('آلام بطن') && has('دم بالبول','آلام أسفل الظهر')) return {
    diagnoses: [
      {name:L('حصى الكلى (Kidney Stones)','Kidney Stones'), probability:'65%', description:L('ترسبات صلبة تتشكل بالكلى وتسبب ألماً حاداً','Hard deposits that form in the kidneys, causing sharp pain')},
      {name:L('التهاب المسالك البولية','Urinary Tract Infection'), probability:'25%', description:L('قد يرافقه دم بالبول','May be accompanied by blood in the urine')},
    ],
    severity:'مرتفع', urgent:true, urgentReason:L('ألم الكلى الحاد مع دم بالبول يستلزم تقييماً عاجلاً','Severe kidney pain with blood in urine requires urgent evaluation'),
    tests:[L('سونار كلى','Kidney ultrasound'),L('أشعة مقطعية للبطن','Abdominal CT scan'),L('تحليل بول','Urinalysis'),L('وظائف الكلى','Kidney function test')],
    recommendations:[L('توجه للطوارئ إذا كان الألم شديداً','Go to the emergency room if pain is severe'),L('شرب الماء بكثرة','Drink plenty of water'),L('مسكن ألم حسب وصفة الطبيب','Pain reliever per doctor prescription'),L('مراجعة طبيب مسالك بولية','See a urologist')]
  };

  // الجفاف
  if (has('عطش شديد','جفاف فم') && has('دوار','إرهاق')) return {
    diagnoses: [
      {name:L('الجفاف (Dehydration)','Dehydration'), probability:'70%', description:L('نقص السوائل بالجسم','A lack of fluids in the body')},
      {name:L('انخفاض ضغط الدم','Low Blood Pressure'), probability:'20%', description:L('قد يرافق الجفاف','May accompany dehydration')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('فحص ضغط الدم','Blood pressure check'),L('تحليل الأملاح والشوارد','Electrolyte panel')],
    recommendations:[L('شرب الماء والسوائل تدريجياً','Drink water and fluids gradually'),L('محلول إرواء فموي','Oral rehydration solution'),L('تجنب المجهود بالحر','Avoid exertion in the heat'),L('مراجعة الطبيب إذا لم يتحسن خلال ساعات','See a doctor if it does not improve within hours')]
  };

  // عسر الهضم وحرقة المعدة
  if (has('حرقة معدة','انتفاخ بطن') && has('غثيان','آلام بطن')) return {
    diagnoses: [
      {name:L('عسر الهضم الوظيفي','Functional Dyspepsia'), probability:'50%', description:L('اضطراب هضمي شائع دون سبب عضوي واضح','A common digestive disorder with no clear organic cause')},
      {name:L('ارتجاع المريء (GERD)','Gastroesophageal Reflux (GERD)'), probability:'35%', description:L('صعود حمض المعدة للمريء','Stomach acid rising into the esophagus')},
      {name:L('قرحة المعدة','Peptic Ulcer'), probability:'15%', description:L('تقرح ببطانة المعدة','Erosion of the stomach lining')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('تنظير معدة إذا استمر','Endoscopy if persistent'),L('فحص جرثومة المعدة H. pylori','H. pylori test')],
    recommendations:[L('تجنب الوجبات الدسمة والحارة','Avoid fatty and spicy meals'),L('عدم الاستلقاء بعد الأكل مباشرة','Avoid lying down right after eating'),L('مضاد حموضة','Antacid'),L('مراجعة طبيب جهاز هضمي إذا استمر الألم','See a gastroenterologist if pain persists')]
  };

  // الإمساك المزمن
  if (has('إمساك') && has('آلام بطن','انتفاخ بطن')) return {
    diagnoses: [
      {name:L('الإمساك الوظيفي','Functional Constipation'), probability:'65%', description:L('بطء حركة الأمعاء دون سبب عضوي','Slow bowel movement with no organic cause')},
      {name:L('متلازمة القولون العصبي (IBS)','Irritable Bowel Syndrome (IBS)'), probability:'30%', description:L('اضطراب وظيفي مزمن بالأمعاء','A chronic functional bowel disorder')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('فحص سريري للبطن','Clinical abdominal exam'),L('تحليل دم إذا استمر','Blood test if persistent')],
    recommendations:[L('زيادة الألياف بالغذاء','Increase dietary fiber'),L('شرب الماء بكثرة','Drink plenty of water'),L('ممارسة الرياضة بانتظام','Exercise regularly'),L('مراجعة الطبيب إذا استمر أكثر من أسبوعين','See a doctor if it persists beyond two weeks')]
  };

  // اضطرابات النوم
  if (has('أرق','صعوبة نوم') && has('إرهاق','صداع')) return {
    diagnoses: [
      {name:L('الأرق (Insomnia)','Insomnia'), probability:'60%', description:L('صعوبة الدخول بالنوم أو الاستمرار به','Difficulty falling or staying asleep')},
      {name:L('انقطاع النفس النومي','Sleep Apnea'), probability:'20%', description:L('توقف مؤقت بالتنفس أثناء النوم','Temporary pauses in breathing during sleep')},
    ],
    severity:'خفيف', urgent:false, urgentReason:'',
    tests:[L('فحص سريري عام','General clinical exam'),L('دراسة نوم إذا استمر','Sleep study if persistent')],
    recommendations:[L('تنظيم مواعيد النوم','Maintain a regular sleep schedule'),L('تجنب الكافيين مساءً','Avoid caffeine in the evening'),L('تقليل استخدام الشاشات قبل النوم','Reduce screen use before bed'),L('مراجعة الطبيب إذا استمر أكثر من أسبوعين','See a doctor if it persists beyond two weeks')]
  };

  // افتراضي
  return {
    diagnoses: [{name:L('يحتاج تقييم طبي شامل','Requires comprehensive medical evaluation'), probability:'—', description:L('الأعراض متعددة وتستلزم فحصاً سريرياً دقيقاً','Multiple symptoms require a thorough clinical exam')}],
    severity:'متوسط', urgent:false, urgentReason:'',
    tests:[L('تحليل دم كامل CBC','Complete blood count (CBC)'),L('تحليل بول','Urinalysis'),L('فحص سريري شامل','Comprehensive clinical exam')],
    recommendations:[L('مراجعة الطبيب لتشخيص دقيق','See a doctor for accurate diagnosis'),L('وصف الأعراض بالتفصيل','Describe symptoms in detail'),L('إحضار أي تحاليل سابقة','Bring any prior test results')]
  };
}
