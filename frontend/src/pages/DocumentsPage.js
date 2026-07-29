/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';
import { api } from '../api';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import normalizeLookupKey from '../utils/normalizeLookupKey';

const BANNER_GRADIENT = 'linear-gradient(135deg, #164e63 0%, #0e7490 100%)';

const STATUS_CONFIG = {
  pending:   { label: 'قيد المعالجة', en:'Pending',   color: '#f59e0b', bg: '#fef3c7' },
  processed: { label: 'مُعالَج',      en:'Processed', color: '#10b981', bg: '#d1fae5' },
  sent:      { label: 'مُرسَل',       en:'Sent',      color: '#1a6bab', bg: '#dbeafe' },
  archived:  { label: 'مؤرشف',       en:'Archived',  color: '#6b7280', bg: '#f3f4f6' },
};

const PRIORITY_CONFIG = {
  urgent:  { label: 'عاجل',  en:'Urgent', color: '#ef4444', bg: '#fee2e2' },
  high:    { label: 'مهم',   en:'High',   color: '#f59e0b', bg: '#fef3c7' },
  normal:  { label: 'عادي',  en:'Normal', color: '#1a6bab', bg: '#dbeafe' },
};

const TYPE_CONFIG = {
  incoming: { label: 'وارد',  en:'Incoming', icon: '📥', color: '#1a6bab' },
  outgoing: { label: 'صادر', en:'Outgoing', icon: '📤', color: '#10b981' },
};

const EMPTY = { docNo: '', type: 'incoming', title: '', from: '', date: '', receivedDate: '', priority: 'normal', status: 'pending', subject: '', assignedTo: '', tags: [] };

