import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp, translateDays } from '../contexts/AppContext';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import { api } from '../api';
import { FaFileExcel } from 'react-icons/fa';

const BANNER_GRADIENT = 'linear-gradient(135deg,#0f1923,#1a2940)';

const emptyDept = { name: '', nameEn: '', icon: '🏥', description: '', head: '', color: '#1a6bab', status: 'active' };

export default function DepartmentsPage() {
  const { showToast, lang, departments, setDepartments, doctors: allDoctors, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const [selected, setSelected] = useState(null);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState(emptyDept);
  const [showImport, setShowImport] = useState(false);
  const [bookForm, setBookForm] = useState({ patient: '', date: '', time: '', type: tr('book_checkup'), notes: '' });
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const deptDoctors = selected ? allDoctors.filter(d => (selected.doctorIds || []).includes(d.id)) : [];
  const openAdd = () => { setEditingDept(null); setForm(emptyDept); setShowDeptModal(true); };
  const openEdit = (d) => { setEditingDept(d); setForm({ ...d }); setShowDeptModal(true); };
  const saveDept = async () => {
    if (!form.name) { showToast(tr('err_dept_name'), 'error'); return; }
    const prev = departments;
    if (editingDept) {
      const ud = { ...form, id: editingDept.id, doctorIds: editingDept.doctorIds || [] };
      setDepartments(p => p.map(d => d.id === editingDept.id ? ud : d));
      const ok = await syncToServer('departments', 'update', ud);
      if (!ok) { setDepartments(prev); return; }
      showToast(tr('msg_updated'), 'success');
    } else {
      const nd = { ...form, id: Date.now(), doctorIds: [], patients: 0 };
      setDepartments(p => [...p, nd]);
      const ok = await syncToServer('departments', 'create', nd);
      if (!ok) { setDepartments(prev); return; }
      showToast(tr('msg_added2'), 'success');
    }
    setShowDeptModal(false);
    if (selected && editingDept?.id === selected.id) setSelected({ ...form, id: editingDept.id });
  };
  const delDept = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = departments;
    setDepartments(p => p.filter(d => d.id !== id));
    const ok = await syncToServer('departments', 'delete', { id });
    if (!ok) { setDepartments(prev); return; }
    if (selected?.id === id) setSelected(null);
    showToast(tr('msg_deleted2'), 'success');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('departments', 'delete', { id });
      if (ok) { setDepartments(p => p.filter(d => d.id !== id)); deleted++; if (selected?.id === id) setSelected(null); }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(
      lang === 'ar' ? `تم حذف ${deleted} من ${ids.length} قسم` : `Deleted ${deleted} of ${ids.length} departments`,
      deleted === ids.length ? 'success' : 'warning'
    );
  };
  const confirmBooking = () => {
    if (!bookForm.patient || !bookForm.date || !bookForm.time) { showToast(tr('err_booking'), 'error'); return; }
    showToast(`✅ ${bookForm.patient} — ${lang === 'ar' ? bookingDoctor.name : (bookingDoctor.nameEn || bookingDoctor.name)} — ${bookForm.date}`, 'success');
    setBookingDoctor(null);
    setBookForm({ patient: '', date: '', time: '', type: tr('book_checkup'), notes: '' });
  };
  const ICONS = ['🏥','🔬','🧪','📡','📱','👩‍⚕️','👁️','🦷','🫀','🧠','💊','🩺','🩻','🫁'];
  const COLORS = ['#1a6bab','#10b981','#8b5cf6','#f59e0b','#ec4899','#06b6d4','#ef4444','#6366f1'];

  // ── إصلاح: "تحميل الأقسام الافتراضية" ──────────────────────────────────────
  // لاستعادة قائمة أقسام جاهزة (بعد ما انمسحت محتوياتها)، ولإضافة باقي أقسام
  // المستشفى المعتادة تلقائياً بدل إدخالها يدوياً واحد واحد. القائمة تغطي
  // الأقسام العامة القياسية + التخصصات الفعلية الموجودة أصلاً بجدول الأطباء
  // عندك (الباطنية وتفرعاتها: الكلى، الجهاز الهضمي، الأورام والغدد، الجهاز
  // التنفسي). تُضاف فقط الأقسام غير الموجودة مسبقاً (لا تكرار).
  const DEFAULT_DEPARTMENTS = [
    { name: 'الطوارئ', nameEn: 'Emergency', icon: '🚑' },
    { name: 'الباطنية', nameEn: 'Internal Medicine', icon: '🩺' },
    { name: 'الباطنية - أمراض الكلى', nameEn: 'Internal Medicine - Nephrology', icon: '🩺' },
    { name: 'الباطنية - الجهاز الهضمي', nameEn: 'Internal Medicine - Gastroenterology', icon: '🩺' },
    { name: 'الباطنية - الأورام والغدد', nameEn: 'Internal Medicine - Oncology & Endocrinology', icon: '🩺' },
    { name: 'الباطنية - اختصاص دقيق جهاز تنفسي وصدرية', nameEn: 'Internal Medicine - Pulmonology', icon: '🫁' },
    { name: 'الجراحة العامة', nameEn: 'General Surgery', icon: '🔪' },
    { name: 'النسائية والتوليد', nameEn: 'Obstetrics & Gynecology', icon: '👩‍⚕️' },
    { name: 'الأطفال', nameEn: 'Pediatrics', icon: '👶' },
    { name: 'العظام', nameEn: 'Orthopedics', icon: '🦴' },
    { name: 'الأنف والأذن والحنجرة', nameEn: 'ENT', icon: '👂' },
    { name: 'العيون', nameEn: 'Ophthalmology', icon: '👁️' },
    { name: 'الجلدية', nameEn: 'Dermatology', icon: '🧴' },
    { name: 'الأسنان', nameEn: 'Dentistry', icon: '🦷' },
    { name: 'النفسية', nameEn: 'Psychiatry', icon: '🧠' },
    { name: 'القلبية', nameEn: 'Cardiology', icon: '🫀' },
    { name: 'المسالك البولية', nameEn: 'Urology', icon: '🩺' },
    { name: 'الأعصاب', nameEn: 'Neurology', icon: '🧠' },
    { name: 'العناية المركزة', nameEn: 'ICU', icon: '🏥' },
    { name: 'التخدير', nameEn: 'Anesthesia', icon: '💉' },
    { name: 'المختبر', nameEn: 'Laboratory', icon: '🔬' },
    { name: 'الأشعة والتصوير الطبي', nameEn: 'Radiology & Imaging', icon: '📡' },
    { name: 'الصيدلية', nameEn: 'Pharmacy', icon: '💊' },
  ];
  const [seeding, setSeeding] = useState(false);

  // Syncs every existing doctor into their department's doctorIds array,
  // based on each doctor's own deptId field. This is a one-time backfill
  // for doctors already in the database from before automatic syncing was
  // added (see DoctorsPage.js, which now keeps this in sync automatically
  // going forward for any new doctor added or edited).
  const [syncingDoctors, setSyncingDoctors] = useState(false);
  const syncDoctorsToDepartments = async () => {
    setSyncingDoctors(true);
    let updatedCount = 0;
    for (const dept of departments) {
      const correctDoctorIds = allDoctors.filter(doc => doc.deptId === dept.id).map(doc => doc.id);
      const current = dept.doctorIds || [];
      const isSame = current.length === correctDoctorIds.length && current.every(id => correctDoctorIds.includes(id));
      if (isSame) continue;
      const updated = { ...dept, doctorIds: correctDoctorIds };
      const ok = await syncToServer('departments', 'update', updated);
      if (ok) { setDepartments(p => p.map(d => d.id === dept.id ? updated : d)); updatedCount++; }
    }
    setSyncingDoctors(false);
    showToast(
      updatedCount > 0
        ? (lang === 'ar' ? `تم ربط الأطباء بأقسامهم — ${updatedCount} قسم تحدَّث` : `Doctors linked to their departments — ${updatedCount} department(s) updated`)
        : (lang === 'ar' ? 'كل الأطباء مربوطون بأقسامهم أصلاً' : 'All doctors are already linked to their departments'),
      'success'
    );
  };

  // ── Smart doctor-to-department matching ────────────────────────────────
  // For doctors that have a specialization but no deptId set at all (the
  // 152-doctor backlog), this suggests a department for each by comparing
  // their specialization text against department names (Arabic and
  // English), instead of requiring manual assignment one by one. Every
  // suggestion is shown for review/correction before anything is applied —
  // nothing is auto-applied without confirmation.
  const [showSmartLink, setShowSmartLink] = useState(false);
  const [suggestions, setSuggestions] = useState([]); // [{ doctor, suggestedDeptId }]
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);

  const guessDepartment = (doctor) => {
    const spec = (doctor.specialization || '').trim();
    if (!spec) return null;
    let best = null;
    let bestScore = 0;
    departments.forEach((dept) => {
      const candidates = [dept.name, dept.nameEn].filter(Boolean);
      candidates.forEach((c) => {
        const cLower = c.toLowerCase();
        const specLower = spec.toLowerCase();
        if (specLower.includes(cLower) || cLower.includes(specLower)) {
          const score = Math.min(c.length, spec.length); // longer overlapping name = more confident match
          if (score > bestScore && c.length >= 3) { bestScore = score; best = dept.id; }
        }
      });
    });
    return best;
  };

  const openSmartLink = () => {
    const unlinked = allDoctors.filter((d) => !d.deptId);
    const built = unlinked.map((doctor) => ({ doctor, suggestedDeptId: guessDepartment(doctor) }));
    setSuggestions(built);
    setShowSmartLink(true);
  };

  const updateSuggestion = (doctorId, deptId) => {
    setSuggestions((prev) => prev.map((s) => (s.doctor.id === doctorId ? { ...s, suggestedDeptId: deptId } : s)));
  };

  const applySuggestions = async () => {
    setApplyingSuggestions(true);
    const toApply = suggestions.filter((s) => s.suggestedDeptId);
    let applied = 0;
    for (const s of toApply) {
      const updatedDoctor = { ...s.doctor, deptId: s.suggestedDeptId };
      const ok = await syncToServer('doctors', 'update', updatedDoctor);
      if (ok) applied++;
    }
    // After updating every doctor's deptId, rebuild each department's
    // doctorIds array so the new assignments actually show up.
    for (const dept of departments) {
      const newlyAssignedIds = toApply.filter((s) => s.suggestedDeptId === dept.id).map((s) => s.doctor.id);
      if (newlyAssignedIds.length === 0) continue;
      const current = dept.doctorIds || [];
      const merged = [...new Set([...current, ...newlyAssignedIds])];
      if (merged.length !== current.length) {
        const updatedDept = { ...dept, doctorIds: merged };
        const ok = await syncToServer('departments', 'update', updatedDept);
        if (ok) setDepartments((p) => p.map((d) => (d.id === dept.id ? updatedDept : d)));
      }
    }
    setApplyingSuggestions(false);
    setShowSmartLink(false);
    showToast(
      lang === 'ar' ? `تم ربط ${applied} طبيب بأقسامهم المقترحة` : `${applied} doctor(s) linked to their suggested departments`,
      'success'
    );
  };

  const loadDefaultDepartments = async () => {
    const existingByName = new Map(departments.map(d => [d.name?.trim(), d]));
    const missing = DEFAULT_DEPARTMENTS.filter(d => !existingByName.has(d.name));
    // إصلاح: أقسام أُضيفت قبل إضافة حقل الاسم الإنكليزي (يدوياً أو بهذا الزر
    // نفسه بنسخة سابقة) تبقى بلا nameEn للأبد إذا اعتمدنا فقط على "أضف الجديد
    // فقط". الآن نُكمِّل الاسم الإنكليزي الناقص للموجود مسبقاً أيضاً.
    const needsBackfill = DEFAULT_DEPARTMENTS.filter(d => {
      const existing = existingByName.get(d.name);
      return existing && !existing.nameEn && d.nameEn;
    });
    if (missing.length === 0 && needsBackfill.length === 0) { showToast(lang === 'ar' ? 'كل الأقسام الافتراضية موجودة أصلاً' : 'All default departments already exist', 'info'); return; }
    setSeeding(true);
    let added = 0, updated = 0;
    for (const d of missing) {
      const nd = { name: d.name, nameEn: d.nameEn, icon: d.icon, description: '', head: '', color: COLORS[added % COLORS.length], status: 'active', id: Date.now() + added, doctorIds: [], patients: 0 };
      const synced = await syncToServer('departments', 'create', nd);
      if (synced) { setDepartments(p => [...p, typeof synced === 'object' ? synced : nd]); added++; }
    }
    for (const d of needsBackfill) {
      const existing = existingByName.get(d.name);
      const ud = { ...existing, nameEn: d.nameEn };
      const ok = await syncToServer('departments', 'update', ud);
      if (ok) { setDepartments(p => p.map(x => x.id === existing.id ? ud : x)); updated++; }
    }
    setSeeding(false);
    showToast(
      lang === 'ar'
        ? `تمت إضافة ${added} قسم جديد${updated ? ` وتحديث الاسم الإنكليزي لـ${updated} قسم موجود` : ''}`
        : `${added} new departments added${updated ? `, ${updated} existing ones updated with English names` : ''}`,
      'success'
    );
  };

  return (
    <div className="page-content">
      <PageBanner icon="🏢" title={tr('dept_management')} subtitle={tr('dept_subtitle')} gradient={BANNER_GRADIENT}>
        <button onClick={() => setShowImport(true)} style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FaFileExcel /> {lang === 'ar' ? 'استيراد من Excel' : 'Import from Excel'}
        </button>
        <button onClick={loadDefaultDepartments} disabled={seeding} style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          🏥 {seeding ? (lang === 'ar' ? 'جارٍ الإضافة...' : 'Adding...') : (lang === 'ar' ? 'تحميل الأقسام الافتراضية' : 'Load Default Departments')}
        </button>
        <button onClick={syncDoctorsToDepartments} disabled={syncingDoctors} style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          🔗 {syncingDoctors ? (lang === 'ar' ? 'جارٍ الربط...' : 'Linking...') : (lang === 'ar' ? 'ربط الأطباء بأقسامهم' : 'Link Doctors to Departments')}
        </button>
        <button onClick={openSmartLink} style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          🧭 {lang === 'ar' ? 'ربط ذكي حسب التخصص' : 'Smart Link by Specialization'}
        </button>
        <ExcelExportButton apiName="departments" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)' }} />
        <button onClick={openAdd} style={{ background: '#fff', color: '#0f1923', border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          ＋ {tr('dept_add')}
        </button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="departments"
          title={lang === 'ar' ? 'استيراد أقسام من Excel' : 'Import Departments from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/departments');
              if (Array.isArray(fresh)) setDepartments(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      {showSmartLink && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-primary, #fff)', borderRadius: 16, padding: 24, width: 'min(760px, 92vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 19 }}>{lang === 'ar' ? 'ربط ذكي حسب التخصص' : 'Smart Link by Specialization'}</h3>
              <button onClick={() => setShowSmartLink(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 14 }}>
              {lang === 'ar'
                ? `عندك ${suggestions.length} طبيب بلا قسم محدَّد. راجع الاقتراح لكل وحد وعدّله لو لازم، وبعدها اضغط "تطبيق" — ما يصير أي تغيير قبل تأكيدك.`
                : `${suggestions.length} doctor(s) have no department set. Review each suggestion below and adjust if needed, then click "Apply" — nothing changes until you confirm.`}
            </p>

            {suggestions.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
                {lang === 'ar' ? 'كل الأطباء عندهم قسم محدَّد أصلاً' : 'Every doctor already has a department set'}
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary, #f3f4f6)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: 10, textAlign: 'start' }}>{lang === 'ar' ? 'الطبيب' : 'Doctor'}</th>
                      <th style={{ padding: 10, textAlign: 'start' }}>{lang === 'ar' ? 'التخصص' : 'Specialization'}</th>
                      <th style={{ padding: 10, textAlign: 'start' }}>{lang === 'ar' ? 'القسم المقترح' : 'Suggested Department'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map(({ doctor, suggestedDeptId }) => (
                      <tr key={doctor.id} style={{ borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
                        <td style={{ padding: 10 }}>{doctor.name}</td>
                        <td style={{ padding: 10, color: 'var(--text-secondary)' }}>{doctor.specialization || '—'}</td>
                        <td style={{ padding: 10 }}>
                          <select
                            value={suggestedDeptId || ''}
                            onChange={(e) => updateSuggestion(doctor.id, e.target.value ? Number(e.target.value) : null)}
                            className="form-control"
                            style={{ fontSize: 13, background: suggestedDeptId ? undefined : 'rgba(239,68,68,0.08)' }}
                          >
                            <option value="">{lang === 'ar' ? '— بدون اقتراح، تجاوز —' : '— No match, skip —'}</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{lang === 'ar' ? d.name : (d.nameEn || d.name)}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowSmartLink(false)} style={{ background: 'transparent', border: '1.5px solid var(--border-color, #d1d5db)', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 600 }}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              {suggestions.length > 0 && (
                <button
                  onClick={applySuggestions}
                  disabled={applyingSuggestions || suggestions.every((s) => !s.suggestedDeptId)}
                  style={{ background: '#1a6bab', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 22px', cursor: 'pointer', fontWeight: 700 }}
                >
                  {applyingSuggestions
                    ? (lang === 'ar' ? 'جارٍ التطبيق...' : 'Applying...')
                    : (lang === 'ar' ? `تطبيق (${suggestions.filter((s) => s.suggestedDeptId).length})` : `Apply (${suggestions.filter((s) => s.suggestedDeptId).length})`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 24 }}>
        <div>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{lang === 'ar' ? `${selectedIds.size} محدَّد` : `${selectedIds.size} selected`}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelectedIds(new Set())} className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }}>{lang === 'ar' ? 'إلغاء التحديد' : 'Clear Selection'}</button>
                <button onClick={() => setBulkDeleteConfirm(true)} className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px' }}>🗑️ {lang === 'ar' ? `حذف المحدَّد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}</button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {departments.map(dept => (
              <div key={dept.id} onClick={() => setSelected(selected?.id === dept.id ? null : dept)}
                // إصلاح تباين الوضع الليلي: كان background:var(--bg-secondary)
                // (غير متسق مع باقي البطاقات المشابهة اللي تستخدم --bg-card)
                // مع transition:'all 0.2s' يشمل الخلفية نفسها — نفس فئة مشكلة
                // --transition الموثَّقة بـ index.css (انتقال خاصية معتمدة على
                // متغيّر CSS يعلق أحياناً على القيمة القديمة عند تبديل الثيم).
                // الآن background:var(--bg-card) (نفس بقية البطاقات)، والانتقال
                // مقتصر على transform/box-shadow فقط (الشيئين الفعليين المتغيّرين هنا).
                style={{ background: 'var(--bg-card)', borderRadius: 14, border: `2px solid ${selected?.id === dept.id ? dept.color : 'var(--border)'}`, cursor: 'pointer', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', transform: selected?.id === dept.id ? 'scale(1.02)' : 'scale(1)', boxShadow: selected?.id === dept.id ? `0 6px 24px ${dept.color}30` : 'none' }}>
                <div style={{ height: 5, background: dept.color }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>{dept.icon}</div>
                    <input type="checkbox" checked={selectedIds.has(dept.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(dept.id); }} onClick={e => e.stopPropagation()} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{lang==="ar"?dept.name:dept.nameEn||dept.name}</h3>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{tr('dept_head_lbl')}: {lang==="ar"?dept.head:dept.headEn||dept.head}</p>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div style={{ textAlign: 'center', background: `${dept.color}15`, borderRadius: 8, padding: '6px 12px' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: dept.color }}>{dept.patients}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{tr('dept_patient_lbl')}</div>
                    </div>
                    <div style={{ textAlign: 'center', background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '6px 12px' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{(dept.doctorIds || []).length}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{tr('dept_doctor_lbl')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: dept.status === 'active' ? '#dcfce7' : '#fee2e2', color: dept.status === 'active' ? '#166534' : '#991b1b', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                      {dept.status === 'active' ? tr('dept_status_active') : tr('dept_status_closed')}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(dept)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab', fontSize: 14 }}>✏️</button>
                      <button onClick={() => delDept(dept.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}>🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: `2px solid ${selected.color}40`, overflow: 'hidden', position: 'sticky', top: 0 }}>
              <div style={{ background: selected.color, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{selected.icon}</span>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{lang==="ar"?selected.name:selected.nameEn||selected.name}</h3>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{tr('dept_docs_panel')}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 16 }}>×</button>
              </div>
              <div style={{ padding: 16 }}>
                {deptDoctors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍⚕️</div>
                    <p>{tr('dept_no_doctors')}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {deptDoctors.map(doc => (
                      <div key={doc.id} style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: doc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>{doc.avatar}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{lang==="ar"?doc.name:doc.nameEn||doc.name}</div>
                            <div style={{ fontSize: 12, color: '#1a6bab', marginBottom: 2 }}>{lang==="ar"?doc.specialization:doc.specializationEn||doc.specialization}</div>
                            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                              <span>⭐ {doc.rating}</span><span>•</span>
                              <span>👥 {doc.patients} {tr('dept_patient_lbl')}</span><span>•</span>
                              <span>🎓 {doc.experience} {tr('auto_pair_117')}</span>
                            </div>
                          </div>
                          <span style={{ background: doc.status === 'active' ? '#dcfce7' : '#fee2e2', color: doc.status === 'active' ? '#166534' : '#991b1b', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                            {doc.status === 'active' ? tr('doc_available') : tr('doc_unavailable')}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                          <div>🕐 {doc.workHours}</div>
                          <div>📞 {doc.phone}</div>
                          <div>💵 {doc.fee?.toLocaleString()} {tr('auto_pair_118')}</div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {(translateDays(doc.availableDays||[],lang)).map(day => (<span key={day} style={{ background: `${doc.color}15`, color: doc.color, padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>{day}</span>))}
                        </div>
                        <button onClick={() => { setBookingDoctor(doc); setBookForm({ patient: '', date: '', time: '', type: tr('book_checkup'), notes: '' }); }}
                          disabled={doc.status !== 'active'}
                          style={{ width: '100%', padding: '9px', borderRadius: 8, background: doc.status === 'active' ? selected.color : '#9ca3af', color: '#fff', border: 'none', cursor: doc.status === 'active' ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          📅 {tr('book_appt')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showDeptModal && (
        <div className="modal-overlay" onClick={() => setShowDeptModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingDept ? tr('dept_edit_title') : tr('dept_add_new')}</h3>
              <button onClick={() => setShowDeptModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}><label className="form-label">{tr('dept_name_req')}</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="form-control" /></div>
                <div style={{ gridColumn: '1/-1' }}><label className="form-label">{lang === 'ar' ? 'اسم القسم بالإنكليزية' : 'Department Name (English)'}</label><input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} className="form-control" placeholder={lang === 'ar' ? 'اختياري — يظهر بالواجهة الإنكليزية بدل الاسم العربي' : 'Optional — shown in the English interface instead of the Arabic name'} /></div>
                <div style={{ gridColumn: '1/-1' }}><label className="form-label">{tr('dept_description')}</label><input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="form-control" /></div>
                <div><label className="form-label">{tr('dept_icon')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ICONS.map(ic => (<button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))} style={{ fontSize: 20, padding: 4, borderRadius: 6, border: `2px solid ${form.icon === ic ? '#1a6bab' : 'var(--border)'}`, background: form.icon === ic ? 'rgba(26,107,171,0.1)' : 'transparent', cursor: 'pointer' }}>{ic}</button>))}
                  </div>
                </div>
                <div><label className="form-label">{tr('dept_color')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {COLORS.map(c => (<button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`, outline: form.color === c ? `2px solid ${c}` : 'none', cursor: 'pointer' }} />))}
                  </div>
                </div>
                <div><label className="form-label">{tr('dept_head')}</label><input value={form.head} onChange={e => setForm(p => ({ ...p, head: e.target.value }))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{tr('select_hospital_field')}</label>
                    <select className="form-control" value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))}>
                      <option value="">—</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="form-label">{tr('lbl_status')}</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="form-control">
                    <option value="active">{tr('dept_status_active')}</option>
                    <option value="inactive">{tr('dept_status_closed')}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeptModal(false)} style={{ marginLeft: 8, padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{tr('btn_cancel')}</button>
              <button onClick={saveDept} className="btn btn-primary">{tr('btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {bookingDoctor && (
        <div className="modal-overlay" onClick={() => setBookingDoctor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header" style={{ background: bookingDoctor.color, borderRadius: '12px 12px 0 0' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{tr('book_appt')}</h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{lang==="ar"?bookingDoctor.name:bookingDoctor.nameEn||bookingDoctor.name} — {lang==="ar"?bookingDoctor.specialization:bookingDoctor.specializationEn||bookingDoctor.specialization}</p>
              </div>
              <button onClick={() => setBookingDoctor(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 18 }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: 12 }}>
                <div><label className="form-label">{tr('book_patient_req')}</label><input value={bookForm.patient} onChange={e => setBookForm(p => ({ ...p, patient: e.target.value }))} className="form-control" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label className="form-label">{tr('book_date_req')}</label><input type="date" value={bookForm.date} onChange={e => setBookForm(p => ({ ...p, date: e.target.value }))} className="form-control" min={new Date().toISOString().split('T')[0]} /></div>
                  <div><label className="form-label">{tr('book_time_req')}</label><input type="time" value={bookForm.time} onChange={e => setBookForm(p => ({ ...p, time: e.target.value }))} className="form-control" /></div>
                </div>
                <div><label className="form-label">{tr('book_visit_type')}</label>
                  <select value={bookForm.type} onChange={e => setBookForm(p => ({ ...p, type: e.target.value }))} className="form-control">
                    <option>{tr('book_checkup')}</option><option>{tr('book_followup')}</option><option>{tr('book_consult')}</option><option>{tr('book_emergency')}</option>
                  </select>
                </div>
                <div><label className="form-label">{tr('field_notes')}</label><textarea value={bookForm.notes} onChange={e => setBookForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" /></div>
                <div style={{ background: `${bookingDoctor.color}10`, borderRadius: 10, padding: 12, border: `1px solid ${bookingDoctor.color}30` }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <span>🕐 {bookingDoctor.workHours}</span>
                    <span>💵 {bookingDoctor.fee?.toLocaleString()} {tr('auto_pair_119')}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setBookingDoctor(null)} style={{ marginLeft: 8, padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{tr('btn_cancel')}</button>
              <button onClick={confirmBooking} style={{ padding: '9px 22px', borderRadius: 8, background: bookingDoctor.color, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                ✅ {tr('svc_book_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang === 'ar' ? `حذف ${selectedIds.size} قسم؟` : `Delete ${selectedIds.size} departments?`}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>{tr('x_hlantmtakd_laimknaltraja')}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}>{tr('btn_cancel')}</button>
                <button className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>{bulkDeleting ? '...' : tr('btn_delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
