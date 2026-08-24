/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import useServerPagination from '../hooks/useServerPagination';
import Pagination from '../components/Pagination';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import { api } from '../api';

const BANNER_GRADIENT = 'linear-gradient(135deg, #581c87 0%, #7e22ce 100%)';

const STATUS_CONFIG = {
  planning:  { ar:'تخطيط',  en:'Planning',   color:'#6b7280', bg:'#f3f4f6' },
  active:    { ar:'نشط',    en:'Active',      color:'#1a6bab', bg:'#dbeafe' },
  onhold:    { ar:'معلق',   en:'On Hold',     color:'#f59e0b', bg:'#fef3c7' },
  completed: { ar:'مُنجَز', en:'Completed',   color:'#10b981', bg:'#d1fae5' },
  cancelled: { ar:'ملغي',   en:'Cancelled',   color:'#ef4444', bg:'#fee2e2' },
};
const PRIORITY_CONFIG = {
  high:   { ar:'عالية',   en:'High',   color:'#ef4444' },
  normal: { ar:'متوسطة',  en:'Normal', color:'#1a6bab' },
  low:    { ar:'منخفضة',  en:'Low',    color:'#6b7280' },
};
const EMPTY = { code:'', name:'', nameEn:'', manager:'', managerEn:'', budget:0, spent:0, startDate:'', endDate:'', progress:0, status:'planning', priority:'normal', phase:'تخطيط', milestones:0, completedMilestones:0 };

// ── تصدير XML متوافق مع Primavera P6 (وMicrosoft Project) ───────────────────
// يبني ملف XML بمواصفات Microsoft Project القياسية (نفس الصيغة التي يقرأها
// Primavera P6 مباشرة عبر File → Import → MS Project XML) — بدون أي مكتبة
// خارجية، نص XML خام يُبنى هنا يدوياً حسب هيكل MSP الرسمي (Project/Tasks/
// Resources/Assignments). كل مشروع بالنظام يصير Task رئيسي (WBS)، وكل
// "مرحلة" (milestone) بالمشروع تصير Task فرعي من نوع Milestone موزَّع بالتساوي
// بين تاريخ البداية والنهاية — أول عدد "المراحل المنجزة" يُعلَّم 100% والباقي
// 0%. مدير كل مشروع يصير Resource مرتبط بمهمته عبر Assignment.
const xmlEscape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const toMspDateTime = (dateStr, hour = 8) => {
  if (!dateStr) return '';
  return `${dateStr}T${String(hour).padStart(2, '0')}:00:00`;
};
const PRIORITY_TO_MSP = { high: 700, normal: 500, low: 300 };

