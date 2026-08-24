/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useNavigate } from 'react-router-dom';
import { useApp, translateDays } from '../contexts/AppContext';
import { FaUserMd, FaPlus, FaSearch, FaEdit, FaTrash, FaEye, FaTimes, FaPhone, FaFileExcel } from 'react-icons/fa';
import useServerPagination from '../hooks/useServerPagination';
import Pagination from '../components/Pagination';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import { api } from '../api';

const BANNER_GRADIENT = 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)';

const specs = [
  { ar:'باطنية وصدرية', en:'Internal/Chest Medicine' },
  { ar:'نسائية وتوليد', en:'OB/GYN' },
  { ar:'أطفال', en:'Pediatrics' },
  { ar:'جلدية', en:'Dermatology' },
  { ar:'عظام وكسور', en:'Orthopedics' },
  { ar:'عيون', en:'Ophthalmology' },
  { ar:'أمراض القلب', en:'Cardiology' },
  { ar:'جراحة عامة', en:'General Surgery' },
  { ar:'تخدير', en:'Anesthesia' },
  { ar:'أورام', en:'Oncology' },
];

const colors = ['#1a6bab', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

export default function DoctorsPage() {
  const navigate = useNavigate();
  const { lang, addToast, doctors, setDoctors, departments, setDepartments, syncToServer, hospitals, multiHospitalEnabled, filterByViewingHospital } = useApp();
  const tr = useT(lang);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('cards'); // 'cards' | 'table'
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [selected, setSelected] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  // تأخير البحث 350 مللي ثانية بعد آخر حرف — يمنع إرسال طلب لكل ضغطة زر
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── الجلب المُرقَّم من السيرفر ────────────────────────────────────────────
  // نفس مبدأ صفحة المرضى بالضبط — الجدول/البطاقات هنا تجيب فقط الصفحة الحالية
  // من الخادم (بحث بالاسم والتخصص + فلترة بالحالة تصير كلها بقاعدة البيانات).
  // مصفوفة `doctors` بالسياق العام تبقى محمَّلة كاملة لصفحات ثانية تحتاجها
  // كقائمة اختيار (الأقسام، المواعيد...)، ومنفصلة عن جدول هذه الصفحة تحديداً.
  const { data: pageItems, page: currentPage, setPage: setCurrentPage, total: totalItems, totalPages, loading, refetch } =
    useServerPagination('doctors', { search: debouncedSearch, status: filter, pageSize: 50 });

  const openAdd = () => {
    setForm({ name: '', nameEn: '', specialization: 'باطنية وصدرية', spec: 'Internal Medicine', phone: '', experience: '', status: 'active', gender: 'male', rating: 4.5, patients: 0, deptId: 1, bio: '', workHours: '9:00 - 15:00', fee: 25000, availableDays: [] });
    setModal('add');
  };

  const openEdit = (d) => { setForm({ ...d }); setSelected(d); setModal('edit'); };
  const openView = (d) => { setSelected(d); setModal('view'); };

  // Keeps department.doctorIds in sync with each doctor's own deptId field —
  // called after every doctor save, so a newly-added or reassigned doctor
  // automatically shows up under the correct department without any extra
  // manual step. oldDeptId is only passed on edit, to remove the doctor from
  // a department they're no longer assigned to.
  const syncDoctorDepartmentLink = async (doctorId, newDeptId, oldDeptId) => {
    if (oldDeptId && oldDeptId !== newDeptId) {
      const oldDept = departments.find((d) => d.id === oldDeptId);
      if (oldDept && (oldDept.doctorIds || []).includes(doctorId)) {
        const updatedOld = { ...oldDept, doctorIds: oldDept.doctorIds.filter((id) => id !== doctorId) };
        const ok = await syncToServer('departments', 'update', updatedOld);
        if (ok) setDepartments((p) => p.map((d) => (d.id === oldDept.id ? updatedOld : d)));
      }
    }
    if (newDeptId) {
      const newDept = departments.find((d) => d.id === newDeptId);
      if (newDept && !(newDept.doctorIds || []).includes(doctorId)) {
        const updatedNew = { ...newDept, doctorIds: [...(newDept.doctorIds || []), doctorId] };
        const ok = await syncToServer('departments', 'update', updatedNew);
        if (ok) setDepartments((p) => p.map((d) => (d.id === newDept.id ? updatedNew : d)));
      }
    }
  };

  // حفظ بيانات الطبيب: يجب انتظار الرد الفعلي من الخادم (await) قبل إظهار رسالة النجاح،
  // لأن تحديث الحالة المحلية (setDoctors) لا يعني بالضرورة نجاح الكتابة في قاعدة البيانات.
  // عند فشل المزامنة يبقى التغيير محفوظاً محلياً فقط، ويجب إعلام المستخدم بذلك صراحة
  // بدل عرض رسالة نجاح وهمية لا تعكس الواقع.
  const handleSave = async () => {
    if (!form.name || !form.phone) {
      addToast(tr('x_irjamlalhqwlalmtlwba'), 'error');
      return;
    }
    if (modal === 'add') {
      const nd = { ...form, id: Date.now(), avatar: form.name.charAt(0), color: colors[Math.floor(Math.random() * colors.length)] };
      setDoctors(p => [nd, ...p]);
      const synced = await syncToServer('doctors', 'create', nd);
      addToast(tr(synced ? 'x_tmti_afaaltbibbnjah' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
      if (synced) await syncDoctorDepartmentLink(nd.id, nd.deptId, null);
      refetch();
    } else {
      const ud = { ...form, id: selected.id };
      setDoctors(p => p.map(d => d.id === selected.id ? ud : d));
      const synced = await syncToServer('doctors', 'update', ud);
      addToast(tr(synced ? 'x_tmthdithbianataltbib' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
      if (synced) await syncDoctorDepartmentLink(ud.id, ud.deptId, selected.deptId);
      refetch();
    }
    setModal(null);
  };

  // حذف طبيب: نفس مبدأ الحفظ — يجب انتظار تأكيد الخادم قبل إظهار رسالة النجاح النهائية.
  const handleDelete = async () => {
    const deletedDoctor = doctors.find(d => d.id === deleteConfirm);
    setDoctors(p => p.filter(d => d.id !== deleteConfirm));
    const synced = await syncToServer('doctors', 'delete', { id: deleteConfirm });
    addToast(tr(synced ? 'x_tmhdhfaltbib' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
    if (synced && deletedDoctor?.deptId) await syncDoctorDepartmentLink(deleteConfirm, null, deletedDoctor.deptId);
    setDeleteConfirm(null);
    refetch();
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const synced = await syncToServer('doctors', 'delete', { id });
      if (synced) { setDoctors(p => p.filter(d => d.id !== id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    addToast(
      ar ? `تم حذف ${deleted} من ${ids.length} طبيب` : `Deleted ${deleted} of ${ids.length} doctors`,
      deleted === ids.length ? 'success' : 'warning'
    );
    refetch();
  };

  return (
    <div className="fade-in">
      <PageBanner icon={<FaUserMd />} title={tr('doc_management')} count={doctors.length} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, overflow: 'hidden' }}>
          {['cards', 'table'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '8px 14px', background: view === v ? '#fff' : 'rgba(255,255,255,0.15)', color: view === v ? '#0c4a6e' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
              {v === 'cards' ? '⊞' : '☰'} {v === 'cards' ? (tr('doc_cards_view')) : (tr('doc_table_view'))}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => setShowImport(true)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}>
          <FaFileExcel /> {ar ? 'استيراد من Excel' : 'Import from Excel'}
        </button>
        <ExcelExportButton apiName="doctors" lang={lang} onError={(m) => addToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
        <button className="btn" onClick={openAdd} style={{ background: '#fff', color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><FaPlus /> {tr('doc_add')}</button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="doctors"
          title={ar ? 'استيراد أطباء من Excel' : 'Import Doctors from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/doctors');
              if (Array.isArray(fresh)) setDoctors(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً وتظهر بأول تحديث لاحق */ }
            refetch();
          }}
        />
      )}

      {/* Search & Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: 220 }}>
              <FaSearch className="search-icon" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tr('doc_search')} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'active', 'inactive'].map(f => (
                <button key={f} onClick={() => setFilter(f)} className="btn btn-sm"
                  style={{ background: filter === f ? 'var(--primary)' : 'var(--bg-primary)', color: filter === f ? 'white' : 'var(--text-secondary)', border: '1.5px solid', borderColor: filter === f ? 'var(--primary)' : 'var(--border)' }}>
                  {f === 'all' ? (tr('status_all')) : f === 'active' ? (tr('status_active')) : (tr('status_inactive'))}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cards View */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ar ? `${selectedIds.size} محدَّد` : `${selectedIds.size} selected`}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelectedIds(new Set())} className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }}>{ar ? 'إلغاء التحديد' : 'Clear Selection'}</button>
            <button onClick={() => setBulkDeleteConfirm(true)} className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px' }}><FaTrash /> {ar ? `حذف المحدَّد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}</button>
          </div>
        </div>
      )}
      {view === 'cards' ? (
        <div className="doctors-grid">
          {pageItems.map(doc => (
            <div key={doc.id} className="doctor-card">
              <div className="doctor-card-top" style={{ background: `linear-gradient(135deg, ${doc.color}22, ${doc.color}11)`, position: 'relative' }}>
                <input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => toggleSelect(doc.id)} style={{ position: 'absolute', top: 10, insetInlineStart: 10, width: 18, height: 18, cursor: 'pointer' }} />
                <div className="avatar" style={{ background: doc.color, color: 'white', width: 64, height: 64, fontSize: 26, margin: '0 auto 10px' }}>{doc.avatar}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>{ar ? doc.name : (doc.nameEn || doc.name)}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{ar ? (doc.specialization || doc.spec || '') : (doc.specializationEn || doc.spec || doc.specialization || '')}</p>
              </div>
              <div className="doctor-card-body">
                <div className="doctor-card-stats">
                  <div className="dc-stat">
                    <span style={{ color: '#f59e0b' }}>⭐</span>
                    <strong>{doc.rating}</strong>
                    <span>{tr('doc_rating')}</span>
                  </div>
                  <div className="dc-stat">
                    <span>👥</span>
                    <strong>{doc.patients}</strong>
                    <span>{tr('doc_patients')}</span>
                  </div>
                  <div className="dc-stat">
                    <span>📅</span>
                    <strong>{doc.experience}</strong>
                    <span>{tr('doc_years')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <FaPhone style={{ fontSize: 11 }} />{doc.phone}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <span className={`badge ${doc.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {doc.status === 'active' ? (tr('status_active')) : (tr('status_inactive'))}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => openView(doc)}><FaEye /> {tr('btn_view')}</button>
                  <button className="btn btn-sm" style={{ flex: 1, background: '#8b5cf6', color: 'white' }} onClick={() => openEdit(doc)}><FaEdit /> {tr('btn_edit')}</button>
                  <button className="btn btn-sm btn-danger" style={{ padding: '6px 10px' }} onClick={() => setDeleteConfirm(doc.id)}><FaTrash /></button>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="empty-state"><div className="icon">⏳</div><h3>{ar ? 'جاري التحميل...' : 'Loading...'}</h3></div>
            </div>
          )}
          {!loading && pageItems.length === 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="empty-state"><div className="icon">👨‍⚕️</div><h3>{tr('x_latwjdatba')}</h3></div>
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(d => selectedIds.has(d.id))} onChange={() => {
                      setSelectedIds(prev => {
                        const allSelected = pageItems.every(d => prev.has(d.id));
                        const next = new Set(prev);
                        pageItems.forEach(d => allSelected ? next.delete(d.id) : next.add(d.id));
                        return next;
                      });
                    }} />
                  </th>
                  <th>{tr('col_doctor')}</th>
                  <th>{tr('doc_specialization')}</th>
                  <th>{tr('col_phone')}</th>
                  <th>{tr('col_experience')}</th>
                  <th>{tr('x_altqiim')}</th>
                  <th>{tr('col_patients')}</th>
                  <th>{tr('field_status')}</th>
                  <th>{tr('x_alijraat')}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(doc => (
                  <tr key={doc.id}>
                    <td><input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => toggleSelect(doc.id)} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ background: doc.color, color: 'white', width: 36, height: 36, fontSize: 14 }}>{doc.avatar}</div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{ar ? doc.name : (doc.nameEn || doc.name)}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{ar ? (doc.specialization || doc.spec || '') : (doc.specializationEn || doc.spec || doc.specialization || '')}</td>
                    <td style={{ fontSize: 13, direction: 'ltr' }}>{doc.phone}</td>
                    <td style={{ fontSize: 13 }}>{doc.experience} {lang==='ar'?'سنة':'yr'}</td>
                    <td style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>⭐ {doc.rating}</td>
                    <td style={{ fontSize: 13 }}>{doc.patients}</td>
                    <td><span className={`badge ${doc.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{doc.status === 'active' ? (tr('status_active')) : (tr('status_inactive'))}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openView(doc)} style={{ padding: '5px 8px' }}><FaEye /></button>
                        <button className="btn btn-sm" onClick={() => openEdit(doc)} style={{ background: '#8b5cf6', color: 'white', padding: '5px 8px' }}><FaEdit /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(doc.id)} style={{ padding: '5px 8px' }}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaUserMd style={{ color: 'var(--primary)' }} />
                {modal === 'add' ? (tr('doc_add_new')) : (tr('doc_edit'))}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}><FaTimes /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{tr('x_alasmbalarbi')}</label>
                  <input className="form-control" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('col_name_en')}</label>
                  <input className="form-control" value={form.nameEn || ''} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('doc_specialization')}</label>
                  <input className="form-control" value={form.specialization || ''} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} list="specs-list" />
                  <datalist id="specs-list">{specs.map(s => <option key={s.ar} value={s.ar} label={s.en} />)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('dept_name')}</label>
                  <select className="form-control" value={form.deptId || ''} onChange={e => setForm(p => ({ ...p, deptId: Number(e.target.value) }))}>
                    <option value="">{tr("choose_dept")}</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{lang==="ar"?d.name:d.nameEn||d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('x_rqmalhatf')}</label>
                  <input className="form-control" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                {multiHospitalEnabled && (
                  <div className="form-group">
                    <label className="form-label">{tr('select_hospital_field')}</label>
                    <select className="form-control" value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))}>
                      <option value="">—</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{tr('col_experience')}</label>
                  <input className="form-control" type="number" value={form.experience || ''} onChange={e => setForm(p => ({ ...p, experience: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('doc_gender')}</label>
                  <select className="form-control" value={form.gender || 'male'} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                    <option value="male">{tr('status_male')}</option>
                    <option value="female">{tr('status_female')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('field_status')}</label>
                  <select className="form-control" value={form.status || 'active'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="active">{tr('status_active')}</option>
                    <option value="inactive">{tr('status_inactive')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('x_altqiim')}</label>
                  <input className="form-control" type="number" min="1" max="5" step="0.1" value={form.rating || ''} onChange={e => setForm(p => ({ ...p, rating: parseFloat(e.target.value) }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>{tr('btn_cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave}>{tr('btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal === 'view' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{tr('x_mlfaltbib')}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}><FaTimes /></button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 24, padding: 20, background: `linear-gradient(135deg, ${selected.color}22, ${selected.color}11)`, borderRadius: 12 }}>
                <div className="avatar" style={{ background: selected.color, color: 'white', width: 80, height: 80, fontSize: 32, margin: '0 auto 12px' }}>{selected.avatar}</div>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>{ar ? selected.name : selected.nameEn}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{ar ? selected.specialization : (selected.specializationEn || selected.spec || selected.specialization)}</p>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>⭐ {selected.rating}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>👥 {selected.patients} {tr('doc_patients')}</span>
                  <span className={`badge ${selected.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {selected.status === 'active' ? (tr('status_active')) : (tr('status_inactive'))}
                  </span>
                </div>
              </div>
              <div className="grid-2">
                {[
                  { label: tr('doc_phone'), value: selected.phone },
                  { label: tr('col_experience'), value: `${selected.experience} ${lang==='ar'?'سنوات':'years'}` },
                  { label: tr('doc_gender'), value: selected.gender === 'male' ? (tr('status_male')) : (tr('status_female')) },
                  { label: tr('col_patients'), value: selected.patients },
                ].map(item => (
                  <div key={item.label} style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>{tr('btn_cancel')}</button>
              <button className="btn btn-primary" onClick={() => { setModal(null); setTimeout(() => openEdit(selected), 100); }}>
                <FaEdit /> {tr('btn_edit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{tr('x_takidalhdhf')}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>{tr('x_hlantmtakd')}</p>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{ar ? `حذف ${selectedIds.size} طبيب؟` : `Delete ${selectedIds.size} doctors?`}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>{tr('x_hlantmtakd')}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}>{tr('btn_cancel')}</button>
                <button className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>{bulkDeleting ? '...' : tr('btn_delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .doctors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
        }
        .doctor-card {
          background: var(--bg-card);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
          overflow: hidden;
          transition: var(--transition);
        }
        .doctor-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .doctor-card-top { padding: 24px 20px 16px; }
        .doctor-card-body { padding: 16px 20px 20px; }
        .doctor-card-stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 10px;
          background: var(--bg-primary);
          border-radius: 8px;
        }
        .dc-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .dc-stat strong { font-size: 15px; color: var(--text-primary); font-weight: 800; }
      `}</style>
    </div>
  );
}
