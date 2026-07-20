/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { FaCalendarAlt, FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaCheck, FaClock } from 'react-icons/fa';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';

const statusConfig = {
  confirmed: { ar: 'مؤكد',       en: 'Confirmed', class: 'badge-success' },
  pending:   { ar: 'انتظار',     en: 'Pending',   class: 'badge-warning' },
  completed: { ar: 'مكتمل',      en: 'Completed', class: 'badge-info'    },
  cancelled: { ar: 'ملغي',       en: 'Cancelled', class: 'badge-danger'  },
};

export default function AppointmentsPage() {
  const { lang, addToast, appointments: apts, setAppointments: setApts, doctors, patients, syncToServer, hospitals, multiHospitalEnabled, filterByViewingHospital } = useApp();
  const tr = useT(lang);
  const ar = lang === 'ar';
  const visitTypes = [tr('visit_checkup'), tr('visit_followup'), tr('visit_consult'), tr('visit_emergency')];

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal]             = useState(null);
  const [form, setForm]               = useState({});
  const [selected, setSelected]       = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = (apts || []).filter(a => {
    if (!a) return false;
    const q = search.toLowerCase();
    const matchQ = (a.patient||'').toLowerCase().includes(q) ||
                   (a.doctor||'').toLowerCase().includes(q) || (a.doctorEn||'').toLowerCase().includes(q) ||
                   (a.department||'').toLowerCase().includes(q) || (a.departmentEn||'').toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || a.status === statusFilter;
    return matchQ && matchS;
  });

  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const counts = {
    confirmed: (apts||[]).filter(a => a?.status === 'confirmed').length,
    pending:   (apts||[]).filter(a => a?.status === 'pending').length,
    completed: (apts||[]).filter(a => a?.status === 'completed').length,
    cancelled: (apts||[]).filter(a => a?.status === 'cancelled').length,
  };

  const openAdd = () => {
    setForm({ patient:'', doctor:'', department:'', date: new Date().toISOString().split('T')[0], time:'09:00', status:'pending', type:'checkup', notes:'' });
    setModal('add');
  };
  const openEdit = (a) => { setForm({...a}); setSelected(a); setModal('edit'); };

  const handleSave = async () => {
    if (!form.patient || !form.doctor || !form.date) {
      addToast(tr('auto_pair_53'), 'error'); return;
    }
    const prev = apts;
    if (modal === 'add') {
      const na = { ...form, id: Date.now() };
      setApts(p => [...p, na]);
      const ok = await syncToServer('appointments', 'create', na);
      if (!ok) { setApts(prev); return; }
      addToast(tr('auto_pair_54'), 'success');
    } else {
      const ua = { ...form, id: selected.id };
      setApts(p => p.map(a => a.id === selected.id ? ua : a));
      const ok = await syncToServer('appointments', 'update', ua);
      if (!ok) { setApts(prev); return; }
      addToast(tr('auto_pair_55'), 'success');
    }
    setModal(null);
  };

  const changeStatus = async (id, status) => {
    const prev = apts;
    const current = apts.find(a => a.id === id);
    if (!current) return;
    const changed = { ...current, status };
    setApts(p => p.map(a => a.id === id ? changed : a));
    const ok = await syncToServer('appointments', 'update', changed);
    if (!ok) { setApts(prev); return; }
    addToast(tr('auto_pair_56'), 'success');
  };

  const handleDelete = async () => {
    const prev = apts;
    setApts(p => p.filter(a => a.id !== deleteConfirm));
    const ok = await syncToServer('appointments', 'delete', { id: deleteConfirm });
    if (!ok) { setApts(prev); return; }
    addToast(tr('auto_pair_57'), 'success');
    setDeleteConfirm(null);
  };

  const getStatusLabel = (status) => {
    const cfg = statusConfig[status];
    if (!cfg) return { label: status, class: 'badge-info' };
    return { label: ar ? cfg.ar : cfg.en, class: cfg.class };
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <div className="icon"><FaCalendarAlt /></div>
          {tr('apt_management')}
          <span className="badge badge-info" style={{ fontSize:13 }}>{(apts||[]).length}</span>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <FaPlus /> {tr('apt_add')}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { key:'confirmed', label: tr('auto_pair_58'), icon:'✅', color:'#10b981' },
          { key:'pending',   label: tr('auto_pair_59'),   icon:'⏳', color:'#f59e0b' },
          { key:'completed', label: tr('auto_pair_60'), icon:'🏁', color:'#1a6bab' },
          { key:'cancelled', label: tr('auto_pair_61'),  icon:'❌', color:'#ef4444' },
        ].map(s => (
          <div key={s.key} className="card" style={{ padding:'14px 16px', borderRight:`4px solid ${s.color}`, cursor:'pointer' }}
            onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}>
            <div style={{ fontSize:22 }}>{s.icon}</div>
            <div style={{ fontWeight:700, fontSize:18, color:s.color }}>{counts[s.key]}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-body" style={{ padding:'14px 20px' }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <div className="search-input-wrapper" style={{ flex:1, minWidth:200 }}>
              <FaSearch className="search-icon" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tr('auto_pair_62')} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {['all','confirmed','pending','completed','cancelled'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className="btn btn-sm"
                  style={{ background: statusFilter===s ? 'var(--primary)' : 'var(--bg-primary)', color: statusFilter===s ? 'white' : 'var(--text-secondary)', border:'1.5px solid', borderColor: statusFilter===s ? 'var(--primary)' : 'var(--border)' }}>
                  {s === 'all' ? (tr('auto_pair_63')) : (ar ? statusConfig[s]?.ar : statusConfig[s]?.en)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{tr('auto_pair_64')}</th>
                <th>{tr('auto_pair_65')}</th>
                <th>{tr('auto_pair_66')}</th>
                <th>{tr('auto_pair_67')}</th>
                <th>{tr('auto_pair_68')}</th>
                <th>{tr('auto_pair_69')}</th>
                <th>{tr('auto_pair_70')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7">
                  <div className="empty-state">
                    <div className="icon">📅</div>
                    <h3>{tr('auto_pair_71')}</h3>
                  </div>
                </td></tr>
              ) : pageItems.map(a => {
                const sl = getStatusLabel(a.status);
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight:600, fontSize:14 }}>{a.patient}</td>
                    <td style={{ fontSize:13 }}>{lang==="ar"?a.doctor:a.doctorEn||a.doctor}</td>
                    <td style={{ fontSize:12 }}><span className="badge badge-info">{lang==="ar"?a.department:a.departmentEn||a.department}</span></td>
                    <td style={{ fontSize:13 }}>{a.date} <span style={{ color:'var(--text-secondary)' }}>{a.time}</span></td>
                    <td style={{ fontSize:12 }}>{a.type==='checkup'?tr('visit_checkup'):a.type==='followup'?tr('visit_followup'):a.type==='consult'?tr('visit_consult'):a.type==='emergency'?tr('visit_emergency'):a.type==='كشف'?tr('visit_checkup'):a.type==='متابعة'?tr('visit_followup'):a.type}</td>
                    <td><span className={`badge ${sl.class}`}>{sl.label}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        {a.status === 'pending' && (
                          <button className="btn btn-sm" onClick={() => changeStatus(a.id,'confirmed')}
                            style={{ background:'#10b981', color:'white', padding:'4px 8px', fontSize:11 }} title={tr('auto_pair_72')}>
                            <FaCheck />
                          </button>
                        )}
                        {a.status === 'confirmed' && (
                          <button className="btn btn-sm" onClick={() => changeStatus(a.id,'completed')}
                            style={{ background:'#1a6bab', color:'white', padding:'4px 8px', fontSize:11 }} title={tr('auto_pair_73')}>
                            <FaClock />
                          </button>
                        )}
                        <button className="btn btn-sm" onClick={() => openEdit(a)}
                          style={{ background:'#8b5cf6', color:'white', padding:'4px 8px' }}>
                          <FaEdit />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(a.id)}
                          style={{ padding:'4px 8px' }}>
                          <FaTrash />
                        </button>
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

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:600 }}>
            <div className="modal-header">
              <h2 style={{ fontSize:18, fontWeight:700 }}>
                {modal==='add' ? (tr('auto_pair_74')) : (tr('auto_pair_75'))}
              </h2>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}><FaTimes /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{tr('auto_pair_76')}</label>
                  <input className="form-control" value={form.patient||''} onChange={e => setForm(p=>({...p,patient:e.target.value}))}
                    list="patients-list" placeholder={tr('auto_pair_77')} />
                  <datalist id="patients-list">{(patients||[]).map(p=><option key={p.id} value={p.name}/>)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('auto_pair_78')}</label>
                  <input className="form-control" value={form.doctor||''} onChange={e => setForm(p=>({...p,doctor:e.target.value}))}
                    list="doctors-list" placeholder={tr('auto_pair_79')} />
                  <datalist id="doctors-list">{(doctors||[]).map(d=><option key={d.id} value={lang==="ar"?d.name:d.nameEn||d.name}/>)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('auto_pair_80')}</label>
                  <input className="form-control" value={form.department||''} onChange={e => setForm(p=>({...p,department:e.target.value}))} />
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
                  <label className="form-label">{tr('auto_pair_81')}</label>
                  <select className="form-control" value={form.type||'checkup'} onChange={e => setForm(p=>({...p,type:e.target.value}))}>
                    {visitTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('auto_pair_82')}</label>
                  <input className="form-control" type="date" value={form.date||''} onChange={e => setForm(p=>({...p,date:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('auto_pair_83')}</label>
                  <input className="form-control" type="time" value={form.time||'09:00'} onChange={e => setForm(p=>({...p,time:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('auto_pair_84')}</label>
                  <select className="form-control" value={form.status||'pending'} onChange={e => setForm(p=>({...p,status:e.target.value}))}>
                    {Object.entries(statusConfig).map(([k,v]) => <option key={k} value={k}>{ar ? v.ar : v.en}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{tr('auto_pair_85')}</label>
                <textarea className="form-control" rows={3} value={form.notes||''} onChange={e => setForm(p=>({...p,notes:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>{tr('auto_pair_86')}</button>
              <button className="btn btn-primary" onClick={handleSave}>{tr('auto_pair_87')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:420 }}>
            <div className="modal-body" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:56, marginBottom:16 }}>⚠️</div>
              <h3 style={{ fontSize:20, marginBottom:8 }}>{tr('auto_pair_88')}</h3>
              <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:24 }}>
                {tr('auto_pair_89')}
              </p>
              <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>{tr('auto_pair_90')}</button>
                <button className="btn btn-danger" onClick={handleDelete}>{tr('auto_pair_91')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
