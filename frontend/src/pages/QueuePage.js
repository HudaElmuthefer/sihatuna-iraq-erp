/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import { FaPlus, FaTrash, FaBullhorn, FaCheckCircle, FaUserClock, FaExclamationTriangle } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';

// إصلاح تباين: التدرّج الأصلي كان يعطي تحت 4.5:1 (WCAG AA) لنص العنوان
// الفرعي (أبيض بأوباسيتي 0.85) — النسخة الأغمق هذه تعطي 6.04:1/7.49:1.
const BANNER_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #064e3b 100%)';

const empty = { patientName: '', department: '', priority: 'normal', notes: '' };

export default function QueuePage() {
  const { lang, showToast, syncToServer, confirmDialog, user, departments, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [tickets, setTickets] = useState([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/queueTickets').then(data => { if (!cancelled && Array.isArray(data)) setTickets(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(empty);
  const [deptFilter, setDeptFilter] = useState('all');

  // ── إصلاح: toISOString() يحوّل الوقت لتوقيت UTC قبل الحساب — ببغداد
  // (UTC+3) هذا يعني قرب منتصف الليل يُحسَب "اليوم" على أنه أمس فعلياً
  // (مثلاً 12:07 صباحاً 24/7 بغداد = 9:07 مساءً 23/7 UTC)، فتختفي تذاكر
  // اليوم كلها من العرض رغم كونها محفوظة بشكل صحيح. نحسب التاريخ محلياً الآن.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todaysTickets = filterByViewingHospital(tickets).filter(t => (t.createdAt || '').slice(0, 10) === today);

  const openAdd = () => { setForm(empty); setShowModal(true); };

  const save = async () => {
    if (!form.patientName || !form.department) { showToast(L('يرجى إدخال اسم المريض والقسم', 'Please enter patient name and department'), 'error'); return; }
    // رقم تذكرة تسلسلي لكل قسم يومياً (يبدأ من 1 كل يوم لكل قسم)
    const deptToday = todaysTickets.filter(t => t.department === form.department);
    const maxNo = deptToday.reduce((max, t) => Math.max(max, +t.ticketNo || 0), 0);
    const nt = { ...form, id: Date.now(), ticketNo: maxNo + 1, status: 'waiting', createdAt: new Date().toISOString(), calledAt: null, servedAt: null, calledBy: null };
    const prev = tickets;
    setTickets(p => [...p, nt]);
    const synced = await syncToServer('queueTickets', 'create', nt);
    if (!synced) { setTickets(prev); return; }
    if (typeof synced === 'object' && synced.id !== nt.id) setTickets(p => p.map(x => x.id === nt.id ? synced : x));
    showToast(L(`تم إصدار التذكرة رقم ${nt.ticketNo}`, `Ticket #${nt.ticketNo} issued`), 'success');
    setShowModal(false);
  };

  const updateStatus = async (ticket, status) => {
    const prev = tickets;
    const changed = {
      ...ticket, status,
      calledAt: status === 'called' ? new Date().toISOString() : ticket.calledAt,
      servedAt: status === 'served' ? new Date().toISOString() : ticket.servedAt,
      calledBy: status === 'called' ? (user?.name || null) : ticket.calledBy,
    };
    setTickets(p => p.map(t => t.id === ticket.id ? changed : t));
    const ok = await syncToServer('queueTickets', 'update', changed);
    if (!ok) { setTickets(prev); return; }
  };

  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')))) return;
    const prev = tickets;
    setTickets(p => p.filter(t => t.id !== id));
    const ok = await syncToServer('queueTickets', 'delete', { id });
    if (!ok) { setTickets(prev); return; }
    showToast(L('تم الحذف', 'Deleted'), 'info');
  };

  // إصلاح: كانت قائمة الأقسام تعتمد فقط على موديول "الأقسام" (عيادات خارجية
  // مُدخَلة يدوياً) — لو ما أضيف أي قسم هناك، القائمة تطلع فاضية تماماً بلا
  // أي خيار. الآن تُضاف تلقائياً أقسام الخدمات السريرية الفعلية الجاهزة أصلاً
  // بالنظام (المختبر، الأشعة، الصيدلية، الردهات، صالة الولادة، العلاج
  // الطبيعي) — صفحات حقيقية موجودة بالتطبيق، فيصير عندها طابور فعلي بغض
  // النظر عن حالة موديول الأقسام.
  const CLINICAL_SERVICE_POINTS = [
    { ar: 'المختبر', en: 'Laboratory' },
    { ar: 'الأشعة والتصوير الطبي', en: 'Radiology & Imaging' },
    { ar: 'الصيدلية', en: 'Pharmacy' },
    { ar: 'الردهات', en: 'Wards' },
    { ar: 'صالة الولادة', en: 'Delivery Room' },
    { ar: 'العلاج الطبيعي', en: 'Physiotherapy' },
  ];
  const allDepartmentNames = [
    ...(departments || []).map(d => lang === 'ar' ? d.name : (d.nameEn || d.name)),
    ...CLINICAL_SERVICE_POINTS.map(s => lang === 'ar' ? s.ar : s.en),
  ];
  // إصلاح (منها مباشرة): كانت قائمة الأقسام تجمع أيضاً أي قيمة "قسم" ظهرت
  // بتذاكر اليوم فعلياً — فلو تذكرة واحدة انكتب فيها اسم طبيب بالغلط (من
  // صفحة الحجز، التي أصلاً حجزها على الأطباء وليس الأقسام)، يبقى اسم الطبيب
  // هذا يظهر بقائمة الأقسام للأبد. الآن القائمة تقتصر على الأقسام الرسمية
  // والافتراضية فقط.
  const deptOptions = [...new Set(allDepartmentNames)].filter(Boolean);
  const visible = todaysTickets
    .filter(t => deptFilter === 'all' || t.department === deptFilter)
    .sort((a, b) => (a.priority === 'emergency' && b.priority !== 'emergency' ? -1 : b.priority === 'emergency' && a.priority !== 'emergency' ? 1 : new Date(a.createdAt) - new Date(b.createdAt)));

  const waiting = visible.filter(t => t.status === 'waiting');
  const called = visible.filter(t => t.status === 'called');
  const served = visible.filter(t => t.status === 'served');
  const noshow = visible.filter(t => t.status === 'noshow');

  const statusColor = (s) => ({ waiting: '#f59e0b', called: '#3b82f6', served: '#22c55e', noshow: '#6b7280' }[s] || '#6b7280');
  const statusLabel = (s) => ({ waiting: L('بالانتظار', 'Waiting'), called: L('تم النداء', 'Called'), served: L('تم الاستلام', 'Served'), noshow: L('لم يحضر', 'No-show') }[s] || s);

  const TicketCard = ({ t }) => (
    <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-card)', border: t.priority === 'emergency' ? '2px solid #ef4444' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>#{t.ticketNo}</span>
          <strong>{t.patientName}</strong>
          {t.priority === 'emergency' && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}><FaExclamationTriangle /> {L('طارئ', 'Emergency')}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {t.department} · {new Date(t.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          {t.calledBy && ` · ${L('نادى', 'called by')} ${t.calledBy}`}
        </div>
        {t.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.notes}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {t.status === 'waiting' && (
          <button onClick={() => updateStatus(t, 'called')} className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}><FaBullhorn /> {L('نداء', 'Call')}</button>
        )}
        {t.status === 'called' && (
          <>
            <button onClick={() => updateStatus(t, 'served')} className="btn" style={{ fontSize: 12, padding: '6px 12px', background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}><FaCheckCircle /> {L('تم الاستلام', 'Served')}</button>
            <button onClick={() => updateStatus(t, 'noshow')} className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }}>{L('لم يحضر', 'No-show')}</button>
          </>
        )}
        <button onClick={() => del(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <PageBanner icon="🎫" title={L('إدارة الطابور', 'Queue Management')} subtitle={L('إصدار تذاكر ومتابعة دور المرضى', 'Issue tickets and manage patient turns')} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => window.open('/queue-display', '_blank')} className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}>🖥️ {L('فتح شاشة العرض', 'Open Display Screen')}</button>
          <button onClick={() => setShowImport(true)} className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}>📊 {L('استيراد من Excel', 'Import from Excel')}</button>
          <ExcelExportButton apiName="queueTickets" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
          <button onClick={openAdd} className="btn" style={{ background: '#fff', color: '#047857', fontWeight: 600 }}><FaPlus /> {L('تذكرة جديدة', 'New Ticket')}</button>
        </div>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="queueTickets"
          title={L('استيراد تذاكر من Excel', 'Import Tickets from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/queueTickets');
              if (Array.isArray(fresh)) setTickets(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: L('بالانتظار', 'Waiting'), val: waiting.length, color: '#f59e0b', icon: <FaUserClock /> },
          { label: L('تم النداء', 'Called'), val: called.length, color: '#3b82f6', icon: <FaBullhorn /> },
          { label: L('تم الاستلام اليوم', 'Served Today'), val: served.length, color: '#22c55e', icon: <FaCheckCircle /> },
          { label: L('لم يحضر', 'No-show'), val: noshow.length, color: '#6b7280', icon: <FaExclamationTriangle /> },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 6, color: s.color }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setDeptFilter('all')} style={{ padding: '7px 14px', borderRadius: 20, border: `2px solid ${deptFilter === 'all' ? '#059669' : 'var(--border)'}`, background: deptFilter === 'all' ? '#059669' : 'transparent', color: deptFilter === 'all' ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>{L('كل الأقسام', 'All Departments')}</button>
          {deptOptions.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{ padding: '7px 14px', borderRadius: 20, border: `2px solid ${deptFilter === d ? '#059669' : 'var(--border)'}`, background: deptFilter === d ? '#059669' : 'transparent', color: deptFilter === d ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>{d}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 12px', color: '#f59e0b' }}>⏳ {L('بالانتظار', 'Waiting')} ({waiting.length})</h3>
          {waiting.map(t => <TicketCard key={t.id} t={t} />)}
          {waiting.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{L('لا يوجد أحد بالانتظار', 'No one waiting')}</p>}
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 12px', color: '#3b82f6' }}>📢 {L('تم النداء', 'Called')} ({called.length})</h3>
          {called.map(t => <TicketCard key={t.id} t={t} />)}
          {called.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{L('لا يوجد', 'None')}</p>}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{L('تذكرة جديدة', 'New Ticket')}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <label className="form-label">{L('اسم المريض', 'Patient name')} *</label>
              <input value={form.patientName} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} className="form-control" style={{ marginBottom: 10 }} />
              <label className="form-label">{L('القسم', 'Department')} *</label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="form-control" style={{ marginBottom: 10 }}>
                <option value="">{L('اختر...', 'Select...')}</option>
                {allDepartmentNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <label className="form-label">{L('الأولوية', 'Priority')}</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="form-control" style={{ marginBottom: 10 }}>
                <option value="normal">{L('عادية', 'Normal')}</option>
                <option value="emergency">{L('طارئ', 'Emergency')}</option>
              </select>
              <label className="form-label">{L('ملاحظات', 'Notes')}</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="form-control" />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-outline" style={{ marginLeft: 8 }}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={save} className="btn btn-primary">{L('إصدار التذكرة', 'Issue Ticket')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
