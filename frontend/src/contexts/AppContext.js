/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, checkBackendReachable, LOGO_IMAGE_URL } from '../api';
import { calcPromotionDue, calcAllowanceDue } from '../pages/hr/promotionCalc';

const AppContext = createContext(null);
export { AppContext };

// ─── ERP MODULES (ALL PAGES) ──────────────────────────────────────────────────
export const ALL_PAGES = [
  // ── الرئيسية ──
  { key: 'dashboard',        navKey: 'nav_dashboard',        label: 'لوحة التحكم',         labelEn: 'Dashboard',                   path: '/',                      icon: '🏠', group: 'core' },
  // ── الرعاية السريرية ──
  { key: 'patients',         navKey: 'nav_patients',         label: 'المرضى',               labelEn: 'Patients',                        path: '/patients',              icon: '👥', group: 'clinical' },
  { key: 'medical-codes',    navKey: 'nav_medical_codes',    label: 'رموز التصنيف الطبي',     labelEn: 'Medical Codes',                   path: '/medical-codes',         icon: '🏷️', group: 'clinical' },
  { key: 'doctors',          navKey: 'nav_doctors',          label: 'الأطباء',              labelEn: 'Doctors',                       path: '/doctors',               icon: '🩺', group: 'clinical' },
  { key: 'appointments',     navKey: 'nav_appointments',     label: 'المواعيد',             labelEn: 'Appointments',                      path: '/appointments',          icon: '📅', group: 'clinical' },
  { key: 'departments',      navKey: 'nav_departments',      label: 'الأقسام',              labelEn: 'Departments',                       path: '/departments',           icon: '🏢', group: 'clinical' },
  { key: 'vaccinations',     navKey: 'nav_vaccinations',     label: 'التطعيمات',            labelEn: 'Vaccinations',                     path: '/vaccinations',          icon: '💉', group: 'clinical' },
  { key: 'wards',            navKey: 'nav_wards',            label: 'الردهات',              labelEn: 'Wards',                            path: '/wards',                 icon: '🛏️', group: 'clinical' },
  { key: 'delivery',         navKey: 'nav_delivery',         label: 'صالة الولادة',         labelEn: 'Delivery Room',                    path: '/delivery',              icon: '👶', group: 'clinical' },
  { key: 'physiotherapy',    navKey: 'nav_physiotherapy',    label: 'العلاج الطبيعي',       labelEn: 'Physiotherapy',                    path: '/physiotherapy',         icon: '🏃', group: 'clinical' },
  { key: 'queue',            navKey: 'nav_queue',            label: 'إدارة الطابور',        labelEn: 'Queue Management',                 path: '/queue',                 icon: '🎫', group: 'clinical' },
  { key: 'drug-interactions',navKey: 'nav_drug_interact',    label: 'التضارب الدوائي',      labelEn: 'Drug Interactions',               path: '/drug-interactions',     icon: '💊', group: 'clinical' },
  { key: 'dosage-check',     navKey: 'nav_dosage_check',     label: 'فحص الجرعات',          labelEn: 'Dosage Check',                    path: '/dosage-check',          icon: '⚖️', group: 'clinical' },
  { key: 'allergy-check',    navKey: 'nav_allergy_check',    label: 'فحص الحساسية الدوائية', labelEn: 'Allergy Check',                   path: '/allergy-check',         icon: '🚫', group: 'clinical' },
  { key: 'medical-leave',    navKey: 'nav_medical_leave',    label: 'الإجازات المرضية',     labelEn: 'Medical Leave',              path: '/medical-leave',         icon: '🏥', group: 'clinical' },
  { key: 'ai-diagnosis',     navKey: 'nav_ai_diagnosis',     label: 'التشخيص بالذكاء الاصطناعي', labelEn: 'AI Diagnosis',    path: '/ai-diagnosis',          icon: '🧠', group: 'clinical' },
  { key: 'crm',              navKey: 'nav_crm',              label: 'إدارة علاقات المرضى',   labelEn: 'Patient CRM',                 path: '/crm',                   icon: '📇', group: 'clinical' },
  // ── المالية ──
  { key: 'accounts',         navKey: 'nav_accounts',         label: 'الحسابات والمالية',    labelEn: 'Accounts & Finance',              path: '/accounts',              icon: '💰', group: 'finance' },
  { key: 'procurement',      navKey: 'nav_procurement',      label: 'المشتريات',            labelEn: 'Procurement',                     path: '/procurement',           icon: '🛒', group: 'finance' },
  { key: 'inventory',        navKey: 'nav_inventory',        label: 'المخزون والمستودعات',  labelEn: 'Inventory',           path: '/inventory',             icon: '📦', group: 'finance' },
  { key: 'billing',          navKey: 'nav_billing',          label: 'الفوترة والدفع',       labelEn: 'Billing & Payment',              path: '/billing',               icon: '🧾', group: 'finance' },
  { key: 'payment-settings', navKey: 'nav_payment_settings', label: 'إعدادات الدفع',        labelEn: 'Payment Settings',              path: '/payment-settings',      icon: '💳', group: 'finance' },
  // ── الموارد البشرية ──
  { key: 'hr',               navKey: 'nav_hr',               label: 'الموارد البشرية',      labelEn: 'Human Resources',               path: '/hr',                    icon: '👔', group: 'hr' },
  { key: 'services',         navKey: 'nav_services',         label: 'الخدمات الشخصية',      labelEn: 'Personal Services',              path: '/services',              icon: '🎯', group: 'hr' },
  // ── إدارة المشاريع ──
  { key: 'projects',         navKey: 'nav_projects',         label: 'إدارة المشاريع',       labelEn: 'Projects',                path: '/projects',              icon: '📐', group: 'projects' },
  // ── إدارة الوثائق ──
  { key: 'documents',        navKey: 'nav_documents',        label: 'ضبط الوثائق',           labelEn: 'Document Control',         path: '/documents',             icon: '📄', group: 'documents' },
  { key: 'quality',          navKey: 'nav_quality',          label: 'إدارة الجودة ISO',     labelEn: 'Quality (ISO)',              path: '/quality',               icon: '🏅', group: 'documents' },
  // ── المختبرات والتصوير الطبي ──
  { key: 'laboratory',       navKey: 'nav_laboratory',       label: 'المختبرات الطبية',     labelEn: 'Laboratory',              path: '/laboratory',            icon: '🔬', group: 'medtech' },
  { key: 'radiology',        navKey: 'nav_radiology',        label: 'الأشعة والتصوير الطبي', labelEn: 'Radiology & Imaging',         path: '/radiology',             icon: '📡', group: 'medtech' },
  { key: 'results',          navKey: 'nav_results',          label: 'نتائج التحاليل والأشعة', labelEn: 'Lab & Radiology Results',    path: '/results',               icon: '📄', group: 'medtech' },
  { key: 'pharmacy',         navKey: 'nav_pharmacy',         label: 'الصيدلية',             labelEn: 'Pharmacy',                      path: '/pharmacy',              icon: '💊', group: 'medtech' },
  // ── الإسعاف والمركبات ──
  { key: 'ambulance',        navKey: 'nav_ambulance',        label: 'الإسعاف والمركبات',    labelEn: 'Ambulance & Vehicles',              path: '/ambulance',             icon: '🚑', group: 'ops' },
  // ── الأصول والأجهزة ──
  { key: 'assets',           navKey: 'nav_assets',           label: 'الأصول والأجهزة الطبية', labelEn: 'Medical Assets',        path: '/assets',                icon: '🏗', group: 'assets' },
  // ── التقارير والتحليلات ──
  { key: 'smart-reports',    navKey: 'nav_smart_reports',    label: 'التقارير والتحليلات',  labelEn: 'Reports & Analytics',            path: '/smart-reports',         icon: '📊', group: 'reports' },
  // ── الإعدادات ── (مجموعة خاصة بها، وليس 'core' مثل لوحة التحكم — حتى تُعرَض
  // دائماً كآخر عنصر بالقائمة الجانبية، بغض النظر عن ترتيبها هنا بالمصفوفة.
  // انظر Layout.js: التجميع يعتمد على أول ظهور لاسم المجموعة أثناء المرور
  // على الصفحات، فلو بقيت 'core' نفسها المستخدَمة مع "لوحة التحكم" (أول
  // عنصر بالمصفوفة)، كانت "الإعدادات" ستُعرَض مباشرة بعد لوحة التحكم أعلى
  // القائمة، رغم كونها آخر عنصر هنا فعلياً.
  { key: 'settings',         navKey: 'nav_settings',         label: 'الإعدادات',            labelEn: 'Settings',                     path: '/settings',              icon: '⚙️', group: 'settingsFooter' },
];

// ERP Role definitions
export const ERP_ROLES = {
  admin:       { label: 'مدير النظام',     labelEn: 'System Admin',      color: '#1a6bab' },
  doctor:      { label: 'طبيب',            labelEn: 'Doctor',            color: '#10b981' },
  nurse:       { label: 'ممرضة',           labelEn: 'Nurse',             color: '#8b5cf6' },
  accountant:  { label: 'محاسب',           labelEn: 'Accountant',        color: '#f59e0b' },
  hr_manager:  { label: 'مدير موارد بشرية',labelEn: 'HR Manager',        color: '#ec4899' },
  procurement: { label: 'مسؤول مشتريات',  labelEn: 'Procurement Officer',color: '#06b6d4' },
  warehouse:   { label: 'أمين مخزن',      labelEn: 'Warehouse Keeper',  color: '#84cc16' },
  pm:          { label: 'مدير مشاريع',    labelEn: 'Project Manager',   color: '#f97316' },
  dcc:         { label: 'مسؤول وثائق',   labelEn: 'Document Controller',color: '#6366f1' },
};

// ─── SYSTEM USERS ─────────────────────────────────────────────────────────────
const defaultUsers = [
  { id:1, name:'System Admin',    username:'admin',       password:'admin',     email:'admin@sihatuna.iq',       role:'admin',       jobTitle:'مدير النظام',       avatar:'م', color:'#1a6bab', permissions: ALL_PAGES.map(p=>p.key) },
  { id:2, name:'د. أحمد سالم',  username:'doctor',      password:'doctor',    email:'doctor@sihatuna.iq',      role:'doctor',      jobTitle:'طبيب اختصاص',       avatar:'أ', color:'#10b981', permissions:['dashboard','patients','appointments','medical-leave','vaccinations','ai-diagnosis','drug-interactions','laboratory','radiology','pharmacy'] },
  { id:3, name:'سارة قاسم',     username:'nurse',       password:'nurse',     email:'nurse@sihatuna.iq',       role:'nurse',       jobTitle:'ممرضة',              avatar:'س', color:'#8b5cf6', permissions:['dashboard','patients','appointments','vaccinations','medical-leave'] },
  { id:4, name:'علي المحاسب',   username:'accountant',  password:'account',   email:'accounts@sihatuna.iq',    role:'accountant',  jobTitle:'محاسب',              avatar:'ع', color:'#f59e0b', permissions:['dashboard','accounts','procurement','smart-reports'] },
  { id:5, name:'هدى الموارد',   username:'hr',          password:'hr123',     email:'hr@sihatuna.iq',          role:'hr_manager',  jobTitle:'مدير موارد بشرية',  avatar:'ه', color:'#ec4899', permissions:['dashboard','hr','services','smart-reports'] },
  { id:6, name:'وليد المخزن',   username:'warehouse',   password:'wh123',     email:'warehouse@sihatuna.iq',   role:'warehouse',   jobTitle:'أمين مخزن',          avatar:'و', color:'#84cc16', permissions:['dashboard','inventory','procurement'] },
  { id:7, name:'نور المشاريع',  username:'pm',          password:'pm123',     email:'pm@sihatuna.iq',          role:'pm',          jobTitle:'مدير مشاريع',        avatar:'ن', color:'#f97316', permissions:['dashboard','projects','smart-reports','documents'] },
  { id:8, name:'زينب الوثائق',  username:'dcc',         password:'dcc123',    email:'dcc@sihatuna.iq',         role:'dcc',         jobTitle:'مسؤول ضبط الوثائق', avatar:'ز', color:'#6366f1', permissions:['dashboard','documents','smart-reports'] },
];

// ─── GLOBAL SHARED DATA ────────────────────────────────────────────────────────
const DAYS_AR = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
const DAYS_EN = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
export const translateDays = (days, lang) => days.map(d => {
  const i = DAYS_AR.indexOf(d);
  return lang === 'en' && i >= 0 ? DAYS_EN[i] : d;
});

