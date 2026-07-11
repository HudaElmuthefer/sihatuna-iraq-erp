import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp, translateDays } from '../contexts/AppContext';
import ExcelImportModal from '../components/ExcelImportModal';
import { api } from '../api';
import { FaFileExcel } from 'react-icons/fa';

const emptyDept = { name: '', icon: '🏥', description: '', head: '', color: '#1a6bab', status: 'active' };

export default function DepartmentsPage() {
  const { showToast, lang, departments, setDepartments, doctors: allDoctors, syncToServer, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const [selected, setSelected] = useState(null);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState(emptyDept);
  const [showImport, setShowImport] = useState(false);
  const [bookForm, setBookForm] = useState({ patient: '', date: '', time: '', type: tr('book_checkup'), notes: '' });
  const deptDoctors = selected ? allDoctors.filter(d => (selected.doctorIds || []).includes(d.id)) : [];
  const openAdd = () => { setEditingDept(null); setForm(emptyDept); setShowDeptModal(true); };
  const openEdit = (d) => { setEditingDept(d); setForm({ ...d }); setShowDeptModal(true); };
  const saveDept = () => {
    if (!form.name) { showToast(tr('err_dept_name'), 'error'); return; }
    if (editingDept) {
      const ud = { ...form, id: editingDept.id, doctorIds: editingDept.doctorIds || [] };
      setDepartments(p => p.map(d => d.id === editingDept.id ? ud : d));
      syncToServer('departments', 'update', ud);
      showToast(tr('msg_updated'), 'success');
    } else {
      const nd = { ...form, id: Date.now(), doctorIds: [], patients: 0 };
      setDepartments(p => [...p, nd]);
      syncToServer('departments', 'create', nd);
      showToast(tr('msg_added2'), 'success');
    }
    setShowDeptModal(false);
    if (selected && editingDept?.id === selected.id) setSelected({ ...form, id: editingDept.id });
  };
  const delDept = (id) => {
    setDepartments(p => p.filter(d => d.id !== id));
    syncToServer('departments', 'delete', { id });
    if (selected?.id === id) setSelected(null);
    showToast(tr('msg_deleted2'), 'success');
  };
  const confirmBooking = () => {
    if (!bookForm.patient || !bookForm.date || !bookForm.time) { showToast(tr('err_booking'), 'error'); return; }
    showToast(`✅ ${bookForm.patient} — ${bookingDoctor.name} — ${bookForm.date}`, 'success');
    setBookingDoctor(null);
    setBookForm({ patient: '', date: '', time: '', type: tr('book_checkup'), notes: '' });
  };
  const ICONS = ['🏥','🔬','🧪','📡','📱','👩‍⚕️','👁️','🦷','🫀','🧠','💊','🩺','🩻','🫁'];
  const COLORS = ['#1a6bab','#10b981','#8b5cf6','#f59e0b','#ec4899','#06b6d4','#ef4444','#6366f1'];

  return (
    <div className="page-content">
      <div style={{ background: 'linear-gradient(135deg,#0f1923,#1a2940)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 36 }}>🏢</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{tr('dept_management')}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 13 }}>{tr('dept_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowImport(true)} style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaFileExcel /> {lang === 'ar' ? 'استيراد من Excel' : 'Import from Excel'}
          </button>
          <button onClick={openAdd} style={{ background: '#fff', color: '#0f1923', border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            ＋ {tr('dept_add')}
          </button>
        </div>
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 24 }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {departments.map(dept => (
              <div key={dept.id} onClick={() => setSelected(selected?.id === dept.id ? null : dept)}
                style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: `2px solid ${selected?.id === dept.id ? dept.color : 'var(--border)'}`, cursor: 'pointer', overflow: 'hidden', transition: 'all 0.2s', transform: selected?.id === dept.id ? 'scale(1.02)' : 'scale(1)', boxShadow: selected?.id === dept.id ? `0 6px 24px ${dept.color}30` : 'none' }}>
                <div style={{ height: 5, background: dept.color }} />
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{dept.icon}</div>
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
    </div>
  );
}
