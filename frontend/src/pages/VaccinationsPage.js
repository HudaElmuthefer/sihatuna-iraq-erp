/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { api } from '../api';
import { FaPlus, FaEdit, FaTrash, FaSyringe, FaCheckCircle, FaClock } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #047857 100%)';

const initialVaccinations = [
  { id: 1, patient: 'Ahmed Mohammed Ali', vaccine: 'COVID-19 (Pfizer)', dose: 'First Dose', date: '2024-01-15', nextDate: '2024-02-05', status: 'completed', provider: 'د. سالم المنصوري', notes: '' },
  { id: 2, patient: 'Fatima Hassan', vaccine: 'Seasonal Flu', dose: 'Annual Dose', date: '2024-03-10', nextDate: '2025-03-10', status: 'completed', provider: 'د. نور الهاشمي', notes: 'لا آثار جانبية' },
  { id: 3, patient: 'Ali Abdul-Razzaq', vaccine: 'Hepatitis B', dose: 'Second Dose', date: '2024-05-20', nextDate: '2024-11-20', status: 'upcoming', provider: 'د. رضا العامري', notes: '' },
  { id: 4, patient: 'Zainab Al-Hussaini', vaccine: 'MMR', dose: 'Booster', date: '2024-06-01', nextDate: null, status: 'overdue', provider: '', notes: 'يجب المراجعة' },
];

const vaccines = [
  { ar: 'COVID-19 (فايزر)', en: 'COVID-19 (Pfizer)' },
  { ar: 'COVID-19 (موديرنا)', en: 'COVID-19 (Moderna)' },
  { ar: 'الأنفلونزا الموسمية', en: 'Seasonal Flu' },
  { ar: 'التهاب الكبد A', en: 'Hepatitis A' },
  { ar: 'التهاب الكبد B', en: 'Hepatitis B' },
  { ar: 'الحصبة والنكاف', en: 'MMR' },
  { ar: 'شلل الأطفال', en: 'Polio' },
  { ar: 'الكزاز', en: 'Tetanus' },
  { ar: 'الدفتيريا', en: 'Diphtheria' },
  { ar: 'الجدري المائي', en: 'Chickenpox' },
  { ar: 'المكورات الرئوية', en: 'Pneumococcal' },
];

const DOSES = [
  { ar: 'الجرعة الأولى', en: '1st Dose' },
  { ar: 'الجرعة الثانية', en: '2nd Dose' },
  { ar: 'الجرعة الثالثة', en: '3rd Dose' },
  { ar: 'جرعة سنوية', en: 'Annual Dose' },
  { ar: 'جرعة معززة', en: 'Booster' },
  { ar: 'التطعيم الأولي', en: 'Primary' },
  { ar: 'التطعيم الثانوي', en: 'Secondary' },
];
const doseLabel = (value, lang) => DOSES.find(d => d.ar===value||d.en===value)?.[lang] || value;

const empty = { patient: '', vaccine: '', dose: '', date: '', nextDate: '', status: 'upcoming', provider: '', notes: '' };

