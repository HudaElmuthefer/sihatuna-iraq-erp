/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, checkBackendReachable } from '../api';

const AppContext = createContext(null);
export { AppContext };

// ─── ERP MODULES (ALL PAGES) ──────────────────────────────────────────────────
export const ALL_PAGES = [
  // ── الرئيسية ──
  { key: 'dashboard',        navKey: 'nav_dashboard',        label: 'لوحة التحكم',         labelEn: 'Dashboard',                   path: '/',                      icon: '🏠', group: 'core' },
  // ── الرعاية السريرية ──
  { key: 'patients',         navKey: 'nav_patients',         label: 'المرضى',               labelEn: 'Patients',                        path: '/patients',              icon: '👥', group: 'clinical' },
  { key: 'doctors',          navKey: 'nav_doctors',          label: 'الأطباء',              labelEn: 'Doctors',                       path: '/doctors',               icon: '🩺', group: 'clinical' },
  { key: 'appointments',     navKey: 'nav_appointments',     label: 'المواعيد',             labelEn: 'Appointments',                      path: '/appointments',          icon: '📅', group: 'clinical' },
  { key: 'departments',      navKey: 'nav_departments',      label: 'الأقسام',              labelEn: 'Departments',                       path: '/departments',           icon: '🏢', group: 'clinical' },
  { key: 'vaccinations',     navKey: 'nav_vaccinations',     label: 'التطعيمات',            labelEn: 'Vaccinations',                     path: '/vaccinations',          icon: '💉', group: 'clinical' },
  { key: 'drug-interactions',navKey: 'nav_drug_interact',    label: 'التضارب الدوائي',      labelEn: 'Drug Interactions',               path: '/drug-interactions',     icon: '💊', group: 'clinical' },
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
  { key: 'quality',          navKey: 'nav_quality',          label: 'إدارة الجودة ISO',     labelEn: 'Quality (ISO)',              path: '/quality',               icon: '🏅', group: 'documents' },
  // ── المختبرات والتصوير الطبي ──
  { key: 'laboratory',       navKey: 'nav_laboratory',       label: 'المختبرات الطبية',     labelEn: 'Laboratory',              path: '/laboratory',            icon: '🔬', group: 'medtech' },
  { key: 'radiology',        navKey: 'nav_radiology',        label: 'الأشعة والتصوير الطبي', labelEn: 'Radiology & Imaging',         path: '/radiology',             icon: '📡', group: 'medtech' },
  { key: 'pharmacy',         navKey: 'nav_pharmacy',         label: 'الصيدلية',             labelEn: 'Pharmacy',                      path: '/pharmacy',              icon: '💊', group: 'medtech' },
  // ── الإسعاف والمركبات ──
  { key: 'ambulance',        navKey: 'nav_ambulance',        label: 'الإسعاف والمركبات',    labelEn: 'Ambulance & Vehicles',              path: '/ambulance',             icon: '🚑', group: 'ops' },
  // ── الأصول والأجهزة ──
  { key: 'assets',           navKey: 'nav_assets',           label: 'الأصول والأجهزة الطبية', labelEn: 'Medical Assets',        path: '/assets',                icon: '🏗', group: 'assets' },
  // ── التقارير والتحليلات ──
  { key: 'smart-reports',    navKey: 'nav_smart_reports',    label: 'التقارير والتحليلات',  labelEn: 'Reports & Analytics',            path: '/smart-reports',         icon: '📊', group: 'reports' },
  // ── الإعدادات ──
  { key: 'settings',         navKey: 'nav_settings',         label: 'الإعدادات',            labelEn: 'Settings',                     path: '/settings',              icon: '⚙️', group: 'core' },
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
export const initialLabTests = [
  { id:1, reqNo:'LAB-2026-0541', patientName:'حسن محمود الزبيدي', patientId:'PT-0001', doctorName:'Dr. Ahmed Salem', testType:'تحليل دم شامل CBC', testTypeEn:'Complete Blood Count CBC', category:'hematology', requestDate:'2026-06-17', sampleDate:'2026-06-17', resultDate:null, status:'processing', priority:'normal', results:null, notes:'' },
  { id:2, reqNo:'LAB-2026-0540', patientName:'مريم علي الحسناوي', patientId:'PT-0002', doctorName:'Dr. Fatima Hassan', testType:'تحليل بول', testTypeEn:'Urinalysis', category:'urine', requestDate:'2026-06-16', sampleDate:'2026-06-16', resultDate:'2026-06-16', status:'completed', priority:'urgent', results:{ value:'طبيعي', valueEn:'Normal', notes:'لا توجد تشوهات', notesEn:'No abnormalities' }, notes:'' },
  { id:3, reqNo:'LAB-2026-0539', patientName:'سعد أحمد المشهداني', patientId:'PT-0003', doctorName:'Dr. Mohammed Ali', testType:'سكر صائم', testTypeEn:'Fasting Blood Sugar', category:'biochemistry', requestDate:'2026-06-15', sampleDate:'2026-06-15', resultDate:'2026-06-15', status:'completed', priority:'normal', results:{ value:'126 mg/dL', valueEn:'126 mg/dL', notes:'مرتفع قليلاً', notesEn:'Slightly elevated' }, notes:'يحتاج متابعة' },
  { id:4, reqNo:'LAB-2026-0542', patientName:'حسن محمود الزبيدي', patientId:'PT-0001', doctorName:'Dr. Ahmed Salem', testType:'وظائف كلى', testTypeEn:'Kidney Function Tests', category:'biochemistry', requestDate:'2026-06-17', sampleDate:null, resultDate:null, status:'pending', priority:'normal', results:null, notes:'' },
];

// ── ERP: Radiology Initial Data ────────────────────────────────────────────────
export const initialRadiology = [
  { id:1, reqNo:'RAD-2026-0221', patientName:'حسن محمود الزبيدي', patientId:'PT-0001', doctorName:'Dr. Ahmed Salem', modality:'xray', bodyPart:'صدر', bodyPartEn:'Chest', requestDate:'2026-06-17', examDate:null, reportDate:null, status:'scheduled', priority:'normal', technician:'', radiologist:'', findings:null, impression:null, images:0 },
  { id:2, reqNo:'RAD-2026-0220', patientName:'مريم علي الحسناوي', patientId:'PT-0002', doctorName:'Dr. Fatima Hassan', modality:'ultrasound', bodyPart:'بطن', bodyPartEn:'Abdomen', requestDate:'2026-06-16', examDate:'2026-06-16', reportDate:'2026-06-16', status:'reported', priority:'normal', technician:'Ahmed Al-Sonar', radiologist:'Dr. Samar Yaser', findings:'السونار طبيعي', findingsEn:'Ultrasound normal', impression:'لا شيء مرضي', impressionEn:'No pathological findings', images:4 },
  { id:3, reqNo:'RAD-2026-0219', patientName:'سعد أحمد المشهداني', patientId:'PT-0003', doctorName:'Dr. Mohammed Ali', modality:'mri', bodyPart:'ركبة يسرى', bodyPartEn:'Left Knee', requestDate:'2026-06-15', examDate:'2026-06-16', reportDate:null, status:'examined', priority:'urgent', technician:'Mohammed Radiology', radiologist:'', findings:null, impression:null, images:12 },
  { id:4, reqNo:'RAD-2026-0222', patientName:'حسن محمود الزبيدي', patientId:'PT-0001', doctorName:'Dr. Ahmed Salem', modality:'ct', bodyPart:'رأس', bodyPartEn:'Head', requestDate:'2026-06-17', examDate:null, reportDate:null, status:'pending', priority:'urgent', technician:'', radiologist:'', findings:null, impression:null, images:0 },
];

// ── ERP: Pharmacy Initial Data ─────────────────────────────────────────────────
export const initialPharmacyOrders = [
  { id:1, prescNo:'RX-2026-1201', patientName:'حسن محمود الزبيدي', patientId:'PT-0001', doctorName:'Dr. Ahmed Salem', date:'2026-06-17', items:[{ name:'أموكسيسيلين 500mg', nameEn:'Amoxicillin 500mg', qty:21, unit:'حبة', unitEn:'tablet', dosage:'3×يومياً لـ 7 أيام', dosageEn:'3× daily for 7 days' },{ name:'باراسيتامول 500mg', nameEn:'Paracetamol 500mg', qty:10, unit:'حبة', unitEn:'tablet', dosage:'عند الحاجة', dosageEn:'As needed' }], status:'dispensed', dispensedBy:'Pharmacist Mohammed', totalCost:18500, notes:'' },
  { id:2, prescNo:'RX-2026-1202', patientName:'مريم علي الحسناوي', patientId:'PT-0002', doctorName:'Dr. Fatima Hassan', date:'2026-06-17', items:[{ name:'فيتامين د3', nameEn:'Vitamin D3', qty:30, unit:'حبة', unitEn:'tablet', dosage:'مرة يومياً', dosageEn:'Once daily' }], status:'pending', dispensedBy:null, totalCost:12000, notes:'' },
  { id:3, prescNo:'RX-2026-1200', patientName:'سعد أحمد المشهداني', patientId:'PT-0003', doctorName:'Dr. Mohammed Ali', date:'2026-06-16', items:[{ name:'ميتفورمين 500mg', nameEn:'Metformin 500mg', qty:60, unit:'حبة', unitEn:'tablet', dosage:'مرتين يومياً', dosageEn:'Twice daily' }], status:'dispensed', dispensedBy:'Pharmacist Sara', totalCost:8000, notes:'' },
];

// ── ERP: Ambulance Initial Data ────────────────────────────────────────────────
export const initialAmbulance = {
  vehicles: [
    { id:1, code:'AMB-01', plate:'Basra A 1234', type:'advanced', model:'Toyota HiAce 2022', crew:'Ahmed Al-Isafi / Dr. Laith', status:'available', lastService:'2026-05-01', nextService:'2026-11-01', km:42500, fuel:75, location:'Hospital - Parking A' },
    { id:2, code:'AMB-02', plate:'Basra B 5678', type:'basic', model:'Ford Transit 2021', crew:'Kareem Al-Musaf / Salma Nurse', status:'on_mission', lastService:'2026-04-15', nextService:'2026-10-15', km:68200, fuel:45, location:'On Mission' },
    { id:3, code:'AMB-03', plate:'Basra C 9012', type:'advanced', model:'Mercedes Sprinter 2023', crew:'', status:'maintenance', lastService:'2026-06-10', nextService:'2026-12-10', km:15000, fuel:30, location:'Maintenance Workshop' },
  ],
  missions: [
    { id:1, missionNo:'MSN-2026-089', vehicleId:2, type:'emergency', callTime:'2026-06-17 09:15', address:'Al-Jazair District, Basra', patient:'Unknown', status:'active', crew:'Kareem Al-Musaf', notes:'Traffic accident' },
    { id:2, missionNo:'MSN-2026-088', vehicleId:1, type:'transfer', callTime:'2026-06-17 07:30', address:'Basra General Hospital', patient:'Ali Mohammed', status:'completed', crew:'Ahmed Al-Isafi', notes:'Patient transfer for treatment' },
  ]
};

// ── ERP: Assets Initial Data ────────────────────────────────────────────────────
export const initialAssets = [
  { id:1, assetNo:'AST-MED-001', name:'جهاز أشعة سيني رقمي', nameEn:'Digital X-Ray Machine', category:'radiology', brand:'Siemens', model:'Multix Fusion', serial:'SIE-2022-XR-4512', purchaseDate:'2022-03-15', purchaseCost:85000000, currentValue:68000000, location:'Radiology Dept.', status:'active', condition:'good', warranty:'2025-03-14', lastMaintenance:'2026-03-01', nextMaintenance:'2026-09-01', responsiblePerson:'Dr. Samar Yaser' },
  { id:2, assetNo:'AST-MED-002', name:'جهاز رنين مغناطيسي MRI', nameEn:'MRI Machine', category:'mri', brand:'GE Healthcare', model:'Signa Architect 3T', serial:'GE-2021-MRI-8823', purchaseDate:'2021-08-20', purchaseCost:650000000, currentValue:540000000, location:'Radiology Dept.', status:'active', condition:'excellent', warranty:'2026-08-19', lastMaintenance:'2026-04-01', nextMaintenance:'2026-10-01', responsiblePerson:'Dr. Samar Yaser' },
  { id:3, assetNo:'AST-MED-003', name:'جهاز مفراس CT', nameEn:'CT Scanner', category:'ct', brand:'Philips', model:'Incisive CT', serial:'PHI-2023-CT-3341', purchaseDate:'2023-01-10', purchaseCost:420000000, currentValue:385000000, location:'Radiology Dept.', status:'maintenance', condition:'fair', warranty:'2027-01-09', lastMaintenance:'2026-06-10', nextMaintenance:'2026-07-10', responsiblePerson:'Eng. Khalid Al-Techni' },
  { id:4, assetNo:'AST-MED-004', name:'جهاز سونار تشخيصي', nameEn:'Diagnostic Ultrasound', category:'ultrasound', brand:'Samsung', model:'RS85A', serial:'SAM-2022-US-7751', purchaseDate:'2022-11-05', purchaseCost:45000000, currentValue:38000000, location:'Ultrasound Dept.', status:'active', condition:'good', warranty:'2025-11-04', lastMaintenance:'2026-02-15', nextMaintenance:'2026-08-15', responsiblePerson:'Ahmed Al-Sonar' },
  { id:5, assetNo:'AST-MED-005', name:'جهاز تحليل الدم الآلي', nameEn:'Automated Blood Analyzer', category:'laboratory', brand:'Sysmex', model:'XN-2000', serial:'SYS-2021-HEM-2234', purchaseDate:'2021-06-01', purchaseCost:78000000, currentValue:58000000, location:'Laboratory', status:'active', condition:'good', warranty:'2024-05-31', lastMaintenance:'2026-05-20', nextMaintenance:'2026-11-20', responsiblePerson:'Eng. Fatima Lab' },
  { id:6, assetNo:'AST-VEH-001', name:'سيارة إسعاف متطورة', nameEn:'Advanced Life Support Ambulance', category:'vehicle', brand:'Toyota', model:'HiAce 2022', serial:'TOY-2022-AMB-001', purchaseDate:'2022-07-01', purchaseCost:95000000, currentValue:75000000, location:'Ambulance Parking', status:'active', condition:'good', warranty:'2025-06-30', lastMaintenance:'2026-05-01', nextMaintenance:'2026-11-01', responsiblePerson:'Ahmed Al-Isafi' },
];

// Backward compatibility aliases
export const mockDoctors = initialDoctors;
export const mockDepartments = initialDepartments;
export const mockPatients = initialPatients;
export const mockAppointments = initialAppointments;

const mockNotifications = [
  { id:1, type:'appointment', message:'موعد جديد: حسن محمود - اليوم 09:00', time:'منذ 5 دقائق', read:false },
  { id:2, type:'alert', message:'⚠️ مخزون منخفض: باراسيتامول 500mg (38 علبة)', time:'منذ 30 دقيقة', read:false },
  { id:3, type:'alert', message:'⚠️ علاوة مستحقة: سارة قاسم (6 أشهر)', time:'منذ ساعة', read:false },
  { id:4, type:'alert', message:'⚠️ اقتراب تقاعد: باسم علي (3 أشهر)', time:'منذ ساعتين', read:false },
  { id:5, type:'procurement', message:'طلب شراء PO-2026-003 بانتظار الموافقة', time:'منذ ساعتين', read:false },
  { id:6, type:'document', message:'وارد عاجل من وزارة الصحة', time:'منذ 3 ساعات', read:true },
  { id:7, type:'report', message:'تقرير شهري ERP جاهز', time:'منذ يوم', read:true },
];

// ─── PROVIDER ──────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  // ── AUTO-RESET on version change ─────────────────────────────────────────
  const DATA_VERSION = 'v6.0-en-final';
  const storedVersion = localStorage.getItem('data_version');
  if (storedVersion !== DATA_VERSION) {
    const authUser  = localStorage.getItem('auth_user');
    const theme_    = localStorage.getItem('theme');
    const lang_     = localStorage.getItem('lang');
    localStorage.clear();
    if (authUser)  localStorage.setItem('auth_user',  authUser);
    if (theme_)    localStorage.setItem('theme',      theme_);
    if (lang_)     localStorage.setItem('lang',       lang_);
    localStorage.setItem('data_version', DATA_VERSION);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ar');
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; } });
  // ── إصلاح ────────────────────────────────────────────────────────────────
  // بعد الانتقال لـ httpOnly cookies، صار مصدر الحقيقة الفعلي لتسجيل الدخول
  // هو الكوكي نفسها بجانب الخادم، بينما auth_user بـ localStorage مجرّد نسخة
  // محلية مساعدة لعرض الواجهة فوراً دون انتظار. لو صار أي تعارض بينهما (مثلاً
  // المستخدم مسح localStorage يدوياً، أو أي خطأ آخر يفرّغ auth_user بينما
  // الكوكي لسا صالحة) — كانت الواجهة تعرض حالة "شبه مسجّل دخول" مربكة: القائمة
  // الجانبية تظهر عادي، لكن كل البيانات تبقى فاضية بصمت بدون أي رسالة خطأ،
  // لأن كل نقاط جلب البيانات تتحقق من user (الفاضي) وتتوقف دون محاولة حتى.
  // الحل: عند التحميل، لو user فاضي محلياً، نتحقق من الخادم مباشرة (الكوكي
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
  const [notifications, setNotifications] = useState(mockNotifications);
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
  const [labTests, setLabTests] = useState(() => {
    try { const s = localStorage.getItem('erp_labtests'); if (!s) return initialLabTests; const p = JSON.parse(s); return p[0]?.testTypeEn ? p : initialLabTests; } catch { return initialLabTests; }
  });
  const [radiology, setRadiology] = useState(() => {
    try { const s = localStorage.getItem('erp_radiology'); if (!s) return initialRadiology; const p = JSON.parse(s); return p[0]?.bodyPartEn ? p : initialRadiology; } catch { return initialRadiology; }
  });
  const [pharmacyOrders, setPharmacyOrders] = useState(() => {
    try { const s = localStorage.getItem('erp_pharmacy'); if (!s) return initialPharmacyOrders; const p = JSON.parse(s); return p[0]?.items?.[0]?.nameEn ? p : initialPharmacyOrders; } catch { return initialPharmacyOrders; }
  });
  const [ambulanceData, setAmbulanceData] = useState(() => {
    try { const s = localStorage.getItem('erp_ambulance'); if (!s) return initialAmbulance; const p = JSON.parse(s); return p.vehicles?.[0]?.plate?.includes('بصرة') ? initialAmbulance : p; } catch { return initialAmbulance; }
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
  // صفحة تجيبها لحالها، حتى تقدر أي صفحة (مثل المرضى) تسأل "هل الوضع مفعّل؟"
  // وتعرض حقل اختيار المنشأة عند الحاجة فقط.
  const [hospitals, setHospitals] = useState([]);
  // "المنشأة المعروضة حالياً" — مفهوم مختلف عن hospitalId بحساب المستخدم:
  // هذا فلتر عرض اختياري يظهر فقط لحساب مستوى الوزارة (بلا hospitalId مُعيَّن)
  // اللي يدير عدة منشآت ويحتاج يركّز على وحدة معينة أحياناً بدل الكل دفعة وحدة.
  // 'all' = يشوف بيانات كل المنشآت مجتمعة (السلوك الافتراضي الحالي).
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
    } catch (err) {
      showToast(err.message, 'error');
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
    } catch (err) {
      showToast(err.message, 'error');
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

  const createInvoice = (patientId) => {
    // إذا فيه فاتورة غير مدفوعة أصلاً لنفس المريض، رجّعيها بدل إنشاء وحدة جديدة
    const existing = invoices.find(inv => inv.patientId === patientId && inv.status === 'unpaid');
    if (existing) return existing.id;
    const id = Date.now();
    const newInvoice = { id, patientId, items: [], total: 0, status: 'unpaid', paymentMethod: null, createdAt: new Date().toISOString(), paidAt: null };
    setInvoices(prev => [...prev, newInvoice]);
    syncToServer('invoices', 'create', newInvoice);
    return id;
  };

  const addInvoiceItem = (invoiceId, item) => setInvoices(prev => {
    const updated = prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      const newItem = { ...item, id: Date.now() + Math.random(), price: Number(item.price) || 0, qty: Number(item.qty) || 1 };
      const items = [...inv.items, newItem];
      const total = items.reduce((s, it) => s + it.price * it.qty, 0);
      return { ...inv, items, total };
    });
    const changed = updated.find(inv => inv.id === invoiceId);
    if (changed) syncToServer('invoices', 'update', changed);
    return updated;
  });

  const removeInvoiceItem = (invoiceId, itemId) => setInvoices(prev => {
    const updated = prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      const items = inv.items.filter(it => it.id !== itemId);
      const total = items.reduce((s, it) => s + it.price * it.qty, 0);
      return { ...inv, items, total };
    });
    const changed = updated.find(inv => inv.id === invoiceId);
    if (changed) syncToServer('invoices', 'update', changed);
    return updated;
  });

  const payInvoice = (invoiceId, paymentMethod, referenceCode) => setInvoices(prev => {
    const updated = prev.map(inv =>
      inv.id === invoiceId ? { ...inv, status: 'paid', paymentMethod, referenceCode: referenceCode || null, paidAt: new Date().toISOString() } : inv
    );
    const changed = updated.find(inv => inv.id === invoiceId);
    if (changed) syncToServer('invoices', 'update', changed);
    return updated;
  });

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
  useEffect(() => { localStorage.setItem('erp_labtests', JSON.stringify(labTests)); }, [labTests]);
  useEffect(() => { localStorage.setItem('erp_radiology', JSON.stringify(radiology)); }, [radiology]);
  useEffect(() => { localStorage.setItem('erp_pharmacy', JSON.stringify(pharmacyOrders)); }, [pharmacyOrders]);
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
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  // عند تسجيل الدخول (وجود توكن حقيقي)، نحمّل كل موديول مربوط من الباك إند الحقيقي
  // بدل النسخة المحلية — هذا يحل مشكلة "كل جهاز يشوف بيانات مختلفة"
  useEffect(() => {
    if (!user) return; // بدون توكن قابل للقراءة من الفرونت إند بعد اليوم — user نفسها المؤشر الوحيد لتسجيل الدخول
    let cancelled = false;
    let sessionExpiredHandled = false; // يمنع تكرار رسالة "انتهت الجلسة" لكل موديول فشل على حدة
    SYNCED_MODULES.forEach(({ key, setState, normalize }) => {
      setSyncStatus(prev => ({ ...prev, [key]: 'syncing' }));
      api.get(`/${key}`)
        .then(serverData => {
          if (cancelled) return;
          if (Array.isArray(serverData) && serverData.length > 0) {
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
                ? 'انتهت جلسة الدخول، الرجاء تسجيل الدخول من جديد'
                : 'Your session has expired — please log in again',
              'error'
            );
          }
        });
    });
    return () => { cancelled = true; console.log('🔍 [SYNC] cleanup — cancelled=true من الآن'); }; // TEMP DEBUG
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
        // المُعادة من الخادم (اللي تحمل المعرّف الصحيح) فور نجاح الإنشاء.
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
      // حين يكون الخادم شغّالاً فعلياً لكن جلسة الدخول بالمتصفح قديمة أو منتهية.
      // بدل ترك المستخدم يحتار بين الاحتمالين، نسجّل خروجه تلقائياً برسالة واضحة الآن.
      if (err.status === 401) {
        console.warn(`⚠️ انتهت صلاحية جلسة الدخول أثناء مزامنة "${moduleKey}" — يتم تسجيل الخروج تلقائياً.`);
        logout();
        showToast(
          lang === 'ar'
            ? 'انتهت جلسة الدخول، الرجاء تسجيل الدخول من جديد'
            : 'Your session has expired — please log in again',
          'error'
        );
        return false;
      }
      // حالة خطأ التحقق من صحة المدخلات (400): سبب مختلف تماماً عن انقطاع الاتصال —
      // الخادم شغّال ووصله الطلب فعلاً، لكنه رفض البيانات نفسها (مثل حقل مطلوب فارغ
      // أو نوع بيانات خاطئ). عرض رسالة "تم الحفظ محلياً" هنا مضلّل تماماً لأنه يوحي
      // بمشكلة اتصال بينما المشكلة الحقيقية بالبيانات المُدخلة نفسها. نعرض بدلها
      // الرسالة التفصيلية الفعلية القادمة من الخادم (مثل "الحقل رقم الهاتف مطلوب").
      if (err.status === 400) {
        console.warn(`⚠️ رُفضت بيانات "${moduleKey}" من الخادم (خطأ تحقق):`, err.message);
        showToast(err.message, 'error');
        return false;
      }
      console.warn(`⚠️ فشلت مزامنة "${moduleKey}" مع الخادم (تم الاحتفاظ بالتغيير محلياً فقط):`, err.message);
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
      // تمييز بين "بيانات دخول خاطئة" و"السيرفر غير شغّال" برسالة واضحة
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
    // مسح الكوكي الفعلية يحتاج طلب للخادم (كود الجافاسكربت لا يقدر يمسح
    // httpOnly cookie مباشرة). لا ننتظر النتيجة — تسجيل الخروج بالواجهة يصير
    // فوراً بغض النظر عن نجاح الطلب، وحتى لو فشل الطلب (مثلاً الخادم متوقف
    // مؤقتاً)، الكوكي القديمة تنتهي صلاحيتها تلقائياً بعد 7 أيام كحد أقصى.
    api.post('/auth/logout', {}).catch(() => {});
    localStorage.removeItem('auth_user');
    setUser(null);
  };
  const markNotifRead = (id) => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllNotifRead = () => setNotifications(p => p.map(n => ({ ...n, read: true })));
  const hasPermission = useCallback((pageKey) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (user.permissions || []).includes(pageKey);
  }, [user]);

  return (
    <AppContext.Provider value={{
      theme, setTheme, toggleTheme, lang, setLang, toggleLang, t,
      user, login, logout,
      toasts, addToast, showToast,
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
      hospitals, multiHospitalEnabled, reloadHospitalsAndMode: loadHospitalsAndMode,
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
