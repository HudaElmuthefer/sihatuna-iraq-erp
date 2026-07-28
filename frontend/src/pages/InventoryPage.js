/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect } from 'react';
import useServerPagination from '../hooks/useServerPagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import { api } from '../api';

const BANNER_GRADIENT = 'linear-gradient(135deg, #78350f 0%, #b45309 100%)';

const STATUS_CONFIG = {
  active: { label: 'متوفر', labelEn: 'Available', color: '#10b981', bg: '#d1fae5' },
  low:    { label: 'منخفض', labelEn: 'Low Stock', color: '#f59e0b', bg: '#fef3c7' },
  out:    { label: 'نفذ',   labelEn: 'Out of Stock', color: '#ef4444', bg: '#fee2e2' },
};

const CAT_CONFIG = {
  medicine:  { label: 'أدوية',        labelEn: 'Medicine',   icon: '💊', color: '#1a6bab' },
  supplies:  { label: 'مستلزمات',    labelEn: 'Supplies',   icon: '🩺', color: '#10b981' },
  equipment: { label: 'معدات',        labelEn: 'Equipment',  icon: '🔧', color: '#8b5cf6' },
};

const EMPTY = { code:'', name:'', nameEn:'', category:'medicine', unit:'Box', qty:0, minQty:0, maxQty:0, unitCost:0, supplier:'', location:'', expiry:'', status:'active' };

