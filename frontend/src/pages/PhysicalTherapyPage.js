/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { FaPlus, FaEdit, FaTrash, FaDumbbell, FaWalking } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';

// إصلاح تباين: التدرّج الأصلي كان يعطي تحت 4.5:1 (WCAG AA) لنص العنوان
// الفرعي (أبيض بأوباسيتي 0.85) — النسخة الأغمق هذي تعطي 5.77:1/7.34:1.
const BANNER_GRADIENT = 'linear-gradient(135deg, #155e75 0%, #0c4a6e 100%)';

const emptyEquip = { name: '', nameEn: '', type: '', status: 'available', notes: '' };
const emptySession = { patientName: '', therapist: '', date: new Date().toISOString().split('T')[0], equipmentUsed: '', treatmentType: '', duration: '', notes: '', progress: '' };

export default function PhysicalTherapyPage() {
  const { lang, showToast, syncToServer, confirmDialog, user, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [tab, setTab] = useState('sessions');
  const [equipment, setEquipment] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([api.get('/ptEquipment'), api.get('/ptSessions')]).then(([e, s]) => {
      if (cancelled) return;
      if (Array.isArray(e)) setEquipment(e);
      if (Array.isArray(s)) setSessions(s);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── الأجهزة ──────────────────────────────────────────────────────────────
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [editingEquip, setEditingEquip] = useState(null);
  const [equipForm, setEquipForm] = useState(emptyEquip);
  const openAddEquip = () => { setEditingEquip(null); setEquipForm(emptyEquip); setShowEquipModal(true); };
  const openEditEquip = (e) => { setEditingEquip(e); setEquipForm({ ...e }); setShowEquipModal(true); };
  const saveEquip = async () => {
    if (!equipForm.name) { showToast(L('يرجى إدخال اسم الجهاز', 'Please enter equipment name'), 'error'); return; }
    const prev = equipment;
    if (editingEquip) {
      const ue = { ...equipForm, id: editingEquip.id };
      setEquipment(p => p.map(x => x.id === editingEquip.id ? ue : x));
      const ok = await syncToServer('ptEquipment', 'update', ue);
      if (!ok) { setEquipment(prev); return; }
      showToast(L('تم التحديث', 'Updated'), 'success');
    } else {
      const ne = { ...equipForm, id: Date.now() };
      setEquipment(p => [...p, ne]);
      const synced = await syncToServer('ptEquipment', 'create', ne);
      if (!synced) { setEquipment(prev); return; }
      if (typeof synced === 'object' && synced.id !== ne.id) setEquipment(p => p.map(x => x.id === ne.id ? synced : x));
      showToast(L('تمت إضافة الجهاز', 'Equipment added'), 'success');
    }
    setShowEquipModal(false);
  };
  const delEquip = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')))) return;
    const prev = equipment;
    setEquipment(p => p.filter(x => x.id !== id));
    const ok = await syncToServer('ptEquipment', 'delete', { id });
    if (!ok) { setEquipment(prev); return; }
    showToast(L('تم الحذف', 'Deleted'), 'info');
  };

  // ── الجلسات ──────────────────────────────────────────────────────────────
  const [showSessModal, setShowSessModal] = useState(false);
  const [editingSess, setEditingSess] = useState(null);
  const [sessForm, setSessForm] = useState(emptySession);
  const [search, setSearch] = useState('');
  const [showEquipImport, setShowEquipImport] = useState(false);
  const [showSessImport, setShowSessImport] = useState(false);
  const openAddSess = () => { setEditingSess(null); setSessForm(emptySession); setShowSessModal(true); };
  const openEditSess = (s) => { setEditingSess(s); setSessForm({ ...s }); setShowSessModal(true); };
  const saveSess = async () => {
    if (!sessForm.patientName || !sessForm.date) { showToast(L('يرجى إدخال اسم المريض والتاريخ', 'Please enter patient name and date'), 'error'); return; }
    const prev = sessions;
    if (editingSess) {
      const us = { ...sessForm, id: editingSess.id };
      setSessions(p => p.map(x => x.id === editingSess.id ? us : x));
      const ok = await syncToServer('ptSessions', 'update', us);
      if (!ok) { setSessions(prev); return; }
      showToast(L('تم التحديث', 'Updated'), 'success');
    } else {
      const ns = { ...sessForm, id: Date.now() };
      setSessions(p => [...p, ns]);
      const synced = await syncToServer('ptSessions', 'create', ns);
      if (!synced) { setSessions(prev); return; }
      if (typeof synced === 'object' && synced.id !== ns.id) setSessions(p => p.map(x => x.id === ns.id ? synced : x));
      showToast(L('تمت إضافة الجلسة', 'Session added'), 'success');
    }
    setShowSessModal(false);
  };
  const delSess = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')))) return;
    const prev = sessions;
    setSessions(p => p.filter(x => x.id !== id));
    const ok = await syncToServer('ptSessions', 'delete', { id });
    if (!ok) { setSessions(prev); return; }
    showToast(L('تم الحذف', 'Deleted'), 'info');
  };

  const statusColor = (s) => ({ available: '#22c55e', in_use: '#3b82f6', maintenance: '#f59e0b', out_of_order: '#ef4444' }[s] || '#6b7280');
  const statusLabel = (s) => ({ available: L('متاح', 'Available'), in_use: L('قيد الاستخدام', 'In Use'), maintenance: L('صيانة', 'Maintenance'), out_of_order: L('معطّل', 'Out of Order') }[s] || s);

  const filteredSessions = filterByViewingHospital(sessions).filter(s => !search || s.patientName?.toLowerCase().includes(search.toLowerCase()));
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filteredSessions, 50);

  const stats = {
    equipCount: equipment.length,
    available: equipment.filter(e => e.status === 'available').length,
    sessionsToday: sessions.filter(s => s.date === new Date().toISOString().split('T')[0]).length,
    sessionsTotal: sessions.length,
  };

  return (
    <div className="page-content">
      <PageBanner icon="🏃" title={L('العلاج الطبيعي', 'Physical Therapy')} subtitle={L('إدارة الأجهزة وجلسات العلاج', 'Manage equipment and treatment sessions')} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{stats.available}/{stats.equipCount}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{L('أجهزة متاحة', 'Available equipment')}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{stats.sessionsToday}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{L('جلسات اليوم', "Today's sessions")}</div></div>
        </div>
      </PageBanner>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('sessions')} className={tab === 'sessions' ? 'btn btn-primary' : 'btn btn-outline'}>{L('الجلسات', 'Sessions')}</button>
        <button onClick={() => setTab('equipment')} className={tab === 'equipment' ? 'btn btn-primary' : 'btn btn-outline'}>{L('الأجهزة', 'Equipment')}</button>
      </div>

      {tab === 'equipment' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0 }}>{L('أجهزة العلاج الطبيعي', 'Physical Therapy Equipment')}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowEquipImport(true)} className="btn btn-outline">📊 {L('استيراد من Excel', 'Import from Excel')}</button>
              <ExcelExportButton apiName="ptEquipment" lang={lang} onError={(m) => showToast(m, 'error')} />
              <button onClick={openAddEquip} className="btn btn-primary"><FaPlus /> {L('جهاز جديد', 'New Equipment')}</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {equipment.map(e => (
              <div key={e.id} style={{ padding: 16, borderRadius: 10, background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong><FaDumbbell /> {lang === 'ar' ? e.name : (e.nameEn || e.name)}</strong>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEditEquip(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab' }}><FaEdit /></button>
                    <button onClick={() => delEquip(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                  </div>
                </div>
                {e.type && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{e.type}</div>}
                <span style={{ display: 'inline-block', marginTop: 8, background: `${statusColor(e.status)}15`, color: statusColor(e.status), padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{statusLabel(e.status)}</span>
                {e.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{e.notes}</div>}
              </div>
            ))}
            {equipment.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{L('لا توجد أجهزة بعد', 'No equipment yet')}</p>}
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <>
          <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('بحث باسم المريض...', 'Search by patient name...')} className="form-control" style={{ flex: 1, minWidth: 180 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSessImport(true)} className="btn btn-outline">📊 {L('استيراد من Excel', 'Import from Excel')}</button>
              <ExcelExportButton apiName="ptSessions" lang={lang} onError={(m) => showToast(m, 'error')} />
              <button onClick={openAddSess} className="btn btn-primary"><FaPlus /> {L('جلسة جديدة', 'New Session')}</button>
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{L('المريض', 'Patient')}</th>
                    <th>{L('المعالج', 'Therapist')}</th>
                    <th>{L('التاريخ', 'Date')}</th>
                    <th>{L('نوع العلاج', 'Treatment Type')}</th>
                    <th>{L('الجهاز المستخدم', 'Equipment Used')}</th>
                    <th>{L('المدة', 'Duration')}</th>
                    <th>{L('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}><FaWalking /> {s.patientName}</td>
                      <td>{s.therapist || '—'}</td>
                      <td>{s.date}</td>
                      <td>{s.treatmentType || '—'}</td>
                      <td>{s.equipmentUsed || '—'}</td>
                      <td>{s.duration ? `${s.duration} ${L('دقيقة', 'min')}` : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => openEditSess(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab' }}><FaEdit /></button>
                          <button onClick={() => delSess(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSessions.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{L('لا توجد بيانات', 'No data')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
          </div>
        </>
      )}

      {/* نافذة جهاز */}
      {showEquipModal && (
        <div className="modal-overlay" onClick={() => setShowEquipModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingEquip ? L('تعديل جهاز', 'Edit Equipment') : L('جهاز جديد', 'New Equipment')}</h3>
              <button onClick={() => setShowEquipModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <label className="form-label">{L('اسم الجهاز', 'Equipment name')} *</label>
              <input value={equipForm.name} onChange={e => setEquipForm(p => ({ ...p, name: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <label className="form-label">{L('النوع', 'Type')}</label>
              <input value={equipForm.type} onChange={e => setEquipForm(p => ({ ...p, type: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <label className="form-label">{L('الحالة', 'Status')}</label>
              <select value={equipForm.status} onChange={e => setEquipForm(p => ({ ...p, status: e.target.value }))} className="form-control" style={{ marginBottom: 10 }}>
                <option value="available">{L('متاح', 'Available')}</option>
                <option value="in_use">{L('قيد الاستخدام', 'In Use')}</option>
                <option value="maintenance">{L('صيانة', 'Maintenance')}</option>
                <option value="out_of_order">{L('معطّل', 'Out of Order')}</option>
              </select>
              <label className="form-label">{L('ملاحظات', 'Notes')}</label>
              <textarea value={equipForm.notes} onChange={e => setEquipForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEquipModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveEquip} className="btn btn-primary">{L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة جلسة */}
      {showSessModal && (
        <div className="modal-overlay" onClick={() => setShowSessModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingSess ? L('تعديل جلسة', 'Edit Session') : L('جلسة جديدة', 'New Session')}</h3>
              <button onClick={() => setShowSessModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('اسم المريض', 'Patient name')} *</label>
                  <input value={sessForm.patientName} onChange={e => setSessForm(p => ({ ...p, patientName: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('المعالج', 'Therapist')}</label>
                  <input value={sessForm.therapist} onChange={e => setSessForm(p => ({ ...p, therapist: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('التاريخ', 'Date')} *</label>
                  <input type="date" value={sessForm.date} onChange={e => setSessForm(p => ({ ...p, date: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('نوع العلاج', 'Treatment type')}</label>
                  <input value={sessForm.treatmentType} onChange={e => setSessForm(p => ({ ...p, treatmentType: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('الجهاز المستخدم', 'Equipment used')}</label>
                  <select value={sessForm.equipmentUsed} onChange={e => setSessForm(p => ({ ...p, equipmentUsed: e.target.value }))} className="form-control">
                    <option value="">—</option>
                    {equipment.map(eq => <option key={eq.id} value={lang === 'ar' ? eq.name : (eq.nameEn || eq.name)}>{lang === 'ar' ? eq.name : (eq.nameEn || eq.name)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{L('المدة (دقيقة)', 'Duration (min)')}</label>
                  <input type="number" value={sessForm.duration} onChange={e => setSessForm(p => ({ ...p, duration: e.target.value }))} className="form-control" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('التقدّم الملاحَظ', 'Observed progress')}</label>
                  <textarea value={sessForm.progress} onChange={e => setSessForm(p => ({ ...p, progress: e.target.value }))} rows={2} className="form-control" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('ملاحظات', 'Notes')}</label>
                  <textarea value={sessForm.notes} onChange={e => setSessForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowSessModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveSess} className="btn btn-primary">{L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {showEquipImport && (
        <ExcelImportModal
          apiName="ptEquipment"
          title={L('استيراد أجهزة من Excel', 'Import Equipment from Excel')}
          lang={lang}
          onClose={() => setShowEquipImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/ptEquipment');
              if (Array.isArray(fresh)) setEquipment(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      {showSessImport && (
        <ExcelImportModal
          apiName="ptSessions"
          title={L('استيراد جلسات من Excel', 'Import Sessions from Excel')}
          lang={lang}
          onClose={() => setShowSessImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/ptSessions');
              if (Array.isArray(fresh)) setSessions(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}
    </div>
  );
}
