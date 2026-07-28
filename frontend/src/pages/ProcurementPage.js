/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)';

const STATUS_CONFIG = {
  pending:   { ar:'بانتظار الموافقة', en:'Pending Approval', color:'#f59e0b', bg:'#fef3c7' },
  approved:  { ar:'مُعتمد',           en:'Approved',         color:'#1a6bab', bg:'#dbeafe' },
  delivered: { ar:'مُسلَّم',          en:'Delivered',        color:'#10b981', bg:'#d1fae5' },
  cancelled: { ar:'ملغي',             en:'Cancelled',        color:'#6b7280', bg:'#f3f4f6' },
};
const PRIORITY_CONFIG = {
  high:   { ar:'عاجل',   en:'Urgent',  color:'#ef4444' },
  normal: { ar:'عادي',   en:'Normal',  color:'#1a6bab' },
  low:    { ar:'منخفض',  en:'Low',     color:'#6b7280' },
};
const EMPTY = { poNo:'', title:'', titleEn:'', supplier:'', supplierEn:'', date:'', deliveryDate:'', totalAmount:0, status:'pending', items:1, priority:'normal', approvedBy:null };

export default function ProcurementPage() {
  const { procurement, setProcurement, user, lang, showToast, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  // ── قارئ الفواتير بالذكاء الاصطناعي ─────────────────────────────────────
  // مماثل لميزة "Razi System" بمنافس السوق (mip-iraq.com) — تصويري/رفعي
  // فاتورة ورقية من المورد بدل كتابة كل التفاصيل يدوياً. تعتمد على نفس
  // مفتاح Gemini المُعدّ أصلاً بـ.env لميزة التشخيص بالذكاء الاصطناعي —
  // ما يحتاج أي إعداد إضافي لو Gemini شغّال أصلاً.
  const [readingInvoice, setReadingInvoice] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState(null); // بيانات الفاتورة المُستخرَجة، للمراجعة قبل التطبيق

  // دالة مشتركة تقرأ الفاتورة سواء جاءت من ملف مرفوع أو من التقاط كاميرا —
  // الاثنان ينتهيان بنفس الشكل (data URL + نوع الملف)، فلا داعي لتكرار منطق
  // استدعاء الـ API مرتين.
  const readInvoiceFromDataUrl = async (dataUrl, mimeType) => {
    setReadingInvoice(true);
    setInvoicePreview(null);
    try {
      const result = await api.post('/invoice-reader/read', { image: dataUrl, mimeType });
      if (!result.available) {
        showToast(L('قراءة الفواتير بالذكاء الاصطناعي غير مُفعَّلة — تأكد من إعداد GEMINI_API_KEY بملف .env', 'AI invoice reading is not enabled — check GEMINI_API_KEY in .env'), 'warning');
      } else {
        setInvoicePreview(result);
      }
    } catch (err) {
      showToast(L('تعذّرت قراءة الفاتورة، جرب صورة أوضح', 'Could not read the invoice, try a clearer image'), 'error');
    } finally {
      setReadingInvoice(false);
    }
  };

  const handleInvoiceFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await readInvoiceFromDataUrl(dataUrl, file.type);
    e.target.value = ''; // يسمح برفع نفس الملف مرة ثانية لو احتاجت المستخدمة تعيد المحاولة
  };

  // ── التقاط مباشر من كاميرا الحاسبة (Webcam) ─────────────────────────────
  // بديل عن رفع ملف — تفتح بث الكاميرا مباشرة داخل المتصفح (getUserMedia)،
  // وتلتقط لقطة واحدة عند الضغط، بدون أي برنامج خارجي أو تثبيت إضافي.
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const openCamera = async () => {
    setCameraError('');
    setCameraReady(false);
    setShowCamera(true);
    try {
      // ملاحظة: بدون facingMode — هذا القيد يخص كاميرات الموبايل (أمامية/
      // خلفية)، وكاميرات الحاسبة (Webcam) ما تدعمه عادة؛ طلبه صراحة كان
      // يمنع ظهور الصورة رغم نجاح تشغيل الكاميرا نفسها (ضوء الكاميرا يضوي).
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // بعض المتصفحات ما تشغّل الفيديو تلقائياً حتى لو البث نفسه شغّال
        // (ضوء الكاميرا مضوي) — نطلب التشغيل صراحة بدل الاعتماد على autoPlay وحدها
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setCameraError(L('تعذّر الوصول لكاميرا الحاسبة، تأكد من السماح للمتصفح باستخدام الكاميرا', 'Could not access the computer camera — make sure the browser has camera permission'));
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
    setCameraReady(false);
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      showToast(L('لسا الكاميرا ما جهّزت الصورة، انتظري ثانية وحاولي مرة ثانية', 'The camera image is not ready yet, wait a second and try again'), 'warning');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    closeCamera();
    await readInvoiceFromDataUrl(dataUrl, 'image/jpeg');
  };

  // يحوّل أي صيغة تاريخ شائعة (سنة-شهر-يوم أو يوم-شهر-سنة أو يوم/شهر/سنة)
  // إلى الصيغة الوحيدة التي يقبلها حقل input من نوع date: yyyy-mm-dd.
  // بدون هذا، أي التزام ناقص من النموذج بالصيغة يجعل الحقل يبدو فارغاً
  // بصرياً رغم وصول القيمة فعلياً.
  const normalizeDate = (raw) => {
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  };

  const applyInvoicePreview = () => {
    if (!invoicePreview) return;
    setForm((p) => ({
      ...p,
      supplier: invoicePreview.vendorName || p.supplier,
      supplierEn: invoicePreview.vendorName || p.supplierEn,
      date: normalizeDate(invoicePreview.invoiceDate) || p.date,
      totalAmount: invoicePreview.grandTotal || p.totalAmount,
      items: invoicePreview.items?.length || p.items,
    }));
    setInvoicePreview(null);
    showToast(L('تم تعبئة بيانات الفاتورة، راجع القيم قبل الحفظ', 'Invoice data filled in — please review before saving'), 'success');
  };

  const filtered = useMemo(() => procurement.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.title.includes(q) || p.poNo.toLowerCase().includes(q) || p.supplier.includes(q))
      && (statusFilter === 'all' || p.status === statusFilter);
  }), [procurement, search, statusFilter]);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = useMemo(() => ({
    total: procurement.length,
    pending: procurement.filter(p => p.status === 'pending').length,
    approved: procurement.filter(p => p.status === 'approved').length,
    totalValue: procurement.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0),
  }), [procurement]);

  const openAdd = () => {
    // إصلاح: procurement.length+1 يكرر رقم أمر شراء موجود فعلاً بعد أي حذف
    const poYear = new Date().getFullYear();
    const poPrefix = `PO-${poYear}-`;
    const poMaxSeq = procurement.reduce((max,p)=>{
      if (typeof p.poNo !== 'string' || !p.poNo.startsWith(poPrefix)) return max;
      const v = parseInt(p.poNo.slice(poPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const nextNo = `${poPrefix}${String(poMaxSeq+1).padStart(3,'0')}`;
    setForm({ ...EMPTY, poNo: nextNo, date: new Date().toISOString().split('T')[0] });
    setEditId(null); setShowModal(true);
  };
  const openEdit = item => { setForm({ ...item }); setEditId(item.id); setShowModal(true); };
  const savePO = async () => {
    if (!form.title || !form.supplier) { showToast(L('يرجى تعبئة العنوان والمورد','Please fill title and supplier'), 'error'); return; }
    const po = { ...form, totalAmount: +form.totalAmount, items: +form.items };
    const prev = procurement;
    if (editId) {
      const up = { ...po, id: editId };
      setProcurement(p => p.map(i => i.id === editId ? { ...i, ...up } : i));
      const ok = await syncToServer('procurement', 'update', up);
      if (!ok) { setProcurement(prev); return; }
      showToast(L('تم التحديث','Updated'), 'success');
    } else {
      const np = { ...po, id: Date.now() };
      setProcurement(p => [...p, np]);
      const ok = await syncToServer('procurement', 'create', np);
      if (!ok) { setProcurement(prev); return; }
      showToast(L('تمت إضافة أمر الشراء','PO added'), 'success');
    }
    setShowModal(false);
  };
  const updateStatus = async (id, status) => {
    const prev = procurement;
    const current = procurement.find(i => i.id === id);
    if (!current) return;
    const changed = { ...current, status, ...(status==='approved' ? {approvedBy: user?.name} : {}) };
    setProcurement(p => p.map(i => i.id === id ? changed : i));
    const ok = await syncToServer('procurement', 'update', changed);
    if (!ok) { setProcurement(prev); return; }
    const msg = status==='approved' ? L('تمت الموافقة','Approved') : status==='delivered' ? L('تم تسجيل الاستلام','Delivery recorded') : L('تم الإلغاء','Cancelled');
    showToast(msg, 'success');
  };
  const n = v => (Number(v) || 0).toLocaleString('en-US');
  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = procurement;
    setProcurement(p => p.filter(i => i.id !== id));
    const ok = await syncToServer('procurement', 'delete', { id });
    if (!ok) { setProcurement(prev); return; }
    showToast(L('تم الحذف','Deleted'), 'info');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('procurement', 'delete', { id });
      if (ok) { setProcurement(p => p.filter(i => i.id !== id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} أمر شراء` : `Deleted ${deleted} of ${ids.length} POs`, deleted === ids.length ? 'success' : 'warning');
  };

  const S = {
    page: { padding:24, direction:dir },
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 },
    stats: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:20 },
    sCard: c => ({ background:'var(--bg-card)', borderRadius:12, padding:'16px 20px', borderTop:`3px solid ${c}` }),
    tb: { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
    inp: { padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13 },
    btn: (c='#1a6bab') => ({ padding:'8px 16px', background:c, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }),
    smBtn: (c='#1a6bab') => ({ padding:'5px 12px', background:c, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }),
    card: { background:'var(--bg-card)', borderRadius:12, padding:18, marginBottom:12, border:'1px solid var(--border)' },
    badge: (c,bg) => ({ display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, color:c, background:bg }),
    modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
    mbox: { background:'var(--bg-primary)', borderRadius:16, padding:28, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', direction:dir },
    g2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
    fl: { display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 },
    fi: { width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13, boxSizing:'border-box' },
  };

  return (
    <div style={S.page}>
      <PageBanner icon="🛒" title={L('المشتريات','Procurement')} subtitle={L('إدارة أوامر الشراء والموردين','Manage purchase orders and suppliers')} gradient={BANNER_GRADIENT}>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ padding:'8px 16px', background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }} onClick={() => setShowImport(true)}>
            📊 {L('استيراد من Excel','Import from Excel')}
          </button>
          <ExcelExportButton apiName="procurement" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }} />
          <button style={{ padding:'8px 16px', background:'#fff', color:'#c2410c', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }} onClick={openAdd}>+ {L('أمر شراء جديد','New PO')}</button>
        </div>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="procurement"
          title={L('استيراد أوامر شراء من Excel','Import Purchase Orders from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/procurement');
              if (Array.isArray(fresh)) setProcurement(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      <div style={S.stats}>
        {[[L('إجمالي أوامر الشراء','Total POs'), stats.total, '#1a6bab'],
          [L('بانتظار الموافقة','Pending Approval'), stats.pending, '#f59e0b'],
          [L('مُعتمدة','Approved'), stats.approved, '#10b981']].map(([lbl,val,c],i) => (
          <div key={i} style={S.sCard(c)}>
            <div style={{ fontSize:26, fontWeight:700, color:'var(--text-primary)' }}>{val}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{lbl}</div>
          </div>
        ))}
        <div style={S.sCard('#8b5cf6')}>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>{n(stats.totalValue)}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{L('إجمالي القيمة (د.ع)','Total Value (IQD)')}</div>
        </div>
      </div>

      <div style={S.tb}>
        <input style={{...S.inp, minWidth:220}} placeholder={L('🔍 بحث...','🔍 Search...')} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', cursor:'pointer' }}>
          <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(po => selectedIds.has(po.id))} onChange={() => {
            setSelectedIds(prev => {
              const allSelected = pageItems.every(po => prev.has(po.id));
              const next = new Set(prev);
              pageItems.forEach(po => allSelected ? next.delete(po.id) : next.add(po.id));
              return next;
            });
          }} />
          {L('تحديد الكل','Select all')}
        </label>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, padding:'10px 16px', background:'var(--bg-secondary)', borderRadius:10, marginBottom:12 }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{lang==='ar' ? `${selectedIds.size} محدَّد` : `${selectedIds.size} selected`}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setSelectedIds(new Set())} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>{lang==='ar' ? 'إلغاء التحديد' : 'Clear Selection'}</button>
            <button onClick={() => setBulkDeleteConfirm(true)} style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>🗑️ {lang==='ar' ? `حذف المحدَّد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}</button>
          </div>
        </div>
      )}

      {pageItems.map(po => {
        const st = STATUS_CONFIG[po.status] || STATUS_CONFIG.pending;
        const pr = PRIORITY_CONFIG[po.priority] || PRIORITY_CONFIG.normal;
        return (
          <div key={po.id} style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', gap:10, flex:1 }}>
                <input type="checkbox" checked={selectedIds.has(po.id)} onChange={() => toggleSelect(po.id)} style={{ marginTop:4 }} />
                <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                  <code style={{ fontSize:12, background:'var(--bg-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--text-secondary)' }}>{po.poNo}</code>
                  <span style={S.badge(st.color,st.bg)}>{L(st.ar,st.en)}</span>
                  <span style={{ fontSize:11, color:pr.color, fontWeight:700 }}>● {L(pr.ar,pr.en)}</span>
                </div>
                <h3 style={{ margin:0, fontSize:15, fontWeight:600, color:'var(--text-primary)' }}>{lang==='ar' ? po.title : (po.titleEn||po.title)}</h3>
                <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>🏢 {lang==='ar' ? po.supplier : (po.supplierEn||po.supplier)}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>📅 {po.date}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>🚚 {po.deliveryDate}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>📦 {po.items} {L('صنف','items')}</span>
                </div>
                {po.approvedBy && <div style={{ fontSize:11, color:'#10b981', marginTop:6 }}>✅ {L('معتمد بواسطة:','Approved by:')} {po.approvedBy}</div>}
                </div>
              </div>
              <div style={{ textAlign:'center', minWidth:120 }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#1a6bab' }}>{n(po.totalAmount)}</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{L('د.ع','IQD')}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:12, borderTop:'1px solid var(--border)', paddingTop:10, flexWrap:'wrap' }}>
              <button onClick={()=>openEdit(po)} style={S.smBtn('#6b7280')}>✏️ {L('تعديل','Edit')}</button>
              {po.status==='pending'   && <button onClick={()=>updateStatus(po.id,'approved')}  style={S.smBtn('#10b981')}>✅ {L('اعتماد','Approve')}</button>}
              {po.status==='approved'  && <button onClick={()=>updateStatus(po.id,'delivered')} style={S.smBtn('#1a6bab')}>📦 {L('تسجيل استلام','Mark Delivered')}</button>}
              {['pending','approved'].includes(po.status) && <button onClick={()=>updateStatus(po.id,'cancelled')} style={S.smBtn('#ef4444')}>❌ {L('إلغاء','Cancel')}</button>}
              <button onClick={()=>del(po.id)} style={S.smBtn('#ef4444')}>🗑️ {L('حذف','Delete')}</button>
            </div>
          </div>
        );
      })}

      {filtered.length===0 && (
        <div style={{ textAlign:'center', padding:48, color:'var(--text-secondary)', background:'var(--bg-card)', borderRadius:12 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🛒</div>
          <p>{L('لا توجد أوامر شراء','No purchase orders found')}</p>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} أمر شراء؟` : `Delete ${selectedIds.size} POs?`}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer' }}>{L('إلغاء','Cancel')}</button>
                <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', cursor:'pointer', fontWeight:600 }}>{bulkDeleting ? '...' : (lang==='ar' ? 'حذف' : 'Delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#111', borderRadius: 14, padding: 16, maxWidth: '90vw' }}>
            <h4 style={{ margin: '0 0 10px', color: '#fff', fontSize: 14 }}>{L('التقاط صورة الفاتورة', 'Capture Invoice Photo')}</h4>
            {cameraError ? (
              <p style={{ color: '#fca5a5', fontSize: 13, maxWidth: 320 }}>{cameraError}</p>
            ) : (
              /* eslint-disable-next-line jsx-a11y/media-has-caption */
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setCameraReady(true)}
                style={{ maxWidth: '80vw', maxHeight: '60vh', borderRadius: 8, background: '#000' }}
              />
            )}
            {!cameraError && !cameraReady && (
              <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>{L('جاري تشغيل الكاميرا...', 'Starting camera...')}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeCamera} style={{ ...S.btn('#6b7280'), padding: '7px 16px' }}>{L('إلغاء', 'Cancel')}</button>
              {!cameraError && (
                <button type="button" onClick={captureFromCamera} disabled={!cameraReady} style={{ ...S.btn(), padding: '7px 16px', opacity: cameraReady ? 1 : 0.5 }}>📸 {L('التقاط', 'Capture')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={S.mbox}>
            <h3 style={{ margin:'0 0 20px', color:'var(--text-primary)' }}>{editId ? L('✏️ تعديل أمر الشراء','✏️ Edit PO') : L('🛒 أمر شراء جديد','🛒 New Purchase Order')}</h3>

            {!editId && (
              <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px dashed var(--border-color, #d1d5db)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  📷 {readingInvoice ? L('جارٍ قراءة الفاتورة...', 'Reading invoice...') : L('رفع صورة فاتورة (اختياري)', 'Upload invoice photo (optional)')}
                  <input type="file" accept="image/*" onChange={handleInvoiceFile} disabled={readingInvoice} style={{ display: 'none' }} />
                </label>
                <button
                  type="button"
                  onClick={openCamera}
                  disabled={readingInvoice}
                  style={{ ...S.btn('#6b7280'), padding: '5px 12px', fontSize: 12, marginTop: 8 }}
                >
                  📸 {L('التقاط من كاميرا الحاسبة', "Capture from computer's camera")}
                </button>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {L('صوّر أو ارفع فاتورة المورد، تُعبّأ الحقول تلقائياً، راجع البيانات المستخرَجة قبل التطبيق.', 'Photograph or upload the supplier invoice — fields fill in automatically. Review the extracted data before applying.')}
                </p>

                {invoicePreview && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-color, #d1d5db)' }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      <strong>{L('المورد', 'Vendor')}:</strong> {invoicePreview.vendorName || '—'} &nbsp;|&nbsp;
                      <strong>{L('التاريخ', 'Date')}:</strong> {invoicePreview.invoiceDate || '—'} &nbsp;|&nbsp;
                      <strong>{L('الإجمالي', 'Total')}:</strong> {invoicePreview.grandTotal || '—'} &nbsp;|&nbsp;
                      <strong>{L('عدد الأصناف', 'Items')}:</strong> {invoicePreview.items?.length || 0}
                    </div>
                    {invoicePreview.items?.length > 0 && (
                      <table style={{ width: '100%', fontSize: 11, marginBottom: 6, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color, #d1d5db)' }}>
                            <th style={{ textAlign: 'start', padding: 4 }}>{L('الصنف', 'Item')}</th>
                            <th style={{ textAlign: 'center', padding: 4 }}>{L('الكمية', 'Qty')}</th>
                            <th style={{ textAlign: 'center', padding: 4 }}>{L('السعر', 'Price')}</th>
                            <th style={{ textAlign: 'end', padding: 4 }}>{L('المجموع', 'Total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicePreview.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #eee)' }}>
                              <td style={{ padding: 4 }}>{it.name || '—'}</td>
                              <td style={{ textAlign: 'center', padding: 4 }}>{it.quantity ?? '—'}</td>
                              <td style={{ textAlign: 'center', padding: 4 }}>{it.unitPrice ?? '—'}</td>
                              <td style={{ textAlign: 'end', padding: 4 }}>{it.total ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {invoicePreview.confidence === 'low' && (
                      <div style={{ fontSize: 11, color: '#b45309', marginBottom: 6 }}>⚠️ {L('دقة القراءة منخفضة، راجع الأرقام يدوياً قبل الحفظ', 'Reading confidence is low — please verify the numbers manually before saving')}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={applyInvoicePreview} style={{ ...S.btn(), padding: '5px 12px', fontSize: 12 }}>{L('✅ تعبئة النموذج', '✅ Fill Form')}</button>
                      <button type="button" onClick={() => setInvoicePreview(null)} style={{ ...S.btn('#6b7280'), padding: '5px 12px', fontSize: 12 }}>{L('تجاهل', 'Discard')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={S.g2}>
              {[['poNo',L('رقم أمر الشراء','PO Number'),'text'],
                ['date',L('تاريخ الطلب','Order Date'),'date'],
                ['deliveryDate',L('تاريخ التسليم المتوقع','Expected Delivery'),'date'],
                ['items',L('عدد الأصناف','Items Count'),'number'],
                ['totalAmount',L('المبلغ الإجمالي (د.ع)','Total Amount (IQD)'),'number']
              ].map(([k,lbl,tp]) => (
                <label key={k}>
                  <span style={S.fl}>{lbl}</span>
                  <input type={tp} style={S.fi} value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>
                </label>
              ))}
              {[['title',L('عنوان المشتريات','Title (Arabic)')],
                ['titleEn','Title (English)'],
                ['supplier',L('المورد','Supplier (Arabic)')],
                ['supplierEn','Supplier (English)']
              ].map(([k,lbl]) => (
                <label key={k} style={{gridColumn:'span 2'}}>
                  <span style={S.fl}>{lbl}</span>
                  <input style={S.fi} value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>
                </label>
              ))}
              {multiHospitalEnabled && (
                <label style={{gridColumn:'span 2'}}>
                  <span style={S.fl}>{L('المنشأة','Facility')}</span>
                  <select style={S.fi} value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))}>
                    <option value="">—</option>
                    {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span style={S.fl}>{L('الأولوية','Priority')}</span>
                <select style={S.fi} value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                  {Object.entries(PRIORITY_CONFIG).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
              <label>
                <span style={S.fl}>{L('الحالة','Status')}</span>
                <select style={S.fi} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                  {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={savePO}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