export default function InventoryPage() {
  const { inventory, setInventory, lang, showToast, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showMovement, setShowMovement] = useState(null);
  const [movQty, setMovQty] = useState(0);
  const [movType, setMovType] = useState('in');
  const [movNote, setMovNote] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  // تأخير البحث 350 مللي ثانية بعد آخر حرف — يمنع إرسال طلب لكل ضغطة زر
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── الجلب المُرقَّم من السيرفر ────────────────────────────────────────────
  // الجدول المعروض هنا يجيب فقط الصفحة الحالية من الخادم (بحث بالاسم/الرمز +
  // فلترة بالتصنيف والحالة تصير كلها بقاعدة البيانات). مصفوفة `inventory`
  // بالسياق العام تبقى محمَّلة كاملة كما هي — تحتاجها صفحة الصيدلية لخصم
  // المخزون عند صرف الوصفات، ولوحة التحكم للإحصائيات (stats تحتها بالأسفل).
  const { data: pageItems, page: currentPage, setPage: setCurrentPage, total: totalItems, totalPages, loading, refetch } =
    useServerPagination('inventory', { search: debouncedSearch, status: statusFilter, filters: { category: catFilter }, pageSize: 50 });

  const stats = useMemo(() => ({
    total: inventory.length,
    low: inventory.filter(i => i.status === 'low').length,
    out: inventory.filter(i => i.status === 'out').length,
    totalValue: inventory.reduce((s, i) => s + i.qty * i.unitCost, 0),
  }), [inventory]);

  const openAdd = () => { setForm(EMPTY); setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setForm({ ...item }); setEditItem(item.id); setShowModal(true); };

  const computeStatus = (qty, min) => qty === 0 ? 'out' : qty <= min ? 'low' : 'active';

  const saveItem = async () => {
    if (!form.code || !form.name) { showToast(L('يرجى تعبئة الرمز والاسم','Please fill code and name'), 'error'); return; }
    const item = { ...form, qty: +form.qty, minQty: +form.minQty, maxQty: +form.maxQty, unitCost: +form.unitCost, status: computeStatus(+form.qty, +form.minQty) };
    if (editItem) {
      const ui = { ...item, id: editItem };
      const prev = inventory;
      setInventory(p => p.map(i => i.id === editItem ? { ...i, ...ui } : i));
      const ok = await syncToServer('inventory', 'update', ui);
      if (!ok) { setInventory(prev); return; }
      showToast(L('تم التحديث','Updated'), 'success');
    } else {
      const ni = { ...item, id: Date.now() };
      setInventory(p => [...p, ni]);
      const ok = await syncToServer('inventory', 'create', ni);
      if (!ok) { setInventory(p => p.filter(i => i.id !== ni.id)); return; }
      showToast(L('تمت الإضافة','Item added'), 'success');
    }
    setShowModal(false);
    refetch();
  };

  const deleteItem = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = inventory;
    setInventory(p => p.filter(i => i.id !== id));
    const ok = await syncToServer('inventory', 'delete', { id });
    if (!ok) { setInventory(prev); return; }
    showToast(L('تم الحذف','Deleted'), 'info');
    refetch();
  };

  const applyMovement = async () => {
    if (!movQty || movQty <= 0) { showToast(L('أدخل كمية صحيحة','Enter valid quantity'), 'error'); return; }
    const prev = inventory;
    const current = inventory.find(i => i.id === showMovement.id);
    if (!current) return;
    const newQty = movType === 'in' ? current.qty + +movQty : Math.max(0, current.qty - +movQty);
    const changed = { ...current, qty: newQty, status: computeStatus(newQty, current.minQty) };
    setInventory(p => p.map(i => i.id === showMovement.id ? changed : i));
    const ok = await syncToServer('inventory', 'update', changed);
    if (!ok) { setInventory(prev); return; }
    showToast(movType==='in'?L('تمت إضافة الكمية','Stock added'):L('تم صرف الكمية','Stock issued'), 'success');
    setShowMovement(null); setMovQty(0); setMovNote('');
    refetch();
  };

  const S = {
    page: { padding: '24px', direction: dir },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
    title: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
    stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 },
    statCard: (c) => ({ background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px', borderTop: `3px solid ${c}` }),
    statNum: { fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' },
    statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
    toolbar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    input: { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 },
    select: { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 },
    btn: (c='#1a6bab') => ({ padding: '8px 16px', background: c, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }),
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden' },
    th: { padding: '12px 14px', textAlign: dir === 'rtl' ? 'right' : 'left', background: 'var(--bg-tertiary)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' },
    td: { padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)' },
    badge: (c, bg) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: c, background: bg }),
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
    modalBox: { background: 'var(--bg-primary)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', direction: dir },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
    fieldLabel: { display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 },
    fieldInput: { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' },
    progBar: (pct, c) => ({ width: `${Math.min(100, pct)}%`, height: 6, background: c, borderRadius: 3, transition: 'width 0.4s' }),
  };

  const n = (v) => Number(v).toLocaleString(lang==='ar'?'ar-IQ':'en-US');

  return (
    <div style={S.page}>
      <PageBanner
        icon="📦"
        title={lang === 'ar' ? 'المخزون والمستودعات' : 'Inventory & Warehouse'}
        subtitle={lang === 'ar' ? 'إدارة الأدوية والمستلزمات والمعدات' : 'Manage medicines, supplies and equipment'}
        gradient={BANNER_GRADIENT}
      >
        <button style={{ ...S.btn(), background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} onClick={() => setShowImport(true)}>
          📊 {L('استيراد من Excel', 'Import from Excel')}
        </button>
        <ExcelExportButton apiName="inventory" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
        <button style={{ ...S.btn(), background: '#fff', color: '#78350f' }} onClick={openAdd}>+ {L('إضافة صنف','Add Item')}</button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="inventory"
          title={L('استيراد مخزون من Excel', 'Import Inventory from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/inventory');
              if (Array.isArray(fresh)) setInventory(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
            refetch();
          }}
        />
      )}

      {/* Stats */}
      <div style={S.stats}>
        <div style={S.statCard('#1a6bab')}>
          <div style={S.statNum}>{stats.total}</div>
          <div style={S.statLabel}>{lang === 'ar' ? 'إجمالي الأصناف' : 'Total Items'}</div>
        </div>
        <div style={S.statCard('#f59e0b')}>
          <div style={S.statNum}>{stats.low}</div>
          <div style={S.statLabel}>{lang === 'ar' ? 'مخزون منخفض' : 'Low Stock'}</div>
        </div>
        <div style={S.statCard('#ef4444')}>
          <div style={S.statNum}>{stats.out}</div>
          <div style={S.statLabel}>{lang === 'ar' ? 'نفذت الكمية' : 'Out of Stock'}</div>
        </div>
        <div style={S.statCard('#10b981')}>
          <div style={S.statNum}>{n(stats.totalValue)}</div>
          <div style={S.statLabel}>{lang === 'ar' ? 'قيمة المخزون (د.ع)' : 'Total Value (IQD)'}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input style={{ ...S.input, minWidth: 220 }} placeholder={L('🔍 بحث...','🔍 Search...')} value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">{L('كل الفئات','All Categories')}</option>
          {Object.entries(CAT_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.label : v.labelEn}</option>)}
        </select>
        <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.label : v.labelEn}</option>)}
        </select>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginRight: 'auto' }}>{totalItems} {L('صنف','items')}</span>
      </div>

      {/* Table */}
      <table style={S.table}>
        <thead>
          <tr>
            {(L(['الرمز','الاسم','الفئة','الكمية','الحد الأدنى','التكلفة/وحدة','المورد','الموقع','الانتهاء','الحالة',''],['Code','Name','Category','Qty','Min Qty','Unit Cost','Supplier','Location','Expiry','Status',''])).map((h) => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageItems.map(item => {
            const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
            const cat = CAT_CONFIG[item.category] || CAT_CONFIG.medicine;
            const pct = item.maxQty > 0 ? (item.qty / item.maxQty) * 100 : 0;
            return (
              <tr key={item.id} style={{ transition: 'background 0.15s' }}>
                <td style={S.td}><code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>{item.code}</code></td>
                <td style={S.td}><div style={{ fontWeight: 600 }}>{lang === 'ar' ? item.name : (item.nameEn || item.name)}</div></td>
                <td style={S.td}><span style={S.badge(cat.color, cat.color + '22')}>{cat.icon} {L(cat.label,cat.labelEn)}</span></td>
                <td style={S.td}>
                  <div style={{ fontWeight: 600, color: item.status === 'out' ? '#ef4444' : item.status === 'low' ? '#f59e0b' : 'var(--text-primary)' }}>{item.qty} {item.unit}</div>
                  <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 4 }}>
                    <div style={S.progBar(pct, item.status === 'out' ? '#ef4444' : item.status === 'low' ? '#f59e0b' : '#10b981')} />
                  </div>
                </td>
                <td style={S.td}>{item.minQty} {item.unit}</td>
                <td style={S.td}>{n(item.unitCost)} {L('د.ع','IQD')}</td>
                <td style={S.td} title={item.supplier}><span style={{ fontSize: 12 }}>{item.supplier.length > 16 ? item.supplier.slice(0,16)+'…' : item.supplier}</span></td>
                <td style={S.td}><code style={{ fontSize: 11 }}>{item.location}</code></td>
                <td style={S.td}><span style={{ fontSize: 12, color: item.expiry && new Date(item.expiry) < new Date() ? '#ef4444' : 'var(--text-secondary)' }}>{item.expiry || '—'}</span></td>
                <td style={S.td}><span style={S.badge(st.color, st.bg)}>{L(st.label,st.labelEn)}</span></td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button title={L('حركة مخزون','Stock Movement')} onClick={() => { setShowMovement(item); setMovQty(0); setMovType('in'); setMovNote(''); }} style={{ background: 'none', border: '1px solid #1a6bab', borderRadius: 6, color: '#1a6bab', cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}>↕</button>
                    <button title={lang === 'ar' ? 'تعديل' : 'Edit'} onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}>✏️</button>
                    <button title={lang === 'ar' ? 'حذف' : 'Delete'} onClick={() => deleteItem(item.id)} style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, color: '#ef4444', cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}>🗑</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {loading && (
            <tr><td colSpan={11} style={{ ...S.td, textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{lang==='ar'?'جاري التحميل...':'Loading...'}</td></tr>
          )}
          {!loading && pageItems.length === 0 && (
            <tr><td colSpan={11} style={{ ...S.td, textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>لا توجد نتائج</td></tr>
          )}
        </tbody>
      </table>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={S.modalBox}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--text-primary)' }}>{editItem?L('✏️ تعديل الصنف','✏️ Edit Item'):L('📦 إضافة صنف جديد','📦 Add New Item')}</h3>
            <div style={S.grid2}>
              {[
                ['code',     L('رمز الصنف','Item Code'),           'text'],
                ['name',     L('الاسم بالعربية','Name (Arabic)'),  'text'],
                ['nameEn',   L('الاسم بالإنجليزية','Name (EN)'),   'text'],
                ['unit',     L('وحدة القياس','Unit'),              'text'],
                ['qty',      L('الكمية الحالية','Current Qty'),    'number'],
                ['minQty',   L('الحد الأدنى','Min Qty'),           'number'],
                ['maxQty',   L('الحد الأقصى','Max Qty'),           'number'],
                ['unitCost', L('التكلفة/وحدة (د.ع)','Unit Cost'), 'number'],
                ['supplier', L('المورد','Supplier'),               'text'],
                ['location', L('موقع التخزين','Location'),         'text'],
                ['expiry',   L('تاريخ الانتهاء','Expiry Date'),    'date'],
              ].map(([k, lbl, tp]) => (
                <label key={k} style={k === 'supplier' || k === 'name' || k === 'nameEn' ? { gridColumn: 'span 2' } : {}}>
                  <span style={S.fieldLabel}>{lbl}</span>
                  <input type={tp} style={S.fieldInput} value={form[k] || ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </label>
              ))}
              <label style={{ gridColumn: 'span 2' }}>
                <span style={S.fieldLabel}>الفئة</span>
                <select style={S.fieldInput} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {Object.entries(CAT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </label>
              {multiHospitalEnabled && (
                <label style={{ gridColumn: 'span 2' }}>
                  <span style={S.fieldLabel}>{L('المنشأة','Facility')}</span>
                  <select style={S.fieldInput} value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))}>
                    <option value="">—</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setShowModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={saveItem}>{L('💾 حفظ','💾 Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {showMovement && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowMovement(null)}>
          <div style={{ ...S.modalBox, maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>↕ حركة المخزون</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>{showMovement.name} — {L('الكمية الحالية:','Current Qty:')} <strong>{showMovement.qty} {showMovement.unit}</strong></p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.fieldLabel}>نوع الحركة</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['in',L('استلام ➕','Receive ➕')],['out',L('صرف ➖','Issue ➖')]].map(([v,lbl]) => (
                  <button key={v} onClick={() => setMovType(v)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: movType === v ? '2px solid #1a6bab' : '1px solid var(--border)', background: movType === v ? '#1a6bab' : 'var(--bg-secondary)', color: movType === v ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>{lbl}</button>
                ))}
              </div>
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.fieldLabel}>الكمية</span>
              <input type="number" min={1} style={{ ...S.fieldInput, width: '100%', boxSizing: 'border-box' }} value={movQty} onChange={e => setMovQty(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 20 }}>
              <span style={S.fieldLabel}>ملاحظة</span>
              <input type="text" style={{ ...S.fieldInput, width: '100%', boxSizing: 'border-box' }} placeholder="سبب الحركة..." value={movNote} onChange={e => setMovNote(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setShowMovement(null)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn(movType === 'in' ? '#10b981' : '#ef4444')} onClick={applyMovement}>{movType === 'in' ? '✅ تأكيد الاستلام' : '✅ تأكيد الصرف'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