// ─── اسم النظام الافتراضي (قبل أي تخصيص من الإدارة) ───────────────────────
// هذه القيمة بالضبط التي يراها كل مستخدم اليوم بالسايدبار وصفحة تسجيل
// الدخول — يجب أن تبقى كما هي حرفياً حتى لا يتغيّر شيء ما لم يلمس أحد هذا
// الإعداد إطلاقاً (راجع "App Name" بتبويب الشعار في SettingsPage.js).
//
// NOTE (English casing): the codebase has always shown the English name in
// TWO different castings — Title Case "Sihatuna Iraq" (sidebar, login page)
// and ALL CAPS "SIHATUNA IRAQ" (copyright footer, browser tab title, About
// page). This constant matches the Title Case form; the three all-caps
// spots apply `.toUpperCase()` at their own call site so every location's
// unset default still renders pixel-identical to what it shows today.
export const DEFAULT_APP_NAME_AR = 'صحتنا عراق';
export const DEFAULT_APP_NAME_EN = 'Sihatuna Iraq';

// ─── لوحة التحكم القابلة للتخصيص (Stage 5) ─────────────────────────────────
// الترتيب الافتراضي = نفس ترتيب العرض الحالي بالضبط (كل الودجت ظاهرة)، حتى
// أي مستخدم لم يخصَّص شيئاً بعد يرى نفس لوحة التحكم كما كانت دائماً.
export const DEFAULT_DASHBOARD_WIDGETS = ['erp', 'stats', 'departments', 'appointments', 'doctors'];

// ─── إعدادات الطباعة الافتراضية العامة ────────────────────────────────────
// تُستخدم كقيمة أولية لكل زر طباعة بالنظام (PrintButton) ما لم يعدّلها
// المستخدم لهذه الطبعة تحديداً عبر لوحة الخيارات المسبقة. logo: false افتراضياً
// لأن رفع الشعار الفعلي يأتي بمرحلة لاحقة — الخيار موجود هنا مسبقاً حتى
// يشتغل تلقائياً بمجرد إضافة الشعار بدون أي تعديل إضافي بهذا الملف.
export const DEFAULT_PRINT_SETTINGS = {
  paperSize: 'A4',       // 'A4' | 'Letter'
  orientation: 'portrait', // 'portrait' | 'landscape'
  includeHeader: true,
  includeFooter: true,
  includeLogo: true,
  // '' means "no global override" — falls back to the original hardcoded
  // default text (see utils/printDefaults.js). Setting either of these gives
  // a *persistent* replacement for that default, without having to retype a
  // per-print override every time (see PrintButton.js's precedence: per-print
  // text > this global default > the original hardcoded default).
  headerText: '',
  footerText: '',
};

export const initialDoctors = [
  { id:1, name:'د. أحمد سالم الراشدي', nameEn:'Dr. Ahmed Salem Al-Rashidi', specialization:'باطنية وصدرية', specializationEn:'Internal/Chest Medicine', deptId:1, experience:15, phone:'07701234567', status:'active', rating:4.8, patients:1240, gender:'male', avatar:'أ', color:'#1a6bab', bio:'خبرة 15 سنة في الباطنية', bioEn:'15 years experience in internal medicine', availableDays:['السبت','الأحد','الاثنين','الثلاثاء'], workHours:'8:00 - 14:00', fee:25000 },
  { id:2, name:'د. فاطمة حسن العبيدي', nameEn:'Dr. Fatima Hassan Al-Obaidi', specialization:'نسائية وتوليد', specializationEn:'OB/GYN', deptId:5, experience:12, phone:'07702345678', status:'active', rating:4.9, patients:980, gender:'female', avatar:'ف', color:'#8b5cf6', bio:'متخصصة في صحة المرأة', bioEn:"Specialist in women's health", availableDays:['الأحد','الاثنين','الأربعاء'], workHours:'9:00 - 15:00', fee:35000 },
  { id:3, name:'د. محمد علي الموسوي', nameEn:'Dr. Mohammed Ali Al-Mousawi', specialization:'أطفال', specializationEn:'Pediatrics', deptId:1, experience:10, phone:'07703456789', status:'active', rating:4.7, patients:1560, gender:'male', avatar:'م', color:'#10b981', bio:'طبيب أطفال معتمد', bioEn:'Certified pediatrician', availableDays:['السبت','الثلاثاء','الخميس'], workHours:'10:00 - 16:00', fee:20000 },
  { id:4, name:'د. زينب كاظم الجبوري', nameEn:'Dr. Zainab Kadhim Al-Jabouri', specialization:'جلدية', specializationEn:'Dermatology', deptId:3, experience:8, phone:'07704567890', status:'active', rating:4.6, patients:720, gender:'female', avatar:'ز', color:'#f59e0b', bio:'أمراض جلدية وتجميل', bioEn:'Skin diseases and cosmetics', availableDays:['الاثنين','الأربعاء','الخميس'], workHours:'11:00 - 17:00', fee:30000 },
  { id:5, name:'د. نور محمد الشمري', nameEn:'Dr. Noor Mohammed Al-Shamri', specialization:'عيون', specializationEn:'Ophthalmology', deptId:6, experience:14, phone:'07706789012', status:'active', rating:4.8, patients:640, gender:'female', avatar:'ن', color:'#06b6d4', bio:'جراحة وعلاج أمراض العيون', bioEn:'Eye surgery and treatment', availableDays:['السبت','الاثنين','الأربعاء'], workHours:'8:00 - 13:00', fee:40000 },
  { id:6, name:'د. علي حسين البصري', nameEn:'Dr. Ali Hussein Al-Basri', specialization:'عظام وكسور', specializationEn:'Orthopedics', deptId:2, experience:20, phone:'07705678901', status:'inactive', rating:4.5, patients:1890, gender:'male', avatar:'ع', color:'#ef4444', bio:'جراحة العظام والمفاصل', bioEn:'Bone and joint surgery', availableDays:['الأحد','الثلاثاء'], workHours:'9:00 - 14:00', fee:45000 },
];

export const initialDepartments = [
  { id:1, name:'الفحوصات الطبية', nameEn:'Medical Examinations', icon:'🔬', doctorIds:[1,3], patients:245, status:'active', head:'د. أحمد سالم', headEn:'Dr. Ahmed Salem', color:'#1a6bab', description:'فحوصات طبية شاملة', descriptionEn:'Comprehensive medical examinations' },
  { id:2, name:'التحاليل', nameEn:'Laboratory', icon:'🧪', doctorIds:[6], patients:180, status:'active', head:'د. علي الكريم', headEn:'Dr. Ali Al-Kareem', color:'#10b981', description:'تحاليل مخبرية دقيقة', descriptionEn:'Precise laboratory tests' },
  { id:3, name:'الأشعة', nameEn:'Radiology', icon:'📡', doctorIds:[4], patients:120, status:'active', head:'د. سمر ياسر', headEn:'Dr. Samar Yaser', color:'#8b5cf6', description:'تصوير بالأشعة السينية والرنين', descriptionEn:'X-ray and MRI imaging' },
  { id:4, name:'السونار', nameEn:'Ultrasound', icon:'📱', doctorIds:[], patients:98, status:'active', head:'د. ريم أحمد', headEn:'Dr. Reem Ahmed', color:'#f59e0b', description:'تصوير بالموجات فوق الصوتية', descriptionEn:'Ultrasound imaging' },
  { id:5, name:'طب النسائية', nameEn:'OB/GYN', icon:'👩‍⚕️', doctorIds:[2], patients:310, status:'active', head:'د. فاطمة حسن', headEn:'Dr. Fatima Hassan', color:'#ec4899', description:'صحة المرأة والتوليد', descriptionEn:"Women's health and obstetrics" },
  { id:6, name:'عيادات العيون', nameEn:'Eye Clinic', icon:'👁️', doctorIds:[5], patients:156, status:'active', head:'د. نور محمد', headEn:'Dr. Noor Mohammed', color:'#06b6d4', description:'طب وجراحة العيون', descriptionEn:'Ophthalmology and eye surgery' },
];

export const initialPatients = [
  { id:1, name:'حسن محمود الزبيدي', age:45, gender:'male', phone:'07711234567', bloodType:'A+', status:'active', lastVisit:'2026-06-10', patientId:'PT-0001', avatar:'ح', color:'#1a6bab' },
  { id:2, name:'مريم علي الحسناوي', age:32, gender:'female', phone:'07722345678', bloodType:'O+', status:'active', lastVisit:'2026-06-12', patientId:'PT-0002', avatar:'م', color:'#8b5cf6' },
  { id:3, name:'سعد أحمد المشهداني', age:58, gender:'male', phone:'07733456789', bloodType:'B+', status:'active', lastVisit:'2026-06-08', patientId:'PT-0003', avatar:'س', color:'#10b981' },
];

export const initialCrmFollowUps = [
  { id:1, patientId:1, followUpType:'checkup', title:'فحص دوري للضغط', dueDate:'2026-07-20', status:'pending', reminderChannel:'sms' },
  { id:2, patientId:2, followUpType:'vaccination', title:'الجرعة الثانية - لقاح الإنفلونزا', dueDate:'2026-07-15', status:'pending', reminderChannel:'whatsapp' },
  { id:3, patientId:3, followUpType:'lab_result', title:'مراجعة نتيجة تحليل السكر', dueDate:'2026-07-05', status:'completed', reminderChannel:'call', completedAt:'2026-07-05T10:00:00.000Z' },
];

export const initialCrmSegments = [
  { id:1, patientId:1, segmentCode:'chronic', priorityLevel:'high', notes:'مريض ضغط مزمن' },
  { id:2, patientId:3, segmentCode:'priority', priorityLevel:'urgent', notes:'' },
];

export const initialCrmInteractions = [
  { id:1, patientId:1, channel:'call', direction:'outbound', subject:'تذكير موعد', notes:'تم التذكير بموعد الفحص الدوري', outcome:'answered', createdAt:'2026-07-01T09:00:00.000Z' },
];

export const initialCrmCampaigns = [];
export const initialCrmCampaignTargets = [];

// ─── الفوترة: قائمة أسعار افتراضية (قابلة للتعديل) ────────────────────────────
export const initialServicePrices = [
  { id:1, category:'consultation', nameAr:'كشفية عامة',          nameEn:'General Consultation',   price:25000 },
  { id:2, category:'consultation', nameAr:'كشفية اختصاص',        nameEn:'Specialist Consultation', price:50000 },
  { id:3, category:'lab',          nameAr:'فحص دم شامل (CBC)',   nameEn:'Complete Blood Count',    price:15000 },
  { id:4, category:'lab',          nameAr:'فحص سكر',              nameEn:'Blood Sugar Test',        price:10000 },
  { id:5, category:'lab',          nameAr:'فحص وظائف كلى',        nameEn:'Kidney Function Test',    price:20000 },
  { id:6, category:'radiology',    nameAr:'أشعة سينية',           nameEn:'X-Ray',                   price:20000 },
  { id:7, category:'radiology',    nameAr:'سونار',                nameEn:'Ultrasound',              price:35000 },
  { id:8, category:'radiology',    nameAr:'مفراس CT',             nameEn:'CT Scan',                 price:150000 },
  { id:9, category:'pharmacy',     nameAr:'صرف وصفة طبية',        nameEn:'Prescription Dispensing', price:0 },
  { id:10,category:'other',        nameAr:'رسوم أخرى',            nameEn:'Other Fees',              price:0 },
];

// ─── PAYMENT GATEWAYS (مرجع ثابت) ─────────────────────────────────────────────
export const PAYMENT_PROVIDERS = [
  { code:'cash',          nameAr:'دفع نقدي',           nameEn:'Cash',            type:'cash',          requiresCredentials:false },
  { code:'zaincash',      nameAr:'زين كاش',             nameEn:'ZainCash',        type:'local_card',    requiresCredentials:true, fields:['merchant_id','secret_key'] },
  { code:'fastpay',       nameAr:'فاست باي',            nameEn:'FastPay',         type:'local_card',    requiresCredentials:true, fields:['merchant_id','api_key'] },
  { code:'qicard',        nameAr:'كي كارد',             nameEn:'Qi Card',         type:'local_card',    requiresCredentials:true, fields:['terminal_id','api_key'] },
  { code:'bank_card',     nameAr:'بطاقة مصرفية محلية',  nameEn:'Local Bank Card', type:'local_card',    requiresCredentials:true, fields:['gateway_url','merchant_id','api_key'] },
  { code:'paypal',        nameAr:'باي بال',             nameEn:'PayPal',          type:'international', requiresCredentials:true, fields:['client_id','client_secret'] },
  { code:'western_union', nameAr:'ويسترن يونيون',       nameEn:'Western Union',   type:'international', requiresCredentials:false },
];

