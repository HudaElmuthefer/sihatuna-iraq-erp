/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { FaPlus, FaEdit, FaTrash, FaBed, FaPills, FaSignOutAlt } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)';

const emptyWard = { name: '', nameEn: '', bedCount: 10, notes: '' };
const emptyAdmission = { patientName: '', wardId: '', bedNo: '', admissionDate: new Date().toISOString().split('T')[0], diagnosis: '', treatingDoctor: '', status: 'admitted', dischargeDate: '', dischargeNotes: '' };
const emptyOrder = { drugName: '', dose: '', route: 'فموي', timesPerDay: 3, scheduledTimes: [], frequency: '', prescribedBy: '', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '' };

export default function WardsPage() {
  const { lang, showToast, syncToServer, confirmDialog, user, filterByViewingHospital, hospitals, multiHospitalEnabled, refreshNotifSources } = useApp();
  const L = (ar, en) => lang === 'ar' ? ar : en;

  // القيمة الابتدائية تحترم ?tab= بالرابط (القائمة الجانبية القابلة للتوسّع
  // — راجعي components/Layout.js وconfig/sidebarSubTabs.js)، مع تجاهل أي
  // قيمة غير معروفة بدل عرض صفحة فارغة بصمت.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => { // admissions | schedule | wards
    const fromUrl = searchParams.get('tab');
    return ['admissions', 'schedule', 'wards'].includes(fromUrl) ? fromUrl : 'admissions';
  });
  // الـuseState أعلاه يُنفَّذ مرة واحدة فقط عند التركيب — لا يكفي وحده حين
  // تُنقَّل من تبويب فرعي بالقائمة الجانبية لآخر بنفس هذه الصفحة (المسار
  // نفسه، ?tab= فقط يتغيّر)، فالصفحة تبقى مُثبَّتة وrouter لا يُعيد تركيبها.
  // هذا الـeffect يُحدِّث التبويب كلما تغيّر ?tab= فعلياً بالرابط، دون التأثير
  // على التبديل اليدوي (أزرار التبويبات لا تُغيّر الرابط أصلاً).
  React.useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (['admissions', 'schedule', 'wards'].includes(fromUrl)) setTab(fromUrl);
  }, [searchParams]);
  const [wards, setWards] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [administrations, setAdministrations] = useState([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      api.get('/wards'), api.get('/admissions'), api.get('/medicationOrders'), api.get('/medicationAdministrations'),
    ]).then(([w, a, o, ad]) => {
      if (cancelled) return;
      if (Array.isArray(w)) setWards(w);
      if (Array.isArray(a)) setAdmissions(a);
      if (Array.isArray(o)) setOrders(o);
      if (Array.isArray(ad)) setAdministrations(ad);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── الردهات ──────────────────────────────────────────────────────────────
  const [showWardModal, setShowWardModal] = useState(false);
  const [editingWard, setEditingWard] = useState(null);
  const [wardForm, setWardForm] = useState(emptyWard);
  const openAddWard = () => { setEditingWard(null); setWardForm(emptyWard); setShowWardModal(true); };
  const openEditWard = (w) => { setEditingWard(w); setWardForm({ ...w }); setShowWardModal(true); };
  const saveWard = async () => {
    if (!wardForm.name) { showToast(L('يرجى إدخال اسم الردهة', 'Please enter ward name'), 'error'); return; }
    const w = { ...wardForm, bedCount: +wardForm.bedCount || 0 };
    const prev = wards;
    if (editingWard) {
      const uw = { ...w, id: editingWard.id };
      setWards(p => p.map(x => x.id === editingWard.id ? uw : x));
      const ok = await syncToServer('wards', 'update', uw);
      if (!ok) { setWards(prev); return; }
      showToast(L('تم التحديث', 'Updated'), 'success');
    } else {
      const nw = { ...w, id: Date.now() };
      setWards(p => [...p, nw]);
      const synced = await syncToServer('wards', 'create', nw);
      if (!synced) { setWards(prev); return; }
      if (typeof synced === 'object' && synced.id !== nw.id) setWards(p => p.map(x => x.id === nw.id ? synced : x));
      showToast(L('تمت إضافة الردهة', 'Ward added'), 'success');
    }
    setShowWardModal(false);
  };
  const delWard = async (id) => {
    if (admissions.some(a => a.wardId === id && a.status === 'admitted')) {
      showToast(L('لا يمكن حذف الردهة — فيها مرضى مُدخَلون حالياً', 'Cannot delete ward — it has currently admitted patients'), 'error');
      return;
    }
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')))) return;
    const prev = wards;
    setWards(p => p.filter(x => x.id !== id));
    const ok = await syncToServer('wards', 'delete', { id });
    if (!ok) { setWards(prev); return; }
    showToast(L('تم الحذف', 'Deleted'), 'info');
  };

  // ── حالات الإدخال ────────────────────────────────────────────────────────
  const [showAdmModal, setShowAdmModal] = useState(false);
  const [editingAdm, setEditingAdm] = useState(null);
  const [admForm, setAdmForm] = useState(emptyAdmission);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('admitted');
  const [showAdmImport, setShowAdmImport] = useState(false);
  const [showWardImport, setShowWardImport] = useState(false);
  const [showOrderImport, setShowOrderImport] = useState(false);

  const openAddAdm = () => { setEditingAdm(null); setAdmForm(emptyAdmission); setShowAdmModal(true); };
  const openEditAdm = (a) => { setEditingAdm(a); setAdmForm({ ...a }); setShowAdmModal(true); };
  const saveAdm = async () => {
    if (!admForm.patientName || !admForm.wardId) { showToast(L('يرجى إدخال اسم المريض والردهة', 'Please enter patient name and ward'), 'error'); return; }
    const prev = admissions;
    if (editingAdm) {
      const ua = { ...admForm, id: editingAdm.id };
      setAdmissions(p => p.map(x => x.id === editingAdm.id ? ua : x));
      const ok = await syncToServer('admissions', 'update', ua);
      if (!ok) { setAdmissions(prev); return; }
      showToast(L('تم التحديث', 'Updated'), 'success');
    } else {
      const na = { ...admForm, id: Date.now() };
      setAdmissions(p => [...p, na]);
      const synced = await syncToServer('admissions', 'create', na);
      if (!synced) { setAdmissions(prev); return; }
      if (typeof synced === 'object' && synced.id !== na.id) setAdmissions(p => p.map(x => x.id === na.id ? synced : x));
      showToast(L('تم تسجيل الإدخال', 'Admission recorded'), 'success');
    }
    setShowAdmModal(false);
  };
  const delAdm = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')))) return;
    const prev = admissions;
    setAdmissions(p => p.filter(x => x.id !== id));
    const ok = await syncToServer('admissions', 'delete', { id });
    if (!ok) { setAdmissions(prev); return; }
    showToast(L('تم الحذف', 'Deleted'), 'info');
  };
  const dischargePatient = async (a) => {
    if (!(await confirmDialog(L('تسجيل خروج المريض من المستشفى؟', 'Discharge this patient from the hospital?')))) return;
    const prev = admissions;
    const updated = { ...a, status: 'discharged', dischargeDate: new Date().toISOString().split('T')[0] };
    setAdmissions(p => p.map(x => x.id === a.id ? updated : x));
    const ok = await syncToServer('admissions', 'update', updated);
    if (!ok) { setAdmissions(prev); return; }
    showToast(L('تم تسجيل الخروج', 'Discharge recorded'), 'success');
  };

  // ── الأدوية (نافذة تفصيلية لكل حالة إدخال) ──────────────────────────────
  const [medAdm, setMedAdm] = useState(null); // الحالة المفتوحة حالياً لعرض أدويتها
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [giveDoseFor, setGiveDoseFor] = useState(null); // orderId
  const [giveDoseTime, setGiveDoseTime] = useState(''); // الموعد المحدَّد تحديداً بنافذة إعطاء الجرعة
  const [nurseName, setNurseName] = useState('');

  const ordersFor = (admissionId) => orders.filter(o => o.admissionId === admissionId);
  const administrationsFor = (orderId) => administrations.filter(a => a.orderId === orderId).sort((a, b) => new Date(b.administeredAt) - new Date(a.administeredAt));

  const saveOrder = async () => {
    if (!orderForm.drugName) { showToast(L('يرجى إدخال اسم الدواء', 'Please enter drug name'), 'error'); return; }
    const no = { ...orderForm, frequency: frequencyLabel(orderForm.timesPerDay), admissionId: medAdm.id, id: Date.now() };
    const prev = orders;
    setOrders(p => [...p, no]);
    const synced = await syncToServer('medicationOrders', 'create', no);
    if (!synced) { setOrders(prev); return; }
    if (typeof synced === 'object' && synced.id !== no.id) setOrders(p => p.map(x => x.id === no.id ? synced : x));
    showToast(L('تمت إضافة الوصفة', 'Order added'), 'success');
    setShowOrderModal(false);
    setOrderForm(emptyOrder);
  };
  const delOrder = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')))) return;
    const prev = orders;
    setOrders(p => p.filter(x => x.id !== id));
    const ok = await syncToServer('medicationOrders', 'delete', { id });
    if (!ok) { setOrders(prev); return; }
    showToast(L('تم الحذف', 'Deleted'), 'info');
  };
  const giveDose = async (order, scheduledFor) => {
    if (!nurseName) { showToast(L('يرجى إدخال اسم الممرض/ة', 'Please enter nurse name'), 'error'); return; }
    const na = {
      id: Date.now(), orderId: order.id, admissionId: order.admissionId, drugName: order.drugName,
      administeredBy: nurseName, administeredAt: new Date().toISOString(), // الوقت الحقيقي الفعلي للإعطاء
      scheduledFor: scheduledFor || null, scheduledDate: scheduledFor ? todayStr : null, // الموعد المجدوَل المرتبط به تحديداً
    };
    const prev = administrations;
    setAdministrations(p => [...p, na]);
    const synced = await syncToServer('medicationAdministrations', 'create', na);
    if (!synced) { setAdministrations(prev); return; }
    if (typeof synced === 'object' && synced.id !== na.id) setAdministrations(p => p.map(x => x.id === na.id ? synced : x));
    showToast(L('تم تسجيل إعطاء الجرعة', 'Dose administration recorded'), 'success');
    setGiveDoseFor(null);
    refreshNotifSources(); // إصلاح: يخفي تنبيه هذي الجرعة بالذات فوراً من الجرس
  };

  const wardName = (id) => wards.find(w => w.id === id)?.[lang === 'ar' ? 'name' : 'nameEn'] || wards.find(w => w.id === id)?.name || '—';

  // ── جدول الجرعات المستحقة اليوم (لمرضى الردهات المُدخَلين فقط) ─────────────
  // إصلاح: كان المتابعة تقتصر على سجل ماضٍ (مين أعطى الجرعة ومتى) بدون أي
  // معرفة بمواعيد الجرعات القادمة أو المتأخرة — يعني ما فيه طريقة تعرف فيها
  // الممرضة "شنو الجرعة المستحقة الحين" بنظرة وحدة. الآن نحسب مواعيد كل
  // جرعة (موزّعة بالتساوي على 24 ساعة بعدد المرات باليوم)، ونقارنها بسجل
  // الإعطاء الفعلي لتحديد: تم الإعطاء ✅ / متأخرة ⚠️ / قادمة ⏳.
  const computeScheduleTimes = (timesPerDay) => {
    const n = Math.max(1, Math.min(12, +timesPerDay || 1));
    const intervalMin = Math.floor((24 * 60) / n);
    const times = [];
    let mins = 8 * 60; // أول جرعة الساعة 08:00 صباحاً
    for (let i = 0; i < n; i++) {
      const h = Math.floor((mins % (24 * 60)) / 60);
      const m = (mins % (24 * 60)) % 60;
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      mins += intervalMin;
    }
    return times;
  };
  // إصلاح: "التكرار" كان حقل نص حر منفصل تماماً عن "عدد المرات باليوم" —
  // يبقى بقيمته الافتراضية الثابتة (أو أي نص كتبته سابقاً) حتى لو غيّرتِ
  // العدد، فيظهر تكرار خاطئ لا علاقة له بالعدد الفعلي المحدَّد. الآن يُحتسَب
  // مباشرة من العدد: 24 ÷ عدد المرات = عدد الساعات بين كل جرعة والثانية.
  const frequencyLabel = (timesPerDay) => {
    const n = Math.max(1, Math.min(12, +timesPerDay || 1));
    const hours = Math.round((24 / n) * 10) / 10; // تقريب لأقرب رقم عشري واحد (مثال: 24÷5=4.8)
    return L(`كل ${hours} ساعة`, `Every ${hours}h`);
  };
  // إصلاح (من المراجعة الشاملة): "طريقة الإعطاء" كانت تُخزَّن كنص عربي ثابت
  // بالسجل (فموي/وريدي/...) وتُعرَض كما هي بغض النظر عن اللغة الحالية — نفس
  // فئة خلل الأقسام والطابور المكتشَفة اليوم، بس بمكان ثالث منفصل تماماً.
  // هذي دالة تترجم القيمة المخزَّنة حسب اللغة وقت العرض فقط (تبقى القيمة
  // المخزَّنة بقاعدة البيانات عربية دائماً، وهذا مقصود — التخزين ثابت،
  // العرض فقط هو اللي يتغيّر حسب اللغة).
  const ROUTE_LABELS = {
    'فموي': { ar: 'فموي', en: 'Oral' },
    'وريدي': { ar: 'وريدي', en: 'IV' },
    'عضلي': { ar: 'عضلي', en: 'IM' },
    'تحت الجلد': { ar: 'تحت الجلد', en: 'Subcutaneous' },
    'موضعي': { ar: 'موضعي', en: 'Topical' },
  };
  const routeLabel = (route) => ROUTE_LABELS[route]?.[lang] || route;
  const todayStr = new Date().toISOString().split('T')[0];
  const activeOrdersToday = orders.filter(o => {
    const adm = admissions.find(a => a.id === o.admissionId);
    if (!adm || adm.status !== 'admitted') return false;
    if (o.startDate && o.startDate > todayStr) return false;
    if (o.endDate && o.endDate < todayStr) return false;
    return true;
  });
  const scheduleRows = activeOrdersToday.flatMap(o => {
    const adm = admissions.find(a => a.id === o.admissionId);
    const times = (Array.isArray(o.scheduledTimes) && o.scheduledTimes.length > 0) ? o.scheduledTimes : computeScheduleTimes(o.timesPerDay);
    return times.map(time => {
      const scheduledAt = new Date(`${todayStr}T${time}:00`);
      // تطابق دقيق بالموعد المجدوَل المُعلَّم صراحةً بلحظة الإعطاء — لا علاقة
      // له بالوقت الحالي (نفس الآلية اللي تصحح مشكلة "كل جرعة تغيّر كل
      // الجرعات"، لأن كل جرعة الآن مربوطة بموعدها بالضبط لا بالتقارب الزمني).
      // نُبقي على تطابق تقريبي (٩٠ دقيقة) كخيار احتياطي فقط لسجلات قديمة
      // أُنشئت قبل هذا الإصلاح ولا تحمل scheduledFor.
      const given = administrationsFor(o.id).find(a =>
        (a.scheduledFor === time && a.scheduledDate === todayStr) ||
        (!a.scheduledFor && Math.abs(new Date(a.administeredAt) - scheduledAt) < 90 * 60 * 1000)
      );
      const status = given ? 'given' : (new Date() > new Date(scheduledAt.getTime() + 30 * 60 * 1000) ? 'overdue' : 'upcoming');
      return { order: o, admission: adm, time, status, given };
    });
  }).sort((a, b) => a.time.localeCompare(b.time));
  const visibleAdmissions = filterByViewingHospital(admissions).filter(a =>
    (statusFilter === 'all' || a.status === statusFilter) &&
    (!search || a.patientName?.toLowerCase().includes(search.toLowerCase()) || a.diagnosis?.toLowerCase().includes(search.toLowerCase()))
  );
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(visibleAdmissions, 50);

  const stats = {
    admitted: admissions.filter(a => a.status === 'admitted').length,
    totalBeds: wards.reduce((s, w) => s + (+w.bedCount || 0), 0),
    wardsCount: wards.length,
  };

  return (
    <div className="page-content">
      <PageBanner icon="🛏️" title={L('الردهات', 'Wards')} subtitle={L('إدارة المرضى الداخليين، الأسرّة، والأدوية', 'Manage inpatients, beds, and medications')} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{stats.admitted}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{L('مُدخَلون حالياً', 'Currently admitted')}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{stats.totalBeds}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{L('إجمالي الأسرّة', 'Total beds')}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{stats.wardsCount}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{L('عدد الردهات', 'Wards')}</div></div>
        </div>
      </PageBanner>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('admissions')} className={tab === 'admissions' ? 'btn btn-primary' : 'btn btn-outline'}>{L('حالات الإدخال', 'Admissions')}</button>
        <button onClick={() => setTab('schedule')} className={tab === 'schedule' ? 'btn btn-primary' : 'btn btn-outline'}>💊 {L('جدول الأدوية اليومي', 'Daily Medication Schedule')}</button>
        <button onClick={() => setTab('wards')} className={tab === 'wards' ? 'btn btn-primary' : 'btn btn-outline'}>{L('الردهات والأسرّة', 'Wards & Beds')}</button>
      </div>

      {tab === 'schedule' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⏳ {L('قادمة', 'Upcoming')}: {scheduleRows.filter(r => r.status === 'upcoming').length}</span>
              <span style={{ fontSize: 12, color: '#ef4444' }}>⚠️ {L('متأخرة', 'Overdue')}: {scheduleRows.filter(r => r.status === 'overdue').length}</span>
              <span style={{ fontSize: 12, color: '#22c55e' }}>✅ {L('تم الإعطاء', 'Given')}: {scheduleRows.filter(r => r.status === 'given').length}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowOrderImport(true)} className="btn btn-outline">📊 {L('استيراد من Excel', 'Import from Excel')}</button>
              <ExcelExportButton apiName="medicationOrders" lang={lang} onError={(m) => showToast(m, 'error')} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{L('الوقت المجدوَل', 'Scheduled Time')}</th>
                  <th>{L('المريض', 'Patient')}</th>
                  <th>{L('الردهة / السرير', 'Ward / Bed')}</th>
                  <th>{L('الدواء', 'Drug')}</th>
                  <th>{L('الجرعة / الطريقة', 'Dose / Route')}</th>
                  <th>{L('الحالة', 'Status')}</th>
                  <th>{L('التفاصيل', 'Details')}</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row, idx) => (
                  <tr key={idx} style={row.status === 'overdue' ? { background: '#ef444410' } : undefined}>
                    <td style={{ fontWeight: 600 }}>{row.time}</td>
                    <td>{row.admission?.patientName || '—'}</td>
                    <td>{row.admission ? `${wardName(row.admission.wardId)}${row.admission.bedNo ? ` — ${row.admission.bedNo}` : ''}` : '—'}</td>
                    <td>{row.order.drugName}</td>
                    <td>{row.order.dose} {row.order.route && `· ${routeLabel(row.order.route)}`}</td>
                    <td>
                      {row.status === 'given' && <span style={{ background: '#22c55e15', color: '#22c55e', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>✅ {L('تم الإعطاء', 'Given')}</span>}
                      {row.status === 'overdue' && <span style={{ background: '#ef444415', color: '#ef4444', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>⚠️ {L('متأخرة', 'Overdue')}</span>}
                      {row.status === 'upcoming' && <span style={{ background: '#f59e0b15', color: '#f59e0b', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>⏳ {L('قادمة', 'Upcoming')}</span>}
                    </td>
                    <td>
                      {row.given ? (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.given.administeredBy} — {new Date(row.given.administeredAt).toLocaleTimeString(lang === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      ) : giveDoseFor === `${row.order.id}-${row.time}` ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input value={nurseName} onChange={e => setNurseName(e.target.value)} placeholder={L('اسم الممرض/ة', 'Nurse name')} className="form-control" style={{ fontSize: 12, padding: '4px 8px', width: 130 }} />
                          <button onClick={() => giveDose(row.order, row.time)} className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>{L('تأكيد', 'Confirm')}</button>
                        </div>
                      ) : (
                        <button onClick={() => setGiveDoseFor(`${row.order.id}-${row.time}`)} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>{L('إعطاء الآن', 'Give Now')}</button>
                      )}
                    </td>
                  </tr>
                ))}
                {scheduleRows.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    {admissions.filter(a => a.status === 'admitted').length === 0 ? (
                      <>
                        <div style={{ marginBottom: 10 }}>{L('ما فيه أي مريض مُدخَل حالياً بالردهات — الجدول يعرض فقط جرعات المرضى المُدخَلين.', 'No patient is currently admitted to a ward — the schedule only shows doses for currently-admitted patients.')}</div>
                        <button onClick={() => setTab('admissions')} className="btn btn-primary" style={{ fontSize: 13 }}>{L('إدخال مريض الآن', 'Admit a Patient Now')}</button>
                      </>
                    ) : (
                      <>
                        <div style={{ marginBottom: 10 }}>{L('يوجد مرضى مُدخَلون لكن بلا أي وصفة دواء مُسجَّلة بعد — افتحي "حالات الإدخال" واضغطي 💊 بجانب المريض لإضافة وصفة.', 'There are admitted patients but no medication orders recorded yet — open "Admissions" and click 💊 next to the patient to add one.')}</div>
                        <button onClick={() => setTab('admissions')} className="btn btn-primary" style={{ fontSize: 13 }}>{L('الذهاب لحالات الإدخال', 'Go to Admissions')}</button>
                      </>
                    )}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'wards' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0 }}>{L('الردهات', 'Wards')}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowWardImport(true)} className="btn btn-outline">📊 {L('استيراد من Excel', 'Import from Excel')}</button>
              <ExcelExportButton apiName="wards" lang={lang} onError={(m) => showToast(m, 'error')} />
              <button onClick={openAddWard} className="btn btn-primary"><FaPlus /> {L('ردهة جديدة', 'New Ward')}</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {wards.map(w => {
              const occupied = admissions.filter(a => a.wardId === w.id && a.status === 'admitted').length;
              return (
                <div key={w.id} style={{ padding: 16, borderRadius: 10, background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{lang === 'ar' ? w.name : (w.nameEn || w.name)}</strong>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEditWard(w)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab' }}><FaEdit /></button>
                      <button onClick={() => delWard(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                    <FaBed /> {occupied} / {w.bedCount} {L('سرير مشغول', 'beds occupied')}
                  </div>
                  {w.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{w.notes}</div>}
                </div>
              );
            })}
            {wards.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{L('لا توجد ردهات بعد', 'No wards yet')}</p>}
          </div>
        </div>
      )}

      {tab === 'admissions' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('بحث بالاسم أو التشخيص...', 'Search by name or diagnosis...')} className="form-control" style={{ flex: 1, minWidth: 200 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ key: 'admitted', label: L('مُدخَل', 'Admitted') }, { key: 'discharged', label: L('خرج', 'Discharged') }, { key: 'all', label: L('الكل', 'All') }].map(s => (
                    <button key={s.key} onClick={() => setStatusFilter(s.key)} style={{ padding: '7px 14px', borderRadius: 20, border: `2px solid ${statusFilter === s.key ? '#7c3aed' : 'var(--border)'}`, background: statusFilter === s.key ? '#7c3aed' : 'transparent', color: statusFilter === s.key ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAdmImport(true)} className="btn btn-outline">📊 {L('استيراد من Excel', 'Import from Excel')}</button>
                <ExcelExportButton apiName="admissions" lang={lang} onError={(m) => showToast(m, 'error')} />
                <button onClick={openAddAdm} className="btn btn-primary"><FaPlus /> {L('إدخال مريض', 'Admit Patient')}</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{L('المريض', 'Patient')}</th>
                    <th>{L('الردهة / السرير', 'Ward / Bed')}</th>
                    <th>{L('التشخيص', 'Diagnosis')}</th>
                    <th>{L('الطبيب المعالج', 'Treating Doctor')}</th>
                    <th>{L('تاريخ الإدخال', 'Admission Date')}</th>
                    <th>{L('الحالة', 'Status')}</th>
                    <th>{L('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.patientName}</td>
                      <td>{wardName(a.wardId)} {a.bedNo && `— ${L('سرير', 'Bed')} ${a.bedNo}`}</td>
                      <td>{a.diagnosis || '—'}</td>
                      <td>{a.treatingDoctor || '—'}</td>
                      <td>{a.admissionDate}</td>
                      <td>
                        <span style={{ background: a.status === 'admitted' ? '#22c55e15' : '#6b728015', color: a.status === 'admitted' ? '#22c55e' : '#6b7280', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                          {a.status === 'admitted' ? L('مُدخَل', 'Admitted') : L('خرج', 'Discharged')}
                        </span>
                        {a.dischargeDate && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.dischargeDate}</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setMedAdm(a)} title={L('الأدوية', 'Medications')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b' }}><FaPills /></button>
                          <button onClick={() => openEditAdm(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab' }}><FaEdit /></button>
                          {a.status === 'admitted' && <button onClick={() => dischargePatient(a)} title={L('تسجيل خروج', 'Discharge')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6' }}><FaSignOutAlt /></button>}
                          <button onClick={() => delAdm(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleAdmissions.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{L('لا توجد بيانات', 'No data')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
          </div>
        </>
      )}

      {/* نافذة ردهة */}
      {showWardModal && (
        <div className="modal-overlay" onClick={() => setShowWardModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingWard ? L('تعديل ردهة', 'Edit Ward') : L('ردهة جديدة', 'New Ward')}</h3>
              <button onClick={() => setShowWardModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <label className="form-label">{L('اسم الردهة', 'Ward name')} *</label>
              <input value={wardForm.name} onChange={e => setWardForm(p => ({ ...p, name: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <label className="form-label">{L('عدد الأسرّة', 'Bed count')}</label>
              <input type="number" value={wardForm.bedCount} onChange={e => setWardForm(p => ({ ...p, bedCount: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <label className="form-label">{L('ملاحظات', 'Notes')}</label>
              <textarea value={wardForm.notes} onChange={e => setWardForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowWardModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveWard} className="btn btn-primary">{L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إدخال مريض */}
      {showAdmModal && (
        <div className="modal-overlay" onClick={() => setShowAdmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingAdm ? L('تعديل بيانات الإدخال', 'Edit Admission') : L('إدخال مريض جديد', 'Admit New Patient')}</h3>
              <button onClick={() => setShowAdmModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('اسم المريض', 'Patient name')} *</label>
                  <input value={admForm.patientName} onChange={e => setAdmForm(p => ({ ...p, patientName: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('الردهة', 'Ward')} *</label>
                  <select value={admForm.wardId} onChange={e => setAdmForm(p => ({ ...p, wardId: +e.target.value }))} className="form-control">
                    <option value="">{L('اختر...', 'Select...')}</option>
                    {wards.map(w => <option key={w.id} value={w.id}>{lang === 'ar' ? w.name : (w.nameEn || w.name)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{L('رقم السرير', 'Bed number')}</label>
                  <input value={admForm.bedNo} onChange={e => setAdmForm(p => ({ ...p, bedNo: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('تاريخ الإدخال', 'Admission date')}</label>
                  <input type="date" value={admForm.admissionDate} onChange={e => setAdmForm(p => ({ ...p, admissionDate: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('الطبيب المعالج', 'Treating doctor')}</label>
                  <input value={admForm.treatingDoctor} onChange={e => setAdmForm(p => ({ ...p, treatingDoctor: e.target.value }))} className="form-control" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('التشخيص', 'Diagnosis')}</label>
                  <textarea value={admForm.diagnosis} onChange={e => setAdmForm(p => ({ ...p, diagnosis: e.target.value }))} rows={2} className="form-control" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAdmModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveAdm} className="btn btn-primary">{L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الأدوية لحالة إدخال معيّنة */}
      {medAdm && (
        <div className="modal-overlay" onClick={() => setMedAdm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>💊 {L('أدوية', 'Medications for')} {medAdm.patientName}</h3>
              <button onClick={() => setMedAdm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
              <button onClick={() => { setOrderForm(emptyOrder); setShowOrderModal(true); }} className="btn btn-primary" style={{ marginBottom: 12 }}>
                <FaPlus /> {L('وصفة دواء جديدة', 'New Medication Order')}
              </button>
              {ordersFor(medAdm.id).map(o => (
                <div key={o.id} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{o.drugName}</strong> — {o.dose} {o.route && `· ${routeLabel(o.route)}`} {o.timesPerDay && `(${frequencyLabel(o.timesPerDay)})`}
                      {Array.isArray(o.scheduledTimes) && o.scheduledTimes.length > 0 && (
                        <div style={{ fontSize: 12, color: '#1a6bab', marginTop: 2 }}>🕐 {L('المواعيد', 'Times')}: {o.scheduledTimes.join(' · ')}</div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {L('كتبها', 'Prescribed by')}: {o.prescribedBy || '—'} · {o.startDate}{o.endDate && ` → ${o.endDate}`}
                      </div>
                      {o.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => {
                        if (giveDoseFor === o.id) { setGiveDoseFor(null); return; }
                        const times = (Array.isArray(o.scheduledTimes) && o.scheduledTimes.length > 0) ? o.scheduledTimes : computeScheduleTimes(o.timesPerDay);
                        const notGivenYet = times.find(t => !administrationsFor(o.id).some(a => a.scheduledFor === t && a.scheduledDate === todayStr));
                        setGiveDoseTime(notGivenYet || times[0] || '');
                        setGiveDoseFor(o.id);
                      }} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>
                        {L('إعطاء جرعة', 'Give Dose')}
                      </button>
                      <button onClick={() => delOrder(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                    </div>
                  </div>
                  {giveDoseFor === o.id && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {(() => {
                        const times = (Array.isArray(o.scheduledTimes) && o.scheduledTimes.length > 0) ? o.scheduledTimes : computeScheduleTimes(o.timesPerDay);
                        return times.length > 0 ? (
                          <select value={giveDoseTime} onChange={e => setGiveDoseTime(e.target.value)} className="form-control" style={{ width: 110 }}>
                            {times.map(t => {
                              const already = administrationsFor(o.id).some(a => a.scheduledFor === t && a.scheduledDate === todayStr);
                              return <option key={t} value={t}>{t}{already ? ` (${L('أُعطيت', 'given')})` : ''}</option>;
                            })}
                          </select>
                        ) : null;
                      })()}
                      <input value={nurseName} onChange={e => setNurseName(e.target.value)} placeholder={L('اسم الممرض/ة', 'Nurse name')} className="form-control" style={{ flex: 1, minWidth: 120 }} />
                      <button onClick={() => giveDose(o, giveDoseTime)} className="btn btn-primary">{L('تأكيد', 'Confirm')}</button>
                    </div>
                  )}
                  {administrationsFor(o.id).length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong>{L('سجل الإعطاء', 'Administration log')}:</strong>
                      {administrationsFor(o.id).map(a => (
                        <div key={a.id}>• {a.administeredBy} — {new Date(a.administeredAt).toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-US')}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {ordersFor(medAdm.id).length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{L('لا توجد أدوية موصوفة بعد', 'No medications prescribed yet')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* نافذة وصفة دواء جديدة */}
      {showOrderModal && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{L('وصفة دواء جديدة', 'New Medication Order')}</h3>
              <button onClick={() => setShowOrderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <label className="form-label">{L('اسم الدواء', 'Drug name')} *</label>
              <input value={orderForm.drugName} onChange={e => setOrderForm(p => ({ ...p, drugName: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="form-label">{L('الجرعة', 'Dose')}</label>
                  <input value={orderForm.dose} onChange={e => setOrderForm(p => ({ ...p, dose: e.target.value }))} className="form-control" placeholder="500mg" />
                </div>
                <div>
                  <label className="form-label">{L('طريقة الإعطاء', 'Route')}</label>
                  <select value={orderForm.route} onChange={e => setOrderForm(p => ({ ...p, route: e.target.value }))} className="form-control">
                    <option value="فموي">{L('فموي', 'Oral')}</option>
                    <option value="وريدي">{L('وريدي', 'IV')}</option>
                    <option value="عضلي">{L('عضلي', 'IM')}</option>
                    <option value="تحت الجلد">{L('تحت الجلد', 'Subcutaneous')}</option>
                    <option value="موضعي">{L('موضعي', 'Topical')}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{L('عدد المرات باليوم', 'Times per day')}</label>
                  <input type="number" min="1" max="12" value={orderForm.timesPerDay} onChange={e => {
                    const n = e.target.value;
                    setOrderForm(p => ({ ...p, timesPerDay: n, frequency: frequencyLabel(n), scheduledTimes: computeScheduleTimes(n) }));
                  }} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('التكرار (مُحتسَب تلقائياً)', 'Frequency (auto-computed)')}</label>
                  <input value={frequencyLabel(orderForm.timesPerDay)} disabled className="form-control" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }} />
                </div>
              </div>

              {/* ── إصلاح: ما كان فيه مكان فعلي لجدولة مواعيد الجرعات — بس رقم
                  "عدد المرات باليوم" يُحسَب منه أوقات تلقائية بالخلفية بدون
                  إمكانية تعديلها. الآن هذا قسم صريح يعرض كل موعد جرعة كحقل
                  وقت منفصل قابل للتعديل أو الحذف، مع زر توليد سريع كنقطة بداية. ── */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>🕐 {L('مواعيد الجرعات', 'Dose Times')}</label>
                  <button type="button" onClick={() => setOrderForm(p => ({ ...p, scheduledTimes: computeScheduleTimes(p.timesPerDay) }))} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>
                    {L('توليد تلقائي حسب العدد', 'Auto-generate from count')}
                  </button>
                </div>
                {orderForm.scheduledTimes.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{L('ما فيه مواعيد محددة بعد — اضغطي "توليد تلقائي" أو أضيفي موعد يدوياً.', 'No times set yet — click "Auto-generate" or add one manually.')}</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {orderForm.scheduledTimes.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', borderRadius: 6, padding: '2px 4px' }}>
                        <input type="time" value={t} onChange={e => setOrderForm(p => ({ ...p, scheduledTimes: p.scheduledTimes.map((x, j) => j === i ? e.target.value : x) }))} style={{ border: 'none', background: 'transparent', fontSize: 13 }} />
                        <button type="button" onClick={() => setOrderForm(p => ({ ...p, scheduledTimes: p.scheduledTimes.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setOrderForm(p => ({ ...p, scheduledTimes: [...p.scheduledTimes, '08:00'] }))} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>+ {L('إضافة موعد', 'Add Time')}</button>
              </div>

              <label className="form-label">{L('الطبيب الكاتب', 'Prescribed by')}</label>
              <input value={orderForm.prescribedBy} onChange={e => setOrderForm(p => ({ ...p, prescribedBy: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="form-label">{L('تاريخ البدء', 'Start date')}</label>
                  <input type="date" value={orderForm.startDate} onChange={e => setOrderForm(p => ({ ...p, startDate: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('تاريخ الانتهاء', 'End date')}</label>
                  <input type="date" value={orderForm.endDate} onChange={e => setOrderForm(p => ({ ...p, endDate: e.target.value }))} className="form-control" />
                </div>
              </div>
              <label className="form-label">{L('ملاحظات', 'Notes')}</label>
              <textarea value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowOrderModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveOrder} className="btn btn-primary">{L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {showWardImport && (
        <ExcelImportModal
          apiName="wards"
          title={L('استيراد ردهات من Excel', 'Import Wards from Excel')}
          lang={lang}
          onClose={() => setShowWardImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/wards');
              if (Array.isArray(fresh)) setWards(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      {showAdmImport && (
        <ExcelImportModal
          apiName="admissions"
          title={L('استيراد حالات إدخال من Excel', 'Import Admissions from Excel')}
          lang={lang}
          onClose={() => setShowAdmImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/admissions');
              if (Array.isArray(fresh)) setAdmissions(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      {showOrderImport && (
        <ExcelImportModal
          apiName="medicationOrders"
          title={L('استيراد وصفات أدوية من Excel', 'Import Medication Orders from Excel')}
          lang={lang}
          onClose={() => setShowOrderImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/medicationOrders');
              if (Array.isArray(fresh)) setOrders(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}
    </div>
  );
}
