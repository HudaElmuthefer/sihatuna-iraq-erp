/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import { FaFileExcel } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import { api } from '../api';

const BANNER_GRADIENT = 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)';

const RX_STATUS = {
  pending:   { ar:'بانتظار الصرف', en:'Pending Dispense', color:'#f59e0b', bg:'#fef3c7' },
  dispensed: { ar:'تم الصرف',      en:'Dispensed',        color:'#10b981', bg:'#d1fae5' },
  partial:   { ar:'صرف جزئي',      en:'Partial',          color:'#1a6bab', bg:'#dbeafe' },
  cancelled: { ar:'ملغي',          en:'Cancelled',        color:'#ef4444', bg:'#fee2e2' },
};

const DRUG_CAT = {
  antibiotic:  { ar:'مضاد حيوي',    en:'Antibiotic',    color:'#ef4444' },
  painkiller:  { ar:'مسكن ألم',     en:'Painkiller',    color:'#f59e0b' },
  chronic:     { ar:'أمراض مزمنة',  en:'Chronic',       color:'#8b5cf6' },
  vitamin:     { ar:'فيتامينات',    en:'Vitamins',      color:'#10b981' },
  cardiac:     { ar:'قلب وأوعية',   en:'Cardiac',       color:'#ef4444' },
  hormone:     { ar:'هرمونات',      en:'Hormones',      color:'#ec4899' },
  other:       { ar:'أخرى',         en:'Other',         color:'#6b7280' },
};

const EMPTY_RX   = { prescNo:'', patientName:'', patientId:'', doctorName:'', date:'', items:[], status:'pending', dispensedBy:'', totalCost:0, notes:'' };
const EMPTY_ITEM = { name:'', qty:1, unit:'Tablet', dosage:'' };
const EMPTY_DRUG = { code:'', name:'', nameEn:'', category:'other', form:'Tablet', strength:'', manufacturer:'', unitCost:0, qty:0, minQty:10, maxQty:500, expiry:'', notes:'' };