export default function VaccinationsPage() {
  const { showToast, lang, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled, user } = useApp();
  const tr = useT(lang);
  const [records, setRecords] = useState(initialVaccinations);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // إصلاح: نفس خلل AppContext (`data.length > 0`) — لو كان عدد التطعيمات
    // الحقيقي بقاعدة البيانات صفراً فعلاً، تبقى الصفحة تعرض بيانات تجريبية
    // وهمية ثابتة (initialVaccinations) للأبد بدل الصفر الصحيح، وكأنها بيانات
    // مرضى حقيقية. الآن نثق بأي رد صالح من الخادم، فارغاً كان أو لا.
    api.get('/vaccinations').then(data => {
      if (!cancelled && Array.isArray(data)) setRecords(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const statusOptions = [
    { key: 'completed', label: tr('vac_done') },
    { key: 'upcoming', label: tr('vac_upcoming') },
    { key: 'overdue', label: tr('vac_overdue') },
  ];
  const normalizeStatus = (s) => ({
    'مكتمل': 'completed', 'completed': 'completed',
    'موعد قادم': 'upcoming', 'upcoming': 'upcoming',
    'متأخر': 'overdue', 'overdue': 'overdue',
    Completed: 'completed',
    Upcoming: 'upcoming',
    Overdue: 'overdue',
  }[s] || s);
  const statusLabel = (s) => statusOptions.find(o => o.key === normalizeStatus(s))?.label || s;
  const vaccineLabel = (value) => vaccines.find(v => v.ar === value || v.en === value)?.[lang] || value;

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setShowModal(true); };

  const save = async () => {
    if (!form.patient || !form.vaccine || !form.date) { showToast(tr('msg_required'), 'error'); return; }
    const prev = records;
    if (editing) {
      const ur = { ...form, id: editing.id };
      setRecords(p => p.map(r => r.id === editing.id ? ur : r));
      const ok = await syncToServer('vaccinations', 'update', ur);
      if (!ok) { setRecords(prev); return; }
      showToast(tr('msg_edited'), 'success');
    } else {
      const nr = { ...form, id: Date.now() };
      setRecords(p => [...p, nr]);
      const synced = await syncToServer('vaccinations', 'create', nr);
      if (!synced) { setRecords(prev); return; }
      if (typeof synced === 'object' && synced.id !== nr.id) {
        setRecords(p => p.map(r => r.id === nr.id ? synced : r));
      }
      showToast(tr('msg_added'), 'success');
    }
    setShowModal(false);
  };

  const del = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = records;
    setRecords(p => p.filter(r => r.id !== id));
    const ok = await syncToServer('vaccinations', 'delete', { id });
    if (!ok) { setRecords(prev); return; }
    showToast(tr('msg_deleted'), 'success');
  };

  const statusColor = (s) => ({ completed: '#22c55e', upcoming: '#3b82f6', overdue: '#ef4444' }[normalizeStatus(s)] || '#6b7280');
  const statusIcon = (s) => normalizeStatus(s) === 'completed' ? <FaCheckCircle /> : normalizeStatus(s) === 'upcoming' ? <FaClock /> : <FaSyringe />;

  const filtered = filterByViewingHospital(records).filter(r =>
    (filterStatus === 'all' || normalizeStatus(r.status) === filterStatus) &&
    (r.patient.includes(search) || r.vaccine.includes(search) || vaccineLabel(r.vaccine).toLowerCase().includes(search.toLowerCase()))
  );
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = {
    total: records.length,
    done: records.filter(r => normalizeStatus(r.status) === 'completed').length,
    upcoming: records.filter(r => normalizeStatus(r.status) === 'upcoming').length,
    late: records.filter(r => normalizeStatus(r.status) === 'overdue').length,
  };

  return (
    <div className="page-content">
      {/* Header */}
      <PageBanner icon="💉" title={tr("vac_management")} subtitle={tr("vac_subtitle")} gradient={BANNER_GRADIENT}>
        <button className="btn" onClick={() => setShowImport(true)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          📊 {lang === 'ar' ? 'استيراد من Excel' : 'Import from Excel'}
        </button>
        <ExcelExportButton apiName="vaccinations" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
        <button className="btn" onClick={openAdd} style={{ background: '#fff', color: '#065f46', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <FaPlus /> {tr('vac_add_btn')}
        </button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="vaccinations"
          title={lang === 'ar' ? 'استيراد تطعيمات من Excel' : 'Import Vaccinations from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/vaccinations');
              if (Array.isArray(fresh)) setRecords(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: tr('vac_total_records'), val: stats.total, color: '#1a6bab', icon: '💉' },
          { label: tr('vac_done'), val: stats.done, color: '#22c55e', icon: '✅' },
          { label: tr('vac_upcoming'), val: stats.upcoming, color: '#3b82f6', icon: '📅' },
          { label: tr('vac_overdue'), val: stats.late, color: '#ef4444', icon: '⚠️' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('vac_search')} className="form-control" style={{ flex: 1, minWidth: 200 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ key: 'all', label: tr('vac_filter_all') }, ...statusOptions].map(s => (
              <button key={s.key} onClick={() => setFilterStatus(s.key)} style={{ padding: '7px 14px', borderRadius: 20, border: `2px solid ${filterStatus === s.key ? '#1a6bab' : 'var(--border)'}`, background: filterStatus === s.key ? '#1a6bab' : 'transparent', color: filterStatus === s.key ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{tr("vac_col_patient")}</th>
                <th>{tr("vac_col_vaccine")}</th>
                <th>{tr('auto_pair_147')}</th>
                <th>{tr("vac_col_date")}</th>
                <th>{tr("vac_col_next")}</th>
                <th>{tr('field_status')}</th>
                <th>{tr('auto_pair_148')}</th>
                <th>{tr("field_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.patient}</td>
                  <td>{vaccineLabel(r.vaccine)}</td>
                  <td><span style={{ background: 'rgba(26,107,171,0.1)', color: '#1a6bab', padding: '2px 8px', borderRadius: 8, fontSize: 12 }}>{doseLabel(r.dose, lang)}</span></td>
                  <td>{r.date}</td>
                  <td>{r.nextDate || '—'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${statusColor(r.status)}15`, color: statusColor(r.status), padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                      {statusIcon(r.status)} {statusLabel(r.status)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.provider || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a6bab' }}><FaEdit /></button>
                      <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><FaTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{tr('vac_no_data')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editing ? tr('vac_edit_title') : tr('vac_add_title')}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)' }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">{tr('vac_patient')} *</label>
                  <input value={form.patient} onChange={e => setForm(p => ({ ...p, patient: e.target.value }))} className="form-control" />
                </div>
                {multiHospitalEnabled && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="form-label">{tr('vac_vaccine')} *</label>
                  <select value={form.vaccine} onChange={e => setForm(p => ({ ...p, vaccine: e.target.value }))} className="form-control">
                    <option value="">{tr('field_choose')}</option>
                    {vaccines.map(v => <option key={lang==="ar"?v.ar:v.en} value={lang==="ar"?v.ar:v.en}>{lang === 'ar' ? v.ar : v.en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{tr('auto_pair_150')}</label>
                  <select value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))} className="form-control">
                    <option value="">{lang==='ar'?'اختر الجرعة...':'Select dose...'}</option>
                    {DOSES.map(d => <option key={d.ar} value={d.ar}>{lang==='ar'?d.ar:d.en}</option>)}
                    <option value="other">{lang==='ar'?'أخرى':'Other'}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{tr('vac_date')} *</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{tr('vac_next_date')}</label>
                  <input type="date" value={form.nextDate || ''} onChange={e => setForm(p => ({ ...p, nextDate: e.target.value }))} className="form-control" />
                </div>
                <div>
                  <label className="form-label">{tr('field_status')}</label>
                  <select value={normalizeStatus(form.status)} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="form-control">
                    {statusOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{tr('auto_pair_154')}</label>
                  <input value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))} placeholder={tr('doctor_name_placeholder')} className="form-control" />
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
