/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { api } from '../api';
import { FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';

const init = [
  { id: 1, employee: 'محمد علي حسن', employeeEn:'Mohammed Ali Hassan', dept: 'قسم الطوارئ', deptEn:'Emergency Dept.', type: 'sick', from: '2024-06-01', to: '2024-06-05', days: 5, diagnosis: 'التهاب حاد', diagnosisEn:'Acute Inflammation', doctor: 'د. أحمد الكريم', status: 'approved', notes: '' },
  { id: 2, employee: 'سارة جاسم', employeeEn:'Sara Jasim', dept: 'قسم الجراحة', deptEn:'Surgery Dept.', type: 'ولادة', from: '2024-05-15', to: '2024-08-15', days: 92, diagnosis: 'إجازة أمومة', diagnosisEn:'Maternity Leave', doctor: 'د. فاطمة الموسوي', status: 'approved', notes: '' },
  { id: 3, employee: 'علي رضا محمد', employeeEn:'Ali Rida Mohammed', dept: 'قسم الأطفال', deptEn:'Pediatrics Dept.', type: 'sick', from: '2024-06-10', to: '2024-06-12', days: 3, diagnosis: 'ضغط دم', diagnosisEn:'Blood Pressure', doctor: 'د. حسين العبادي', status: 'review', notes: 'يجب التحقق من المستندات' },
  { id: 4, employee: 'نورا سعد', employeeEn:'Nora Saad', dept: 'قسم المختبر', deptEn:'Laboratory Dept.', type: 'عارضة', from: '2024-06-08', to: '2024-06-09', days: 2, diagnosis: 'حادث منزلي', diagnosisEn:'Home Accident', doctor: 'د. ليلى الهاشمي', status: 'rejected', notes: 'لم تُقدم وثائق كافية' },
];

const empty = { employee: '', dept: '', type: 'sick', from: '', to: '', days: '', diagnosis: '', doctor: '', status: 'review', notes: '' };
const depts_ar = ['قسم الطوارئ', 'قسم الجراحة', 'قسم الأطفال', 'قسم المختبر', 'قسم الأشعة', 'قسم الباطنية'];
const depts_en = ['Emergency', 'Surgery', 'Pediatrics', 'Laboratory', 'Radiology', 'Internal Medicine'];

export default function MedicalLeavePage() {
  const { showToast, lang, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled, user } = useApp();
  const depts = lang === 'ar' ? depts_ar : depts_en;
  const tr = useT(lang);
  const typeOptions = [
    { value: 'مرضية', label: tr('leave_type_sick') },
    { value: 'ولادة', label: tr('leave_type_mat') },
    { value: 'عارضة', label: tr('leave_type_cas') },
    { value: 'اعتيادية', label: tr('leave_type_ann') },
    { value: 'طارئة', label: tr('leave_type_urg') },
  ];
  const statusOptions = [
    { value: 'موافق عليه', label: tr('leave_status_appr2') },
    { value: 'قيد المراجعة', label: tr('leave_status_rev') },
    { value: 'مرفوض', label: tr('leave_status_rej2') },
  ];
  const displayValue = (value) => ({
    'مرضية': tr('leave_type_sick'),
    'ولادة': tr('leave_type_mat'),
    'عارضة': tr('leave_type_cas'),
    'اعتيادية': tr('leave_type_ann'),
    'طارئة': tr('leave_type_urg'),
    'موافق عليه': tr('leave_status_appr2'),
    'قيد المراجعة': tr('leave_status_rev'),
    'مرفوض': tr('leave_status_rej2'),
  }[value] || value);
  const [leaves, setLeaves] = useState(init);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // إصلاح: نفس خلل AppContext — لو كان عدد الإجازات الحقيقي صفراً، تبقى
    // الصفحة تعرض بيانات تجريبية وهمية ثابتة (init) للأبد بدل الصفر الصحيح.
    api.get('/medicalLeaves').then(data => {
      if (!cancelled && Array.isArray(data)) setLeaves(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState('all');

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setShowModal(true); };

  const calcDays = (from, to) => {
    if (!from || !to) return '';
    const d = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24) + 1;
    return d > 0 ? d : '';
  };

  const save = async () => {
    if (!form.employee || !form.from || !form.to) { showToast(tr('msg_required'), 'error'); return; }
    const days = calcDays(form.from, form.to);
    const prev = leaves;
    if (editing) {
      const ul = { ...form, days, id: editing.id };
      setLeaves(p => p.map(r => r.id === editing.id ? ul : r));
      const ok = await syncToServer('medicalLeaves', 'update', ul);
      if (!ok) { setLeaves(prev); return; }
      showToast(tr('msg_edited'), 'success');
    } else {
      const nl = { ...form, days, id: Date.now() };
      setLeaves(p => [...p, nl]);
      const synced = await syncToServer('medicalLeaves', 'create', nl);
      if (!synced) { setLeaves(prev); return; }
      if (typeof synced === 'object' && synced.id !== nl.id) {
        setLeaves(p => p.map(r => r.id === nl.id ? synced : r));
      }
      showToast(tr('msg_added'), 'success');
    }
    setShowModal(false);
  };

  const del = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = leaves;
    setLeaves(p => p.filter(r => r.id !== id));
    const ok = await syncToServer('medicalLeaves', 'delete', { id });
    if (!ok) { setLeaves(prev); return; }
    showToast(tr('msg_deleted'), 'success');
  };
  const updateStatus = async (id, status) => {
    const prev = leaves;
    const current = leaves.find(r => r.id === id);
    if (!current) return;
    const changed = { ...current, status };
    setLeaves(p => p.map(r => r.id === id ? changed : r));
    const ok = await syncToServer('medicalLeaves', 'update', changed);
    if (!ok) { setLeaves(prev); return; }
    showToast(`${tr('leave_status_changed')}: ${displayValue(status)}`, 'success');
  };

  const statusStyle = (s) => ({
    'approved': { bg: '#dcfce7', color: '#166534', icon: <FaCheckCircle /> },
    'review': { bg: '#fef9c3', color: '#854d0e', icon: <FaClock /> },
    'rejected': { bg: '#fee2e2', color: '#991b1b', icon: <FaTimesCircle /> } }[s] || { bg: '#f3f4f6', color: '#374151', icon: null });

  const filtered = filter === 'all' ? filterByViewingHospital(leaves) : filterByViewingHospital(leaves).filter(r => r.status === filter);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = {
    total: leaves.length,
    approved: leaves.filter(r => r.status === 'approved').length,
    pending: leaves.filter(r => r.status === 'review').length,
    rejected: leaves.filter(r => r.status === 'rejected').length,
    totalDays: leaves.filter(r => r.status === 'approved').reduce((s, r) => s + (parseInt(r.days) || 0), 0) };

  return (
    <div className="page-content">
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 36 }}>📋</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{tr('leave_management')}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 13 }}>{tr('leave_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={openAdd} style={{ background: '#fff', color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <FaPlus /> {tr('leave_add')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 24 }}>
        {[
          { label: tr('vac_total'), val: stats.total, color: '#1a6bab', icon: '📋' },
          { label: tr('leave_approved_lbl'), val: stats.approved, color: '#22c55e', icon: '✅' },
          { label: tr('leave_pending_lbl'), val: stats.pending, color: '#f59e0b', icon: '⏳' },
          { label: tr('leave_rejected_lbl'), val: stats.rejected, color: '#ef4444', icon: '❌' },
          { label: tr('leave_days_total'), val: stats.totalDays, color: '#8b5cf6', icon: '📅' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ value:'all', label:tr('leave_filter_all') }, ...statusOptions].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: '8px 18px', borderRadius: 20, border: `2px solid ${filter === f.value ? '#1a6bab' : 'var(--border)'}`, background: filter === f.value ? '#1a6bab' : 'transparent', color: filter === f.value ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{tr('leave_col_emp')}</th>
                <th>{tr('hr_emp_dept')}</th>
                <th>{tr('leave_type')}</th>
                <th>{tr('leave_from')}</th>
                <th>{tr('leave_to')}</th>
                <th>{tr('leave_days')}</th>
                <th>{tr('field_diagnosis')}</th>
                <th>{tr('field_status')}</th>
                <th>{tr('field_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(r => {
                const st = statusStyle(r.status);
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{lang==='ar'?r.employee:(r.employeeEn||r.employee)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lang==='ar'?r.dept:(r.deptEn||r.dept)}</td>
                    <td><span style={{ background: 'rgba(26,107,171,0.1)', color: '#1a6bab', padding: '2px 8px', borderRadius: 8, fontSize: 12 }}>{displayValue(r.type)}</span></td>
                    <td>{r.from}</td>
                    <td>{r.to}</td>
                    <td style={{ fontWeight: 600, color: '#1a6bab' }}>{r.days}</td>
                    <td style={{ fontSize: 13 }}>{lang==='ar'?r.diagnosis:(r.diagnosisEn||r.diagnosis)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {st.icon} {displayValue(r.status)}
                        </span>
                        {r.status === 'review' && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => updateStatus(r.id, 'approved')} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>{tr('btn_accept')}</button>
                            <button onClick={() => updateStatus(r.id, 'rejected')} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>{tr('btn_reject')}</button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab' }}><FaEdit /></button>
                        <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{tr('msg_no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editing ? tr('leave_edit') : tr('leave_add')}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)' }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">{tr('leave_col_emp')} *</label>
                  <input value={form.employee} onChange={e => setForm(p => ({ ...p, employee: e.target.value }))} className="form-control" />
                </div>
                {multiHospitalEnabled && (
                  <div>
                    <label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="form-label">{tr('hr_emp_dept')}</label>
                  <select value={form.dept} onChange={e => setForm(p => ({ ...p, dept: e.target.value }))} className="form-control">
                    <option value="">{tr('field_choose')}</option>
                    {depts.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{tr('leave_type')}</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="form-control">
                    {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{tr('field_status')}</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="form-control">
                    {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{tr('leave_col_from')} *</label>
                  <input type="date" value={form.from} onChange={e => { const v = e.target.value; setForm(p => ({ ...p, from: v, days: calcDays(v, p.to) })); }} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{tr('leave_col_to')} *</label>
                  <input type="date" value={form.to} onChange={e => { const v = e.target.value; setForm(p => ({ ...p, to: v, days: calcDays(p.from, v) })); }} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{tr('field_diagnosis')}</label>
                  <input value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{tr('leave_col_doctor')}</label>
                  <input value={form.doctor} onChange={e => setForm(p => ({ ...p, doctor: e.target.value }))} className="form-control" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{tr('field_notes')}</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn" style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', marginLeft: 8 }}>{tr('btn_cancel')}</button>
              <button onClick={save} className="btn btn-primary">{tr('btn_save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
