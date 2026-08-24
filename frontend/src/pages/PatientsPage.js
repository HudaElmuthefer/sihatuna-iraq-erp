/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { FaUsers, FaPlus, FaSearch, FaEdit, FaTrash, FaEye, FaTimes, FaFileExcel} from 'react-icons/fa';
import useServerPagination from '../hooks/useServerPagination';
import Pagination from '../components/Pagination';
import DateRangeFilter from '../components/DateRangeFilter';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import DiagnosisPicker from '../components/DiagnosisPicker';
import AllergyPicker from '../components/AllergyPicker';
import PageBanner from '../components/PageBanner';
import { api } from '../api';

const BANNER_GRADIENT = 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)';

const emptyForm = {
  name: '', nameEn: '', age: '', gender: 'male', phone: '', nationalId: '',
  bloodType: 'A+', status: 'active', insurance: '', notes: '',
  diagnosis: '', diagnoses: [], doctor: '', allergies: [], chronicDiseases: ''
};

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const colors = ['#1a6bab', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

export default function PatientsPage() {
  const { lang, addToast, patients, setPatients, syncPatientToServer, hospitals, multiHospitalEnabled, filterByViewingHospital } = useApp();
  const tr = useT(lang);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const ar = lang === 'ar';

  // تأخير البحث 350 مللي ثانية بعد آخر حرف تكتبه — بدون هذا، كل ضغطة زر
  // كانت ترسل طلب فوري للخادم (بطيء وغير ضروري)؛ الآن ينتظر توقفك عن الكتابة
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── الجلب المُرقَّم من السيرفر ────────────────────────────────────────────
  // الجدول المعروض بهذه الصفحة يجيب فقط الصفحة الحالية من الخادم (بحث/فلترة/
  // ترقيم يصير كله بقاعدة البيانات، وليس بالمتصفح) — سريع بغض النظر عن عدد
  // المرضى الكلي، حتى لو وصل لعشرات الآلاف مستقبلاً. مصفوفة `patients` من
  // السياق العام (AppContext) تبقى محمَّلة كاملة كما هي — تحتاجها صفحات ثانية
  // (الفوترة، المواعيد) لقوائم اختيار، ولا علاقة لها بجدول هذه الصفحة تحديداً.
  const { data: pageItems, page: currentPage, setPage: setCurrentPage, total: totalItems, totalPages, loading, refetch } =
    useServerPagination('patients', { search: debouncedSearch, status: statusFilter, pageSize: 50, filters: { startDate: dateFrom, endDate: dateTo } });

  const openAdd = () => {
    // نعتمد على أعلى رقم مريض موجود فعلياً بدل عدد السجلات — الاعتماد على
    // patients.length كان يُنتج أرقاماً مكررة بعد أي عملية حذف (مثلاً لو
    // انحذف مريض، يصير الطول أقل، فيتكرر رقم مريض موجود أصلاً).
    const maxNum = patients.reduce((max, p) => {
      const match = /^PT-(\d+)$/.exec(p.patientId || '');
      const num = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, num);
    }, 0);
    setForm({ ...emptyForm, patientId: `PT-${String(maxNum + 1).padStart(4, '0')}` });
    setModal('add');
  };

  const openEdit = (p) => {
    // التوافق العكسي: مرضى أُنشئوا قبل هذا التحديث لهم icdCode/snomedCode
    // كحقلين منفردين لا كمصفوفة diagnoses — نحوّلهما تلقائياً هنا بدل فقدان البيانات
    let diagnoses = Array.isArray(p.diagnoses) ? p.diagnoses : [];
    if (diagnoses.length === 0 && (p.icdCode || p.snomedCode)) {
      diagnoses = [{ id: Date.now(), icdCode: p.icdCode || '', icdNameAr: '', icdNameEn: '', snomedCode: p.snomedCode || '', snomedNameAr: '', snomedNameEn: '', isPrimary: true, dateAdded: '' }];
    }
    // نفس مبدأ التوافق العكسي أعلاه — مرضى أُنشئوا قبل هذا التحديث لهم
    // allergies كحقل نصي حر واحد لا مصفوفة (راجع AllergyPicker.js). نحوّل
    // النص القديم لعنصر واحد بشدة "متوسطة" افتراضياً (غير معروفة فعلياً من
    // نص حر قديم) بدل فقدان البيانات.
    let allergies = Array.isArray(p.allergies) ? p.allergies : [];
    if (allergies.length === 0 && typeof p.allergies === 'string' && p.allergies.trim()) {
      allergies = [{ id: Date.now(), name: p.allergies.trim(), severity: 'moderate', dateAdded: '' }];
    }
    setForm({ ...p, diagnoses, allergies });
    setSelected(p);
    setModal('edit');
  };
  const openView = (p) => { setSelected(p); setModal('view'); };

  // حفظ بيانات المريض: يجب انتظار الرد الفعلي من الخادم (await) قبل إظهار رسالة
  // النجاح — قبل هذا التصحيح كانت الرسالة تظهر "تمت الإضافة" دائماً حتى لو
  // فشلت المزامنة الفعلية (مثلاً بسبب جلسة دخول غير صالحة)، مما يخفي المشكلة
  // تماماً عن المستخدم ويجعلها تبدو وكأن كل شيء تم بنجاح بينما السجل لم يُحفَظ
  // فعلياً بقاعدة البيانات.
  const handleSave = async () => {
    if (!form.name || !form.phone) {
      addToast(tr('x_irjamlalhqwlalmtlwba'), 'error');
      return;
    }
    if (modal === 'add') {
      const newPt = {
        ...form, id: Date.now(), totalVisits: 0,
        lastVisit: new Date().toISOString().split('T')[0],
        avatar: form.name.charAt(0),
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      setPatients(p => [newPt, ...p]);
      const synced = await syncPatientToServer('create', newPt);
      addToast(tr(synced ? 'x_tmti_afaalmri_bnjah' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
      refetch(); // نحدّث الجدول المعروض (المجلوب من السيرفر) ليعكس السجل الجديد فوراً
    } else {
      const updatedPt = { ...form, id: selected.id };
      setPatients(p => p.map(pt => pt.id === selected.id ? updatedPt : pt));
      const synced = await syncPatientToServer('update', updatedPt);
      addToast(tr(synced ? 'x_tmthdithbianatalmri' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
      refetch();
    }
    setModal(null);
  };

  const handleDelete = async () => {
    setPatients(p => p.filter(pt => pt.id !== deleteConfirm));
    const synced = await syncPatientToServer('delete', { id: deleteConfirm });
    addToast(tr(synced ? 'x_tmhdhfalmri' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
    setDeleteConfirm(null);
    refetch();
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const synced = await syncPatientToServer('delete', { id });
      if (synced) { setPatients(p => p.filter(pt => pt.id !== id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    addToast(
      ar ? `تم حذف ${deleted} من ${ids.length} مريض` : `Deleted ${deleted} of ${ids.length} patients`,
      deleted === ids.length ? 'success' : 'warning'
    );
    refetch();
  };

  const statusLabel = (s) => {
    if (s === 'active') return { label: tr('status_active'), className: 'badge-success' };
    return { label: tr('status_inactive'), className: 'badge-danger' };
  };

  return (
    <div className="fade-in">
      <PageBanner icon={<FaUsers />} title={tr('pat_management')} count={patients.length} gradient={BANNER_GRADIENT}>
        <button className="btn" onClick={() => setShowImport(true)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}>
          <FaFileExcel /> {ar ? 'استيراد من Excel' : 'Import from Excel'}
        </button>
        <ExcelExportButton apiName="patients" lang={lang} onError={(m) => addToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
        <button className="btn" onClick={openAdd} style={{ background: '#fff', color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <FaPlus /> {tr('pat_add')}
        </button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="patients"
          title={ar ? 'استيراد مرضى من Excel' : 'Import Patients from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/patients');
              if (Array.isArray(fresh)) setPatients(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً وتظهر بأول تحديث لاحق */ }
            refetch(); // يحدّث جدول هذه الصفحة تحديداً (المجلوب من السيرفر بشكل منفصل)
          }}
        />
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: 200 }}>
              <FaSearch className="search-icon" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('pat_search')} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'active', 'inactive'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className="btn btn-sm"
                  style={{ background: statusFilter === s ? 'var(--primary)' : 'var(--bg-primary)', color: statusFilter === s ? 'white' : 'var(--text-secondary)', border: '1.5px solid', borderColor: statusFilter === s ? 'var(--primary)' : 'var(--border)' }}>
                  {s === 'all' ? tr('status_all') : s === 'active' ? tr('status_active') : tr('status_inactive')}
                </button>
              ))}
            </div>
            <DateRangeFilter lang={lang} from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
              label={ar ? 'تاريخ التسجيل:' : 'Registration date:'} />
          </div>
        </div>
      </div>

      <div className="card">
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{ar ? `${selectedIds.size} محدَّد` : `${selectedIds.size} selected`}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedIds(new Set())} className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }}>{ar ? 'إلغاء التحديد' : 'Clear Selection'}</button>
              <button onClick={() => setBulkDeleteConfirm(true)} className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px' }}><FaTrash /> {ar ? `حذف المحدَّد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}</button>
            </div>
          </div>
        )}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(p => selectedIds.has(p.id))} onChange={() => {
                    setSelectedIds(prev => {
                      const allSelected = pageItems.every(p => prev.has(p.id));
                      const next = new Set(prev);
                      pageItems.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
                      return next;
                    });
                  }} />
                </th>
                <th>{tr('pat_patient_id')}</th>
                <th>{tr('field_name')}</th>
                <th>{tr('x_alamraljns')}</th>
                <th>{tr('field_phone')}</th>
                <th>{tr('pat_blood_type')}</th>
                <th>{tr('x_altbibalmaalj')}</th>
                <th>{lang === 'ar' ? 'التشخيص الأساسي (ICD)' : 'Primary Diagnosis (ICD)'}</th>
                <th>{tr('pat_last_visit')}</th>
                <th>{tr('field_status')}</th>
                <th>{tr('field_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="11">
                  <div className="empty-state">
                    <div className="icon">⏳</div>
                    <h3>{ar ? 'جارٍ التحميل...' : 'Loading...'}</h3>
                  </div>
                </td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan="11">
                  <div className="empty-state">
                    <div className="icon">👤</div>
                    <h3>{tr('pat_no_patients')}</h3>
                  </div>
                </td></tr>
              ) : pageItems.map(p => {
                const s = statusLabel(p.status);
                return (
                  <tr key={p.id}>
                    <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                    <td><span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.patientId}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ background: p.color, color: 'white', width: 36, height: 36, fontSize: 14 }}>{p.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.insurance}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{p.age} {lang==='ar'?'سنة':'yr'} / {p.gender === 'male' ? tr('status_male') : tr('status_female')}</td>
                    <td style={{ fontSize: 13, direction: 'ltr' }}>{p.phone}</td>
                    <td><span className="badge badge-info">{p.bloodType}</span></td>
                    <td style={{ fontSize: 13 }}>{p.doctor}</td>
                    <td style={{ fontSize: 12 }}>
                      {(() => {
                        const primary = Array.isArray(p.diagnoses) ? p.diagnoses.find(d => d.isPrimary) || p.diagnoses[0] : null;
                        if (primary?.icdCode) return <span><span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{primary.icdCode}</span> {lang === 'ar' ? primary.icdNameAr : (primary.icdNameEn || primary.icdNameAr)}</span>;
                        if (p.icdCode) return <span style={{ fontFamily: 'monospace' }}>{p.icdCode}</span>; // بيانات قديمة قبل هذا التحديث
                        return '-';
                      })()}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.lastVisit}</td>
                    <td><span className={`badge ${s.className}`}>{s.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openView(p)} style={{ padding: '5px 8px' }}><FaEye /></button>
                        <button className="btn btn-sm" onClick={() => openEdit(p)} style={{ background: '#8b5cf6', color: 'white', padding: '5px 8px' }}><FaEdit /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(p.id)} style={{ padding: '5px 8px' }}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                <FaUsers style={{ color: 'var(--primary)', marginLeft: 8 }} />
                {modal === 'add' ? tr('pat_add_new') : (tr('pat_edit'))}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}><FaTimes /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                {/* ── إضافة: حقل رقم المريض (patientId) ──────────────────────
                    لم يكن موجوداً بهذه النافذة إطلاقاً رغم أن العمود يظهر
                    بالجدول — يُولَّد تلقائياً عند الإضافة فقط (openAdd)، لكن
                    لا توجد طريقة لعرضه أو تعديله يدوياً، خصوصاً للسجلات
                    المستوردة عبر Excel التي قد يصل رقم المريض فيها فارغاً أو
                    بتنسيق مختلف يحتاج تصحيحاً يدوياً لربطه بموديولات أخرى
                    (مثل نتائج المختبر). الآن يظهر كحقل نصي قابل للتعديل. */}
                <div className="form-group">
                  <label className="form-label">{tr('pat_patient_id') || (lang === 'ar' ? 'رقم المريض' : 'Patient ID')}</label>
                  <input className="form-control" style={{ fontFamily: 'monospace' }} value={form.patientId || ''} onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))} placeholder="PT-0001" />
                </div>
                <div className="form-group"><label className="form-label">{tr('x_alasmbalarbi')}</label><input className="form-control" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{tr('col_name_en')}</label><input className="form-control" value={form.nameEn || ''} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{lang === 'ar' ? 'رقم البطاقة الوطنية الموحدة' : 'National ID Number'}</label><input className="form-control" value={form.nationalId || ''} onChange={e => setForm(p => ({ ...p, nationalId: e.target.value }))} placeholder={lang === 'ar' ? 'اختياري' : 'Optional'} /></div>
                <div className="form-group"><label className="form-label">{tr('x_alamr')}</label><input className="form-control" type="number" value={form.age || ''} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{tr('field_gender')}</label>
                  <select className="form-control" value={form.gender || 'male'} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                    <option value="male">{tr('status_male')}</option>
                    <option value="female">{tr('status_female')}</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">{tr('x_rqmalhatf')}</label><input className="form-control" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                {multiHospitalEnabled && (
                  <div className="form-group">
                    <label className="form-label">{tr('select_hospital_field')}</label>
                    <select className="form-control" value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))}>
                      <option value="">—</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group"><label className="form-label">{tr('pat_blood_type')}</label>
                  <select className="form-control" value={form.bloodType || 'A+'} onChange={e => setForm(p => ({ ...p, bloodType: e.target.value }))}>
                    {bloodTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">{tr('field_diagnosis')}</label><input className="form-control" value={form.diagnosis || ''} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">{lang === 'ar' ? 'التصنيف الطبي الدولي (ICD-10 / SNOMED CT)' : 'International Medical Classification (ICD-10 / SNOMED CT)'}</label>
                  <DiagnosisPicker diagnoses={form.diagnoses || []} onChange={(d) => setForm(p => ({ ...p, diagnoses: d }))} lang={lang} />
                </div>
                <div className="form-group"><label className="form-label">{tr('x_altbibalmaalj')}</label><input className="form-control" value={form.doctor || ''} onChange={e => setForm(p => ({ ...p, doctor: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{tr('x_rqmaltamin')}</label><input className="form-control" value={form.insurance || ''} onChange={e => setForm(p => ({ ...p, insurance: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{tr('field_status')}</label>
                  <select className="form-control" value={form.status || 'active'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="active">{tr('status_active')}</option>
                    <option value="inactive">{tr('status_inactive')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{tr('x_alamra_almzmnawalhsasia')}</label>
                <AllergyPicker allergies={Array.isArray(form.allergies) ? form.allergies : []} onChange={(a) => setForm(p => ({ ...p, allergies: a }))} lang={lang} />
              </div>
              <div className="form-group"><label className="form-label">{tr('field_notes')}</label><textarea className="form-control" rows={3} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>{tr('btn_cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave}>{tr('btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'view' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{tr('x_mlfalmri')}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}><FaTimes /></button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div className="avatar" style={{ background: selected.color, color: 'white', width: 72, height: 72, fontSize: 28, margin: '0 auto 12px' }}>{selected.avatar}</div>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>{selected.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{selected.patientId}</p>
              </div>
              <div className="grid-2">
                {[
                  { label: tr('pat_age'), value: `${selected.age} ${lang==='ar'?'سنة':'yr'}` },
                  { label: tr('field_gender'), value: selected.gender === 'male' ? tr('status_male') : tr('status_female') },
                  { label: tr('field_phone'), value: selected.phone },
                  { label: tr('pat_blood_type'), value: selected.bloodType },
                  { label: tr('field_diagnosis'), value: selected.diagnosis || '-' },
                  { label: tr('col_doctor'), value: selected.doctor || '-' },
                  { label: tr('pat_last_visit'), value: selected.lastVisit },
                  { label: tr('col_visits'), value: selected.totalVisits },
                ].map(item => (
                  <div key={item.label} style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {(Array.isArray(selected.allergies) && selected.allergies.length > 0) && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{tr('x_alamra_almzmnawalhsasia')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.allergies.map((a) => {
                      const sevColor = { mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' }[a.severity] || '#6b7280';
                      const sevLabel = { mild: lang === 'ar' ? 'خفيفة' : 'Mild', moderate: lang === 'ar' ? 'متوسطة' : 'Moderate', severe: lang === 'ar' ? 'شديدة' : 'Severe' }[a.severity] || a.severity;
                      return (
                        <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-primary)', fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>{a.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: sevColor, background: `${sevColor}1a`, padding: '1px 6px', borderRadius: 10 }}>{sevLabel}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {(Array.isArray(selected.diagnoses) && selected.diagnoses.length > 0) && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{lang === 'ar' ? 'التصنيف الطبي الدولي (ICD-10 / SNOMED CT)' : 'International Medical Classification'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.diagnoses.map((d) => (
                      <div key={d.id} style={{ padding: 10, background: d.isPrimary ? '#eff6ff' : 'var(--bg-primary)', borderRadius: 8, fontSize: 13 }}>
                        {d.icdCode && <span><span style={{ fontFamily: 'monospace', color: '#1a6bab' }}>{d.icdCode}</span> {lang === 'ar' ? d.icdNameAr : (d.icdNameEn || d.icdNameAr)}</span>}
                        {d.snomedCode && <span style={{ marginInlineStart: 10 }}><span style={{ fontFamily: 'monospace', color: '#7c3aed' }}>{d.snomedCode}</span> {lang === 'ar' ? d.snomedNameAr : (d.snomedNameEn || d.snomedNameAr)}</span>}
                        {d.isPrimary && <span style={{ fontSize: 10, background: '#1a6bab', color: '#fff', padding: '1px 6px', borderRadius: 4, marginInlineStart: 8 }}>{lang === 'ar' ? 'أساسي' : 'Primary'}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>{tr('btn_close')}</button>
              <button className="btn btn-primary" onClick={() => { setModal(null); setTimeout(() => openEdit(selected), 100); }}><FaEdit /> {tr('btn_edit')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{tr('x_takidalhdhf')}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                {tr('x_hlantmtakd_laimknaltraja')}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>{tr('btn_cancel')}</button>
                <button className="btn btn-danger" onClick={handleDelete}>{tr('btn_delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{ar ? `حذف ${selectedIds.size} مريض؟` : `Delete ${selectedIds.size} patients?`}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                {tr('x_hlantmtakd_laimknaltraja')}
              </p>
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