export const initialAppointments = [
  { id:1, patient:'حسن محمود الزبيدي', doctorId:1, doctor:'د. أحمد سالم الراشدي', doctorEn:'Dr. Ahmed Salem Al-Rashidi', department:'الفحوصات الطبية', departmentEn:'Medical Examinations', date:'2026-06-17', time:'09:00', status:'confirmed', type:'checkup', notes:'مراجعة دورية' },
  { id:2, patient:'مريم علي الحسناوي', doctorId:2, doctor:'د. فاطمة حسن العبيدي', doctorEn:'Dr. Fatima Hassan Al-Obaidi', department:'طب النسائية', departmentEn:'OB/GYN', date:'2026-06-17', time:'10:30', status:'pending', type:'followup', notes:'' },
  { id:3, patient:'سعد أحمد المشهداني', doctorId:3, doctor:'د. محمد علي الموسوي', doctorEn:'Dr. Mohammed Ali Al-Mousawi', department:'الفحوصات الطبية', departmentEn:'Medical Examinations', date:'2026-06-18', time:'11:00', status:'confirmed', type:'checkup', notes:'' },
];

// ── ERP: Inventory Initial Data ────────────────────────────────────────────────
export const initialInventory = [
  { id:1, code:'MED-001', name:'أموكسيسيلين 500mg', nameEn:'Amoxicillin 500mg', category:'medicine', unit:'Box', qty:245, minQty:50, maxQty:500, unitCost:3500, supplier:'National Drug Co.', location:'A-01', expiry:'2027-12-31', status:'active' },
  { id:2, code:'MED-002', name:'باراسيتامول 500mg', nameEn:'Paracetamol 500mg', category:'medicine', unit:'Box', qty:38, minQty:100, maxQty:800, unitCost:1200, supplier:'National Drug Co.', location:'A-02', expiry:'2027-06-30', status:'low' },
  { id:3, code:'MED-003', name:'سيليكوكسيب 200mg', nameEn:'Celecoxib 200mg', category:'medicine', unit:'Box', qty:120, minQty:40, maxQty:300, unitCost:8500, supplier:'Al-Ilaj Pharmacy', location:'A-03', expiry:'2026-11-30', status:'active' },
  { id:4, code:'EQP-001', name:'حقن ومحاقن 5ml', nameEn:'Syringes 5ml', category:'supplies', unit:'Box', qty:85, minQty:30, maxQty:200, unitCost:12000, supplier:'Medical Supplies Co.', location:'B-01', expiry:'2028-01-01', status:'active' },
  { id:5, code:'EQP-002', name:'قفازات طبية L', nameEn:'Medical Gloves L', category:'supplies', unit:'Box', qty:12, minQty:20, maxQty:150, unitCost:25000, supplier:'Medical Supplies Co.', location:'B-02', expiry:'2028-06-01', status:'low' },
  { id:6, code:'EQP-003', name:'جهاز قياس ضغط', nameEn:'Blood Pressure Monitor', category:'equipment', unit:'Device', qty:8, minQty:5, maxQty:20, unitCost:185000, supplier:'Medical Equipment Co.', location:'C-01', expiry:null, status:'active' },
  { id:7, code:'MED-004', name:'ميترونيدازول 250mg', nameEn:'Metronidazole 250mg', category:'medicine', unit:'Box', qty:0, minQty:50, maxQty:400, unitCost:2000, supplier:'National Drug Co.', location:'A-04', expiry:'2027-03-31', status:'out' },
];

// ── ERP: Procurement Initial Data ──────────────────────────────────────────────
export const initialProcurement = [
  { id:1, poNo:'PO-2026-001', title:'أدوية ومستلزمات - ربع سنوي', titleEn:'Quarterly Medicine & Supplies', supplier:'شركة الدواء الوطنية', supplierEn:'National Drug Company', date:'2026-06-01', deliveryDate:'2026-06-20', totalAmount:4500000, status:'delivered', items:12, priority:'normal', approvedBy:'مدير النظام' },
  { id:2, poNo:'PO-2026-002', title:'معدات مختبر جديدة', titleEn:'New Lab Equipment', supplier:'المعدات الطبية', supplierEn:'Medical Equipment Co.', date:'2026-06-10', deliveryDate:'2026-07-15', totalAmount:12000000, status:'approved', items:5, priority:'high', approvedBy:'مدير النظام' },
  { id:3, poNo:'PO-2026-003', title:'قرطاسية ومستلزمات مكتبية', titleEn:'Office Stationery & Supplies', supplier:'مستلزمات الإداري', supplierEn:'Admin Supplies Co.', date:'2026-06-15', deliveryDate:'2026-06-22', totalAmount:350000, status:'pending', items:8, priority:'low', approvedBy:null },
  { id:4, poNo:'PO-2026-004', title:'أجهزة حاسوب وشبكات', titleEn:'Computers & Networks', supplier:'شركة التقنية', supplierEn:'Tech Company', date:'2026-05-20', deliveryDate:'2026-06-10', totalAmount:8500000, status:'cancelled', items:10, priority:'normal', approvedBy:null },
];

// ── ERP: Projects Initial Data ──────────────────────────────────────────────────
export const initialProjects = [
  { id:1, code:'PRJ-2026-01', name:'توسعة قسم الطوارئ', nameEn:'Emergency Dept. Expansion', manager:'م. خالد العلي', managerEn:'Eng. Khalid Al-Ali', budget:850000000, spent:320000000, startDate:'2026-01-01', endDate:'2026-12-31', progress:42, status:'active', priority:'high', phase:'تنفيذ', phaseEn:'Execution', milestones:8, completedMilestones:3 },
  { id:2, code:'PRJ-2026-02', name:'تطوير نظام المعلومات الصحية', nameEn:'HIS Development', manager:'م. هدى عبد العظيم', managerEn:'Eng. Huda Abduladheem', budget:180000000, spent:95000000, startDate:'2026-03-01', endDate:'2026-09-30', progress:68, status:'active', priority:'high', phase:'Testing', phaseEn:'Testing', milestones:6, completedMilestones:4 },
  { id:3, code:'PRJ-2025-05', name:'تجديد مبنى الإدارة', nameEn:'Admin Building Renovation', manager:'م. سامر حسين', managerEn:'Eng. Samer Hussein', budget:420000000, spent:418000000, startDate:'2025-06-01', endDate:'2026-01-31', progress:100, status:'completed', priority:'normal', phase:'مُنجَز', phaseEn:'Completed', milestones:5, completedMilestones:5 },
  { id:4, code:'PRJ-2026-03', name:'نظام الطاقة الشمسية', nameEn:'Solar Power System', manager:'م. رنا القاسم', managerEn:'Eng. Rana Al-Qasim', budget:650000000, spent:0, startDate:'2026-08-01', endDate:'2027-06-30', progress:0, status:'planning', priority:'normal', phase:'تخطيط', phaseEn:'Planning', milestones:7, completedMilestones:0 },
];

// ── ERP: Documents Initial Data ────────────────────────────────────────────────
export const initialDocuments = [
  { id:1, docNo:'IN-2026-0542', type:'incoming', title:'كتاب وارد - وزارة الصحة بشأن لقاحات موسم 2026', from:'وزارة الصحة / المديرية العامة', date:'2026-06-15', receivedDate:'2026-06-15', priority:'urgent', status:'processed', subject:'لقاحات', assignedTo:'مدير النظام', tags:['صحة','لقاحات','وزارة'] },
  { id:2, docNo:'IN-2026-0541', type:'incoming', title:'طلب تقرير إنجاز - الجهاز المركزي للإحصاء', from:'الجهاز المركزي للإحصاء', date:'2026-06-14', receivedDate:'2026-06-14', priority:'normal', status:'pending', subject:'إحصاء', assignedTo:'زينب الوثائق', tags:['إحصاء','تقرير'] },
  { id:3, docNo:'OUT-2026-0318', type:'outgoing', title:'رد على استفسار - معهد الصحة العامة', from:'إدارة المستشفى', date:'2026-06-13', receivedDate:null, priority:'normal', status:'sent', subject:'استفسار', assignedTo:'زينب الوثائق', tags:['رد','معهد'] },
  { id:4, docNo:'IN-2026-0540', type:'incoming', title:'فاتورة توريد أدوية - شركة الدواء الوطنية', from:'شركة الدواء الوطنية', date:'2026-06-12', receivedDate:'2026-06-12', priority:'normal', status:'processed', subject:'مشتريات', assignedTo:'علي المحاسب', tags:['فاتورة','أدوية','مشتريات'] },
  { id:5, docNo:'OUT-2026-0317', type:'outgoing', title:'عرض أسعار - مشروع التوسعة', from:'إدارة المشاريع', date:'2026-06-10', receivedDate:null, priority:'high', status:'sent', subject:'مشاريع', assignedTo:'نور المشاريع', tags:['عطاء','مشاريع','توسعة'] },
  { id:6, docNo:'IN-2026-0539', type:'incoming', title:'تقرير التفتيش الصحي السنوي', from:'وزارة الصحة / الرقابة', date:'2026-06-08', receivedDate:'2026-06-08', priority:'high', status:'pending', subject:'تفتيش', assignedTo:'مدير النظام', tags:['تفتيش','رقابة','سنوي'] },
];

// ── ERP: Laboratory Initial Data ──────────────────────────────────────────────
// ── إصلاح: كانت 4 طلبات تحاليل وهمية (بأسماء مرضى وأطباء واقعية، نتائج فعلية
// مثل "126 mg/dL") تظهر تلقائياً كـ"احتياط" لأول مستخدم جديد. تبدأ فارغة
// بصراحة الآن.
export const initialLabTests = [];

// ── ERP: Radiology Initial Data ────────────────────────────────────────────────
// ── إصلاح: كانت 4 فحوصات أشعة وهمية تظهر تلقائياً كـ"احتياط" لأول مستخدم
// جديد. تبدأ فارغة بصراحة الآن.
export const initialRadiology = [];

// ── ERP: Pharmacy Initial Data ─────────────────────────────────────────────────
// ── إصلاح: كانت 3 وصفات صيدلية وهمية (بتكاليف فعلية مثل 18500 د.ع) تظهر
// تلقائياً كـ"احتياط" لأول مستخدم جديد. تبدأ فارغة بصراحة الآن.
export const initialPharmacyOrders = [];

// ── ERP: Ambulance Initial Data ────────────────────────────────────────────────
// ── إصلاح: كانت هذه بيانات تجريبية وهمية (3 سيارات إسعاف، 2 مأمورية) تظهر
// تلقائياً كـ"احتياط" لأول مستخدم جديد قبل أن يضيف أي مركبة حقيقية — بدون
// أي تمييز أنها وهمية. تبدأ فارغة الآن بصراحة تامة؛ البيانات الحقيقية تأتي من
// الباك إند فقط.
export const initialAmbulance = { vehicles: [], missions: [] };

// ── إصلاح: كانت هذه 6 أصول طبية وهمية (جهاز أشعة، MRI بـ650 مليون دينار...)
// تظهر تلقائياً كـ"احتياط" لأول مستخدم جديد قبل أن يضيف أي أصل حقيقي —
// بدون أي تمييز أنها وهمية. تبدأ فارغة الآن بصراحة تامة.
export const initialAssets = [];

// Backward compatibility aliases
export const mockDoctors = initialDoctors;
export const mockDepartments = initialDepartments;
export const mockPatients = initialPatients;
export const mockAppointments = initialAppointments;

