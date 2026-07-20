/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';

// ── Status configs with ar+en ──────────────────────────────────────────────────
const AUDIT_STATUS = {
  planned:   { ar:'مجدول',   en:'Planned',   color:'#1a6bab', bg:'#dbeafe' },
  active:    { ar:'جاري',    en:'Active',     color:'#f59e0b', bg:'#fef3c7' },
  completed: { ar:'مُنجَز',  en:'Completed',  color:'#10b981', bg:'#d1fae5' },
  cancelled: { ar:'ملغي',    en:'Cancelled',  color:'#ef4444', bg:'#fee2e2' },
};
const NC_STATUS = {
  open:       { ar:'مفتوحة',      en:'Open',        color:'#ef4444', bg:'#fee2e2' },
  inprogress: { ar:'قيد المعالجة', en:'In Progress', color:'#f59e0b', bg:'#fef3c7' },
  closed:     { ar:'مغلقة',       en:'Closed',       color:'#10b981', bg:'#d1fae5' },
  verified:   { ar:'مُوثَّقة',    en:'Verified',     color:'#8b5cf6', bg:'#ede9fe' },
};
const NC_CLASS = {
  major: { ar:'رئيسية',   en:'Major',       color:'#ef4444' },
  minor: { ar:'ثانوية',   en:'Minor',       color:'#f59e0b' },
  obs:   { ar:'ملاحظة',   en:'Observation', color:'#6b7280' },
};

// ── إصلاح جذري: كانت البيانات (مراجعات، عدم مطابقة، مؤشرات أداء) تُخزَّن
// بذاكرة المتصفح المؤقتة بس (React state محلي بدون أي اتصال بقاعدة بيانات)
// — تُفقَد بمجرد تحديث الصفحة، وترجع لنفس 3 سجلات تجريبية ثابتة بالكود كل
// مرة، رغم إن المستخدم يشوف رسالة "تم الحفظ" بعد كل إضافة! هذا كان يخدع
// المستخدم فعلياً بإنه يحفظ بيانات جودة حقيقية بينما تختفي بصمت. الآن كل
// شيء يُقرأ ويُكتَب من/لقاعدة PostgreSQL الحقيقية عبر /api/qualityAudits،
// /api/qualityNCs، /api/qualityKPIs (راجعي routes/modules.js بالباك إند).
// لو الجداول فاضية (تركيب جديد)، الصفحة تبدأ فاضية بصراحة — بدون أي بيانات
// تجريبية توحي بوجود سجلات مو موجودة فعلياً.