function buildPrimaveraXML(projectsList, lang, appNameAr, appNameEn) {
  const managerResources = [];
  const managerUid = (name) => {
    if (!name) return null;
    let idx = managerResources.indexOf(name);
    if (idx === -1) { managerResources.push(name); idx = managerResources.length - 1; }
    return idx + 1; // UID يبدأ من 1
  };

  let uidCounter = 1;
  const taskBlocks = [];
  const assignmentBlocks = [];

  projectsList.forEach((proj, i) => {
    const wbs = i + 1;
    const taskUid = uidCounter++;
    const managerName = lang === 'ar' ? proj.manager : (proj.managerEn || proj.manager);
    const resUid = managerUid(managerName);

    const priorityMsp = PRIORITY_TO_MSP[proj.priority] ?? 500;
    const notesParts = [];
    if (proj.status) notesParts.push(`${lang === 'ar' ? 'الحالة' : 'Status'}: ${proj.status}`);
    if (proj.phase) notesParts.push(`${lang === 'ar' ? 'المرحلة الحالية' : 'Phase'}: ${proj.phase}`);

    taskBlocks.push(`
    <Task>
      <UID>${taskUid}</UID>
      <ID>${wbs}</ID>
      <Name>${xmlEscape(lang === 'ar' ? proj.name : (proj.nameEn || proj.name))}</Name>
      <WBS>${wbs}</WBS>
      <OutlineNumber>${wbs}</OutlineNumber>
      <OutlineLevel>1</OutlineLevel>
      <Start>${toMspDateTime(proj.startDate)}</Start>
      <Finish>${toMspDateTime(proj.endDate, 17)}</Finish>
      <PercentComplete>${Math.max(0, Math.min(100, Math.round(+proj.progress || 0)))}</PercentComplete>
      <Priority>${priorityMsp}</Priority>
      <Cost>${(+proj.budget || 0).toFixed(2)}</Cost>
      <ActualCost>${(+proj.spent || 0).toFixed(2)}</ActualCost>
      <Notes>${xmlEscape(notesParts.join(' | '))}</Notes>
      <Text1>${xmlEscape(proj.code || '')}</Text1>
    </Task>`);

    if (resUid && managerName) {
      assignmentBlocks.push(`
    <Assignment>
      <UID>${taskUid}</UID>
      <TaskUID>${taskUid}</TaskUID>
      <ResourceUID>${resUid}</ResourceUID>
    </Assignment>`);
    }

    // مراحل المشروع (milestones) كمهام فرعية موزَّعة بالتساوي بين البداية والنهاية
    const milestoneCount = Math.max(0, Math.round(+proj.milestones || 0));
    const completedCount = Math.max(0, Math.min(milestoneCount, Math.round(+proj.completedMilestones || 0)));
    if (milestoneCount > 0 && proj.startDate && proj.endDate) {
      const startMs = new Date(proj.startDate).getTime();
      const endMs = new Date(proj.endDate).getTime();
      const span = Math.max(endMs - startMs, 0);
      for (let m = 1; m <= milestoneCount; m++) {
        const mUid = uidCounter++;
        const frac = milestoneCount === 1 ? 1 : m / milestoneCount;
        const mDate = new Date(startMs + span * frac).toISOString().split('T')[0];
        taskBlocks.push(`
    <Task>
      <UID>${mUid}</UID>
      <ID>${mUid}</ID>
      <Name>${xmlEscape((lang === 'ar' ? 'مرحلة ' : 'Milestone ') + m)}</Name>
      <OutlineNumber>${wbs}.${m}</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
      <Start>${toMspDateTime(mDate)}</Start>
      <Finish>${toMspDateTime(mDate, 17)}</Finish>
      <Milestone>1</Milestone>
      <PercentComplete>${m <= completedCount ? 100 : 0}</PercentComplete>
      <PredecessorLink><PredecessorUID>${taskUid}</PredecessorUID></PredecessorLink>
    </Task>`);
      }
    }
  });

  const resourceBlocks = managerResources.map((name, i) => `
    <Resource>
      <UID>${i + 1}</UID>
      <ID>${i + 1}</ID>
      <Name>${xmlEscape(name)}</Name>
    </Resource>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>SIHATUNA-Projects-${new Date().toISOString().split('T')[0]}.xml</Name>
  <Title>${xmlEscape(lang === 'ar' ? `مشاريع ${appNameAr}` : `${appNameEn.toUpperCase()} Projects`)}</Title>
  <CreationDate>${new Date().toISOString()}</CreationDate>
  <CurrencySymbol>IQD</CurrencySymbol>
  <SaveVersion>14</SaveVersion>
  <Tasks>${taskBlocks.join('')}
  </Tasks>
  <Resources>${resourceBlocks}
  </Resources>
  <Assignments>${assignmentBlocks.join('')}
  </Assignments>
</Project>`;
}

function downloadPrimaveraXML(projectsList, lang, appNameAr, appNameEn) {
  const xml = buildPrimaveraXML(projectsList, lang, appNameAr, appNameEn);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SIHATUNA-Projects-${new Date().toISOString().split('T')[0]}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ProjectsPage() {
  const { projects, setProjects, lang, showToast, syncToServer, confirmDialog, hospitals, multiHospitalEnabled, appNameAr, appNameEn } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [view, setView] = useState('cards');

  // تأخير البحث 350 مللي ثانية بعد آخر حرف — يمنع إرسال طلب لكل ضغطة زر
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── الجلب المُرقَّم من السيرفر ────────────────────────────────────────────
  // قبل هذا، الصفحة كانت تعرض *كل* المشاريع المطابقة دفعة وحدة بدون أي ترقيم
  // إطلاقاً (لا للبطاقات ولا للجدول) — مقبول بعدد محدود، لكن يصير بطيئاً مع
  // نمو عدد المشاريع. الآن تجيب فقط الصفحة الحالية من الخادم.
  const { data: filtered, page: currentPage, setPage: setCurrentPage, total: totalItems, totalPages, loading, refetch } =
    useServerPagination('projects', { search: debouncedSearch, status: statusFilter, pageSize: 50 });

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter(p=>p.status==='active').length,
    completed: projects.filter(p=>p.status==='completed').length,
    totalBudget: projects.reduce((s,p)=>s+(+p.budget||0),0),
    totalSpent: projects.reduce((s,p)=>s+(+p.spent||0),0),
  }), [projects]);

  const openAdd = () => {
    // إصلاح: كان يعتمد على projects.length+1، فبعد أي حذف يتكرر رمز مشروع
    // موجود فعلاً (مثال: 3 مشاريع، نحذف رقم 2، فالمشروع الجديد ياخذ نفس رمز
    // رقم 3). الآن نشتق الرقم التالي من أعلى رقم تسلسلي فعلي موجود لنفس
    // السنة، بغض النظر عن الحذف أو الترتيب.
    const year = new Date().getFullYear();
    const prefix = `PRJ-${year}-`;
    const maxSeq = projects.reduce((max, p) => {
      if (typeof p.code !== 'string' || !p.code.startsWith(prefix)) return max;
      const n = parseInt(p.code.slice(prefix.length), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const code = `${prefix}${String(maxSeq + 1).padStart(2, '0')}`;
    setForm({ ...EMPTY, code, startDate: new Date().toISOString().split('T')[0] });
    setEditId(null); setShowModal(true);
  };
  const openEdit = p => { setForm({...p}); setEditId(p.id); setShowModal(true); };
  const saveProject = async () => {
    if (!form.name||!form.manager) { showToast(L('يرجى تعبئة الاسم والمدير','Please fill name and manager'),'error'); return; }
    // ── إصلاح: كانت المشاريع المستورَدة من Excel (وأي مشروع قديم بلا هذه
    // الحقول) تحفظ undefined لهذه الأرقام، فتظهر "NaN%" و"undefined/undefined"
    // بالواجهة. الآن تُفرَض قيمة رقمية دائماً (0 كحد أدنى) بكل حفظ.
    const proj = {...form, budget:+form.budget||0, spent:+form.spent||0, progress:+form.progress||0, milestones:+form.milestones||0, completedMilestones:+form.completedMilestones||0};
    // ── إصلاح مهم: كان يعرض "تمت الإضافة/تم التحديث" فوراً ويقفل النافذة
    // ويستدعي refetch() دون انتظار نتيجة الحفظ الفعلية بالخادم. فلو فشل
    // الحفظ (صلاحية منتهية، خطأ خادم، انقطاع اتصال)، تبقى الحالة المحلية
    // (المُستخدَمة بالإحصائيات) تعرض المشروع وكأنه أُضيف، بينما القائمة
    // الحقيقية المجلوبة من الخادم فارغة لأنه لم يُحفَظ بقاعدة البيانات أصلاً.
    // الآن ننتظر نتيجة المزامنة، ولو فشلت نتراجع عن التغيير المحلي ونعرض
    // خطأ بدل رسالة نجاح مضلِّلة.
    if (editId) {
      const up = {...proj,id:editId};
      const prevList = projects;
      setProjects(p=>p.map(i=>i.id===editId?{...i,...up}:i));
      const ok = await syncToServer('projects','update',up);
      if (!ok) { setProjects(prevList); return; }
      showToast(L('تم التحديث','Updated'),'success');
    } else {
      const np = {...proj,id:Date.now()};
      setProjects(p=>[...p,np]);
      const ok = await syncToServer('projects','create',np);
      if (!ok) { setProjects(p=>p.filter(i=>i.id!==np.id)); return; }
      showToast(L('تمت إضافة المشروع','Project added'),'success');
    }
    setShowModal(false);
    refetch();
  };
  const deleteProject = async id => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prevList = projects;
    setProjects(p=>p.filter(i=>i.id!==id));
    const ok = await syncToServer('projects','delete',{id});
    if (!ok) { setProjects(prevList); return; }
    showToast(L('تم الحذف','Deleted'),'info');
    refetch();
  };
  const n = v => Number(v).toLocaleString('en-US');
  const budgetPct = proj => (proj.budget>0) ? Math.min(100,((+proj.spent||0)/proj.budget)*100) : 0;

  const S = {
    page:{padding:24,direction:dir},
    stats:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:20},
    sCard:c=>({background:'var(--bg-card)',borderRadius:12,padding:'16px 20px',borderTop:`3px solid ${c}`}),
    tb:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},
    inp:{padding:'8px 12px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13},
    btn:(c='#1a6bab')=>({padding:'8px 16px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    smBtn:(c='#6b7280')=>({padding:'5px 12px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}),
    card:{background:'var(--bg-card)',borderRadius:14,padding:20,marginBottom:14,border:'1px solid var(--border)'},
    badge:(c,bg)=>({display:'inline-block',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:600,color:c,background:bg}),
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999},
    mbox:{background:'var(--bg-primary)',borderRadius:16,padding:28,width:'100%',maxWidth:580,maxHeight:'90vh',overflowY:'auto',direction:dir},
    g2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14},
    fl:{display:'block',fontSize:12,color:'var(--text-secondary)',marginBottom:4},
    fi:{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
    th:{padding:'10px 12px',textAlign:dir==='rtl'?'right':'left',background:'var(--bg-tertiary)',fontSize:11,fontWeight:600,color:'var(--text-secondary)',borderBottom:'1px solid var(--border)'},
    td:{padding:'10px 12px',borderBottom:'1px solid var(--border)',fontSize:12,color:'var(--text-primary)'},
  };

  return (
    <div style={S.page}>
      <PageBanner icon="📐" title={L('إدارة المشاريع','Project Management')} subtitle={L('تخطيط ومتابعة مشاريع المؤسسة | متوافق مع Primavera P6','Project planning & tracking | Primavera P6 compatible')} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ padding:'8px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }} onClick={() => setShowImport(true)}>
            📊 {L('استيراد من Excel','Import from Excel')}
          </button>
          <ExcelExportButton apiName="projects" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
          <button
            style={{ padding:'8px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}
            onClick={() => {
              if (!projects || projects.length === 0) { showToast(L('لا توجد مشاريع للتصدير','No projects to export'), 'error'); return; }
              downloadPrimaveraXML(projects, lang, appNameAr, appNameEn);
              showToast(L('تم تصدير ملف XML — افتحه من Primavera P6 عبر File → Import','XML exported — open it in Primavera P6 via File → Import'), 'success');
            }}
          >
            📤 {L('تصدير Primavera P6 (XML)','Export Primavera P6 (XML)')}
          </button>
          <button style={{ padding:'8px 16px', background: '#fff', color: '#7e22ce', border: 'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }} onClick={openAdd}>+ {L('مشروع جديد','New Project')}</button>
        </div>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="projects"
          title={L('استيراد مشاريع من Excel','Import Projects from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/projects');
              if (Array.isArray(fresh)) setProjects(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
            refetch();
          }}
        />
      )}

      <div style={S.stats}>
        {[[L('المشاريع الكلية','Total Projects'),stats.total,'#1a6bab'],
          [L('نشطة','Active'),stats.active,'#10b981'],
          [L('مُنجَزة','Completed'),stats.completed,'#8b5cf6']].map(([lbl,val,c],i)=>(
          <div key={i} style={S.sCard(c)}>
            <div style={{fontSize:26,fontWeight:700,color:'var(--text-primary)'}}>{val}</div>
            <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:4}}>{lbl}</div>
          </div>
        ))}
        <div style={S.sCard('#f59e0b')}>
          <div style={{fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>{n(stats.totalBudget)}</div>
          <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>{L('إجمالي الميزانيات','Total Budgets')}</div>
          <div style={{marginTop:6,height:5,background:'var(--border)',borderRadius:3}}>
            <div style={{width:`${stats.totalBudget>0?Math.min(100,(stats.totalSpent/stats.totalBudget)*100):0}%`,height:'100%',background:'#f59e0b',borderRadius:3}}/>
          </div>
          <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:4}}>{L('المصروف:','Spent:')} {n(stats.totalSpent)}</div>
        </div>
      </div>

      <div style={S.tb}>
        <input style={{...S.inp,minWidth:220}} placeholder={L('🔍 بحث بالاسم أو الكود...','🔍 Search by name or code...')} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
        </select>
        <div style={{marginRight:'auto',display:'flex',gap:6}}>
          {[['cards',L('بطاقات','Cards')],['gantt',L('غانت','Gantt')]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'7px 14px',borderRadius:8,border:view===v?'none':'1px solid var(--border)',background:view===v?'#1a6bab':'var(--bg-secondary)',color:view===v?'#fff':'var(--text-secondary)',cursor:'pointer',fontSize:12}}>{l}</button>
          ))}
        </div>
      </div>

      {view==='cards' && filtered.map(proj=>{
        const st=STATUS_CONFIG[proj.status]||STATUS_CONFIG.planning;
        const pr=PRIORITY_CONFIG[proj.priority]||PRIORITY_CONFIG.normal;
        const bPct=budgetPct(proj);
        return (
          <div key={proj.id} style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                  <code style={{fontSize:11,background:'var(--bg-tertiary)',padding:'2px 8px',borderRadius:4,color:'var(--text-secondary)'}}>{proj.code}</code>
                  <span style={S.badge(st.color,st.bg)}>{L(st.ar,st.en)}</span>
                  <span style={{fontSize:11,color:pr.color,fontWeight:700}}>● {L('أولوية ','Priority: ')}{L(pr.ar,pr.en)}</span>
                  <span style={{fontSize:11,color:'var(--text-secondary)',background:'var(--bg-tertiary)',padding:'2px 8px',borderRadius:10}}>📍 {lang==='ar'?proj.phase:(proj.phaseEn||proj.phase)}</span>
                </div>
                <h3 style={{margin:0,fontSize:15,fontWeight:600,color:'var(--text-primary)'}}>{lang==='ar'?proj.name:(proj.nameEn||proj.name)}</h3>
                <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:4}}>👤 {lang==='ar'?proj.manager:(proj.managerEn||proj.manager)} | 📅 {proj.startDate} ← {proj.endDate}</div>
              </div>
              <div style={{textAlign:'center',minWidth:70}}>
                <div style={{width:64,height:64,borderRadius:'50%',background:`conic-gradient(#1a6bab ${(+proj.progress||0)*3.6}deg, var(--border) 0deg)`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
                  <div style={{width:50,height:50,borderRadius:'50%',background:'var(--bg-secondary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#1a6bab'}}>{+proj.progress||0}%</div>
                </div>
                <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:4}}>{L('الإنجاز','Progress')}</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:14}}>
              <div>
                <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:6}}>{L('المراحل:','Milestones:')} {+proj.completedMilestones||0}/{+proj.milestones||0}</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {Array.from({length:+proj.milestones||0}).map((_,i)=>(
                    <div key={i} style={{width:14,height:14,borderRadius:'50%',background:i<(+proj.completedMilestones||0)?'#10b981':'var(--border)',border:'1px solid var(--border)'}}/>
                  ))}
                </div>
              </div>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-secondary)',marginBottom:6}}>
                  <span>{L('الميزانية','Budget')}</span>
                  <span>{bPct.toFixed(0)}% {L('مُصرَف','spent')}</span>
                </div>
                <div style={{height:8,background:'var(--border)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{width:`${bPct}%`,height:'100%',background:bPct>90?'#ef4444':bPct>70?'#f59e0b':'#10b981',borderRadius:4,transition:'width 0.4s'}}/>
                </div>
                <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:4}}>{n(+proj.spent||0)} / {n(+proj.budget||0)} {L('د.ع','IQD')}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12,borderTop:'1px solid var(--border)',paddingTop:10}}>
              <button onClick={()=>openEdit(proj)} style={S.smBtn('#6b7280')}>✏️ {L('تعديل','Edit')}</button>
              <button onClick={()=>deleteProject(proj.id)} style={S.smBtn('#ef4444')}>🗑 {L('حذف','Delete')}</button>
            </div>
          </div>
        );
      })}

      {view==='gantt' && (
        <div style={{background:'var(--bg-card)',borderRadius:14,padding:20,overflowX:'auto'}}>
          <h3 style={{margin:'0 0 16px',color:'var(--text-secondary)',fontSize:14}}>{L('مخطط غانت (عرض مبسط)','Gantt Chart (Simplified View)')}</h3>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
            <thead>
              <tr style={{background:'var(--bg-tertiary)'}}>
                {(L(['المشروع','المرحلة','البداية','النهاية','الإنجاز','الميزانية'],['Project','Phase','Start','End','Progress','Budget'])).map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(proj=>{
                const st=STATUS_CONFIG[proj.status]||STATUS_CONFIG.planning;
                return (
                  <tr key={proj.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={S.td}>
                      <code style={{fontSize:10,color:'var(--text-secondary)',display:'block'}}>{proj.code}</code>
                      <span style={{fontWeight:600}}>{lang==='ar'?proj.name:(proj.nameEn||proj.name)}</span>
                    </td>
                    <td style={S.td}><span style={S.badge(st.color,st.bg)}>{lang==='ar'?proj.phase:(proj.phaseEn||proj.phase)}</span></td>
                    <td style={{...S.td,color:'var(--text-secondary)'}}>{proj.startDate}</td>
                    <td style={{...S.td,color:'var(--text-secondary)'}}>{proj.endDate}</td>
                    <td style={S.td}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,height:12,background:'var(--border)',borderRadius:6,minWidth:80}}>
                          <div style={{width:`${+proj.progress||0}%`,height:'100%',background:'#1a6bab',borderRadius:6}}/>
                        </div>
                        <span style={{fontSize:12,fontWeight:600,color:'#1a6bab'}}>{+proj.progress||0}%</span>
                      </div>
                    </td>
                    <td style={{...S.td,color:'var(--text-secondary)'}}>{n(+proj.budget||0)} {L('د.ع','IQD')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div style={{textAlign:'center',padding:48,color:'var(--text-secondary)'}}>{lang==='ar'?'جاري التحميل...':'Loading...'}</div>
      )}
      {!loading && filtered.length===0 && (
        <div style={{textAlign:'center',padding:48,color:'var(--text-secondary)',background:'var(--bg-card)',borderRadius:12}}>
          <div style={{fontSize:40,marginBottom:8}}>📐</div>
          <p>{L('لا توجد مشاريع','No projects found')}</p>
        </div>
      )}
      {!loading && totalItems > 0 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      )}

      {showModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={S.mbox}>
            <h3 style={{margin:'0 0 20px',color:'var(--text-primary)'}}>{editId?L('✏️ تعديل المشروع','✏️ Edit Project'):L('📐 مشروع جديد','📐 New Project')}</h3>
            <div style={S.g2}>
              {[['code',L('رمز المشروع','Project Code'),'text'],
                ['startDate',L('تاريخ البداية','Start Date'),'date'],
                ['endDate',L('تاريخ النهاية','End Date'),'date'],
                ['budget',L('الميزانية الكلية (د.ع)','Budget (IQD)'),'number'],
                ['spent',L('المبلغ المصروف','Amount Spent'),'number'],
                ['progress',L('نسبة الإنجاز (%)','Progress (%)'),'number'],
                ['milestones',L('عدد المراحل','Milestones'),'number'],
                ['completedMilestones',L('المراحل المنجزة','Completed Milestones'),'number']
              ].map(([k,lbl,tp])=>(
                <label key={k}>
                  <span style={S.fl}>{lbl}</span>
                  <input type={tp} style={S.fi} value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>
                </label>
              ))}
              {[['name',L('اسم المشروع بالعربية','Project Name (Arabic)')],
                ['nameEn',L('اسم المشروع بالإنجليزية','Project Name (English)')],
                ['manager',L('مدير المشروع','Project Manager')],
                ['managerEn',L('المدير بالإنجليزية','Manager (English)')],
                ['phase',L('المرحلة الحالية','Current Phase')]
              ].map(([k,lbl])=>(
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
                <span style={S.fl}>{L('الحالة','Status')}</span>
                <select style={S.fi} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                  {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
              <label>
                <span style={S.fl}>{L('الأولوية','Priority')}</span>
                <select style={S.fi} value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                  {Object.entries(PRIORITY_CONFIG).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={saveProject}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