// ─── PROVIDER ──────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  // ── AUTO-RESET on version change ─────────────────────────────────────────
  // ── إصلاح: رفع النسخة يمسح أي بيانات تجريبية وهمية (سيارات إسعاف/أصول
  // وهمية) كانت مخبَّأة بمتصفح المستخدم من نسخة سابقة — يجبر إعادة تحميل
  // البيانات الحقيقية من الباك إند بدل عرض البيانات الوهمية القديمة المحفوظة.
  const DATA_VERSION = 'v7.4-no-localstorage-quota-crash';
  const storedVersion = localStorage.getItem('data_version');
  if (storedVersion !== DATA_VERSION) {
    const authUser  = localStorage.getItem('auth_user');
    const theme_    = localStorage.getItem('theme');
    const lang_     = localStorage.getItem('lang');
    const printSettings_ = localStorage.getItem('print_settings');
    localStorage.clear();
    if (authUser)  localStorage.setItem('auth_user',  authUser);
    if (theme_)    localStorage.setItem('theme',      theme_);
    if (lang_)     localStorage.setItem('lang',       lang_);
    if (printSettings_) localStorage.setItem('print_settings', printSettings_);
    localStorage.setItem('data_version', DATA_VERSION);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ar');
  // إعدادات الطباعة العامة (افتراضية لكل طبعة، قابلة للتجاوز مؤقتاً من لوحة
  // خيارات الطباعة قبل كل عملية طباعة دون تغيير هذه القيم المحفوظة)
  const [printSettings, setPrintSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('print_settings'));
      return saved ? { ...DEFAULT_PRINT_SETTINGS, ...saved } : DEFAULT_PRINT_SETTINGS;
    } catch {
      return DEFAULT_PRINT_SETTINGS;
    }
  });
  // مساحة مشتركة لخيارات الطباعة المؤقتة (رأس/تذييل/شعار) بين لوحة الطباعة
  // العامة (PrintButton بالـ Layout) وأي صفحة عندها تصدير PDF خاص بها (مثل
  // التقارير الذكية) — حتى تُعيد استخدام نفس آلية الطباعة الموحَّدة بدل بناء
  // واحدة منفصلة لكل صفحة.
  const [printOverlay, setPrintOverlay] = useState(null);
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; } });
  // ── إصلاح ────────────────────────────────────────────────────────────────
  // بعد الانتقال لـ httpOnly cookies، صار مصدر الحقيقة الفعلي لتسجيل الدخول
  // هو الكوكي نفسها بجانب الخادم، بينما auth_user بـ localStorage مجرّد نسخة
  // محلية مساعدة لعرض الواجهة فوراً دون انتظار. لو صار أي تعارض بينهما (مثلاً
  // المستخدم مسح localStorage يدوياً، أو أي خطأ آخر يفرّغ auth_user بينما
  // الكوكي لا تزال صالحة) — كانت الواجهة تعرض حالة "شبه مسجّل دخول" مربكة: القائمة
  // الجانبية تظهر عادي، لكن كل البيانات تبقى فارغة بصمت بدون أي رسالة خطأ،
  // لأن كل نقاط جلب البيانات تتحقق من user (الفارغ) وتتوقف دون محاولة حتى.
  // الحل: عند التحميل، لو user فارغ محلياً، نتحقق من الخادم مباشرة (الكوكي
  // تُرسَل تلقائياً لو موجودة) — فإن كانت صالحة نستعيد الجلسة الحقيقية، وإن لم
  // تكن (فعلاً غير مسجّل دخول) نبقى بحالة تسجيل الخروج الطبيعية بدون أي تغيير.
  useEffect(() => {
    if (user) return; // عندنا نسخة محلية فعلاً، لا حاجة للتحقق
    api.get('/auth/me')
      .then(freshUser => {
        localStorage.setItem('auth_user', JSON.stringify(freshUser));
        setUser(freshUser);
      })
      .catch(() => { /* لا كوكي صالحة فعلاً — تسجيل خروج طبيعي، لا داعي لأي إجراء */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- نتعمّد التحقق مرة واحدة فقط عند التحميل
  const [toasts, setToasts] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // إصلاح: الإشعارات كانت مصفوفة وهمية ثابتة (mockNotifications) غير متصلة
  // بأي بيانات حقيقية، وبدون أي رابط تنقّل لصفحتها. الآن نخزّن فقط معرّفات
  // الإشعارات المقروءة (تُشتق الإشعارات نفسها حياً من البيانات الحقيقية
  // بالأسفل — انظر useMemo الخاص بـ notifications).
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('read_notif_ids')) || []); } catch { return new Set(); }
  });
  useEffect(() => {
    try { localStorage.setItem('read_notif_ids', JSON.stringify([...readNotifIds])); } catch { /* تخزين تقديري فقط */ }
  }, [readNotifIds]);
  const [systemUsers, setSystemUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('system_users')) || defaultUsers; } catch { return defaultUsers; }
  });

  // ── CLINICAL DATA ──────────────────────────────────────────────────────────
  const [doctors, setDoctors] = useState(() => {
    try {
      const s = localStorage.getItem('app_doctors');
      if (!s) return initialDoctors;
      const saved = JSON.parse(s);
      const needsMigration = saved.some(d => !d.nameEn);
      if (needsMigration) {
        return saved.map(d => {
          const fresh = initialDoctors.find(x => x.id === d.id);
          return fresh ? { ...fresh, ...d, nameEn: fresh.nameEn, specializationEn: fresh.specializationEn, bioEn: fresh.bioEn } : d;
        });
      }
      return saved;
    } catch { return initialDoctors; }
  });
  const [departments, setDepartments] = useState(() => {
    try {
      const s = localStorage.getItem('app_departments');
      if (!s) return initialDepartments;
      const saved = JSON.parse(s);
      const needsMigration = saved.some(d => !d.nameEn);
      if (needsMigration) {
        return saved.map(d => {
          const fresh = initialDepartments.find(x => x.id === d.id);
          return fresh ? { ...fresh, ...d, nameEn: fresh.nameEn, headEn: fresh.headEn, descriptionEn: fresh.descriptionEn } : d;
        });
      }
      return saved;
    } catch { return initialDepartments; }
  });
  const [patients, setPatients] = useState(() => {
    try { const s = localStorage.getItem('app_patients'); return s ? JSON.parse(s) : initialPatients; } catch { return initialPatients; }
  });
  const [syncStatus, setSyncStatus] = useState({}); // { doctors: 'synced', patients: 'offline', ... }
  const [appointments, setAppointments] = useState(() => {
    try {
      const s = localStorage.getItem('app_appointments');
      if (!s) return initialAppointments;
      const saved = JSON.parse(s);
      const typeMap = {'كشف':'checkup','متابعة':'followup','استشارة':'consult','طارئ':'emergency'};
      const needsMigration = saved.some(a => !a.doctorEn || typeMap[a.type]);
      if (needsMigration) {
        return saved.map(a => {
          const fresh = initialAppointments.find(x => x.id === a.id);
          return { ...a, type: typeMap[a.type] || a.type, doctorEn: a.doctorEn || (fresh?.doctorEn) || a.doctor, departmentEn: a.departmentEn || (fresh?.departmentEn) || a.department };
        });
      }
      return saved;
    } catch { return initialAppointments; }
  });

  // إعداد موحّد لكل الموديولات المربوطة بالباك إند — إضافة موديول جديد هنا فقط
  // ── ERP DATA ───────────────────────────────────────────────────────────────
  // ── إصلاح حرج (QuotaExceededError) ──────────────────────────────────────
  // labTests وradiology وpharmacyOrders تُملأ عبر استيراد Excel جماعي وقد
  // تصل لآلاف السجلات دفعة واحدة — تخزينها بـ localStorage (حده الفعلي عادة
  // 5-10 ميجابايت لكل موقع) كان يتسبب بخطأ "Setting the value of erp_labtests
  // exceeded the quota" الذي يوقف تحميل الصفحة بالكامل بعد أي استيراد كبير.
  // لا حاجة حقيقية لهذا التخزين المحلي أصلاً: هذه الموديولات الثلاثة مسجَّلة
  // ضمن SYNCED_MODULES أدناه وتُجلَب بالكامل من الباك إند (PostgreSQL) فور
  // تسجيل الدخول — الخادم هو مصدر الحقيقة، وliocalStorage كان مجرّد نسخة
  // احتياطية زائدة ولا فائدة عملية منها. الآن تبدأ فارغة دائماً في الذاكرة
  // فقط، وتُملأ عبر الجلب من الخادم بعد تسجيل الدخول (انظر useEffect الخاص
  // بـ SYNCED_MODULES بالأسفل).
  const [labTests, setLabTests] = useState(initialLabTests);
  const [radiology, setRadiology] = useState(initialRadiology);
  const [pharmacyOrders, setPharmacyOrders] = useState(initialPharmacyOrders);
  const [ambulanceData, setAmbulanceData] = useState(() => {
    try { const s = localStorage.getItem('erp_ambulance'); return s ? JSON.parse(s) : initialAmbulance; } catch { return initialAmbulance; }
  });
  const [assets, setAssets] = useState(() => {
    try { const s = localStorage.getItem('erp_assets'); return s ? JSON.parse(s) : initialAssets; } catch { return initialAssets; }
  });
  const [inventory, setInventory] = useState(() => {
    try { const s = localStorage.getItem('erp_inventory'); if (!s) return initialInventory; const p = JSON.parse(s); return p[0]?.unit === 'علبة' ? initialInventory : p; } catch { return initialInventory; }
  });
  const [procurement, setProcurement] = useState(() => {
    try { const s = localStorage.getItem('erp_procurement'); return s ? JSON.parse(s) : initialProcurement; } catch { return initialProcurement; }
  });
  const [projects, setProjects] = useState(() => {
    try { const s = localStorage.getItem('erp_projects'); if (!s) return initialProjects; const p = JSON.parse(s); return p[0]?.phase === 'تنفيذ' ? initialProjects : p; } catch { return initialProjects; }
  });
  const [documents, setDocuments] = useState(() => {
    try { const s = localStorage.getItem('erp_documents'); return s ? JSON.parse(s) : initialDocuments; } catch { return initialDocuments; }
  });

  // ── CRM (المرضى) ──────────────────────────────────────────────────────────
  const [crmFollowUps, setCrmFollowUps] = useState(() => {
    try { const s = localStorage.getItem('crm_followups'); return s ? JSON.parse(s) : initialCrmFollowUps; } catch { return initialCrmFollowUps; }
  });
  const [crmSegments, setCrmSegments] = useState(() => {
    try { const s = localStorage.getItem('crm_segments'); return s ? JSON.parse(s) : initialCrmSegments; } catch { return initialCrmSegments; }
  });
  const [crmInteractions, setCrmInteractions] = useState(() => {
    try { const s = localStorage.getItem('crm_interactions'); return s ? JSON.parse(s) : initialCrmInteractions; } catch { return initialCrmInteractions; }
  });
  const [crmCampaigns, setCrmCampaigns] = useState(() => {
    try { const s = localStorage.getItem('crm_campaigns'); return s ? JSON.parse(s) : initialCrmCampaigns; } catch { return initialCrmCampaigns; }
  });
  const [crmCampaignTargets, setCrmCampaignTargets] = useState(() => {
    try { const s = localStorage.getItem('crm_campaign_targets'); return s ? JSON.parse(s) : initialCrmCampaignTargets; } catch { return initialCrmCampaignTargets; }
  });

  // دوال مساعدة CRM
  const addCrmFollowUp = (data) => {
    const nf = { ...data, id: Date.now(), status: 'pending' };
    setCrmFollowUps(p => [...p, nf]);
    syncToServer('crmFollowUps', 'create', nf);
  };
  const updateCrmFollowUpStatus = (id, status) => setCrmFollowUps(p => {
    const updated = p.map(f => f.id === id ? { ...f, status, completedAt: status === 'completed' ? new Date().toISOString() : f.completedAt } : f);
    const changed = updated.find(f => f.id === id);
    if (changed) syncToServer('crmFollowUps', 'update', changed);
    return updated;
  });
  const addCrmInteraction = (data) => {
    const ni = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
    setCrmInteractions(p => [ni, ...p]);
    syncToServer('crmInteractions', 'create', ni);
  };
  const assignCrmSegment = (data) => setCrmSegments(p => {
    const exists = p.find(s => s.patientId === data.patientId && s.segmentCode === data.segmentCode);
    if (exists) {
      const updated = { ...exists, ...data };
      syncToServer('crmSegments', 'update', updated);
      return p.map(s => s === exists ? updated : s);
    }
    const ns = { ...data, id: Date.now() };
    syncToServer('crmSegments', 'create', ns);
    return [...p, ns];
  });
  const addCrmCampaign = (data) => {
    const id = Date.now();
    const nc = { ...data, id, status: 'draft' };
    setCrmCampaigns(p => [...p, nc]);
    syncToServer('crmCampaigns', 'create', nc);
    return id;
  };
  const buildCrmCampaignTargets = (campaignId) => {
    const campaign = crmCampaigns.find(c => c.id === campaignId);
    if (!campaign) return 0;
    const targetPatients = (!campaign.targetSegment || campaign.targetSegment === 'all')
      ? patients.filter(p => p.status === 'active')
      : patients.filter(p => crmSegments.some(s => s.patientId === p.id && s.segmentCode === campaign.targetSegment));
    let added = 0;
    setCrmCampaignTargets(prev => {
      const next = [...prev];
      targetPatients.forEach(p => {
        if (!next.some(t => t.campaignId === campaignId && t.patientId === p.id)) {
          const nt = { id: Date.now() + p.id, campaignId, patientId: p.id, deliveryStatus: 'pending' };
          next.push(nt);
          syncToServer('crmCampaignTargets', 'create', nt);
          added++;
        }
      });
      return next;
    });
    return targetPatients.length;
  };
  const updateCrmTargetDeliveryStatus = (id, deliveryStatus) => setCrmCampaignTargets(p => {
    const updated = p.map(t => t.id === id ? { ...t, deliveryStatus, respondedAt: deliveryStatus === 'responded' ? new Date().toISOString() : t.respondedAt } : t);
    const changed = updated.find(t => t.id === id);
    if (changed) syncToServer('crmCampaignTargets', 'update', changed);
    return updated;
  });

  // ── إعدادات بوابات الدفع ──────────────────────────────────────────────────
  // بوابات الدفع: تُحمَّل من الخادم الحقيقي (PostgreSQL) بدل localStorage —
  // هذا يضمن ظهور نفس الإعدادات بغض النظر عن الجهاز أو المتصفح المستخدَم.
  const [paymentGateways, setPaymentGateways] = useState([]);
  useEffect(() => {
    if (!user) return; // بدون توكن قابل للقراءة من الفرونت إند بعد اليوم، نعتمد على حالة user نفسها كمؤشر تسجيل دخول
    api.get('/admin/payment-gateways')
      .then(rows => {
        setPaymentGateways(rows.map(r => ({
          providerCode: r.provider_code,
          isActive: r.is_active,
          isSandbox: r.is_sandbox,
          hasCredentials: r.has_credentials,
        })));
      })
      .catch(err => console.warn('⚠️ تعذّر تحميل إعدادات بوابات الدفع من الخادم:', err.message));
  }, [user]);
  // صفحة تجيبها لحالها، حتى تستطيع أي صفحة (مثل المرضى) أن تسأل "هل الوضع مفعّل؟"
  // وتعرض حقل اختيار المنشأة عند الحاجة فقط.
  const [hospitals, setHospitals] = useState([]);
  // "المنشأة المعروضة حالياً" — مفهوم مختلف عن hospitalId بحساب المستخدم:
  // هذا فلتر عرض اختياري يظهر فقط لحساب مستوى الوزارة (بلا hospitalId مُعيَّن)
  // الذي يدير عدة منشآت ويحتاج يركّز على وحدة معينة أحياناً بدل الكل دفعة واحدة.
  // 'all' = يرى بيانات كل المنشآت مجتمعة (السلوك الافتراضي الحالي).
  const [viewingHospitalId, setViewingHospitalId] = useState(() => localStorage.getItem('viewing_hospital_id') || 'all');
  useEffect(() => { localStorage.setItem('viewing_hospital_id', viewingHospitalId); }, [viewingHospitalId]);
  // دالة مساعدة تُطبَّق بأي صفحة تريد احترام هذا الفلتر — تُرجع القائمة كاملة
  // لو الفلتر على "الكل" أو لو المستخدم أصلاً مربوط بمنشأة واحدة (فلترته
  // مفروضة سلفاً من الخادم نفسه، فلا داعي لفلترة إضافية بالفرونت إند)
  const filterByViewingHospital = useCallback((records) => {
    if (viewingHospitalId === 'all' || user?.hospitalId) return records;
    return records.filter(r => r.hospitalId === viewingHospitalId);
  }, [viewingHospitalId, user?.hospitalId]);
  const [multiHospitalEnabled, setMultiHospitalEnabled] = useState(false);
  const loadHospitalsAndMode = useCallback(async () => {
    if (!user) return;
    try {
      const [hospList, modeRes] = await Promise.all([
        api.get('/hospitals'),
        api.get('/system-settings/multi_hospital_enabled'),
      ]);
      setHospitals(hospList);
      setMultiHospitalEnabled(modeRes.value === true);
    } catch (err) {
      console.warn('⚠️ تعذّر تحميل بيانات المنشآت:', err.message);
    }
  }, [user]);
  useEffect(() => { loadHospitalsAndMode(); }, [user?.id, loadHospitalsAndMode]);

  // ── شعار المنظمة (Logo) ──────────────────────────────────────────────────
  // يُحمَّل بدون انتظار تسجيل الدخول (بخلاف loadHospitalsAndMode أعلاه) —
  // الشعار يجب أن يظهر بصفحة تسجيل الدخول نفسها، فمسار الجلب (logo-info) عام
  // بالباك إند (بدون auth) قصداً. logoUrl = null يعني لا يوجد شعار مرفوع بعد،
  // فتستخدم كل الأماكن (Layout, LoginPage, PageBanner, PrintButton) الأيقونة
  // الافتراضية.
  //
  // ملاحظة: الجلب يعيد المحاولة تلقائياً (مرة بعد فشل أول محاولة، ومرة أخرى
  // عند كل تسجيل دخول) — إصلاح لمشكلة سابقة كانت تخلي الشعار عالقاً على
  // الأيقونة الافتراضية لبقية الجلسة لو فشلت أول محاولة جلب لأي سبب عابر
  // (الباك إند لا يزال يقلع، أو انقطاع شبكة لحظي عند أول تحميل).
  const [logoInfo, setLogoInfo] = useState({ hasLogo: false, updatedAt: null });
  const reloadLogo = useCallback(async () => {
    try {
      const info = await api.get('/branding/logo-info');
      setLogoInfo(info);
      return true;
    } catch (err) {
      console.warn('⚠️ Could not load logo info:', err.message);
      return false;
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    reloadLogo().then(ok => {
      if (!ok && !cancelled) setTimeout(() => { if (!cancelled) reloadLogo(); }, 2000);
    });
    return () => { cancelled = true; };
  }, [reloadLogo, user?.id]);
  // Cache-bust with updatedAt so replacing the logo doesn't keep showing the
  // previous cached image at this same constant URL.
  const logoUrl = logoInfo.hasLogo ? `${LOGO_IMAGE_URL}?v=${encodeURIComponent(logoInfo.updatedAt || '')}` : null;

  // ── اسم النظام القابل للتعديل (App Name) ────────────────────────────────
  // نفس نمط الشعار أعلاه بالضبط (جلب عام بدون auth + إعادة محاولة تلقائية عند
  // الفشل/تسجيل الدخول) — لأنه أيضاً يجب أن يظهر بصفحة تسجيل الدخول قبل أي
  // مصادقة. nameAr/nameEn = null يعني لا يوجد تخصيص، فيُستخدَم الاسم الافتراضي
  // (DEFAULT_APP_NAME_AR/EN) بدون أي تغيير عن سلوك النظام الحالي.
  const [appNameOverride, setAppNameOverride] = useState({ nameAr: null, nameEn: null });
  const reloadAppName = useCallback(async () => {
    try {
      const info = await api.get('/branding/app-name');
      setAppNameOverride(info);
      return true;
    } catch (err) {
      console.warn('⚠️ Could not load app name override:', err.message);
      return false;
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    reloadAppName().then(ok => {
      if (!ok && !cancelled) setTimeout(() => { if (!cancelled) reloadAppName(); }, 2000);
    });
    return () => { cancelled = true; };
  }, [reloadAppName, user?.id]);
  const appNameAr = appNameOverride.nameAr || DEFAULT_APP_NAME_AR;
  const appNameEn = appNameOverride.nameEn || DEFAULT_APP_NAME_EN;
  const appName = lang === 'ar' ? appNameAr : appNameEn;

  // Keeps the browser tab title in sync with the (possibly customized) app
  // name — index.html's static <title> is only the pre-JS default. Uppercased
  // English half to match the original static title's "SIHATUNA IRAQ" casing
  // exactly when nothing has been customized (see appNameEn's own comment —
  // the stored/default value itself is Title Case, matching the sidebar and
  // login page; this one spot has always been all-caps).
  useEffect(() => { document.title = `${appNameAr} | ${appNameEn.toUpperCase()}`; }, [appNameAr, appNameEn]);

  const togglePaymentGateway = async (providerCode) => {
    const exists = paymentGateways.find(g => g.providerCode === providerCode);
    const nextActive = exists ? !exists.isActive : true;
    try {
      await api.post('/admin/payment-gateways', {
        providerCode,
        isActive: nextActive,
        isSandbox: exists?.isSandbox ?? true,
      });
      setPaymentGateways(prev => {
        if (exists) return prev.map(g => g.providerCode === providerCode ? { ...g, isActive: nextActive } : g);
        return [...prev, { providerCode, isActive: true, isSandbox: true }];
      });
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const savePaymentCredentials = async (providerCode, credentials, isSandbox) => {
    try {
      await api.post('/admin/payment-gateways', { providerCode, isActive: true, isSandbox, credentials });
      setPaymentGateways(prev => {
        const exists = prev.find(g => g.providerCode === providerCode);
        if (exists) return prev.map(g => g.providerCode === providerCode ? { ...g, isSandbox, isActive: true, hasCredentials: true } : g);
        return [...prev, { providerCode, isActive: true, isSandbox, hasCredentials: true }];
      });
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  // ── سلة المحذوفات (Recycle Bin) ──────────────────────────────────────────
  // كل حذف بأي موديول الآن ينقل السجل هنا بدل حذفه نهائياً (راجع pgCrud.js).
  // هذه الدوال تخدم صفحة الإعدادات (تبويب سلة المحذوفات، إدمن فقط) للاطلاع
  // على المحذوفات واسترجاعها أو حذفها نهائياً.
  const fetchRecycleBin = async () => {
    try {
      return await api.get('/recycle-bin');
    } catch (err) {
      showToast(err.message, 'error');
      return [];
    }
  };
  const restoreFromRecycleBin = async (id) => {
    try {
      const result = await api.post(`/recycle-bin/${id}/restore`);
      return result;
    } catch (err) {
      showToast(err.message, 'error');
      return null;
    }
  };
  const purgeFromRecycleBin = async (id) => {
    try {
      await api.delete(`/recycle-bin/${id}`);
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  // ── الفوترة (Billing) ─────────────────────────────────────────────────────
  const [servicePrices, setServicePrices] = useState(() => {
    try { const s = localStorage.getItem('erp_service_prices'); return s ? JSON.parse(s) : initialServicePrices; } catch { return initialServicePrices; }
  });
  const [invoices, setInvoices] = useState(() => {
    try { const s = localStorage.getItem('erp_invoices'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const updateServicePrice = (id, price) => setServicePrices(prev => prev.map(s => s.id === id ? { ...s, price: Number(price) } : s));
  const addServicePrice = (data) => setServicePrices(prev => [...prev, { ...data, id: Date.now(), price: Number(data.price) || 0 }]);
  const deleteServicePrice = (id) => setServicePrices(prev => prev.filter(s => s.id !== id));

  const createInvoice = async (patientId) => {
    // إذا فيه فاتورة غير مدفوعة أصلاً لنفس المريض، أعِدها بدل إنشاء وحدة جديدة
    const existing = invoices.find(inv => inv.patientId === patientId && inv.status === 'unpaid');
    if (existing) return existing.id;
    const id = Date.now();
    const newInvoice = { id, patientId, items: [], total: 0, status: 'unpaid', paymentMethod: null, createdAt: new Date().toISOString(), paidAt: null };
    setInvoices(prev => [...prev, newInvoice]);
    const ok = await syncToServer('invoices', 'create', newInvoice);
    if (!ok) { setInvoices(prev => prev.filter(inv => inv.id !== id)); return null; }
    return id;
  };

  const addInvoiceItem = async (invoiceId, item) => {
    const prev = invoices;
    const current = invoices.find(inv => inv.id === invoiceId);
    if (!current) return;
    const newItem = { ...item, id: Date.now() + Math.random(), price: Number(item.price) || 0, qty: Number(item.qty) || 1 };
    const items = [...current.items, newItem];
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const changed = { ...current, items, total };
    setInvoices(p => p.map(inv => inv.id === invoiceId ? changed : inv));
    const ok = await syncToServer('invoices', 'update', changed);
    if (!ok) { setInvoices(prev); showToast(lang === 'ar' ? 'تعذّر حفظ الخدمة بالفاتورة' : 'Failed to save item to invoice', 'error'); }
  };

  const removeInvoiceItem = async (invoiceId, itemId) => {
    const prev = invoices;
    const current = invoices.find(inv => inv.id === invoiceId);
    if (!current) return;
    const items = current.items.filter(it => it.id !== itemId);
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const changed = { ...current, items, total };
    setInvoices(p => p.map(inv => inv.id === invoiceId ? changed : inv));
    const ok = await syncToServer('invoices', 'update', changed);
    if (!ok) { setInvoices(prev); showToast(lang === 'ar' ? 'تعذّر حذف الخدمة من الفاتورة' : 'Failed to remove item from invoice', 'error'); }
  };

  const payInvoice = async (invoiceId, paymentMethod, referenceCode) => {
    const prev = invoices;
    const current = invoices.find(inv => inv.id === invoiceId);
    if (!current) return false;
    const changed = { ...current, status: 'paid', paymentMethod, referenceCode: referenceCode || null, paidAt: new Date().toISOString() };
    setInvoices(p => p.map(inv => inv.id === invoiceId ? changed : inv));
    const ok = await syncToServer('invoices', 'update', changed);
    if (!ok) {
      // ── حرج: الدفع فعلياً تم وتأكّد من مزوّد الدفع (processPayment يستدعي
      // هذه الدالة فقط بعد نجاح حقيقي) — لا نتراجع عن حالة "مدفوعة" محلياً
      // حتى لو فشلت المزامنة، لأن هذا يخفي دفعة حقيقية حصلت فعلاً. نبقيها
      // محلياً وننبّه بوضوح أن الفاتورة تحتاج مزامنة يدوية لاحقاً.
      showToast(
        lang === 'ar'
          ? 'تم الدفع فعلياً لكن تعذّر تحديث حالة الفاتورة بالخادم — راجعها يدوياً'
          : 'Payment succeeded but failed to sync invoice status to server — please verify manually',
        'error'
      );
    }
    return true;
  };

  // معالجة دفع فعلية: تُنشئ سجلاً حقيقياً بجدول payments بالخادم (وليس تحديث
  // حالة الفاتورة محلياً فقط كما كان سابقاً). الخطوات:
  //   1) POST /api/payments — يبدأ عملية الدفع (تُسجَّل بحالة "pending" أولاً)
  //   2) حسب طريقة الدفع: الدفع النقدي يُكتمل تلقائياً فور التسجيل (verify)،
  //      وطرق التحويل اليدوي (مثل Western Union أو POS) تحتاج تأكيداً يدوياً
  //      بالرقم المرجعي (manual-confirm) قبل اعتبارها مكتملة
  //   3) فقط بعد تأكيد اكتمال الدفع فعلياً من الخادم، تُعلَّم الفاتورة "مدفوعة"
  // ترجع true عند نجاح الدفع فعلياً، false عند الفشل (مع عرض رسالة الخطأ).
  const processPayment = async (invoiceId, patientId, providerCode, amount, referenceNote) => {
    try {
      const { payment } = await api.post('/payments', {
        invoiceId, patientId, providerCode, amount, currency: 'IQD',
      });

      let finalStatus = payment.status;
      if (finalStatus !== 'completed') {
        if (providerCode === 'cash') {
          const verified = await api.post(`/payments/${payment.id}/verify`);
          finalStatus = verified.status;
        } else if (referenceNote) {
          const confirmed = await api.post(`/payments/${payment.id}/manual-confirm`, { referenceNote });
          finalStatus = confirmed.status;
        }
      }

      if (finalStatus === 'completed') {
        payInvoice(invoiceId, providerCode, referenceNote || null);
        return true;
      }
      showToast(
        lang === 'ar' ? 'لم تكتمل عملية الدفع بعد، راجع الحالة لاحقاً' : 'Payment not completed yet, check status later',
        'warning'
      );
      return false;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  // ── PERSIST ALL DATA ───────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('app_doctors', JSON.stringify(doctors)); }, [doctors]);
  useEffect(() => { localStorage.setItem('app_departments', JSON.stringify(departments)); }, [departments]);
  useEffect(() => { localStorage.setItem('app_patients', JSON.stringify(patients)); }, [patients]);
  useEffect(() => { localStorage.setItem('app_appointments', JSON.stringify(appointments)); }, [appointments]);
  useEffect(() => { localStorage.setItem('erp_inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('erp_procurement', JSON.stringify(procurement)); }, [procurement]);
  useEffect(() => { localStorage.setItem('erp_projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('erp_documents', JSON.stringify(documents)); }, [documents]);
  // ── إصلاح: أُزيل تخزين labTests وradiology وpharmacyOrders في localStorage
  // (كان هنا سابقاً) — راجع الملاحظة عند تعريف الحالة الخاصة بها أعلاه لسبب
  // الإزالة الكامل (خطأ QuotaExceededError بعد استيراد Excel جماعي).
  useEffect(() => { localStorage.setItem('erp_ambulance', JSON.stringify(ambulanceData)); }, [ambulanceData]);
  useEffect(() => { localStorage.setItem('erp_assets', JSON.stringify(assets)); }, [assets]);
  useEffect(() => { localStorage.setItem('crm_followups', JSON.stringify(crmFollowUps)); }, [crmFollowUps]);
  useEffect(() => { localStorage.setItem('crm_segments', JSON.stringify(crmSegments)); }, [crmSegments]);
  useEffect(() => { localStorage.setItem('crm_interactions', JSON.stringify(crmInteractions)); }, [crmInteractions]);
  useEffect(() => { localStorage.setItem('crm_campaigns', JSON.stringify(crmCampaigns)); }, [crmCampaigns]);
  useEffect(() => { localStorage.setItem('crm_campaign_targets', JSON.stringify(crmCampaignTargets)); }, [crmCampaignTargets]);
  // ملاحظة: لا حاجة لحفظ paymentGateways بـ localStorage بعد الآن — يُحمَّل
  // ويُحفظ مباشرة من وإلى الخادم الحقيقي (PostgreSQL) عبر togglePaymentGateway
  // وsavePaymentCredentials أعلاه.
  useEffect(() => { localStorage.setItem('erp_service_prices', JSON.stringify(servicePrices)); }, [servicePrices]);
  useEffect(() => { localStorage.setItem('erp_invoices', JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; localStorage.setItem('lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('print_settings', JSON.stringify(printSettings)); }, [printSettings]);
  useEffect(() => { localStorage.setItem('system_users', JSON.stringify(systemUsers)); }, [systemUsers]);

  // إعداد موحّد لكل الموديولات المربوطة بالباك إند — إضافة موديول جديد هنا فقط
  // (مفتاح الباك إند، setter الفرونت إند، ودالة توحيد الحقول لو تختلف التسمية)
  const SYNCED_MODULES = React.useMemo(() => [
    { key: 'patients',    setState: setPatients,    normalize: p => ({ ...p, name: p.name || p.full_name }) },
    { key: 'doctors',     setState: setDoctors,     normalize: d => ({ ...d, name: d.name || d.full_name }) },
    { key: 'departments', setState: setDepartments, normalize: d => d },
    { key: 'appointments',setState: setAppointments,normalize: a => a },
    { key: 'labTests',       setState: setLabTests,       normalize: x => x },
    { key: 'radiology',      setState: setRadiology,      normalize: x => x },
    { key: 'pharmacyOrders', setState: setPharmacyOrders, normalize: x => x },
    { key: 'assets',         setState: setAssets,         normalize: x => x },
    { key: 'inventory',      setState: setInventory,      normalize: x => x },
    { key: 'procurement',    setState: setProcurement,    normalize: x => x },
    { key: 'projects',       setState: setProjects,       normalize: x => x },
    { key: 'documents',      setState: setDocuments,      normalize: x => x },
    { key: 'servicePrices',       setState: setServicePrices,      normalize: x => x },
    { key: 'invoices',            setState: setInvoices,           normalize: x => x },
    { key: 'crmFollowUps',        setState: setCrmFollowUps,       normalize: x => x },
    { key: 'crmSegments',         setState: setCrmSegments,        normalize: x => x },
    { key: 'crmInteractions',     setState: setCrmInteractions,    normalize: x => x },
    { key: 'crmCampaigns',        setState: setCrmCampaigns,       normalize: x => x },
    { key: 'crmCampaignTargets',  setState: setCrmCampaignTargets, normalize: x => x },
    { key: 'users',               setState: setSystemUsers,        normalize: x => x },
    // إصلاح: بيانات الإسعاف (المركبات + المأموريات) ما كان عندها أي آلية جلب
    // حقيقية من الخادم إطلاقاً — تعتمد فقط على localStorage + التحديثات
    // المتفائلة لحظة كل عملية بنفس الجلسة. جهاز أو متصفح جديد كان يعرض بيانات
    // تجريبية وهمية (initialAmbulance) للأبد، وأي تعديل من مستخدم/جهاز آخر ما
    // كان يظهر أبداً. الآن تُجلَب فعلياً عند تسجيل الدخول مثل بقية الموديولات.
    { key: 'ambulanceVehicles', setState: (data) => setAmbulanceData(p => ({ ...p, vehicles: data })), normalize: x => x },
    { key: 'ambulanceMissions', setState: (data) => setAmbulanceData(p => ({ ...p, missions: data })), normalize: x => x },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  // عند تسجيل الدخول (وجود توكن حقيقي)، نحمّل كل موديول مربوط من الباك إند الحقيقي
  // بدل النسخة المحلية — هذا يحل مشكلة "كل جهاز يرى بيانات مختلفة"
  useEffect(() => {
    if (!user) return; // بدون توكن قابل للقراءة من الفرونت إند بعد اليوم — user نفسها المؤشر الوحيد لتسجيل الدخول
    let cancelled = false;
    let sessionExpiredHandled = false; // يمنع تكرار رسالة "انتهت الجلسة" لكل موديول فشل على حدة
    SYNCED_MODULES.forEach(({ key, setState, normalize }) => {
      setSyncStatus(prev => ({ ...prev, [key]: 'syncing' }));
      api.get(`/${key}`)
        .then(serverData => {
          if (cancelled) return;
          // إصلاح: الشرط السابق `serverData.length > 0` كان يمنع أي تحديث لو
          // كانت النتيجة الحقيقية بالخادم مصفوفة فارغة (مثلاً بعد حذف كل
          // مشاريع/عناصر موديول معيّن، أو منشأة جديدة بلا بيانات بعد) —
          // فتبقى الواجهة عارضة أرقام قديمة محفوظة بالمتصفح (localStorage)
          // للأبد بدل الصفر الصحيح. الآن نحدّث الحالة بأي مصفوفة صالحة من
          // الخادم، فارغة كانت أو لا — هو مصدر الحقيقة دائماً بعد تسجيل الدخول.
          if (Array.isArray(serverData)) {
            setState(serverData.map(normalize));
          }
          setSyncStatus(prev => ({ ...prev, [key]: 'synced' }));
        })
        .catch((err) => {
          if (cancelled) return;
          setSyncStatus(prev => ({ ...prev, [key]: 'offline' }));
          // جلسة دخول منتهية: نسجّل خروج المستخدم مرة واحدة برسالة واضحة
          // بدل ترك كل موديول يفشل بصمت ويظهر النظام وكأنه "يعمل محلياً فقط" بلا سبب واضح
          if (err.status === 401 && !sessionExpiredHandled) {
            sessionExpiredHandled = true;
            logout();
            showToast(
              lang === 'ar'
                ? 'انتهت جلسة الدخول، يرجى تسجيل الدخول من جديد'
                : 'Your session has expired — please log in again',
              'error'
            );
          }
        });
    });
    return () => { cancelled = true; };
  }, [user, SYNCED_MODULES]); // eslint-disable-line react-hooks/exhaustive-deps -- نتعمّد عدم إعادة الجلب عند تغيّر lang/showToast فقط

  // مزامنة الكتابة الموحّدة: تُستدعى بعد أي إضافة أو تعديل أو حذف محلي بأي موديول مربوط،
  // وترسلها إلى الباك إند الحقيقي دون إيقاف الواجهة أثناء الانتظار.
  // ملاحظة مهمة: يجب على المستدعي دائماً انتظار (await) نتيجة هذه الدالة قبل إظهار
  // رسالة نجاح للمستخدم، لأن القيمة المُعادة تعكس الحالة الفعلية للحفظ في قاعدة البيانات
  // وليست افتراضاً بأن العملية نجحت.
  // القيمة المُعادة: true عند نجاح الحفظ فعلياً في الخادم، false عند الفشل أو عدم توفر تسجيل دخول حقيقي.
  const syncToServer = async (moduleKey, action, item) => {
    if (!user) return false; // لا يوجد تسجيل دخول حقيقي بعد — يبقى العمل محلياً فقط
    try {
      if (action === 'create') {
        const created = await api.post(`/${moduleKey}`, item);
        // إصلاح مهم بعد الانتقال إلى PostgreSQL: الفرونت إند يُولّد معرّفاً
        // مؤقتاً محلياً (Date.now()) لحظة الإنشاء لعرض السجل فوراً بالواجهة
        // قبل انتظار رد الخادم (Optimistic UI). لكن قاعدة PostgreSQL تُصدر
        // معرّفها التسلسلي الخاص (SERIAL) الذي يختلف تماماً عن هذا الرقم
        // المؤقت. بدون هذا التصحيح، أي عملية لاحقة بنفس الجلسة تستخدم هذا
        // المعرّف المؤقت (تعديل، حذف، أو ربط بسجل آخر مثل فاتورة أو دفعة)
        // تفشل لأن الخادم لا يعرف هذا المعرّف أصلاً — وهذا بالضبط ما كان
        // يسبب خطأ "value out of range for type integer" عند ربط الفواتير
        // بالمدفوعات. الحل: نستبدل السجل المحلي بالنسخة الحقيقية الكاملة
        // المُعادة من الخادم (التي تحمل المعرّف الصحيح) فور نجاح الإنشاء.
        if (created && created.id !== undefined && created.id !== item.id) {
          const moduleEntry = SYNCED_MODULES.find(m => m.key === moduleKey);
          if (moduleEntry) {
            moduleEntry.setState(prev => prev.map(rec => rec.id === item.id ? created : rec));
          }
        }
        // نُعيد السجل الحقيقي الكامل (وليس true فقط) — يفيد الصفحات التي تدير
        // حالتها محلياً بمعزل عن SYNCED_MODULES (مثل صفحة الموارد البشرية)
        // لتصحيح المعرّف بنفسها أيضاً. لا يكسر أي استدعاء قديم يتحقق فقط من
        // "صحّ/خطأ" لأن كائناً حقيقياً يُقيَّم كـ true دائماً بجافاسكربت.
        return created || true;
      }
      else if (action === 'update') await api.put(`/${moduleKey}/${item.id}`, item);
      else if (action === 'delete') await api.delete(`/${moduleKey}/${item.id}`);
      return true;
    } catch (err) {
      // حالة خاصة ومهمة: رمز الدخول منتهي أو غير صالح (401) — هذا خطأ مختلف تماماً عن
      // انقطاع الاتصال بالخادم، والسبب الأكثر شيوعاً لرسالة "تم الحفظ محلياً" المربكة
      // حين يكون الخادم يعمل فعلياً لكن جلسة الدخول بالمتصفح قديمة أو منتهية.
      // بدل ترك المستخدم يحتار بين الاحتمالين، نسجّل خروجه تلقائياً برسالة واضحة الآن.
      if (err.status === 401) {
        console.warn(`⚠️ انتهت صلاحية جلسة الدخول أثناء مزامنة "${moduleKey}" — يتم تسجيل الخروج تلقائياً.`);
        logout();
        showToast(
          lang === 'ar'
            ? 'انتهت جلسة الدخول، يرجى تسجيل الدخول من جديد'
            : 'Your session has expired — please log in again',
          'error'
        );
        return false;
      }
      // حالة خطأ التحقق من صحة المدخلات (400): سبب مختلف تماماً عن انقطاع الاتصال —
      // الخادم يعمل ووصله الطلب فعلاً، لكنه رفض البيانات نفسها (مثل حقل مطلوب فارغ
      // أو نوع بيانات خاطئ). عرض رسالة "تم الحفظ محلياً" هنا مضلّل تماماً لأنه يوحي
      // بمشكلة اتصال بينما المشكلة الحقيقية بالبيانات المُدخلة نفسها. نعرض بدلها
      // الرسالة التفصيلية الفعلية القادمة من الخادم (مثل "الحقل رقم الهاتف مطلوب").
      if (err.status === 400) {
        console.warn(`⚠️ رُفضت بيانات "${moduleKey}" من الخادم (خطأ تحقق):`, err.message);
        showToast(err.message, 'error');
        return false;
      }
      // إصلاح مهم: أي خطأ غير 401/400 (مثال: 403 رفض صلاحية، 500 خطأ خادم،
      // أو انقطاع اتصال) كان يُسجَّل فقط بـ console.warn — غير مرئي للمستخدم
      // إطلاقاً. هذا بالضبط سبب ظهور "تمت الإضافة" بالواجهة (لأن الصفحة تعرض
      // رسالة النجاح دون انتظار نتيجة المزامنة الفعلية) بينما السجل لم يُحفَظ
      // بقاعدة البيانات أصلاً — فيبقى العدّاد بالإحصائيات (محسوب من الحالة
      // المحلية المتفائلة) مرتفعاً بينما القائمة الفعلية (المجلوبة من الخادم)
      // فارغة. الآن نعرض رسالة خطأ واضحة للمستخدم بكل الحالات غير المعالَجة
      // صراحة أعلاه، مع تمييز خطأ الصلاحية (403) لأنه الأكثر إرباكاً.
      if (err.status === 403) {
        console.warn(`⚠️ رُفض وصول "${moduleKey}" (403 — لا صلاحية أو جلسة قديمة):`, err.message);
        showToast(
          lang === 'ar'
            ? 'لم يُحفَظ التغيير: لا توجد صلاحية كافية، أو أن جلسة الدخول قديمة. جرّب تسجيل الخروج والدخول من جديد.'
            : 'Not saved: insufficient permission, or your session is outdated. Try logging out and back in.',
          'error'
        );
        return false;
      }
      console.warn(`⚠️ فشلت مزامنة "${moduleKey}" مع الخادم (تم الاحتفاظ بالتغيير محلياً فقط):`, err.message);
      showToast(
        lang === 'ar'
          ? `تعذّر حفظ التغيير بالخادم (${moduleKey}): ${err.message || 'خطأ غير معروف'}`
          : `Failed to save change to server (${moduleKey}): ${err.message || 'unknown error'}`,
        'error'
      );
      return false;
    }
  };
  // اسم قديم متوافق مع الاستخدام الحالي بصفحة المرضى
  const syncPatientToServer = (action, patient) => syncToServer('patients', action, patient);

  const t = useCallback((key) => key, []);
  const toggleTheme = () => setTheme(p => p === 'light' ? 'dark' : 'light');
  const toggleLang = () => setLang(p => p === 'ar' ? 'en' : 'ar');
  const toggleSidebar = () => setSidebarCollapsed(p => !p);

  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const addToast = showToast;

  // ── نافذة تأكيد عامة (Promise-based) ────────────────────────────────────────
  // بدل تكرار نافذة تأكيد الحذف يدوياً بكل صفحة (كانت موجودة بـ3 صفحات فقط من
  // أصل +20 عملية حذف بالنظام)، هذا نمط واحد قابل لإعادة الاستخدام من أي مكان:
  //   const ok = await confirmDialog('نص الرسالة');
  //   if (!ok) return;
  // يُعرَض فعلياً عبر مكوّن <ConfirmDialog /> (انظر components/ConfirmDialog.js).
  const [confirmState, setConfirmState] = useState(null); // { message, resolve } | null
  const confirmDialog = useCallback((message) => {
    return new Promise((resolve) => { setConfirmState({ message, resolve }); });
  }, []);
  const resolveConfirm = useCallback((result) => {
    setConfirmState(prev => { if (prev) prev.resolve(result); return null; });
  }, []);

  // تحديث جزئي لبيانات المستخدم الحالي بالحالة المحلية (وليس تسجيل دخول جديد
  // كامل) — يُستخدم مثلاً بعد تغيير كلمة المرور بنجاح، لمسح علامة
  // mustChangePassword فوراً بدون الحاجة لتسجيل خروج ودخول من جديد.
  const updateUser = (partial) => {
    setUser(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem('auth_user', JSON.stringify(next));
      return next;
    });
  };

  // ── لوحة التحكم القابلة للتخصيص (Stage 5) ────────────────────────────────
  // dashboardLayout الفعلي المُطبَّق = تخصيص المستخدم (user.dashboardLayout)
  // لو موجود، وإلا القائمة الافتراضية الكاملة — بدون أي طلب شبكة إضافي، لأن
  // user (من تسجيل الدخول/auth-me) يحمل الحقل أصلاً.
  const dashboardLayout = user?.dashboardLayout || DEFAULT_DASHBOARD_WIDGETS;

  const saveDashboardLayout = async (widgets) => {
    try {
      await api.put('/users/me/dashboard-layout', { widgets });
      updateUser({ dashboardLayout: widgets });
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const resetDashboardLayout = async () => {
    try {
      await api.delete('/users/me/dashboard-layout');
      updateUser({ dashboardLayout: undefined });
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const login = async (credentials) => {
    try {
      const data = await api.post('/auth/login', {
        username: credentials.username,
        password: credentials.password,
      });
      // ── إصلاح أمني ──────────────────────────────────────────────────────
      // ما عاد نخزّن data.token بـ localStorage — الخادم ضبط httpOnly cookie
      // تلقائياً بنفس الاستجابة (انظر server.js)، والمتصفح يرسلها تلقائياً
      // مع كل طلب لاحق بدون أي تدخل من الجافاسكربت. auth_user يبقى مخزَّناً
      // (بيانات عرض فقط: الاسم، الدور، الصلاحيات — لا كلمة مرور ولا توكن)
      // لعرض واجهة المستخدم فوراً عند إعادة فتح التطبيق قبل التحقق من الخادم.
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      // تمييز بين "بيانات دخول خاطئة" و"السيرفر لا يعمل" برسالة واضحة
      const reachable = await checkBackendReachable();
      if (!reachable) {
        return {
          success: false,
          message: lang === 'ar'
            ? 'تعذّر الاتصال بالخادم (Backend). تأكد من أنه يعمل — شغّل start-backend.bat أو node server.js في مجلد backend.'
            : 'Cannot reach the backend server. Make sure it is running — run start-backend.bat or node server.js in the backend folder.',
        };
      }
      return { success: false, message: err.message || (lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials') };
    }
  };

  const logout = () => {
    // مسح الكوكي الفعلية يحتاج طلب للخادم (كود الجافاسكربت لا يستطيع مسح
    // httpOnly cookie مباشرة). لا ننتظر النتيجة — تسجيل الخروج بالواجهة يصير
    // فوراً بغض النظر عن نجاح الطلب، وحتى لو فشل الطلب (مثلاً الخادم متوقف
    // مؤقتاً)، الكوكي القديمة تنتهي صلاحيتها تلقائياً بعد 7 أيام كحد أقصى.
    api.post('/auth/logout', {}).catch(() => {});
    localStorage.removeItem('auth_user');
    setUser(null);
  };
  // ── بيانات خفيفة لتنبيهات الأدوية المستحقة بالردهات + الترفيعات/البدلات
  // المستحقة بالحسابات ──────────────────────────────────────────────────────
  // إضافة: طلب المستخدمة تنبيهاً فورياً "المريض الفلاني يستحق دواءه الآن"
  // بغض النظر عن أي صفحة هو فاتحها — ليس فقط عند فتح صفحة الردهات بنفسه.
  // جلب خفيف مخصَّص لهذا الغرض فقط (بيانات الردهات/الحسابات نفسها تبقى محلية
  // بصفحاتها كما هي، هذا مسار منفصل يغذّي جرس الإشعارات العام بالتطبيق).
  //
  // إصلاح حرج: كان يُجلَب مرة واحدة فقط عند تحميل التطبيق ولا يتحدّث أبداً
  // بعدها — فتأكيد إعطاء جرعة بصفحة الردهات يحدّث حالتها المحلية هناك فقط،
  // وجرس الإشعارات يبقى لا يعرف بالتحديث، فيبقى التنبيه معروضاً للأبد حتى لو
  // فعلاً انحلّت المشكلة. الآن أي صفحة تستطيع طلب تحديث فوري لهذا المصدر عبر
  // refreshNotifSources() بعد أي إجراء يُفترَض يُسقِط تنبيهاً (إعطاء جرعة،
  // تصفير حالة "مستحق" بترفيع أو بدل...).
  const EMPTY_NOTIF_SOURCE = { admissions: [], orders: [], administrations: [], promotionsAllowances: [], employees: [] };
  const [medNotifSource, setMedNotifSource] = useState(EMPTY_NOTIF_SOURCE);
  const [notifRefreshTick, setNotifRefreshTick] = useState(0);
  const refreshNotifSources = useCallback(() => setNotifRefreshTick(t => t + 1), []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // إصلاح: كانت تجلب الخمس نقاط دائماً لكل مستخدم مسجَّل دخول، حتى لو ما
    // عنده صلاحية وصول للردهات ولا الحسابات إطلاقاً (فني مختبر، موظف
    // استقبال...) — حمل شبكة حقيقي وقت التوسّع لعدة منشآت بمستخدمين كثار.
    // الآن تُجلَب فقط المجموعة التي يستطيع المستخدم فعلاً رؤية بياناتها.
    const canWards = user.role === 'admin' || (user.permissions || []).includes('wards');
    const canAccounts = user.role === 'admin' || (user.permissions || []).includes('accounts');
    const canHR = user.role === 'admin' || (user.permissions || []).includes('hr');
    if (!canWards && !canAccounts && !canHR) { setMedNotifSource(EMPTY_NOTIF_SOURCE); return; }
    Promise.all([
      canWards ? api.get('/admissions') : Promise.resolve([]),
      canWards ? api.get('/medicationOrders') : Promise.resolve([]),
      canWards ? api.get('/medicationAdministrations') : Promise.resolve([]),
      canAccounts ? api.get('/promotionsAllowances') : Promise.resolve([]),
      canHR ? api.get('/employees') : Promise.resolve([]),
    ])
      .then(([admissions, orders, administrations, promotionsAllowances, employees]) => {
        if (cancelled) return;
        setMedNotifSource({
          admissions: Array.isArray(admissions) ? admissions : [],
          orders: Array.isArray(orders) ? orders : [],
          administrations: Array.isArray(administrations) ? administrations : [],
          promotionsAllowances: Array.isArray(promotionsAllowances) ? promotionsAllowances : [],
          employees: Array.isArray(employees) ? employees : [],
        });
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, notifRefreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // إصلاح: الإشعارات الآن مُشتقّة حياً من بيانات حقيقية موجودة فعلاً
  // بالسياق (مخزون، مشتريات، مواعيد، مستندات، فواتير) بدل قائمة وهمية ثابتة،
  // وكل إشعار يحمل رابط (link) لصفحته الفعلية حتى يعمل الضغط عليه بالواجهة.
  const notifications = React.useMemo(() => {
    const list = [];
    const today = new Date().toISOString().split('T')[0];

    filterByViewingHospital(inventory)
      .filter(i => i.status === 'low' || i.status === 'out')
      .slice(0, 8)
      .forEach(i => list.push({
        id: `inv-${i.id}`,
        type: 'alert',
        message: i.status === 'out'
          ? (lang === 'ar' ? `⚠️ نفاد المخزون: ${i.name}` : `⚠️ Out of stock: ${i.nameEn || i.name}`)
          : (lang === 'ar' ? `⚠️ مخزون منخفض: ${i.name} (${i.qty} ${i.unit || ''})` : `⚠️ Low stock: ${i.nameEn || i.name} (${i.qty} ${i.unit || ''})`),
        time: lang === 'ar' ? 'المخزون والمستودعات' : 'Inventory',
        link: '/inventory',
      }));

    filterByViewingHospital(procurement)
      .filter(p => p.status === 'pending')
      .slice(0, 8)
      .forEach(p => list.push({
        id: `po-${p.id}`,
        type: 'procurement',
        message: lang === 'ar' ? `طلب شراء ${p.poNo || ''} بانتظار الموافقة: ${p.title || ''}` : `Purchase order ${p.poNo || ''} awaiting approval: ${p.titleEn || p.title || ''}`,
        time: p.date || '',
        link: '/procurement',
      }));

    filterByViewingHospital(appointments)
      .filter(a => a.date === today && (a.status === 'pending' || a.status === 'confirmed'))
      .slice(0, 8)
      .forEach(a => list.push({
        id: `apt-${a.id}`,
        type: 'appointment',
        message: lang === 'ar' ? `موعد اليوم: ${a.patient || ''} - ${a.time || ''}` : `Today's appointment: ${a.patient || ''} - ${a.time || ''}`,
        time: lang === 'ar' ? 'المواعيد' : 'Appointments',
        link: '/appointments',
      }));

    filterByViewingHospital(documents)
      .filter(d => d.priority === 'urgent' && d.status === 'pending')
      .slice(0, 8)
      .forEach(d => list.push({
        id: `doc-${d.id}`,
        type: 'document',
        message: lang === 'ar' ? `📄 مستند عاجل: ${d.title || d.docNo || ''}` : `📄 Urgent document: ${d.title || d.docNo || ''}`,
        time: d.date || '',
        link: '/documents',
      }));

    filterByViewingHospital(invoices)
      .filter(inv => inv.status === 'unpaid')
      .slice(0, 8)
      .forEach(inv => {
        const pName = patients.find(p => p.id === Number(inv.patientId))?.name || (lang === 'ar' ? 'مريض' : 'Patient');
        list.push({
          id: `bill-${inv.id}`,
          type: 'alert',
          message: lang === 'ar' ? `🧾 فاتورة غير مدفوعة: ${pName}` : `🧾 Unpaid invoice: ${pName}`,
          time: lang === 'ar' ? 'الفوترة والدفع' : 'Billing',
          link: '/billing',
        });
      });

    // ── أدوية الردهات المستحقة الآن أو المتأخرة ────────────────────────────
    // نفس منطق حساب الجدول بصفحة الردهات بالضبط (مواعيد موزّعة أو محدَّدة
    // يدوياً، تطابق دقيق مع سجل الإعطاء الفعلي بالموعد المحدَّد تحديداً).
    const computeTimes = (timesPerDay) => {
      const n = Math.max(1, Math.min(12, +timesPerDay || 1));
      const intervalMin = Math.floor((24 * 60) / n);
      const times = [];
      let mins = 8 * 60;
      for (let i = 0; i < n; i++) {
        const h = Math.floor((mins % (24 * 60)) / 60);
        const m = (mins % (24 * 60)) % 60;
        times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        mins += intervalMin;
      }
      return times;
    };
    const { admissions: medAdmissionsAll, orders: medOrders, administrations: medAdmins } = medNotifSource;
    const medAdmissions = filterByViewingHospital(medAdmissionsAll);
    const activeMedOrders = medOrders.filter(o => {
      const adm = medAdmissions.find(a => a.id === o.admissionId);
      if (!adm || adm.status !== 'admitted') return false;
      if (o.startDate && o.startDate > today) return false;
      if (o.endDate && o.endDate < today) return false;
      return true;
    });
    let dueMedCount = 0;
    activeMedOrders.forEach(o => {
      const adm = medAdmissions.find(a => a.id === o.admissionId);
      const times = (Array.isArray(o.scheduledTimes) && o.scheduledTimes.length > 0) ? o.scheduledTimes : computeTimes(o.timesPerDay);
      times.forEach(time => {
        const scheduledAt = new Date(`${today}T${time}:00`);
        const given = medAdmins.find(a => a.orderId === o.id && (
          (a.scheduledFor === time && a.scheduledDate === today) ||
          (!a.scheduledFor && Math.abs(new Date(a.administeredAt) - scheduledAt) < 90 * 60 * 1000)
        ));
        if (given) return;
        const isDueOrOverdue = new Date() > scheduledAt; // الوقت وصل أو فات (وليس "قادمة" بعد)
        if (!isDueOrOverdue || dueMedCount >= 8) return;
        dueMedCount++;
        list.push({
          id: `med-${o.id}-${time}`,
          type: 'alert',
          message: lang === 'ar'
            ? `💊 يستحق المريض ${adm?.patientName || ''} دواء ${o.drugName} (${o.dose || ''}) الساعة ${time}`
            : `💊 ${adm?.patientName || ''} is due for ${o.drugName} (${o.dose || ''}) at ${time}`,
          time: lang === 'ar' ? 'الردهات' : 'Wards',
          link: '/wards',
        });
      });
    });

    // ── ترفيعات وعلاوات مستحقة (الحسابات، سجل موحَّد — راجع
    // accounts/PromotionsAllowancesTab.js) ───────────────────────────────────
    filterByViewingHospital(medNotifSource.promotionsAllowances)
      .filter(r => r.promotionStatus === 'مستحق')
      .slice(0, 8)
      .forEach(r => list.push({
        id: `promo-${r.id}`,
        type: 'alert',
        message: lang === 'ar' ? `⬆️ ترفيع مستحق: ${r.name}` : `⬆️ Promotion due: ${r.name}`,
        time: lang === 'ar' ? 'الحسابات — الترفيعات والعلاوات' : 'Accounts — Promotions & Allowances',
        link: '/accounts',
      }));
    filterByViewingHospital(medNotifSource.promotionsAllowances)
      .filter(r => r.allowanceStatus === 'مستحقة')
      .slice(0, 8)
      .forEach(r => list.push({
        id: `allow-${r.id}`,
        type: 'alert',
        message: lang === 'ar' ? `🎁 علاوة مستحقة: ${r.name}` : `🎁 Allowance due: ${r.name}`,
        time: lang === 'ar' ? 'الحسابات — الترفيعات والعلاوات' : 'Accounts — Promotions & Allowances',
        link: '/accounts',
      }));

    // ── مواعيد العلاوة/الترفيع القادمة (محرّك حساب حقيقي على سجل الموظف نفسه،
    // راجع hr/promotionCalc.js) — ضمن 30 يوماً أو متأخرة ──────────────────────
    const DUE_WITHIN_DAYS = 30;
    let hrDueCount = 0;
    filterByViewingHospital(medNotifSource.employees).forEach(e => {
      if (hrDueCount >= 8) return;
      const promoDue = calcPromotionDue(e);
      if (promoDue.available && promoDue.daysUntil <= DUE_WITHIN_DAYS && hrDueCount < 8) {
        hrDueCount++;
        list.push({
          id: `hrdue-promo-${e.id}`,
          type: 'alert',
          message: lang === 'ar'
            ? `⬆️ ترفيع ${promoDue.overdue ? 'متأخر' : 'مستحق قريباً'} — ${e.name} (${promoDue.dueDate})`
            : `⬆️ Promotion ${promoDue.overdue ? 'overdue' : 'due soon'} — ${e.name} (${promoDue.dueDate})`,
          time: lang === 'ar' ? 'الموارد البشرية' : 'HR',
          link: '/hr',
        });
      }
      const allowDue = calcAllowanceDue(e);
      if (allowDue.available && allowDue.daysUntil <= DUE_WITHIN_DAYS && hrDueCount < 8) {
        hrDueCount++;
        list.push({
          id: `hrdue-allow-${e.id}`,
          type: 'alert',
          message: lang === 'ar'
            ? `💰 علاوة ${allowDue.overdue ? 'متأخرة' : 'مستحقة قريباً'} — ${e.name} (${allowDue.dueDate})`
            : `💰 Allowance ${allowDue.overdue ? 'overdue' : 'due soon'} — ${e.name} (${allowDue.dueDate})`,
          time: lang === 'ar' ? 'الموارد البشرية' : 'HR',
          link: '/hr',
        });
      }
    });

    return list.map(n => ({ ...n, read: readNotifIds.has(n.id) }));
  }, [inventory, procurement, appointments, documents, invoices, patients, medNotifSource, readNotifIds, lang, filterByViewingHospital]);

  const markNotifRead = (id) => setReadNotifIds(prev => new Set(prev).add(id));
  const markAllNotifRead = () => setReadNotifIds(prev => {
    const next = new Set(prev);
    notifications.forEach(n => next.add(n.id));
    return next;
  });
  const hasPermission = useCallback((pageKey) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (user.permissions || []).includes(pageKey);
  }, [user]);

  return (
    <AppContext.Provider value={{
      theme, setTheme, toggleTheme, lang, setLang, toggleLang, t,
      printSettings, setPrintSettings,
      printOverlay, setPrintOverlay,
      user, login, logout, updateUser,
      dashboardLayout, saveDashboardLayout, resetDashboardLayout,
      toasts, addToast, showToast,
      confirmState, confirmDialog, resolveConfirm,
      refreshNotifSources,
      sidebarCollapsed, toggleSidebar,
      notifications, markNotifRead, markAllNotifRead,
      systemUsers, setSystemUsers,
      hasPermission,
      // Clinical data
      // ملاحظة: القوائم أدناه تُعرض بعد تطبيق فلتر "المنشأة المعروضة حالياً"
      // (filterByViewingHospital) تلقائياً — أي صفحة تستهلكها من الـ Context
      // تستفيد من الفلترة بدون أي تعديل إضافي بها. دوال setXxx تبقى تعمل على
      // الحالة الكاملة غير المفلترة (ضروري حتى لا تُفقد سجلات منشآت أخرى عند
      // أي عملية إضافة/تعديل محلية).
      doctors: filterByViewingHospital(doctors), setDoctors,
      departments: filterByViewingHospital(departments), setDepartments,
      patients: filterByViewingHospital(patients), setPatients, syncStatus, syncPatientToServer, syncToServer,
      appointments: filterByViewingHospital(appointments), setAppointments,
      // ERP data
      labTests: filterByViewingHospital(labTests), setLabTests,
      radiology: filterByViewingHospital(radiology), setRadiology,
      pharmacyOrders: filterByViewingHospital(pharmacyOrders), setPharmacyOrders,
      ambulanceData, setAmbulanceData,
      assets: filterByViewingHospital(assets), setAssets,
      inventory: filterByViewingHospital(inventory), setInventory,
      procurement: filterByViewingHospital(procurement), setProcurement,
      projects: filterByViewingHospital(projects), setProjects,
      documents: filterByViewingHospital(documents), setDocuments,
      // CRM
      crmFollowUps: filterByViewingHospital(crmFollowUps), addCrmFollowUp, updateCrmFollowUpStatus,
      crmSegments: filterByViewingHospital(crmSegments), assignCrmSegment,
      crmInteractions: filterByViewingHospital(crmInteractions), addCrmInteraction,
      crmCampaigns: filterByViewingHospital(crmCampaigns), addCrmCampaign, buildCrmCampaignTargets,
      crmCampaignTargets: filterByViewingHospital(crmCampaignTargets), updateCrmTargetDeliveryStatus,
      // Payment gateways
      paymentGateways, togglePaymentGateway, savePaymentCredentials,
      fetchRecycleBin, restoreFromRecycleBin, purgeFromRecycleBin,
      hospitals, multiHospitalEnabled, reloadHospitalsAndMode: loadHospitalsAndMode,
      logoUrl, reloadLogo,
      appName, appNameAr, appNameEn, reloadAppName,
      viewingHospitalId, setViewingHospitalId, filterByViewingHospital,
      // Billing
      servicePrices: filterByViewingHospital(servicePrices), updateServicePrice, addServicePrice, deleteServicePrice,
      invoices: filterByViewingHospital(invoices), createInvoice, addInvoiceItem, removeInvoiceItem, payInvoice, processPayment,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};