export default function QualityPage() {
  const { lang, showToast, confirmDialog, user } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [tab, setTab]           = useState('kpi');
  const [audits, setAudits]     = useState([]);
  const [ncs, setNCs]           = useState([]);
  const [kpis, setKpis]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showNCModal, setShowNCModal]       = useState(false);
  const [showKpiModal, setShowKpiModal]     = useState(false);
  const [auditForm, setAuditForm] = useState({});
  const [ncForm, setNCForm]       = useState({});
  const [kpiForm, setKpiForm]     = useState({});
  const [editingKpiId, setEditingKpiId] = useState(null);
  const [kpiActualDraft, setKpiActualDraft] = useState('');

  // ── جلب البيانات الحقيقية من الباك إند عند فتح الصفحة ────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('/qualityAudits').catch(() => []),
      api.get('/qualityNCs').catch(() => []),
      api.get('/qualityKPIs').catch(() => []),
    ]).then(([a, n, k]) => {
      if (cancelled) return;
      if (Array.isArray(a)) setAudits(a);
      if (Array.isArray(n)) setNCs(n);
      if (Array.isArray(k)) setKpis(k);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ({
    audits:   audits.length,
    openNCs:  ncs.filter(n => n.status === 'open' || n.status === 'inprogress').length,
    majorNCs: ncs.filter(n => n.classification === 'major' && n.status !== 'closed' && n.status !== 'verified').length,
    avgScore: (() => { const sc = audits.filter(a => a.score); return sc.length ? (sc.reduce((s,a)=>s+a.score,0)/sc.length).toFixed(0) : 0; })(),
  }), [audits, ncs]);

  // KPI helpers — use lowerIsBetter flag, no string matching
  const kpiGood  = kpi => kpi.lowerIsBetter ? kpi.actual <= kpi.target : kpi.actual >= kpi.target;
  const kpiColor = kpi => {
    const ratio = kpi.lowerIsBetter ? kpi.target / Math.max(kpi.actual,0.01) : kpi.actual / kpi.target;
    return ratio >= 1 ? '#10b981' : ratio >= 0.9 ? '#f59e0b' : '#ef4444';
  };
  const kpiPct   = kpi => {
    const ratio = kpi.lowerIsBetter ? kpi.target / Math.max(kpi.actual,0.01) : kpi.actual / kpi.target;
    return Math.min(100, ratio * 100);
  };
  const trendIcon  = (trend, lowerIsBetter) => trend === 'stable' ? '→' : trend === 'up' ? '↑' : '↓';
  const trendColor = (trend, lowerIsBetter) => {
    if (trend === 'stable') return '#6b7280';
    const good = lowerIsBetter ? trend === 'down' : trend === 'up';
    return good ? '#10b981' : '#ef4444';
  };

  // ── دوال الحفظ/التحديث/الحذف — تتصل بالباك إند الحقيقي ────────────────────────
  const saveAudit = async () => {
    if (!auditForm.title) { showToast(L('يرجى إدخال العنوان','Please enter title'),'error'); return; }
    // إصلاح: audits.length+1 يكرر رقم مراجعة موجود فعلاً بعد أي حذف
    const auYear = new Date().getFullYear();
    const auPrefix = `AUD-${auYear}-`;
    const auMaxSeq = audits.reduce((max,a)=>{
      if (typeof a.auditNo !== 'string' || !a.auditNo.startsWith(auPrefix)) return max;
      const v = parseInt(a.auditNo.slice(auPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const no = `${auPrefix}${String(auMaxSeq+1).padStart(2,'0')}`;
    const payload = { ...auditForm, auditNo: no, findings: 0, ncs: 0, score: null };
    try {
      const saved = await api.post('/qualityAudits', payload);
      setAudits(p => [...p, saved]);
      showToast(L('تمت إضافة المراجعة','Audit added'),'success');
      setShowAuditModal(false);
    } catch (err) {
      showToast(err.message || L('فشل الحفظ','Save failed'), 'error');
    }
  };

  const deleteAudit = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    try {
      await api.delete(`/qualityAudits/${id}`);
      setAudits(p => p.filter(x => x.id !== id));
    } catch (err) {
      showToast(err.message || L('فشل الحذف','Delete failed'), 'error');
    }
  };

  const saveNC = async () => {
    if (!ncForm.title) { showToast(L('يرجى إدخال العنوان','Please enter title'),'error'); return; }
    // إصلاح: ncs.length+1 يكرر رقم عدم مطابقة موجود فعلاً بعد أي حذف
    const ncYear = new Date().getFullYear();
    const ncPrefix = `NC-${ncYear}-`;
    const ncMaxSeq = ncs.reduce((max,x)=>{
      if (typeof x.ncNo !== 'string' || !x.ncNo.startsWith(ncPrefix)) return max;
      const v = parseInt(x.ncNo.slice(ncPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const no = `${ncPrefix}${String(ncMaxSeq+1).padStart(3,'0')}`;
    const payload = { ...ncForm, ncNo: no, status: 'open', closeDate: null };
    try {
      const saved = await api.post('/qualityNCs', payload);
      setNCs(p => [...p, saved]);
      showToast(L('تم تسجيل عدم المطابقة','NC registered'),'success');
      setShowNCModal(false);
    } catch (err) {
      showToast(err.message || L('فشل الحفظ','Save failed'), 'error');
    }
  };

  const updateNCStatus = async (nc, newStatus) => {
    const payload = { ...nc, status: newStatus, closeDate: newStatus === 'closed' ? new Date().toISOString().split('T')[0] : nc.closeDate };
    try {
      const saved = await api.put(`/qualityNCs/${nc.id}`, payload);
      setNCs(p => p.map(x => x.id === nc.id ? saved : x));
    } catch (err) {
      showToast(err.message || L('فشل التحديث','Update failed'), 'error');
    }
  };

  const deleteNC = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    try {
      await api.delete(`/qualityNCs/${id}`);
      setNCs(p => p.filter(x => x.id !== id));
    } catch (err) {
      showToast(err.message || L('فشل الحذف','Delete failed'), 'error');
    }
  };

  const saveKpi = async () => {
    if (!kpiForm.name || kpiForm.target === undefined || kpiForm.actual === undefined) {
      showToast(L('يرجى تعبئة الاسم والهدف والقيمة الحالية','Please fill name, target and actual value'),'error');
      return;
    }
    const payload = { ...kpiForm, target: Number(kpiForm.target), actual: Number(kpiForm.actual) };
    try {
      const saved = await api.post('/qualityKPIs', payload);
      setKpis(p => [...p, saved]);
      showToast(L('تمت إضافة المؤشر','KPI added'),'success');
      setShowKpiModal(false);
    } catch (err) {
      showToast(err.message || L('فشل الحفظ','Save failed'), 'error');
    }
  };

  const saveKpiActual = async (kpi) => {
    const newActual = Number(kpiActualDraft);
    if (Number.isNaN(newActual)) { showToast(L('قيمة غير صالحة','Invalid value'),'error'); return; }
    const payload = { ...kpi, actual: newActual };
    try {
      const saved = await api.put(`/qualityKPIs/${kpi.id}`, payload);
      setKpis(p => p.map(x => x.id === kpi.id ? saved : x));
      setEditingKpiId(null);
    } catch (err) {
      showToast(err.message || L('فشل التحديث','Update failed'), 'error');
    }
  };

  const deleteKpi = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    try {
      await api.delete(`/qualityKPIs/${id}`);
      setKpis(p => p.filter(x => x.id !== id));
    } catch (err) {
      showToast(err.message || L('فشل الحذف','Delete failed'), 'error');
    }
  };

  const S = {
    page:   { padding:24, direction:dir },
    stats:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 },
    sCard:  c => ({ background:'var(--bg-secondary)', borderRadius:12, padding:'14px 18px', borderTop:`3px solid ${c}` }),
    btn:    (c='#1a6bab') => ({ padding:'8px 16px', background:c, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }),
    smBtn:  (c='#6b7280') => ({ padding:'4px 8px', background:c, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:11 }),
    badge:  (c,bg) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:600, color:c, background:bg }),
    table:  { width:'100%', borderCollapse:'collapse', background:'var(--bg-secondary)', borderRadius:12, overflow:'hidden' },
    th:     { padding:'10px 14px', textAlign:dir==='rtl'?'right':'left', background:'var(--bg-tertiary)', fontSize:11, fontWeight:600, color:'var(--text-secondary)', borderBottom:'1px solid var(--border)' },
    td:     { padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text-primary)' },
    modal:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
    mbox:   { background:'var(--bg-primary)', borderRadius:16, padding:28, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', direction:dir },
    g2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
    fl:     { display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 },
    fi:     { width:'100%', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13, boxSizing:'border-box' },
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:0 }}>🏅 {L('إدارة الجودة','Quality Management')}</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:13, margin:'4px 0 0' }}>{L('نظام إدارة الجودة ISO 9001 — مؤشرات الأداء · المراجعات · عدم المطابقة','ISO 9001 Quality Management — KPIs · Audits · Non-Conformance')}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {tab === 'kpi'    && <button style={S.btn('#10b981')} onClick={() => { setKpiForm({ period: `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth()+1)/3)}`, trend:'stable', lowerIsBetter:false, unit:'%' }); setShowKpiModal(true); }}>+ {L('مؤشر جديد','New KPI')}</button>}
          {tab === 'audits' && <button style={S.btn()} onClick={() => { setAuditForm({ date: new Date().toISOString().split('T')[0], status:'planned', type:'internal' }); setShowAuditModal(true); }}>+ {L('مراجعة جديدة','New Audit')}</button>}
          {tab === 'ncs'    && <button style={S.btn('#ef4444')} onClick={() => { setNCForm({ openDate: new Date().toISOString().split('T')[0], status:'open', classification:'minor' }); setShowNCModal(true); }}>+ {L('عدم مطابقة','New NC')}</button>}
        </div>
      </div>

      {/* Stats */}
      <div style={S.stats}>
        {[
          [L('المراجعات الكلية','Total Audits'),        stats.audits,   '#1a6bab'],
          [L('عدم مطابقة مفتوحة','Open NCs'),           stats.openNCs,  '#f59e0b'],
          [L('عدم مطابقة رئيسية','Major NCs'),          stats.majorNCs, '#ef4444'],
          [L('متوسط درجة الجودة','Avg Quality Score'), stats.avgScore+'%','#10b981'],
        ].map(([l, v, c], i) => (
          <div key={i} style={S.sCard(c)}>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>{v}</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[['kpi', L('📊 مؤشرات الأداء KPI','📊 KPIs')], ['audits', L('🔍 المراجعات','🔍 Audits')], ['ncs', L('⚠️ عدم المطابقة','⚠️ Non-Conformance')]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, border: tab===k?'none':'1px solid var(--border)', background: tab===k?'#1a6bab':'transparent', color: tab===k?'#fff':'var(--text-secondary)', fontWeight: tab===k?600:400 }}>{l}</button>
        ))}
      </div>

      {/* ── KPI TAB ── */}
      {tab === 'kpi' && (
        loading ? (
          <p style={{ textAlign:'center', color:'var(--text-secondary)', padding:'40px 0' }}>{L('جاري التحميل...','Loading...')}</p>
        ) : kpis.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-secondary)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
            <p>{L('لا توجد مؤشرات أداء مسجَّلة بعد — أضيفي أول مؤشر بزر "مؤشر جديد" أعلاه','No KPIs recorded yet — add your first one with the "New KPI" button above')}</p>
          </div>
        ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {kpis.map(kpi => {
            const c    = kpiColor(kpi);
            const pct  = kpiPct(kpi);
            const icon = trendIcon(kpi.trend, kpi.lowerIsBetter);
            const tc   = trendColor(kpi.trend, kpi.lowerIsBetter);
            const isEditing = editingKpiId === kpi.id;
            return (
              <div key={kpi.id} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:18, border:'1px solid var(--border)', borderTop:`3px solid ${c}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, color:'var(--text-primary)' }}>{L(kpi.name, kpi.nameEn)}</div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{kpi.period}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:18, fontWeight:700, color:tc }}>{icon}</span>
                    <button onClick={() => { setEditingKpiId(kpi.id); setKpiActualDraft(kpi.actual); }} style={{ ...S.smBtn('#6b7280'), padding:'3px 7px' }}>✏️</button>
                    <button onClick={() => deleteKpi(kpi.id)} style={{ ...S.smBtn('#ef4444'), padding:'3px 7px' }}>🗑</button>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:8 }}>
                  <div>
                    {isEditing ? (
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number" step="0.1" value={kpiActualDraft} onChange={e=>setKpiActualDraft(e.target.value)} style={{ ...S.fi, width:80, padding:'5px 8px' }} autoFocus />
                        <button onClick={() => saveKpiActual(kpi)} style={{ ...S.smBtn('#10b981'), padding:'5px 9px' }}>{L('حفظ','Save')}</button>
                        <button onClick={() => setEditingKpiId(null)} style={{ ...S.smBtn('#6b7280'), padding:'5px 9px' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ fontSize:28, fontWeight:700, color:c }}>
                        {kpi.actual}<span style={{ fontSize:13, fontWeight:400, color:'var(--text-secondary)' }}> {kpi.unit}</span>
                      </div>
                    )}
                    <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{L('الهدف:','Target:')} {kpi.target} {kpi.unit}</div>
                  </div>
                  <div style={{ fontSize:18, fontWeight:700, color:c }}>{pct.toFixed(0)}%</div>
                </div>
                <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:4, transition:'width 0.5s' }}/>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {/* ── AUDITS TAB ── */}
      {tab === 'audits' && (
        <table style={S.table}>
          <thead>
            <tr>{(L(['رقم المراجعة','العنوان','النطاق','المدقق','التاريخ','النوع','النتائج','NC','الدرجة','الحالة',''],
                    ['Audit No','Title','Scope','Auditor','Date','Type','Findings','NC','Score','Status',''])).map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {audits.map(a => {
              const st = AUDIT_STATUS[a.status] || AUDIT_STATUS.planned;
              return (
                <tr key={a.id}>
                  <td style={S.td}><code style={{ fontSize:10, background:'var(--bg-tertiary)', padding:'2px 6px', borderRadius:4 }}>{a.auditNo}</code></td>
                  <td style={S.td}><div style={{ fontWeight:600, fontSize:12 }}>{L(a.title, a.titleEn)}</div></td>
                  <td style={{ ...S.td, fontSize:11, color:'var(--text-secondary)' }}>{L(a.scope, a.scopeEn)}</td>
                  <td style={{ ...S.td, fontSize:11 }}>{a.auditor}</td>
                  <td style={{ ...S.td, fontSize:11, color:'var(--text-secondary)' }}>{a.date}</td>
                  <td style={S.td}><span style={S.badge(a.type==='internal'?'#1a6bab':'#8b5cf6', a.type==='internal'?'#dbeafe':'#ede9fe')}>{a.type==='internal'?L('داخلية','Internal'):L('خارجية','External')}</span></td>
                  <td style={{ ...S.td, textAlign:'center' }}>{a.findings || '—'}</td>
                  <td style={{ ...S.td, textAlign:'center' }}>{a.ncs > 0 ? <span style={{ color:'#ef4444', fontWeight:700 }}>{a.ncs}</span> : '—'}</td>
                  <td style={S.td}>{a.score ? <span style={{ fontWeight:700, color: a.score>=90?'#10b981':a.score>=80?'#f59e0b':'#ef4444' }}>{a.score}%</span> : '—'}</td>
                  <td style={S.td}><span style={S.badge(st.color, st.bg)}>{L(st.ar, st.en)}</span></td>
                  <td style={S.td}><button onClick={() => deleteAudit(a.id)} style={S.smBtn('#ef4444')}>🗑</button></td>
                </tr>
              );
            })}
            {!loading && audits.length === 0 && <tr><td colSpan={11} style={{ ...S.td, textAlign:'center', padding:40, color:'var(--text-secondary)' }}>{L('لا توجد مراجعات مسجَّلة بعد','No audits recorded yet')}</td></tr>}
            {loading && <tr><td colSpan={11} style={{ ...S.td, textAlign:'center', padding:40, color:'var(--text-secondary)' }}>{L('جاري التحميل...','Loading...')}</td></tr>}
          </tbody>
        </table>
      )}

      {/* ── NCs TAB ── */}
      {tab === 'ncs' && (
        <table style={S.table}>
          <thead>
            <tr>{(L(['رقم NC','العنوان','التصنيف','القسم','المسؤول','تاريخ الفتح','الإغلاق','الحالة',''],
                    ['NC No','Title','Class','Dept','Owner','Open Date','Close Date','Status',''])).map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ncs.map(nc => {
              const st = NC_STATUS[nc.status] || NC_STATUS.open;
              const cl = NC_CLASS[nc.classification] || NC_CLASS.minor;
              return (
                <tr key={nc.id}>
                  <td style={S.td}><code style={{ fontSize:10, background:'var(--bg-tertiary)', padding:'2px 6px', borderRadius:4 }}>{nc.ncNo}</code></td>
                  <td style={S.td}>
                    <div style={{ fontWeight:600, fontSize:12 }}>{L(nc.title, nc.titleEn)}</div>
                    <div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:2 }}>{(lang==='ar'?nc.corrective:(nc.correctiveEn||nc.corrective))?.slice(0,50)}…</div>
                  </td>
                  <td style={S.td}><span style={{ fontSize:11, fontWeight:700, color:cl.color }}>● {L(cl.ar, cl.en)}</span></td>
                  <td style={{ ...S.td, fontSize:11 }}>{lang==='ar'?nc.department:(nc.departmentEn||nc.department)}</td>
                  <td style={{ ...S.td, fontSize:11 }}>{lang==='ar'?nc.owner:(nc.ownerEn||nc.owner)}</td>
                  <td style={{ ...S.td, fontSize:11, color:'var(--text-secondary)' }}>{nc.openDate}</td>
                  <td style={{ ...S.td, fontSize:11, color: nc.closeDate ? '#10b981' : '#f59e0b' }}>{nc.closeDate || L('مفتوحة','Open')}</td>
                  <td style={S.td}><span style={S.badge(st.color, st.bg)}>{L(st.ar, st.en)}</span></td>
                  <td style={S.td}>
                    <div style={{ display:'flex', gap:4 }}>
                      {nc.status === 'open'       && <button onClick={() => updateNCStatus(nc, 'inprogress')} style={S.smBtn('#f59e0b')}>{L('معالجة','Process')}</button>}
                      {nc.status === 'inprogress' && <button onClick={() => updateNCStatus(nc, 'closed')} style={S.smBtn('#10b981')}>{L('إغلاق','Close')}</button>}
                      <button onClick={() => deleteNC(nc.id)} style={S.smBtn('#ef4444')}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && ncs.length === 0 && <tr><td colSpan={9} style={{ ...S.td, textAlign:'center', padding:40, color:'var(--text-secondary)' }}>{L('لا توجد حالات عدم مطابقة مسجَّلة بعد','No non-conformances recorded yet')}</td></tr>}
            {loading && <tr><td colSpan={9} style={{ ...S.td, textAlign:'center', padding:40, color:'var(--text-secondary)' }}>{L('جاري التحميل...','Loading...')}</td></tr>}
          </tbody>
        </table>
      )}

      {/* ── AUDIT MODAL ── */}
      {showAuditModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowAuditModal(false)}>
          <div style={S.mbox}>
            <h3 style={{ margin:'0 0 18px', color:'var(--text-primary)' }}>🔍 {L('مراجعة جديدة','New Audit')}</h3>
            <div style={S.g2}>
              <label style={{ gridColumn:'span 2' }}><span style={S.fl}>{L('عنوان المراجعة','Audit Title')}</span><input style={S.fi} value={auditForm.title||''} onChange={e=>setAuditForm(p=>({...p,title:e.target.value,titleEn:e.target.value}))}/></label>
              <label style={{ gridColumn:'span 2' }}><span style={S.fl}>{L('النطاق','Scope')}</span><input style={S.fi} value={auditForm.scope||''} onChange={e=>setAuditForm(p=>({...p,scope:e.target.value,scopeEn:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('المدقق','Auditor')}</span><input style={S.fi} value={auditForm.auditor||''} onChange={e=>setAuditForm(p=>({...p,auditor:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('التاريخ','Date')}</span><input type="date" style={S.fi} value={auditForm.date||''} onChange={e=>setAuditForm(p=>({...p,date:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('النوع','Type')}</span>
                <select style={S.fi} value={auditForm.type||'internal'} onChange={e=>setAuditForm(p=>({...p,type:e.target.value}))}>
                  <option value="internal">{L('داخلية','Internal')}</option>
                  <option value="external">{L('خارجية','External')}</option>
                </select>
              </label>
              <label><span style={S.fl}>{L('الحالة','Status')}</span>
                <select style={S.fi} value={auditForm.status||'planned'} onChange={e=>setAuditForm(p=>({...p,status:e.target.value}))}>
                  {Object.entries(AUDIT_STATUS).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowAuditModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={saveAudit}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NC MODAL ── */}
      {showNCModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNCModal(false)}>
          <div style={S.mbox}>
            <h3 style={{ margin:'0 0 18px', color:'var(--text-primary)' }}>⚠️ {L('تسجيل عدم مطابقة','Register Non-Conformance')}</h3>
            <div style={S.g2}>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('عنوان عدم المطابقة','NC Title')}</span><input style={S.fi} value={ncForm.title||''} onChange={e=>setNCForm(p=>({...p,title:e.target.value,titleEn:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('الوصف','Description')}</span><textarea style={{...S.fi,minHeight:60,resize:'vertical'}} value={ncForm.description||''} onChange={e=>setNCForm(p=>({...p,description:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('التصنيف','Classification')}</span>
                <select style={S.fi} value={ncForm.classification||'minor'} onChange={e=>setNCForm(p=>({...p,classification:e.target.value}))}>
                  {Object.entries(NC_CLASS).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
              <label><span style={S.fl}>{L('القسم','Department')}</span><input style={S.fi} value={ncForm.department||''} onChange={e=>setNCForm(p=>({...p,department:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('المسؤول عن التصحيح','Owner')}</span><input style={S.fi} value={ncForm.owner||''} onChange={e=>setNCForm(p=>({...p,owner:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('تاريخ الإغلاق المتوقع','Due Date')}</span><input type="date" style={S.fi} value={ncForm.dueDate||''} onChange={e=>setNCForm(p=>({...p,dueDate:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('السبب الجذري','Root Cause')}</span><input style={S.fi} value={ncForm.rootCause||''} onChange={e=>setNCForm(p=>({...p,rootCause:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('الإجراء التصحيحي','Corrective Action')}</span><input style={S.fi} value={ncForm.corrective||''} onChange={e=>setNCForm(p=>({...p,corrective:e.target.value}))}/></label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowNCModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn('#ef4444')} onClick={saveNC}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI MODAL ── */}
      {showKpiModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowKpiModal(false)}>
          <div style={S.mbox}>
            <h3 style={{ margin:'0 0 18px', color:'var(--text-primary)' }}>📊 {L('مؤشر أداء جديد','New KPI')}</h3>
            <div style={S.g2}>
              <label style={{ gridColumn:'span 2' }}><span style={S.fl}>{L('اسم المؤشر','KPI Name')}</span><input style={S.fi} value={kpiForm.name||''} onChange={e=>setKpiForm(p=>({...p,name:e.target.value,nameEn:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الهدف','Target')}</span><input type="number" step="0.1" style={S.fi} value={kpiForm.target??''} onChange={e=>setKpiForm(p=>({...p,target:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('القيمة الحالية','Current Value')}</span><input type="number" step="0.1" style={S.fi} value={kpiForm.actual??''} onChange={e=>setKpiForm(p=>({...p,actual:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الوحدة','Unit')}</span><input style={S.fi} placeholder="% / min / ..." value={kpiForm.unit||''} onChange={e=>setKpiForm(p=>({...p,unit:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الفترة','Period')}</span><input style={S.fi} placeholder="2026-Q3" value={kpiForm.period||''} onChange={e=>setKpiForm(p=>({...p,period:e.target.value}))}/></label>
              <label><span style={S.fl}>{L('الأفضل هو الأقل؟','Lower is better?')}</span>
                <select style={S.fi} value={kpiForm.lowerIsBetter ? 'yes' : 'no'} onChange={e=>setKpiForm(p=>({...p,lowerIsBetter: e.target.value === 'yes'}))}>
                  <option value="no">{L('لا (الأعلى أفضل)','No (higher is better)')}</option>
                  <option value="yes">{L('نعم (مثل معدل الأخطاء)','Yes (e.g. error rate)')}</option>
                </select>
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowKpiModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn('#10b981')} onClick={saveKpi}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
