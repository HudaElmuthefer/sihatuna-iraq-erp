/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { FaPlus, FaEdit, FaTrash, FaBaby, FaSyringe, FaBed, FaFileExcel } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)';

const today = new Date().toISOString().split('T')[0];

// نموذج الإدخال المبدئي (الأم قبل الولادة) — حقول قليلة ومباشرة
const emptyAdmission = {
  motherName: '', motherAge: '', admissionDate: today, expectedDate: '', admissionNotes: '',
  stage: 'admitted',
};

// النموذج الكامل (إتمام الولادة أو تعديل سجل موجود)
const emptyFull = {
  motherName: '', motherAge: '', admissionDate: today, expectedDate: '', admissionNotes: '',
  deliveryDate: today, deliveryTime: '',
  deliveryType: 'normal', attendingDoctor: '', midwife: '',
  babyName: '', babyGender: '', babyWeight: '', apgarScore: '', complications: '',
  motherStatus: 'stable', babyStatus: 'healthy', notes: '',
  stage: 'delivered', firstVaccineGiven: false,
};

const emptyVaccine = { vaccine: 'BCG', date: today };

export default function DeliveryRoomPage() {
  const { lang, showToast, syncToServer, confirmDialog, user, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [records, setRecords] = useState([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/deliveries').then(data => { if (!cancelled && Array.isArray(data)) setRecords(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState('admitted'); // admitted | delivered
  const [showAdmModal, setShowAdmModal] = useState(false); // نافذة إدخال أم جديدة (قبل الولادة)
  const [showFullModal, setShowFullModal] = useState(false); // نافذة إتمام/تعديل الولادة كاملة
  const [editing, setEditing] = useState(null);
  const [admForm, setAdmForm] = useState(emptyAdmission);
  const [fullForm, setFullForm] = useState(emptyFull);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);

  // ── إدخال الأم قبل الولادة ───────────────────────────────────────────────
  const openAddAdmission = () => { setAdmForm(emptyAdmission); setShowAdmModal(true); };
  const saveAdmission = async () => {
    if (!admForm.motherName) { showToast(L('يرجى إدخال اسم الأم', 'Please enter mother name'), 'error'); return; }
    const nr = { ...admForm, id: Date.now() };
    const prev = records;
    setRecords(p => [...p, nr]);
    const synced = await syncToServer('deliveries', 'create', nr);
    if (!synced) { setRecords(prev); return; }
    if (typeof synced === 'object' && synced.id !== nr.id) setRecords(p => p.map(r => r.id === nr.id ? synced : r));
    showToast(L('تم تسجيل دخول الأم للردهة', 'Mother admission recorded'), 'success');
    setShowAdmModal(false);
  };

  // ── إتمام الولادة (من مرحلة "قبل" إلى "بعد") أو تعديل سجل كامل ──────────
  const openCompleteDelivery = (r) => { setEditing(r); setFullForm({ ...emptyFull, ...r, stage: 'delivered' }); setShowFullModal(true); };
  const openEditFull = (r) => { setEditing(r); setFullForm({ ...emptyFull, ...r }); setShowFullModal(true); };
  // إصلاح: ما كان فيه طريقة تسجيل ولادة مباشرة بدون المرور بمرحلة "قبل
  // الولادة" أولاً — يمنع تسجيل ولادات فعلية (حالات طارئة، أو بيانات سابقة)
  // ما مرّت بتلك المرحلة بالنظام. الآن زر "ولادة جديدة" بتبويب السجلات نفسه
  // يفتح نفس النموذج الكامل مباشرة بلا حاجة لسجل دخول مسبق.
  const openNewDelivery = () => { setEditing(null); setFullForm(emptyFull); setShowFullModal(true); };
  const saveFull = async () => {
    if (!fullForm.motherName || !fullForm.deliveryDate) { showToast(L('يرجى إدخال اسم الأم وتاريخ الولادة', 'Please enter mother name and delivery date'), 'error'); return; }
    const prev = records;
    if (editing) {
      const ur = { ...fullForm, id: editing.id };
      setRecords(p => p.map(r => r.id === editing.id ? ur : r));
      const ok = await syncToServer('deliveries', 'update', ur);
      if (!ok) { setRecords(prev); return; }
      showToast(L('تم الحفظ', 'Saved'), 'success');
    } else {
      const nr = { ...fullForm, id: Date.now() };
      setRecords(p => [...p, nr]);
      const synced = await syncToServer('deliveries', 'create', nr);
      if (!synced) { setRecords(prev); return; }
      if (typeof synced === 'object' && synced.id !== nr.id) setRecords(p => p.map(r => r.id === nr.id ? synced : r));
      showToast(L('تم تسجيل الولادة', 'Delivery recorded'), 'success');
    }
    setShowFullModal(false);
    setEditing(null);
  };

  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')))) return;
    const prev = records;
    setRecords(p => p.filter(r => r.id !== id));
    const ok = await syncToServer('deliveries', 'delete', { id });
    if (!ok) { setRecords(prev); return; }
    showToast(L('تم الحذف', 'Deleted'), 'info');
  };

  // ── تسجيل الطفل ولقاحه الأول ─────────────────────────────────────────────
  // يُنشئ سجل تطعيم حقيقي بموديول التطعيمات نفسه (نفس الجدول اللي تشوفينه
  // بصفحة "التطعيمات")، مو مجرد علامة داخل سجل الولادة — حتى يظهر الطفل
  // ضمن سجلات التطعيم العامة للمستشفى مثل أي مريض ثاني.
  const [vaccineFor, setVaccineFor] = useState(null); // السجل المفتوح حالياً لتسجيل لقاحه
  const [vaccineForm, setVaccineForm] = useState(emptyVaccine);
  const openVaccine = (r) => { setVaccineFor(r); setVaccineForm(emptyVaccine); };
  const saveVaccine = async () => {
    if (!vaccineFor.babyName) { showToast(L('يرجى إدخال اسم الطفل أولاً بسجل الولادة', "Please enter the baby's name in the delivery record first"), 'error'); return; }
    const nv = { id: Date.now(), patient: vaccineFor.babyName, vaccine: vaccineForm.vaccine, dose: L('الجرعة الأولى', '1st Dose'), date: vaccineForm.date, provider: vaccineFor.attendingDoctor || '', status: 'completed', notes: L('اللقاح الأول عند الولادة', 'First vaccine at birth') };
    const synced = await syncToServer('vaccinations', 'create', nv);
    if (!synced) return;
    const prev = records;
    const updated = { ...vaccineFor, firstVaccineGiven: true };
    setRecords(p => p.map(r => r.id === vaccineFor.id ? updated : r));
    const ok = await syncToServer('deliveries', 'update', updated);
    if (!ok) { setRecords(prev); }
    showToast(L('تم تسجيل اللقاح الأول للطفل', "Baby's first vaccine recorded"), 'success');
    setVaccineFor(null);
  };

  const typeLabel = (t) => ({ normal: L('طبيعية', 'Normal'), cesarean: L('قيصرية', 'Cesarean') }[t] || t);
  const motherStatusColor = (s) => ({ stable: '#22c55e', critical: '#ef4444', observation: '#f59e0b' }[s] || '#6b7280');
  const motherStatusLabel = (s) => ({ stable: L('مستقرة', 'Stable'), critical: L('حرجة', 'Critical'), observation: L('تحت المراقبة', 'Under Observation') }[s] || s);
  const babyStatusColor = (s) => ({ healthy: '#22c55e', nicu: '#f59e0b', critical: '#ef4444' }[s] || '#6b7280');
  const babyStatusLabel = (s) => ({ healthy: L('سليم', 'Healthy'), nicu: L('حاضنة', 'NICU'), critical: L('حرج', 'Critical') }[s] || s);

  const visible = filterByViewingHospital(records);
  const admitted = visible.filter(r => r.stage !== 'delivered' && (!search || r.motherName?.toLowerCase().includes(search.toLowerCase())));
  const delivered = visible.filter(r => r.stage === 'delivered' && (!search || r.motherName?.toLowerCase().includes(search.toLowerCase()) || r.babyName?.toLowerCase().includes(search.toLowerCase())));
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(delivered, 50);

  const stats = {
    admitted: admitted.length,
    total: delivered.length,
    thisMonth: delivered.filter(r => r.deliveryDate?.slice(0, 7) === new Date().toISOString().slice(0, 7)).length,
    nicu: delivered.filter(r => r.babyStatus === 'nicu' || r.babyStatus === 'critical').length,
  };

  return (
    <div className="page-content">
      <PageBanner icon="👶" title={L('صالة الولادة', 'Delivery Room')} subtitle={L('من دخول الأم قبل الولادة إلى تسجيل الطفل ولقاحه الأول', "From the mother's admission through the baby's first vaccine")} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowImport(true)} className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, border: '1px solid rgba(255,255,255,0.5)' }}>
            <FaFileExcel /> {L('استيراد من Excel', 'Import from Excel')}
          </button>
          <ExcelExportButton apiName="deliveries" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
          <button onClick={openAddAdmission} className="btn" style={{ background: '#fff', color: '#db2777', fontWeight: 600 }}><FaBed /> {L('دخول أم جديدة', 'New Mother Admission')}</button>
        </div>
      </PageBanner>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: L('أمهات قبل الولادة', 'Mothers Before Delivery'), val: stats.admitted, color: '#8b5cf6', icon: '🤰' },
          { label: L('إجمالي الولادات', 'Total Deliveries'), val: stats.total, color: '#ec4899', icon: '👶' },
          { label: L('هذا الشهر', 'This Month'), val: stats.thisMonth, color: '#1a6bab', icon: '📅' },
          { label: L('بالحاضنة/حرجة', 'NICU/Critical'), val: stats.nicu, color: '#ef4444', icon: '⚠️' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('admitted')} className={tab === 'admitted' ? 'btn btn-primary' : 'btn btn-outline'}>🤰 {L('قبل الولادة', 'Before Delivery')} ({admitted.length})</button>
        <button onClick={() => setTab('delivered')} className={tab === 'delivered' ? 'btn btn-primary' : 'btn btn-outline'}>👶 {L('سجلات الولادة', 'Delivery Records')} ({delivered.length})</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('بحث باسم الأم أو الطفل...', 'Search by mother or baby name...')} className="form-control" />
      </div>

      {/* ── تبويب: قبل الولادة ── */}
      {tab === 'admitted' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{L('اسم الأم', 'Mother Name')}</th>
                  <th>{L('العمر', 'Age')}</th>
                  <th>{L('تاريخ الدخول', 'Admission Date')}</th>
                  <th>{L('الموعد المتوقع', 'Expected Date')}</th>
                  <th>{L('ملاحظات', 'Notes')}</th>
                  <th>{L('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {admitted.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.motherName}</td>
                    <td>{r.motherAge || '—'}</td>
                    <td>{r.admissionDate}</td>
                    <td>{r.expectedDate || '—'}</td>
                    <td>{r.admissionNotes || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openCompleteDelivery(r)} className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}><FaBaby /> {L('إتمام الولادة', 'Complete Delivery')}</button>
                        <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {admitted.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{L('لا توجد أمهات مسجَّلات قبل الولادة حالياً', 'No mothers currently admitted before delivery')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── تبويب: سجلات الولادة ── */}
      {tab === 'delivered' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16, paddingBottom: 0 }}>
            <button onClick={openNewDelivery} className="btn btn-primary"><FaPlus /> {L('ولادة جديدة', 'New Delivery')}</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{L('الأم', 'Mother')}</th>
                  <th>{L('تاريخ الولادة', 'Delivery Date')}</th>
                  <th>{L('نوع الولادة', 'Type')}</th>
                  <th>{L('الطبيب', 'Doctor')}</th>
                  <th>{L('المولود', 'Baby')}</th>
                  <th>{L('حالة الأم', 'Mother Status')}</th>
                  <th>{L('حالة المولود', 'Baby Status')}</th>
                  <th>{L('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.motherName}</td>
                    <td>{r.deliveryDate} {r.deliveryTime && `— ${r.deliveryTime}`}</td>
                    <td>{typeLabel(r.deliveryType)}</td>
                    <td>{r.attendingDoctor || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.babyName || L('بلا اسم بعد', 'Not yet named')}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {r.babyGender && (r.babyGender === 'male' ? L('ذكر', 'Male') : L('أنثى', 'Female'))} {r.babyWeight && `— ${r.babyWeight}kg`}
                      </div>
                    </td>
                    <td><span style={{ background: `${motherStatusColor(r.motherStatus)}15`, color: motherStatusColor(r.motherStatus), padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{motherStatusLabel(r.motherStatus)}</span></td>
                    <td><span style={{ background: `${babyStatusColor(r.babyStatus)}15`, color: babyStatusColor(r.babyStatus), padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{babyStatusLabel(r.babyStatus)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {r.babyName && !r.firstVaccineGiven && (
                          <button onClick={() => openVaccine(r)} title={L('تسجيل اللقاح الأول', "Register first vaccine")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b' }}><FaSyringe /></button>
                        )}
                        {r.firstVaccineGiven && <span title={L('أُعطي اللقاح الأول', 'First vaccine given')} style={{ color: '#22c55e' }}><FaSyringe /></span>}
                        <button onClick={() => openEditFull(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab' }}><FaEdit /></button>
                        <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {delivered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{L('لا توجد سجلات ولادة بعد', 'No delivery records yet')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
        </div>
      )}

      {/* نافذة دخول أم جديدة (قبل الولادة) */}
      {showAdmModal && (
        <div className="modal-overlay" onClick={() => setShowAdmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}><FaBed /> {L('دخول أم جديدة للردهة', 'New Mother Admission')}</h3>
              <button onClick={() => setShowAdmModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <label className="form-label">{L('اسم الأم', 'Mother name')} *</label>
              <input value={admForm.motherName} onChange={e => setAdmForm(p => ({ ...p, motherName: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="form-label">{L('عمر الأم', 'Mother age')}</label>
                  <input type="number" value={admForm.motherAge} onChange={e => setAdmForm(p => ({ ...p, motherAge: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('تاريخ الدخول', 'Admission date')}</label>
                  <input type="date" value={admForm.admissionDate} onChange={e => setAdmForm(p => ({ ...p, admissionDate: e.target.value }))} className="form-control" />
                </div>
              </div>
              <label className="form-label">{L('الموعد المتوقع للولادة', 'Expected delivery date')}</label>
              <input type="date" value={admForm.expectedDate} onChange={e => setAdmForm(p => ({ ...p, expectedDate: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <label className="form-label">{L('ملاحظات', 'Notes')}</label>
              <textarea value={admForm.admissionNotes} onChange={e => setAdmForm(p => ({ ...p, admissionNotes: e.target.value }))} rows={2} className="form-control" />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAdmModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveAdmission} className="btn btn-primary">{L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إتمام/تعديل الولادة كاملة */}
      {showFullModal && (
        <div className="modal-overlay" onClick={() => setShowFullModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}><FaBaby /> {!editing ? L('ولادة جديدة', 'New Delivery') : editing.stage !== 'delivered' ? L('إتمام الولادة', 'Complete Delivery') : L('تعديل سجل الولادة', 'Edit Delivery Record')}</h3>
              <button onClick={() => setShowFullModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('اسم الأم', 'Mother name')} *</label>
                  <input value={fullForm.motherName} onChange={e => setFullForm(p => ({ ...p, motherName: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('عمر الأم', 'Mother age')}</label>
                  <input type="number" value={fullForm.motherAge} onChange={e => setFullForm(p => ({ ...p, motherAge: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('تاريخ الدخول', 'Admission date')}</label>
                  <input type="date" value={fullForm.admissionDate} onChange={e => setFullForm(p => ({ ...p, admissionDate: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('تاريخ الولادة', 'Delivery date')} *</label>
                  <input type="date" value={fullForm.deliveryDate} onChange={e => setFullForm(p => ({ ...p, deliveryDate: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('وقت الولادة', 'Delivery time')}</label>
                  <input type="time" value={fullForm.deliveryTime} onChange={e => setFullForm(p => ({ ...p, deliveryTime: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('نوع الولادة', 'Delivery type')}</label>
                  <select value={fullForm.deliveryType} onChange={e => setFullForm(p => ({ ...p, deliveryType: e.target.value }))} className="form-control">
                    <option value="normal">{L('طبيعية', 'Normal')}</option>
                    <option value="cesarean">{L('قيصرية', 'Cesarean')}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{L('الطبيب المشرف', 'Attending doctor')}</label>
                  <input value={fullForm.attendingDoctor} onChange={e => setFullForm(p => ({ ...p, attendingDoctor: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{L('القابلة', 'Midwife')}</label>
                  <input value={fullForm.midwife} onChange={e => setFullForm(p => ({ ...p, midwife: e.target.value }))} className="form-control" />
                </div>
                <div style={{ gridColumn: '1/-1', borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <strong style={{ fontSize: 13 }}>👶 {L('بيانات المولود', 'Baby Details')}</strong>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('اسم الطفل', 'Baby name')}</label>
                  <input value={fullForm.babyName} onChange={e => setFullForm(p => ({ ...p, babyName: e.target.value }))} className="form-control" placeholder={L('اسم المولود (اختياري إن لم يُسمَّ بعد)', "Baby's name (optional if not yet named)")} />
                </div>
                <div>
                  <label className="form-label">{L('جنس المولود', 'Baby gender')}</label>
                  <select value={fullForm.babyGender} onChange={e => setFullForm(p => ({ ...p, babyGender: e.target.value }))} className="form-control">
                    <option value="">—</option>
                    <option value="male">{L('ذكر', 'Male')}</option>
                    <option value="female">{L('أنثى', 'Female')}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{L('وزن المولود (كغم)', 'Baby weight (kg)')}</label>
                  <input type="number" step="0.01" value={fullForm.babyWeight} onChange={e => setFullForm(p => ({ ...p, babyWeight: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">Apgar Score</label>
                  <input value={fullForm.apgarScore} onChange={e => setFullForm(p => ({ ...p, apgarScore: e.target.value }))} className="form-control" placeholder="9/10" />
                </div>
                <div>
                  <label className="form-label">{L('حالة الأم', "Mother's status")}</label>
                  <select value={fullForm.motherStatus} onChange={e => setFullForm(p => ({ ...p, motherStatus: e.target.value }))} className="form-control">
                    <option value="stable">{L('مستقرة', 'Stable')}</option>
                    <option value="observation">{L('تحت المراقبة', 'Under Observation')}</option>
                    <option value="critical">{L('حرجة', 'Critical')}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{L('حالة المولود', "Baby's status")}</label>
                  <select value={fullForm.babyStatus} onChange={e => setFullForm(p => ({ ...p, babyStatus: e.target.value }))} className="form-control">
                    <option value="healthy">{L('سليم', 'Healthy')}</option>
                    <option value="nicu">{L('حاضنة', 'NICU')}</option>
                    <option value="critical">{L('حرج', 'Critical')}</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('مضاعفات', 'Complications')}</label>
                  <textarea value={fullForm.complications} onChange={e => setFullForm(p => ({ ...p, complications: e.target.value }))} rows={2} className="form-control" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{L('ملاحظات', 'Notes')}</label>
                  <textarea value={fullForm.notes} onChange={e => setFullForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowFullModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveFull} className="btn btn-primary">{L('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تسجيل اللقاح الأول للطفل */}
      {vaccineFor && (
        <div className="modal-overlay" onClick={() => setVaccineFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}><FaSyringe /> {L('تسجيل اللقاح الأول', "Register Baby's First Vaccine")}</h3>
              <button onClick={() => setVaccineFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                {L('للطفل', 'For baby')}: <strong>{vaccineFor.babyName}</strong> ({L('ابن/ابنة', 'child of')} {vaccineFor.motherName})
              </p>
              <label className="form-label">{L('اللقاح', 'Vaccine')}</label>
              <select value={vaccineForm.vaccine} onChange={e => setVaccineForm(p => ({ ...p, vaccine: e.target.value }))} className="form-control" style={{ marginBottom: 10 }}>
                <option value="BCG">BCG (السل)</option>
                <option value="Hepatitis B">التهاب الكبد B (الجرعة الأولى)</option>
                <option value="OPV">شلل الأطفال (الجرعة الأولى)</option>
              </select>
              <label className="form-label">{L('تاريخ الإعطاء', 'Date given')}</label>
              <input type="date" value={vaccineForm.date} onChange={e => setVaccineForm(p => ({ ...p, date: e.target.value }))} className="form-control" />
            </div>
            <div className="modal-footer">
              <button onClick={() => setVaccineFor(null)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={saveVaccine} className="btn btn-primary">{L('تسجيل', 'Register')}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ExcelImportModal
          apiName="deliveries"
          title={L('استيراد سجلات الولادة من Excel', 'Import Delivery Records from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/deliveries');
              if (Array.isArray(fresh)) setRecords(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}
    </div>
  );
}
