/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useT } from '../translations';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { FaUsers, FaPlus, FaSearch, FaEdit, FaTrash, FaEye, FaTimes, FaFileExcel} from 'react-icons/fa';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import ExcelImportModal from '../components/ExcelImportModal';
import { api } from '../api';

const emptyForm = {
  name: '', nameEn: '', age: '', gender: 'male', phone: '',
  bloodType: 'A+', status: 'active', insurance: '', notes: '',
  diagnosis: '', doctor: '', allergies: '', chronicDiseases: ''
};

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const colors = ['#1a6bab', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

export default function PatientsPage() {
  const { lang, addToast, patients, setPatients, syncPatientToServer, hospitals, multiHospitalEnabled, filterByViewingHospital } = useApp();
  const tr = useT(lang);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const ar = lang === 'ar';

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = (p.name || '').toLowerCase().includes(q) ||
      (p.nameEn || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q) ||
      (p.patientId || '').includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

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

  const openEdit = (p) => { setForm({ ...p }); setSelected(p); setModal('edit'); };
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
    } else {
      const updatedPt = { ...form, id: selected.id };
      setPatients(p => p.map(pt => pt.id === selected.id ? updatedPt : pt));
      const synced = await syncPatientToServer('update', updatedPt);
      addToast(tr(synced ? 'x_tmthdithbianatalmri' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
    }
    setModal(null);
  };

  const handleDelete = async () => {
    setPatients(p => p.filter(pt => pt.id !== deleteConfirm));
    const synced = await syncPatientToServer('delete', { id: deleteConfirm });
    addToast(tr(synced ? 'x_tmhdhfalmri' : 'x_tmalhfzmhliaftqrmzamn'), synced ? 'success' : 'warning');
    setDeleteConfirm(null);
  };

  const statusLabel = (s) => {
    if (s === 'active') return { label: tr('status_active'), className: 'badge-success' };
    return { label: tr('status_inactive'), className: 'badge-danger' };
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon"><FaUsers /></div>
          {tr('pat_management')}
          <span className="badge badge-info" style={{ fontSize: 13 }}>{patients.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>
            <FaFileExcel /> {ar ? 'استيراد من Excel' : 'Import from Excel'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FaPlus /> {tr('pat_add')}
          </button>
        </div>
      </div>

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
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{tr('pat_patient_id')}</th>
                <th>{tr('field_name')}</th>
                <th>{tr('x_alamraljns')}</th>
                <th>{tr('field_phone')}</th>
                <th>{tr('pat_blood_type')}</th>
                <th>{tr('x_altbibalmaalj')}</th>
                <th>{tr('pat_last_visit')}</th>
                <th>{tr('field_status')}</th>
                <th>{tr('field_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="9">
                  <div className="empty-state">
                    <div className="icon">👤</div>
                    <h3>{tr('pat_no_patients')}</h3>
                  </div>
                </td></tr>
              ) : pageItems.map(p => {
                const s = statusLabel(p.status);
                return (
                  <tr key={p.id}>
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
                <div className="form-group"><label className="form-label">{tr('x_alasmbalarbi')}</label><input className="form-control" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{tr('col_name_en')}</label><input className="form-control" value={form.nameEn || ''} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} /></div>
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
                <div className="form-group"><label className="form-label">{tr('x_altbibalmaalj')}</label><input className="form-control" value={form.doctor || ''} onChange={e => setForm(p => ({ ...p, doctor: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{tr('x_rqmaltamin')}</label><input className="form-control" value={form.insurance || ''} onChange={e => setForm(p => ({ ...p, insurance: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">{tr('field_status')}</label>
                  <select className="form-control" value={form.status || 'active'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="active">{tr('status_active')}</option>
                    <option value="inactive">{tr('status_inactive')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">{tr('x_alamra_almzmnawalhsasia')}</label><input className="form-control" value={form.allergies || ''} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} /></div>
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
    </div>
  );
}