export default function DocumentsPage() {
  const { documents, setDocuments, lang, showToast, user, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [tagInput, setTagInput] = useState('');

  const filtered = useMemo(() => documents.filter(d => {
    const q = search.toLowerCase();
    // Fallback to '' before calling string methods: some records (e.g. bulk-
    // imported/seeded data) can have a missing title, docNo, from, or
    // subject, which would otherwise throw here and crash the whole page.
    const matchSearch = !q || (d.title||'').includes(q) || (d.docNo||'').toLowerCase().includes(q) || (d.from||'').includes(q) || (d.subject||'').includes(q);
    // Normalized the same way the card below resolves its displayed
    // type/status/priority, so a record shown as e.g. "Incoming"/"Pending"
    // (its real value doesn't match any known key) also matches when that
    // same type/status/priority is selected as a filter.
    const matchType = typeFilter === 'all' || normalizeLookupKey(d.type, TYPE_CONFIG, 'incoming') === typeFilter;
    const matchStatus = statusFilter === 'all' || normalizeLookupKey(d.status, STATUS_CONFIG, 'pending') === statusFilter;
    const matchPriority = priorityFilter === 'all' || normalizeLookupKey(d.priority, PRIORITY_CONFIG, 'normal') === priorityFilter;
    return matchSearch && matchType && matchStatus && matchPriority;
  }), [documents, search, typeFilter, statusFilter, priorityFilter]);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = useMemo(() => ({
    total: documents.length,
    // Normalized the same way the card displays type/status, so these counts
    // stay consistent with what selecting that same filter shows below.
    incoming: documents.filter(d => normalizeLookupKey(d.type, TYPE_CONFIG, 'incoming') === 'incoming').length,
    outgoing: documents.filter(d => normalizeLookupKey(d.type, TYPE_CONFIG, 'incoming') === 'outgoing').length,
    pending: documents.filter(d => normalizeLookupKey(d.status, STATUS_CONFIG, 'pending') === 'pending').length,
    urgent: documents.filter(d => normalizeLookupKey(d.priority, PRIORITY_CONFIG, 'normal') === 'urgent').length,
  }), [documents]);

  const openAdd = () => {
    // إصلاح: documents.length+1 يكرر رقم مستند موجود فعلاً بعد أي حذف
    const year = new Date().getFullYear();
    const docPrefix = `IN-${year}-`;
    const maxSeq = documents.reduce((max,d)=>{
      if (typeof d.docNo !== 'string' || !d.docNo.startsWith(docPrefix)) return max;
      const v = parseInt(d.docNo.slice(docPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const nextNo = `${docPrefix}${String(maxSeq+1).padStart(4,'0')}`;
    setForm({ ...EMPTY, docNo: nextNo, date: new Date().toISOString().split('T')[0], receivedDate: new Date().toISOString().split('T')[0], assignedTo: user?.name || '' });
    setEditId(null); setTagInput(''); setShowModal(true);
  };
  const openEdit = (d) => { setForm({ ...d, tags: d.tags || [] }); setEditId(d.id); setTagInput(''); setShowModal(true); };

  const saveDoc = async () => {
    if (!form.title || !form.from) { showToast('يرجى تعبئة العنوان والمصدر', 'error'); return; }
    const doc = { ...form, tags: form.tags || [] };
    const prev = documents;
    if (editId) {
      const ud = { ...doc, id: editId };
      setDocuments(p => p.map(i => i.id === editId ? { ...i, ...ud } : i));
      const ok = await syncToServer('documents', 'update', ud);
      if (!ok) { setDocuments(prev); return; }
      showToast(L('تم التحديث','Updated'),'success');
    } else {
      const nd = { ...doc, id: Date.now() };
      setDocuments(p => [...p, nd]);
      const ok = await syncToServer('documents', 'create', nd);
      if (!ok) { setDocuments(prev); return; }
      showToast(L('تمت إضافة الوثيقة','Document added'),'success');
    }
    setShowModal(false);
  };

  const updateStatus = async (id, status) => {
    const prev = documents;
    const current = documents.find(i => i.id === id);
    if (!current) return;
    const changed = { ...current, status };
    setDocuments(p => p.map(i => i.id === id ? changed : i));
    const ok = await syncToServer('documents', 'update', changed);
    if (!ok) { setDocuments(prev); return; }
    showToast(L('تم تحديث الحالة','Status updated'),'success');
  };

  const deleteDoc = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = documents;
    setDocuments(p => p.filter(i => i.id !== id));
    const ok = await syncToServer('documents', 'delete', { id });
    if (!ok) { setDocuments(prev); return; }
    showToast(L('تم الحذف','Deleted'),'info');
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm(p => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag) => setForm(p => ({ ...p, tags: (p.tags || []).filter(t => t !== tag) }));

  const S = {
    page: { padding: '24px', direction: dir },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
    title: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
    stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 },
    statCard: (c) => ({ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${c}` }),
    toolbar: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    input: { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 },
    select: { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 },
    btn: (c='#1a6bab') => ({ padding: '8px 16px', background: c, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }),
    docCard: (priority) => ({ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 10, border: `1px solid var(--border)`, borderRight: priority === 'urgent' ? '4px solid #ef4444' : priority === 'high' ? '4px solid #f59e0b' : '1px solid var(--border)' }),
    badge: (c, bg) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: c, background: bg }),
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
    modalBox: { background: 'var(--bg-primary)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', direction: dir },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
    fieldLabel: { display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 },
    fieldInput: { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' },
  };

  return (
    <div style={S.page}>
      <PageBanner icon="📁" title={L('ضبط الوثائق والمراسلات','Document Control')} subtitle={lang === 'ar' ? 'إدارة الوارد والصادر وأرشفة الوثائق | متوافق مع ISO 9001' : 'Incoming, outgoing & document archiving | ISO 9001 compliant'} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }} onClick={() => setShowImport(true)}>
            📊 {lang === 'ar' ? 'استيراد من Excel' : 'Import from Excel'}
          </button>
          <ExcelExportButton apiName="documents" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
          <button style={{ padding: '8px 16px', background: '#fff', color: '#0e7490', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }} onClick={openAdd}>+ {lang === 'ar' ? 'وثيقة جديدة' : 'New Document'}</button>
        </div>
      </PageBanner>

      <div style={S.stats}>
        {[['إجمالي الوثائق', stats.total, '#1a6bab'],['وارد', stats.incoming, '#8b5cf6'],['صادر', stats.outgoing, '#10b981'],['قيد المعالجة', stats.pending, '#f59e0b'],['عاجل', stats.urgent, '#ef4444']].map(([lbl, val, c], i) => (
          <div key={i} style={S.statCard(c)}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={S.toolbar}>
        <input style={{ ...S.input, minWidth: 200 }} placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">الوارد والصادر</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {lang==='ar'?v.label:v.en}</option>)}
        </select>
        <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang==='ar'?v.label:v.en}</option>)}
        </select>
        <select style={S.select} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="all">كل الأولويات</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang==='ar'?v.label:v.en}</option>)}
        </select>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{filtered.length} {L('وثيقة','docs')}</span>
      </div>

      {pageItems.map(doc => {
        const st = STATUS_CONFIG[normalizeLookupKey(doc.status, STATUS_CONFIG, 'pending')];
        const pr = PRIORITY_CONFIG[normalizeLookupKey(doc.priority, PRIORITY_CONFIG, 'normal')];
        const tp = TYPE_CONFIG[normalizeLookupKey(doc.type, TYPE_CONFIG, 'incoming')];
        return (
          <div key={doc.id} style={S.docCard(doc.priority)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{tp.icon}</span>
                  <code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-secondary)' }}>{doc.docNo}</code>
                  <span style={S.badge(tp.color, tp.color + '22')}>{lang==='ar'?tp.label:tp.en}</span>
                  <span style={S.badge(st.color, st.bg)}>{lang==='ar'?st.label:st.en}</span>
                  <span style={S.badge(pr.color, pr.bg)}>{lang==='ar'?pr.label:pr.en}</span>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{doc.title}</h3>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🏢 {doc.from}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📅 {doc.date}</span>
                  {doc.assignedTo && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>👤 {doc.assignedTo}</span>}
                  {doc.subject && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🏷 {doc.subject}</span>}
                </div>
                {doc.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {doc.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, flexWrap: 'wrap' }}>
              {doc.status === 'pending' && <button onClick={() => updateStatus(doc.id, 'processed')} style={{ ...S.btn('#10b981'), padding: '4px 10px', fontSize: 11 }}>✅ معالجة</button>}
              {doc.status === 'pending' && doc.type === 'outgoing' && <button onClick={() => updateStatus(doc.id, 'sent')} style={{ ...S.btn('#1a6bab'), padding: '4px 10px', fontSize: 11 }}>{L('📤 إرسال','📤 Send')}</button>}
              {['processed','sent'].includes(doc.status) && <button onClick={() => updateStatus(doc.id, 'archived')} style={{ ...S.btn('#6b7280'), padding: '4px 10px', fontSize: 11 }}>{L('🗄 أرشفة','🗄 Archive')}</button>}
              <button onClick={() => openEdit(doc)} style={{ ...S.btn('#6b7280'), padding: '4px 10px', fontSize: 11 }}>{L('✏️ تعديل','✏️ Edit')}</button>
              <button onClick={() => deleteDoc(doc.id)} style={{ ...S.btn('#ef4444'), padding: '4px 10px', fontSize: 11 }}>{L('🗑 حذف','🗑 Delete')}</button>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
          <p>لا توجد وثائق</p>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {showModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={S.modalBox}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--text-primary)' }}>{editId ? '✏️ تعديل الوثيقة' : '📁 وثيقة جديدة'}</h3>
            <div style={S.grid2}>
              <label>
                <span style={S.fieldLabel}>رقم الوثيقة</span>
                <input style={S.fieldInput} value={form.docNo || ''} onChange={e => setForm(p => ({ ...p, docNo: e.target.value }))} />
              </label>
              <label>
                <span style={S.fieldLabel}>النوع</span>
                <select style={S.fieldInput} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {lang==='ar'?v.label:v.en}</option>)}
                </select>
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <span style={S.fieldLabel}>عنوان الوثيقة</span>
                <input style={S.fieldInput} value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <span style={S.fieldLabel}>المصدر / الجهة</span>
                <input style={S.fieldInput} value={form.from || ''} onChange={e => setForm(p => ({ ...p, from: e.target.value }))} />
              </label>
              {multiHospitalEnabled && (
                <label style={{ gridColumn: 'span 2' }}>
                  <span style={S.fieldLabel}>{lang==='ar'?'المنشأة':'Facility'}</span>
                  <select style={S.fieldInput} value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))}>
                    <option value="">—</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span style={S.fieldLabel}>التاريخ</span>
                <input type="date" style={S.fieldInput} value={form.date || ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </label>
              <label>
                <span style={S.fieldLabel}>الموضوع</span>
                <input style={S.fieldInput} value={form.subject || ''} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
              </label>
              <label>
                <span style={S.fieldLabel}>الأولوية</span>
                <select style={S.fieldInput} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang==='ar'?v.label:v.en}</option>)}
                </select>
              </label>
              <label>
                <span style={S.fieldLabel}>الحالة</span>
                <select style={S.fieldInput} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang==='ar'?v.label:v.en}</option>)}
                </select>
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <span style={S.fieldLabel}>مسؤول المعالجة</span>
                <input style={S.fieldInput} value={form.assignedTo || ''} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <span style={S.fieldLabel}>الوسوم (اضغط Enter لإضافة)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...S.fieldInput, flex: 1 }} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="أضف وسماً..." />
                  <button type="button" onClick={addTag} style={{ ...S.btn(), padding: '8px 12px' }}>+</button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {(form.tags || []).map(tag => (
                    <span key={tag} onClick={() => removeTag(tag)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#dbeafe', color: '#1a6bab', cursor: 'pointer' }}>#{tag} ✕</span>
                  ))}
                </div>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setShowModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={saveDoc}>{L('💾 حفظ','💾 Save')}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ExcelImportModal
          apiName="documents"
          title={lang === 'ar' ? 'استيراد وثائق من Excel' : 'Import Documents from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/documents');
              if (Array.isArray(fresh)) setDocuments(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}
    </div>
  );
}