export default function PharmacyPage() {
  const { pharmacyOrders, setPharmacyOrders, inventory, setInventory, lang, showToast, user, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;
  const ar = lang === 'ar';

  const [tab, setTab]           = useState('prescriptions');
  const [search, setSearch]     = useState('');
  const [drugSearch, setDrugSearch] = useState('');
  // ── تحديد متعدد للحذف الجماعي (الوصفات والأدوية منفصلين) ─────────────────
  const [selectedRxIds, setSelectedRxIds] = useState(new Set());
  const [selectedDrugIds, setSelectedDrugIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(null); // 'rx' | 'drug' | null
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleRxSelect = (id) => setSelectedRxIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDrugSelect = (id) => setSelectedDrugIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter]       = useState('all');

  // ── استيراد من Excel (الوصفات فقط) ────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);

  // Prescription modal
  const [showRxModal, setShowRxModal] = useState(false);
  const [editRxId, setEditRxId]       = useState(null);
  const [rxForm, setRxForm]           = useState(EMPTY_RX);
  const [newItem, setNewItem]         = useState(EMPTY_ITEM);

  // Drug modal
  const [showDrugModal, setShowDrugModal] = useState(false);
  const [editDrugId, setEditDrugId]       = useState(null);
  const [drugForm, setDrugForm]           = useState(EMPTY_DRUG);

  // Filtered prescriptions
  const filteredRx = useMemo(() => pharmacyOrders.filter(rx => {
    const q = search.toLowerCase();
    return (!q || rx.patientName.includes(q) || rx.prescNo.toLowerCase().includes(q))
      && (statusFilter === 'all' || rx.status === statusFilter);
  }), [pharmacyOrders, search, statusFilter]);
  const { pageItems: rxPageItems, currentPage: rxCurrentPage, setCurrentPage: setRxCurrentPage, totalPages: rxTotalPages, totalItems: rxTotalItems } = usePagination(filteredRx, 50);

  // Drugs from inventory (medicine only)
  const drugs = useMemo(() => {
    const meds = (inventory || []).filter(i => i.category === 'medicine');
    return {
      all:       meds,
      available: meds.filter(i => i.status === 'active'),
      low:       meds.filter(i => i.status === 'low'),
      out:       meds.filter(i => i.status === 'out'),
    };
  }, [inventory]);

  const filteredDrugs = useMemo(() => {
    const q = drugSearch.toLowerCase();
    return drugs.all.filter(d =>
      !q || d.name?.includes(q) || d.nameEn?.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q)
    ).filter(d => catFilter === 'all' || d.drugCat === catFilter);
  }, [drugs, drugSearch, catFilter]);

  const stats = useMemo(() => ({
    total:     pharmacyOrders.length,
    pending:   pharmacyOrders.filter(r => r.status === 'pending').length,
    dispensed: pharmacyOrders.filter(r => r.status === 'dispensed').length,
    revenue:   pharmacyOrders.filter(r => r.status === 'dispensed').reduce((s,r) => s + r.totalCost, 0),
  }), [pharmacyOrders]);

  const n = v => Number(v).toLocaleString(lang==='ar'?'ar-IQ':'en-US');

  // ── PRESCRIPTIONS CRUD ──────────────────────────────────────────────
  const openAddRx = () => {
    // إصلاح: pharmacyOrders.length+1 يكرر رقم وصفة موجود فعلاً بعد أي حذف
    const rYear = new Date().getFullYear();
    const rPrefix = `RX-${rYear}-`;
    const rMaxSeq = pharmacyOrders.reduce((max,r)=>{
      if (typeof r.prescNo !== 'string' || !r.prescNo.startsWith(rPrefix)) return max;
      const v = parseInt(r.prescNo.slice(rPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const no = `${rPrefix}${String(rMaxSeq+1).padStart(4,'0')}`;
    setRxForm({ ...EMPTY_RX, prescNo: no, date: new Date().toISOString().split('T')[0] });
    setEditRxId(null); setShowRxModal(true);
  };
  const addItem = () => {
    if (!newItem.name) return;
    setRxForm(p => ({ ...p, items: [...p.items, { ...newItem, id: Date.now() }] }));
    setNewItem(EMPTY_ITEM);
  };
  const removeItem = id => setRxForm(p => ({ ...p, items: p.items.filter(i => i.id !== id) }));
  const saveRx = async () => {
    if (!rxForm.patientName || rxForm.items.length === 0) { showToast(L('يرجى إضافة اسم المريض والأدوية','Please add patient name and drugs'), 'error'); return; }
    const prev = pharmacyOrders;
    if (editRxId) {
      const ur = { ...rxForm, id: editRxId };
      setPharmacyOrders(p => p.map(r => r.id === editRxId ? { ...r, ...ur } : r));
      const ok = await syncToServer('pharmacyOrders', 'update', ur);
      if (!ok) { setPharmacyOrders(prev); return; }
      showToast(L('تم التحديث','Updated'), 'success');
    } else {
      const nr = { ...rxForm, id: Date.now() };
      setPharmacyOrders(p => [...p, nr]);
      const ok = await syncToServer('pharmacyOrders', 'create', nr);
      if (!ok) { setPharmacyOrders(prev); return; }
      showToast(L('تمت إضافة الوصفة','Prescription added'), 'success');
    }
    setShowRxModal(false);
  };
  // ── إصلاح: صرف الوصفة كان يغيّر حالتها لـ"تم الصرف" بس، بدون أي خصم فعلي من
  // المخزون — يعني تنبيهات "نواقص الأدوية" ما تعكس الاستهلاك الحقيقي إطلاقاً،
  // فقط التعديلات اليدوية المباشرة على المخزون. الآن يحاول مطابقة كل دواء
  // بالوصفة مع سجل مخزون حقيقي (بالاسم) ويخصم الكمية المصروفة فعلياً.
  const dispense = async id => {
    const rx = pharmacyOrders.find(r => r.id === id);
    const prevOrders = pharmacyOrders;
    const changedOrder = { ...rx, status: 'dispensed', dispensedBy: user?.name || L('الصيدلاني','Pharmacist') };
    setPharmacyOrders(p => p.map(r => r.id === id ? changedOrder : r));
    const orderOk = await syncToServer('pharmacyOrders', 'update', changedOrder);
    if (!orderOk) { setPharmacyOrders(prevOrders); return; }

    // خصم الكميات من المخزون — مطابقة بالاسم (عربي أو إنكليزي) مع سجلات الأدوية
    for (const item of (rx?.items || [])) {
      const stockDrug = (inventory || []).find(i =>
        i.category === 'medicine' && (i.name === item.name || i.nameEn === item.name || i.name === item.nameEn)
      );
      if (stockDrug) {
        const newQty = Math.max(0, (Number(stockDrug.qty) || 0) - (Number(item.qty) || 0));
        const newStatus = newQty === 0 ? 'out' : newQty <= (stockDrug.minQty || 10) ? 'low' : 'active';
        const updatedStock = { ...stockDrug, qty: newQty, status: newStatus };
        const prevStock = inventory;
        setInventory(p => p.map(i => i.id === stockDrug.id ? updatedStock : i));
        const stockOk = await syncToServer('inventory', 'update', updatedStock);
        if (!stockOk) {
          setInventory(prevStock);
          showToast(L(`تعذّر خصم ${item.name} من المخزون`, `Failed to deduct ${item.name} from stock`), 'error');
        }
      }
      // لو ما لقينا مطابقة بالمخزون (دواء مو مسجَّل أصلاً)، نتجاهل الخصم بصمت
      // بدل ما نكسر عملية الصرف — الوصفة تنصرف بأي حال، وين لو المخزون مو دقيق 100%
    }

    showToast(L('تم صرف الوصفة','Prescription dispensed'), 'success');
  };
  const deleteRx = async id => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = pharmacyOrders;
    setPharmacyOrders(p => p.filter(r => r.id !== id));
    const ok = await syncToServer('pharmacyOrders', 'delete', { id });
    if (!ok) { setPharmacyOrders(prev); return; }
    showToast(L('تم الحذف','Deleted'), 'info');
  };
  const handleBulkDeleteRx = async () => {
    const ids = [...selectedRxIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('pharmacyOrders', 'delete', { id });
      if (ok) { setPharmacyOrders(p => p.filter(r => r.id !== id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(null);
    setSelectedRxIds(new Set());
    showToast(L(`تم حذف ${deleted} من ${ids.length} وصفة`, `Deleted ${deleted} of ${ids.length} prescriptions`), deleted === ids.length ? 'success' : 'warning');
  };

  // ── DRUGS CRUD ────────────────────────────────────────────────────────
  const openAddDrug = () => {
    // إصلاح: drugs.all.length+1 يكرر رمز دواء موجود فعلاً بعد أي حذف
    const dPrefix = `MED-`;
    const dMaxSeq = drugs.all.reduce((max,d)=>{
      if (typeof d.code !== 'string' || !d.code.startsWith(dPrefix)) return max;
      const v = parseInt(d.code.slice(dPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const no = `${dPrefix}${String(dMaxSeq+1).padStart(3,'0')}`;
    setDrugForm({ ...EMPTY_DRUG, code: no });
    setEditDrugId(null); setShowDrugModal(true);
  };
  const openEditDrug = drug => { setDrugForm({ ...drug }); setEditDrugId(drug.id); setShowDrugModal(true); };
  const saveDrug = async () => {
    if (!drugForm.name || !drugForm.code) { showToast(L('يرجى تعبئة الرمز والاسم','Please fill code and name'), 'error'); return; }
    const qty = +drugForm.qty;
    const minQty = +drugForm.minQty;
    const status = qty === 0 ? 'out' : qty <= minQty ? 'low' : 'active';
    const d = { ...drugForm, category: 'medicine', qty, minQty, maxQty: +drugForm.maxQty, unitCost: +drugForm.unitCost, status };
    // ── إصلاح حرج: كان الحفظ يحدّث الحالة المحلية بس بدون أي تزامن مع
    // الباك إند إطلاقاً — أي دواء يُضاف/يُعدَّل من هذي الصفحة كان يختفي فوراً
    // بمجرد تحديث الصفحة، رغم ظهور رسالة "تم الحفظ" ✅ (نفس نمط مشكلة إدارة
    // الجودة اللي انصلحت سابقاً، بس هنا يمس مخزون أدوية حقيقي).
    if (editDrugId) {
      const ud = { ...d, id: editDrugId };
      const prev = inventory;
      setInventory(p => p.map(i => i.id === editDrugId ? { ...i, ...ud } : i));
      const ok = await syncToServer('inventory', 'update', ud);
      if (!ok) { setInventory(prev); return; }
      showToast(L('تم التحديث','Updated'), 'success');
    } else {
      const nd = { ...d, id: Date.now(), supplier: drugForm.manufacturer };
      const prev = inventory;
      setInventory(p => [...p, nd]);
      const synced = await syncToServer('inventory', 'create', nd);
      if (!synced) { setInventory(prev); return; }
      if (typeof synced === 'object' && synced.id !== nd.id) {
        setInventory(p => p.map(i => i.id === nd.id ? synced : i));
      }
      showToast(L('تمت إضافة الدواء','Drug added'), 'success');
    }
    setShowDrugModal(false);
  };
  const deleteDrug = async id => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = inventory;
    setInventory(p => p.filter(i => i.id !== id));
    const ok = await syncToServer('inventory', 'delete', { id });
    if (!ok) { setInventory(prev); return; }
    showToast(L('تم الحذف','Deleted'), 'info');
  };
  const handleBulkDeleteDrugs = async () => {
    const ids = [...selectedDrugIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('inventory', 'delete', { id });
      if (ok) { setInventory(p => p.filter(i => i.id !== id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(null);
    setSelectedDrugIds(new Set());
    showToast(L(`تم حذف ${deleted} من ${ids.length} دواء`, `Deleted ${deleted} of ${ids.length} drugs`), deleted === ids.length ? 'success' : 'warning');
  };

  // ── STYLES ────────────────────────────────────────────────────────────
  const S = {
    page:   { padding: 24, direction: dir },
    stats:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 },
    sCard:  c => ({ background:'var(--bg-card)', borderRadius:12, padding:'14px 18px', borderTop:`3px solid ${c}` }),
    tabs:   { display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' },
    tabBtn: active => ({ padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, border: active ? 'none' : '1px solid var(--border)', background: active ? '#1a6bab' : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', fontWeight: active ? 600 : 400, display:'flex', alignItems:'center', gap:8 }),
    tb:     { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
    inp:    { padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13 },
    btn:    (c='#1a6bab') => ({ padding:'8px 16px', background:c, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }),
    smBtn:  (c='#6b7280') => ({ padding:'4px 10px', background:c, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }),
    rxCard: { background:'var(--bg-card)', borderRadius:12, padding:18, marginBottom:12, border:'1px solid var(--border)' },
    badge:  (c,bg) => ({ display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, color:c, background:bg }),
    table:  { width:'100%', borderCollapse:'collapse', background:'var(--bg-card)', borderRadius:12, overflow:'hidden' },
    th:     { padding:'10px 12px', textAlign: dir==='rtl'?'right':'left', background:'var(--bg-tertiary)', fontSize:11, fontWeight:600, color:'var(--text-secondary)', borderBottom:'1px solid var(--border)' },
    td:     { padding:'10px 12px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text-primary)', verticalAlign:'middle' },
    modal:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
    mbox:   (w=540) => ({ background:'var(--bg-primary)', borderRadius:16, padding:28, width:'100%', maxWidth:w, maxHeight:'90vh', overflowY:'auto', direction:dir }),
    g2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
    fl:     { display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 },
    fi:     { width:'100%', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13, boxSizing:'border-box' },
  };

  const tabCount = (k) => ({ prescriptions: pharmacyOrders.length, available: drugs.available.length, shortage: drugs.low.length + drugs.out.length }[k] || 0);
  const tabLabel = k => ({ prescriptions: L('📋 الوصفات الطبية','📋 Prescriptions'), available: L('✅ الأدوية المتوفرة','✅ Drug Inventory'), shortage: L('⚠️ نواقص الأدوية','⚠️ Drug Shortage') }[k]);

  return (
    <div style={S.page}>
      {/* Header */}
      <PageBanner
        icon="💊"
        title={L('الصيدلية','Pharmacy')}
        subtitle={L('إدارة الوصفات الطبية وصرف الأدوية وإدارة المخزون','Manage prescriptions, drug dispensing and inventory')}
        gradient={BANNER_GRADIENT}
      >
        {tab === 'prescriptions' && (
          <>
            <button style={{...S.btn(), background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)'}} onClick={() => setShowImport(true)}>
              <FaFileExcel style={{marginInlineEnd:6}} /> {ar ? 'استيراد من Excel' : 'Import from Excel'}
            </button>
            <ExcelExportButton apiName="pharmacyOrders" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }} />
            <button style={{...S.btn(), background:'#fff', color:'#14532d'}} onClick={openAddRx}>+ {L('وصفة جديدة','New Prescription')}</button>
          </>
        )}
        {(tab === 'available' || tab === 'shortage') && <button style={{...S.btn(), background:'#fff', color:'#14532d'}} onClick={openAddDrug}>+ {L('إضافة دواء','Add Drug')}</button>}
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="pharmacyOrders"
          title={ar ? 'استيراد وصفات طبية من Excel' : 'Import Prescriptions from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/pharmacyOrders');
              if (Array.isArray(fresh)) setPharmacyOrders(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً وتظهر بأول تحديث لاحق */ }
          }}
        />
      )}

      {/* Stats */}
      <div style={S.stats}>
        {[[L('إجمالي الوصفات','Total Rx'), stats.total, '#1a6bab'], [L('بانتظار الصرف','Pending'), stats.pending, '#f59e0b'], [L('تم الصرف','Dispensed'), stats.dispensed, '#10b981']].map(([l,v,c],i) => (
          <div key={i} style={S.sCard(c)}>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>{v}</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:3 }}>{l}</div>
          </div>
        ))}
        <div style={S.sCard('#8b5cf6')}>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>{n(stats.revenue)}</div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:3 }}>{L('إيراد الصيدلية (د.ع)','Pharmacy Revenue (IQD)')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {['prescriptions','available','shortage'].map(k => (
          <button key={k} style={S.tabBtn(tab===k)} onClick={()=>setTab(k)}>
            {tabLabel(k)}
            <span style={{ background: tab===k?'rgba(255,255,255,0.25)':'var(--bg-tertiary)', color: tab===k?'#fff':'var(--text-secondary)', borderRadius:12, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{tabCount(k)}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: PRESCRIPTIONS ── */}
      {tab === 'prescriptions' && <>
        <div style={S.tb}>
          <input style={{...S.inp, minWidth:200}} placeholder={L('🔍 بحث...','🔍 Search...')} value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">{L('كل الحالات','All Status')}</option>
            {Object.entries(RX_STATUS).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
          </select>
        </div>

        {selectedRxIds.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12, padding:'8px 12px', borderRadius:8, background:'var(--bg-secondary)' }}>
            <span style={{ fontSize:13, fontWeight:600 }}>{L(`${selectedRxIds.size} محدَّد`, `${selectedRxIds.size} selected`)}</span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setSelectedRxIds(new Set())} style={S.btn('#6b7280')}>{L('إلغاء التحديد','Clear Selection')}</button>
              <button onClick={() => setBulkDeleteConfirm('rx')} style={S.btn('#ef4444')}>🗑 {L(`حذف المحدَّد (${selectedRxIds.size})`, `Delete Selected (${selectedRxIds.size})`)}</button>
            </div>
          </div>
        )}
        {rxPageItems.map(rx => {
          const st = RX_STATUS[rx.status] || RX_STATUS.pending;
          return (
            <div key={rx.id} style={S.rxCard}>
              <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                    <input type="checkbox" checked={selectedRxIds.has(rx.id)} onChange={() => toggleRxSelect(rx.id)} />
                    <code style={{ fontSize:11, background:'var(--bg-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--text-secondary)' }}>{rx.prescNo}</code>
                    <span style={S.badge(st.color, st.bg)}>{L(st.ar, st.en)}</span>
                  </div>
                  <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:600, color:'var(--text-primary)' }}>{rx.patientName}</h3>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>👨‍⚕️ {rx.doctorName} | 📅 {rx.date}</div>
                  {rx.dispensedBy && <div style={{ fontSize:11, color:'#10b981', marginTop:4 }}>✅ {L('صُرف بواسطة:','Dispensed by:')} {rx.dispensedBy}</div>}
                </div>
                <div style={{ textAlign:'center', minWidth:100 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#1a6bab' }}>{n(rx.totalCost)}</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{L('د.ع','IQD')}</div>
                </div>
              </div>
              <div style={{ marginTop:12, background:'var(--bg-tertiary)', borderRadius:8, padding:10 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>
                  {L('الأدوية الموصوفة','Prescribed drugs')} ({rx.items?.length||0} {L('صنف','items')}):
                </div>
                {(rx.items||[]).map((item,i) => (
                  <div key={i} style={{ display:'flex', gap:12, alignItems:'center', padding:'5px 0', borderBottom: i<rx.items.length-1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', flex:1 }}>💊 {lang==='ar'?item.name:(item.nameEn||item.name)}</span>
                    <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{item.qty} {lang==='ar'?item.unit:(item.unitEn||item.unit)}</span>
                    <span style={{ fontSize:11, color:'var(--text-secondary)', minWidth:120 }}>{lang==='ar'?item.dosage:(item.dosageEn||item.dosage)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10, flexWrap:'wrap' }}>
                {rx.status==='pending' && <button onClick={()=>dispense(rx.id)} style={S.btn('#10b981')}>✅ {L('صرف الوصفة','Dispense')}</button>}
                <button onClick={()=>{ setRxForm({...rx,items:rx.items||[]}); setEditRxId(rx.id); setShowRxModal(true); }} style={S.btn('#6b7280')}>✏️ {L('تعديل','Edit')}</button>
                <button onClick={()=>deleteRx(rx.id)} style={S.btn('#ef4444')}>🗑 {L('حذف','Delete')}</button>
              </div>
            </div>
          );
        })}
        {filteredRx.length===0 && <div style={{ textAlign:'center', padding:48, color:'var(--text-secondary)', background:'var(--bg-secondary)', borderRadius:12 }}><div style={{ fontSize:40, marginBottom:8 }}>💊</div><p>{L('لا توجد وصفات','No prescriptions found')}</p></div>}
        <Pagination currentPage={rxCurrentPage} totalPages={rxTotalPages} onPageChange={setRxCurrentPage} totalItems={rxTotalItems} pageSize={50} lang={lang} />
      </>}

      {/* ── TAB: DRUG INVENTORY ── */}
      {tab === 'available' && <>
        <div style={S.tb}>
          <input style={{...S.inp, minWidth:200}} placeholder={L('🔍 بحث بالاسم أو الرمز...','🔍 Search by name or code...')} value={drugSearch} onChange={e=>setDrugSearch(e.target.value)}/>
          <select style={S.inp} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
            <option value="all">{L('كل الفئات','All Categories')}</option>
            {Object.entries(DRUG_CAT).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
          </select>
          <span style={{ color:'var(--text-secondary)', fontSize:12 }}>{filteredDrugs.length} {L('صنف','items')}</span>
        </div>

        {selectedDrugIds.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12, padding:'8px 12px', borderRadius:8, background:'var(--bg-secondary)' }}>
            <span style={{ fontSize:13, fontWeight:600 }}>{L(`${selectedDrugIds.size} محدَّد`, `${selectedDrugIds.size} selected`)}</span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setSelectedDrugIds(new Set())} style={S.btn('#6b7280')}>{L('إلغاء التحديد','Clear Selection')}</button>
              <button onClick={() => setBulkDeleteConfirm('drug')} style={S.btn('#ef4444')}>🗑 {L(`حذف المحدَّد (${selectedDrugIds.size})`, `Delete Selected (${selectedDrugIds.size})`)}</button>
            </div>
          </div>
        )}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>
                <input type="checkbox" checked={filteredDrugs.length > 0 && filteredDrugs.every(d => selectedDrugIds.has(d.id))} onChange={() => {
                  setSelectedDrugIds(prev => {
                    const allSelected = filteredDrugs.every(d => prev.has(d.id));
                    const next = new Set(prev);
                    filteredDrugs.forEach(d => allSelected ? next.delete(d.id) : next.add(d.id));
                    return next;
                  });
                }} />
              </th>
              {(L(['الرمز','اسم الدواء','الشكل','التركيز','الكمية','الحد الأدنى','تاريخ الانتهاء','الحالة',''],['Code','Drug Name','Form','Strength','Qty','Min Qty','Expiry','Status',''])).map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredDrugs.map(d => {
              const statusBadge = d.status==='out'
                ? { label:L('نفذ','Out'), c:'#ef4444', bg:'#fee2e2' }
                : d.status==='low'
                ? { label:L('منخفض','Low'), c:'#f59e0b', bg:'#fef3c7' }
                : { label:L('متوفر','Available'), c:'#10b981', bg:'#d1fae5' };
              const pct = d.maxQty > 0 ? Math.min(100, (d.qty/d.maxQty)*100) : 0;
              return (
                <tr key={d.id}>
                  <td style={S.td}><input type="checkbox" checked={selectedDrugIds.has(d.id)} onChange={() => toggleDrugSelect(d.id)} /></td>
                  <td style={S.td}><code style={{ fontSize:10, background:'var(--bg-tertiary)', padding:'2px 6px', borderRadius:4 }}>{d.code}</code></td>
                  <td style={S.td}>
                    <div style={{ fontWeight:600 }}>{L(d.name, d.nameEn||d.name)}</div>
                    {d.manufacturer && <div style={{ fontSize:10, color:'var(--text-secondary)' }}>{d.manufacturer}</div>}
                  </td>
                  <td style={{...S.td, fontSize:11}}>{d.form || d.unit || '—'}</td>
                  <td style={{...S.td, fontSize:11}}>{d.strength || '—'}</td>
                  <td style={S.td}>
                    <div style={{ fontWeight:700, color: d.status==='out'?'#ef4444': d.status==='low'?'#f59e0b':'#10b981' }}>{d.qty} {d.unit}</div>
                    <div style={{ width:60, height:5, background:'var(--border)', borderRadius:3, marginTop:3 }}>
                      <div style={{ width:`${pct}%`, height:'100%', background: d.status==='out'?'#ef4444': d.status==='low'?'#f59e0b':'#10b981', borderRadius:3 }}/>
                    </div>
                  </td>
                  <td style={{...S.td, fontSize:11, color:'var(--text-secondary)'}}>{d.minQty}</td>
                  <td style={{...S.td, fontSize:11, color: d.expiry&&new Date(d.expiry)<new Date()?'#ef4444':'var(--text-secondary)'}}>{d.expiry||'—'}</td>
                  <td style={S.td}><span style={S.badge(statusBadge.c, statusBadge.bg)}>{statusBadge.label}</span></td>
                  <td style={S.td}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>openEditDrug(d)} style={S.smBtn('#1a6bab')}>✏️</button>
                      <button onClick={()=>deleteDrug(d.id)} style={S.smBtn('#ef4444')}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredDrugs.length===0 && <tr><td colSpan={10} style={{...S.td, textAlign:'center', padding:40, color:'var(--text-secondary)'}}>{L('لا توجد أدوية','No drugs found')}</td></tr>}
          </tbody>
        </table>
      </>}

      {/* ── TAB: SHORTAGE ── */}
      {tab === 'shortage' && <>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
          <div style={S.sCard('#f59e0b')}>
            <div style={{ fontSize:26, fontWeight:700, color:'#f59e0b' }}>{drugs.low.length}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{L('مخزون منخفض','Low Stock')}</div>
          </div>
          <div style={S.sCard('#ef4444')}>
            <div style={{ fontSize:26, fontWeight:700, color:'#ef4444' }}>{drugs.out.length}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{L('نفذت الكمية','Out of Stock')}</div>
          </div>
          {(drugs.low.length + drugs.out.length) > 0 && (
            <div style={{ background:'#fff3cd', borderRadius:12, padding:'14px 18px', border:'1px solid #f59e0b' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#856404' }}>⚠️ {L('تنبيه','Alert')}</div>
              <div style={{ fontSize:11, color:'#664d03', marginTop:4 }}>{L('يرجى إنشاء طلب شراء للأصناف الناقصة','Create a purchase order for shortage items')}</div>
            </div>
          )}
        </div>

        <table style={S.table}>
          <thead>
            <tr>{(L(['الرمز','اسم الدواء','الكمية الحالية','الحد الأدنى','الحالة','المورد','تاريخ الانتهاء',''],['Code','Drug Name','Current Qty','Min Qty','Status','Supplier','Expiry',''])).map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {[...drugs.out, ...drugs.low].map(d => (
              <tr key={d.id} style={{ background: d.status==='out'?'rgba(239,68,68,0.04)':'rgba(245,158,11,0.04)' }}>
                <td style={S.td}><code style={{ fontSize:10, background:'var(--bg-tertiary)', padding:'2px 6px', borderRadius:4 }}>{d.code}</code></td>
                <td style={S.td}><div style={{ fontWeight:600 }}>{L(d.name, d.nameEn||d.name)}</div></td>
                <td style={S.td}><span style={{ fontWeight:700, fontSize:14, color: d.status==='out'?'#ef4444':'#f59e0b' }}>{d.qty}</span></td>
                <td style={{...S.td, color:'var(--text-secondary)'}}>{d.minQty}</td>
                <td style={S.td}>
                  <span style={S.badge(d.status==='out'?'#ef4444':'#f59e0b', d.status==='out'?'#fee2e2':'#fef3c7')}>
                    {d.status==='out' ? L('نفذ','Out of Stock') : L('منخفض','Low Stock')}
                  </span>
                </td>
                <td style={{...S.td, fontSize:11, color:'var(--text-secondary)'}}>{d.supplier||'—'}</td>
                <td style={{...S.td, fontSize:11, color: d.expiry&&new Date(d.expiry)<new Date()?'#ef4444':'var(--text-secondary)'}}>{d.expiry||'—'}</td>
                <td style={S.td}>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>openEditDrug(d)} style={S.smBtn('#1a6bab')}>✏️ {L('تعديل','Edit')}</button>
                    <button onClick={()=>deleteDrug(d.id)} style={S.smBtn('#ef4444')}>🗑</button>
                    <a href="/procurement" style={{ padding:'4px 10px', background:'#f59e0b', color:'#fff', borderRadius:6, fontSize:11, fontWeight:600, textDecoration:'none' }}>🛒 {L('طلب شراء','Order')}</a>
                  </div>
                </td>
              </tr>
            ))}
            {drugs.low.length===0 && drugs.out.length===0 && (
              <tr><td colSpan={8} style={{...S.td, textAlign:'center', padding:48, color:'#10b981', fontSize:16}}>✅ {L('لا توجد نواقص في الأدوية حالياً','No drug shortages currently')}</td></tr>
            )}
          </tbody>
        </table>
      </>}

      {/* ── PRESCRIPTION MODAL ── */}
      {showRxModal && (
        <div style={S.modal} onClick={e => e.target===e.currentTarget && setShowRxModal(false)}>
          <div style={S.mbox()}>
            <h3 style={{ margin:'0 0 20px', color:'var(--text-primary)' }}>{editRxId ? L('✏️ تعديل الوصفة','✏️ Edit Prescription') : L('💊 وصفة طبية جديدة','💊 New Prescription')}</h3>
            <div style={S.g2}>
              <label><span style={S.fl}>{L('رقم الوصفة','Rx Number')}</span><input style={S.fi} value={rxForm.prescNo||''} onChange={e=>setRxForm(p=>({...p,prescNo:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('التاريخ','Date')}</span><input type="date" style={S.fi} value={rxForm.date||''} onChange={e=>setRxForm(p=>({...p,date:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('اسم المريض','Patient Name')}</span><input style={S.fi} value={rxForm.patientName||''} onChange={e=>setRxForm(p=>({...p,patientName:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('رقم المريض','Patient ID')}</span><input style={S.fi} value={rxForm.patientId||''} onChange={e=>setRxForm(p=>({...p,patientId:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الطبيب','Doctor')}</span><input style={S.fi} value={rxForm.doctorName||''} onChange={e=>setRxForm(p=>({...p,doctorName:e.target.value}))}/></label>
              {multiHospitalEnabled && (
                <label><span style={S.fl}>{L('المنشأة','Facility')}</span>
                  <select style={S.fi} value={rxForm.hospitalId||''} onChange={e=>setRxForm(p=>({...p,hospitalId:e.target.value}))}>
                    <option value="">—</option>
                    {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </label>
              )}
              <label><span style={S.fl}>{L('التكلفة الإجمالية (د.ع)','Total Cost (IQD)')}</span><input type="number" style={S.fi} value={rxForm.totalCost||0} onChange={e=>setRxForm(p=>({...p,totalCost:+e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الحالة','Status')}</span>
                <select style={S.fi} value={rxForm.status} onChange={e=>setRxForm(p=>({...p,status:e.target.value}))}>
                  {Object.entries(RX_STATUS).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
            </div>
            {/* Add drug items */}
            <div style={{ marginTop:16, padding:14, background:'var(--bg-tertiary)', borderRadius:10 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', marginBottom:10 }}>{L('إضافة دواء:','Add drug:')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8, marginBottom:8 }}>
                <input style={S.fi} placeholder={L('اسم الدواء','Drug name')} value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))}/>
                <input type="number" style={S.fi} placeholder={L('الكمية','Qty')} min={1} value={newItem.qty} onChange={e=>setNewItem(p=>({...p,qty:+e.target.value}))}/>
                <input style={S.fi} placeholder={L('وحدة','Unit')} value={newItem.unit} onChange={e=>setNewItem(p=>({...p,unit:e.target.value}))}/>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input style={{...S.fi,flex:1}} placeholder={L('الجرعة (3×يومياً...)','Dosage instructions...')} value={newItem.dosage} onChange={e=>setNewItem(p=>({...p,dosage:e.target.value}))}/>
                <button type="button" onClick={addItem} style={S.btn('#10b981')}>+ {L('إضافة','Add')}</button>
              </div>
              {(rxForm.items||[]).length > 0 && (
                <div style={{ marginTop:10 }}>
                  {rxForm.items.map((item,i) => (
                    <div key={item.id||i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ flex:1, fontSize:12 }}>💊 {lang==='ar'?item.name:(item.nameEn||item.name)} — {item.qty} {lang==='ar'?item.unit:(item.unitEn||item.unit)} — {lang==='ar'?item.dosage:(item.dosageEn||item.dosage)}</span>
                      <button type="button" onClick={()=>removeItem(item.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowRxModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={saveRx}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRUG MODAL ── */}
      {showDrugModal && (
        <div style={S.modal} onClick={e => e.target===e.currentTarget && setShowDrugModal(false)}>
          <div style={S.mbox(580)}>
            <h3 style={{ margin:'0 0 20px', color:'var(--text-primary)' }}>{editDrugId ? L('✏️ تعديل الدواء','✏️ Edit Drug') : L('💊 إضافة دواء جديد','💊 Add New Drug')}</h3>
            <div style={S.g2}>
              <label><span style={S.fl}>{L('رمز الدواء','Drug Code')}</span><input style={S.fi} value={drugForm.code||''} onChange={e=>setDrugForm(p=>({...p,code:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الفئة','Category')}</span>
                <select style={S.fi} value={drugForm.drugCat||'other'} onChange={e=>setDrugForm(p=>({...p,drugCat:e.target.value}))}>
                  {Object.entries(DRUG_CAT).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('اسم الدواء بالعربية','Drug Name (Arabic)')}</span><input style={S.fi} value={drugForm.name||''} onChange={e=>setDrugForm(p=>({...p,name:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('اسم الدواء بالإنجليزية','Drug Name (English)')}</span><input style={S.fi} value={drugForm.nameEn||''} onChange={e=>setDrugForm(p=>({...p,nameEn:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الشكل الدوائي','Form')}</span>
                <select style={S.fi} value={drugForm.form||L('حبة','Tablet')} onChange={e=>setDrugForm(p=>({...p,form:e.target.value,unit:e.target.value}))}>
                  {[['Tablet','حبة'],['Capsule','كبسول'],['Syrup','شراب'],['Injection','حقن'],['Cream','كريم'],['Drops','قطرة'],['Patch','لصقة']].map(([en,ar]) => <option key={en} value={lang==='ar'?ar:en}>{lang==='ar'?ar:en}</option>)}
                </select>
              </label>
              <label><span style={S.fl}>{L('التركيز','Strength')}</span><input style={S.fi} placeholder="مثال: 500mg" value={drugForm.strength||''} onChange={e=>setDrugForm(p=>({...p,strength:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الشركة المصنّعة','Manufacturer')}</span><input style={S.fi} value={drugForm.manufacturer||''} onChange={e=>setDrugForm(p=>({...p,manufacturer:e.target.value,supplier:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('سعر الوحدة (د.ع)','Unit Price (IQD)')}</span><input type="number" style={S.fi} value={drugForm.unitCost||0} onChange={e=>setDrugForm(p=>({...p,unitCost:+e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الكمية الحالية','Current Qty')}</span><input type="number" style={S.fi} value={drugForm.qty||0} onChange={e=>setDrugForm(p=>({...p,qty:+e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الحد الأدنى','Min Qty')}</span><input type="number" style={S.fi} value={drugForm.minQty||10} onChange={e=>setDrugForm(p=>({...p,minQty:+e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الحد الأقصى','Max Qty')}</span><input type="number" style={S.fi} value={drugForm.maxQty||500} onChange={e=>setDrugForm(p=>({...p,maxQty:+e.target.value}))}/></label>
              <label><span style={S.fl}>{L('تاريخ انتهاء الصلاحية','Expiry Date')}</span><input type="date" style={S.fi} value={drugForm.expiry||''} onChange={e=>setDrugForm(p=>({...p,expiry:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('ملاحظات','Notes')}</span><input style={S.fi} value={drugForm.notes||''} onChange={e=>setDrugForm(p=>({...p,notes:e.target.value}))}/></label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowDrugModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn('#10b981')} onClick={saveDrug}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>
                {bulkDeleteConfirm === 'rx'
                  ? L(`حذف ${selectedRxIds.size} وصفة؟`, `Delete ${selectedRxIds.size} prescriptions?`)
                  : L(`حذف ${selectedDrugIds.size} دواء؟`, `Delete ${selectedDrugIds.size} drugs?`)}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{L('هل أنت متأكد؟ لا يمكن التراجع.', 'Are you sure? This cannot be undone.')}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button style={S.btn('#6b7280')} onClick={() => setBulkDeleteConfirm(null)} disabled={bulkDeleting}>{L('إلغاء','Cancel')}</button>
                <button style={S.btn('#ef4444')} onClick={bulkDeleteConfirm === 'rx' ? handleBulkDeleteRx : handleBulkDeleteDrugs} disabled={bulkDeleting}>{bulkDeleting ? '...' : L('حذف','Delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
