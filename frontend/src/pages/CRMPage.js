/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';

const FOLLOWUP_TYPES = {
  appointment:  { ar:'موعد',            en:'Appointment' },
  checkup:      { ar:'فحص دوري',        en:'Checkup' },
  vaccination:  { ar:'لقاح',            en:'Vaccination' },
  lab_result:   { ar:'نتيجة مختبر',     en:'Lab Result' },
  medication:   { ar:'دواء',            en:'Medication' },
  other:        { ar:'أخرى',            en:'Other' },
};
const FOLLOWUP_STATUS = {
  pending:   { ar:'قيد الانتظار', en:'Pending',   color:'#f59e0b', bg:'#fef3c7' },
  completed: { ar:'مكتملة',       en:'Completed', color:'#10b981', bg:'#d1fae5' },
  missed:    { ar:'فائتة',        en:'Missed',    color:'#ef4444', bg:'#fee2e2' },
  cancelled: { ar:'ملغاة',        en:'Cancelled', color:'#6b7280', bg:'#f3f4f6' },
};
const CAMPAIGN_TYPES = {
  vaccination:       { ar:'حملة لقاحات',        en:'Vaccination' },
  checkup_reminder:  { ar:'تذكير بفحص دوري',    en:'Checkup Reminder' },
  awareness:         { ar:'توعية صحية عامة',    en:'General Awareness' },
  seasonal:          { ar:'حملة موسمية',        en:'Seasonal' },
};

export default function CRMPage() {
  const {
    lang, showToast, patients,
    crmFollowUps, addCrmFollowUp, updateCrmFollowUpStatus,
    crmSegments, assignCrmSegment,
    crmInteractions, addCrmInteraction,
    crmCampaigns, addCrmCampaign, buildCrmCampaignTargets,
    crmCampaignTargets,
    hospitals, multiHospitalEnabled,
  } = useApp();

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('followups');
  const [fuFilter, setFuFilter] = useState('pending');
  const [showFuModal, setShowFuModal] = useState(false);
  const [fuForm, setFuForm] = useState({ patientId:'', followUpType:'checkup', title:'', dueDate:'', reminderChannel:'sms' });
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ nameAr:'', nameEn:'', campaignType:'awareness', targetSegment:'all', channel:'sms', messageAr:'', messageEn:'' });

  const S = {
    page:{padding:24,direction:dir},
    tabs:{display:'flex',gap:8,borderBottom:'2px solid var(--border)',marginBottom:20},
    tabBtn:(active)=>({padding:'10px 16px',border:'none',borderBottom:active?'3px solid #1a6bab':'3px solid transparent',background:'transparent',fontWeight:active?700:500,cursor:'pointer',fontSize:13,color:'var(--text-primary)'}),
    tb:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},
    btn:(c='#1a6bab')=>({padding:'8px 16px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    table:{width:'100%',borderCollapse:'collapse',background:'var(--bg-secondary)',borderRadius:12,overflow:'hidden'},
    th:{padding:'10px 12px',textAlign:dir==='rtl'?'right':'left',background:'var(--bg-tertiary)',fontSize:11,fontWeight:600,color:'var(--text-secondary)',borderBottom:'1px solid var(--border)'},
    td:{padding:'10px 12px',borderBottom:'1px solid var(--border)',fontSize:12,color:'var(--text-primary)'},
    badge:(c,bg)=>({display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,color:c,background:bg}),
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999},
    mbox:{background:'var(--bg-primary)',borderRadius:16,padding:28,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',direction:dir},
    g2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
    fl:{display:'block',fontSize:12,color:'var(--text-secondary)',marginBottom:4},
    fi:{width:'100%',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
  };

  const patientName = (id) => patients.find(p => p.id === Number(id))?.name || '—';

  const filteredFollowUps = useMemo(
    () => crmFollowUps.filter(f => fuFilter === 'all' || f.status === fuFilter)
      .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [crmFollowUps, fuFilter]
  );

  const complianceReport = useMemo(() => {
    const byType = {};
    crmFollowUps.forEach(f => {
      if (!byType[f.followUpType]) byType[f.followUpType] = { type:f.followUpType, completed:0, missed:0, pending:0, total:0 };
      byType[f.followUpType].total++;
      byType[f.followUpType][f.status === 'completed' ? 'completed' : f.status === 'missed' ? 'missed' : 'pending']++;
    });
    return Object.values(byType);
  }, [crmFollowUps]);

  const campaignReport = useMemo(() => crmCampaigns.map(c => {
    const targets = crmCampaignTargets.filter(t => t.campaignId === c.id);
    const delivered = targets.filter(t => t.deliveryStatus === 'delivered').length;
    const responded = targets.filter(t => t.deliveryStatus === 'responded').length;
    return { ...c, totalTargets: targets.length, delivered, responded };
  }), [crmCampaigns, crmCampaignTargets]);

  function submitFollowUp() {
    if (!fuForm.patientId || !fuForm.title || !fuForm.dueDate) {
      showToast(L('عبّي كل الحقول المطلوبة', 'Please fill all required fields'), 'error');
      return;
    }
    addCrmFollowUp({ ...fuForm, patientId: Number(fuForm.patientId) });
    showToast(L('تمت إضافة المتابعة', 'Follow-up added'), 'success');
    setShowFuModal(false);
    setFuForm({ patientId:'', followUpType:'checkup', title:'', dueDate:'', reminderChannel:'sms' });
  }

  function submitCampaign() {
    if (!campaignForm.nameAr) {
      showToast(L('اكتب اسم الحملة', 'Enter a campaign name'), 'error');
      return;
    }
    addCrmCampaign(campaignForm);
    showToast(L('تم إنشاء الحملة', 'Campaign created'), 'success');
    setShowCampaignModal(false);
    setCampaignForm({ nameAr:'', nameEn:'', campaignType:'awareness', targetSegment:'all', channel:'sms', messageAr:'', messageEn:'' });
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
          {L('📇 إدارة علاقات المرضى (CRM)', '📇 Patient CRM')}
        </h1>
        <p style={{ color:'var(--text-secondary)', fontSize:13, margin:'4px 0 0' }}>
          {L('متابعات، تذكيرات، وحملات توعية صحية للمرضى', 'Follow-ups, reminders and awareness campaigns')}
        </p>
      </div>

      <div style={S.tabs}>
        <button style={S.tabBtn(tab==='followups')} onClick={() => setTab('followups')}>{L('المتابعات والتذكيرات','Follow-ups')}</button>
        <button style={S.tabBtn(tab==='campaigns')} onClick={() => setTab('campaigns')}>{L('حملات التوعية','Campaigns')}</button>
        <button style={S.tabBtn(tab==='reports')} onClick={() => setTab('reports')}>{L('التقارير','Reports')}</button>
      </div>

      {tab === 'followups' && (
        <div>
          <div style={S.tb}>
            {['pending','completed','missed','all'].map(s => (
              <button key={s} onClick={() => setFuFilter(s)} style={{ ...S.btn(fuFilter===s?'#1a6bab':'var(--bg-tertiary)'), color: fuFilter===s?'#fff':'var(--text-primary)' }}>
                {s === 'all' ? L('الكل','All') : L(FOLLOWUP_STATUS[s].ar, FOLLOWUP_STATUS[s].en)}
              </button>
            ))}
            <div style={{ flex:1 }} />
            <button style={S.btn()} onClick={() => setShowFuModal(true)}>{L('+ متابعة جديدة','+ New Follow-up')}</button>
          </div>

          <table style={S.table}>
            <thead>
              <tr>
                {[L('المريض','Patient'), L('النوع','Type'), L('العنوان','Title'), L('تاريخ الاستحقاق','Due Date'), L('الحالة','Status'), L('إجراء','Action')]
                  .map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredFollowUps.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'var(--text-secondary)' }}>{L('لا توجد متابعات','No follow-ups')}</td></tr>
              )}
              {filteredFollowUps.map(f => {
                const st = FOLLOWUP_STATUS[f.status] || FOLLOWUP_STATUS.pending;
                return (
                  <tr key={f.id}>
                    <td style={S.td}>{patientName(f.patientId)}</td>
                    <td style={S.td}>{L(FOLLOWUP_TYPES[f.followUpType]?.ar, FOLLOWUP_TYPES[f.followUpType]?.en) || f.followUpType}</td>
                    <td style={S.td}>{f.title}</td>
                    <td style={S.td}>{f.dueDate}</td>
                    <td style={S.td}><span style={S.badge(st.color, st.bg)}>{L(st.ar, st.en)}</span></td>
                    <td style={S.td}>
                      {f.status === 'pending' && (
                        <div style={{ display:'flex', gap:4 }}>
                          <button style={{ ...S.btn('#10b981'), padding:'3px 8px', fontSize:10 }} onClick={() => updateCrmFollowUpStatus(f.id,'completed')}>{L('تمت','Done')}</button>
                          <button style={{ ...S.btn('#ef4444'), padding:'3px 8px', fontSize:10 }} onClick={() => updateCrmFollowUpStatus(f.id,'missed')}>{L('فائتة','Missed')}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'campaigns' && (
        <div>
          <div style={S.tb}>
            <div style={{ flex:1 }} />
            <button style={S.btn()} onClick={() => setShowCampaignModal(true)}>{L('+ حملة جديدة','+ New Campaign')}</button>
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                {[L('الحملة','Campaign'), L('النوع','Type'), L('المستهدفون','Targets'), L('تم التوصيل','Delivered'), L('استجابوا','Responded'), L('إجراء','Action')]
                  .map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {campaignReport.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'var(--text-secondary)' }}>{L('لا توجد حملات بعد','No campaigns yet')}</td></tr>
              )}
              {campaignReport.map(c => (
                <tr key={c.id}>
                  <td style={S.td}>{L(c.nameAr, c.nameEn || c.nameAr)}</td>
                  <td style={S.td}>{L(CAMPAIGN_TYPES[c.campaignType]?.ar, CAMPAIGN_TYPES[c.campaignType]?.en) || c.campaignType}</td>
                  <td style={S.td}>{c.totalTargets}</td>
                  <td style={S.td}>{c.delivered}</td>
                  <td style={S.td}>{c.responded}</td>
                  <td style={S.td}>
                    <button style={{ ...S.btn('#6b7280'), padding:'3px 8px', fontSize:10 }} onClick={() => {
                      const count = buildCrmCampaignTargets(c.id);
                      showToast(L(`تم بناء قائمة المستفيدين: ${count} مريض`, `Target list built: ${count} patients`), 'success');
                    }}>{L('بناء القائمة','Build Targets')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reports' && (
        <div>
          <h3 style={{ fontSize:15, marginBottom:10 }}>{L('نسبة الالتزام بالمتابعات','Follow-up Compliance')}</h3>
          <table style={{ ...S.table, marginBottom:28 }}>
            <thead>
              <tr>{[L('النوع','Type'), L('مكتملة','Completed'), L('فائتة','Missed'), L('قيد الانتظار','Pending'), L('نسبة الالتزام','Compliance %')].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {complianceReport.map(r => (
                <tr key={r.type}>
                  <td style={S.td}>{L(FOLLOWUP_TYPES[r.type]?.ar, FOLLOWUP_TYPES[r.type]?.en) || r.type}</td>
                  <td style={S.td}>{r.completed}</td>
                  <td style={S.td}>{r.missed}</td>
                  <td style={S.td}>{r.pending}</td>
                  <td style={{ ...S.td, fontWeight:700 }}>{r.total ? Math.round((r.completed / r.total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ fontSize:15, marginBottom:10 }}>{L('أداء حملات التوعية','Campaign Performance')}</h3>
          <table style={S.table}>
            <thead>
              <tr>{[L('الحملة','Campaign'), L('المستهدفون','Targets'), L('تم التوصيل','Delivered'), L('استجابوا','Responded'), L('نسبة الاستجابة','Response %')].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {campaignReport.map(c => (
                <tr key={c.id}>
                  <td style={S.td}>{L(c.nameAr, c.nameEn || c.nameAr)}</td>
                  <td style={S.td}>{c.totalTargets}</td>
                  <td style={S.td}>{c.delivered}</td>
                  <td style={S.td}>{c.responded}</td>
                  <td style={{ ...S.td, fontWeight:700 }}>{c.totalTargets ? Math.round((c.responded / c.totalTargets) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showFuModal && (
        <div style={S.modal} onClick={() => setShowFuModal(false)}>
          <div style={S.mbox} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop:0 }}>{L('متابعة جديدة','New Follow-up')}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={S.fl}>{L('المريض','Patient')}</label>
                <select style={S.fi} value={fuForm.patientId} onChange={e => setFuForm({ ...fuForm, patientId: e.target.value })}>
                  <option value="">{L('اختر مريضاً','Select patient')}</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={S.g2}>
                <div>
                  <label style={S.fl}>{L('النوع','Type')}</label>
                  <select style={S.fi} value={fuForm.followUpType} onChange={e => setFuForm({ ...fuForm, followUpType: e.target.value })}>
                    {Object.entries(FOLLOWUP_TYPES).map(([k,v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.fl}>{L('تاريخ الاستحقاق','Due Date')}</label>
                  <input type="date" style={S.fi} value={fuForm.dueDate} onChange={e => setFuForm({ ...fuForm, dueDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={S.fl}>{L('العنوان','Title')}</label>
                <input style={S.fi} value={fuForm.title} onChange={e => setFuForm({ ...fuForm, title: e.target.value })} placeholder={L('مثال: فحص دوري للضغط','e.g. Blood pressure checkup')} />
              </div>
              {multiHospitalEnabled && (
                <div>
                  <label style={S.fl}>{L('المنشأة','Facility')}</label>
                  <select style={S.fi} value={fuForm.hospitalId || ''} onChange={e => setFuForm({ ...fuForm, hospitalId: e.target.value })}>
                    <option value="">—</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={S.fl}>{L('قناة التذكير','Reminder Channel')}</label>
                <select style={S.fi} value={fuForm.reminderChannel} onChange={e => setFuForm({ ...fuForm, reminderChannel: e.target.value })}>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">{L('اتصال','Call')}</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setShowFuModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={submitFollowUp}>{L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}

      {showCampaignModal && (
        <div style={S.modal} onClick={() => setShowCampaignModal(false)}>
          <div style={S.mbox} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop:0 }}>{L('حملة توعية جديدة','New Awareness Campaign')}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={S.g2}>
                <div>
                  <label style={S.fl}>{L('اسم الحملة (عربي)','Name (Arabic)')}</label>
                  <input style={S.fi} value={campaignForm.nameAr} onChange={e => setCampaignForm({ ...campaignForm, nameAr: e.target.value })} />
                </div>
                <div>
                  <label style={S.fl}>{L('اسم الحملة (إنجليزي)','Name (English)')}</label>
                  <input style={S.fi} value={campaignForm.nameEn} onChange={e => setCampaignForm({ ...campaignForm, nameEn: e.target.value })} />
                </div>
              </div>
              <div style={S.g2}>
                <div>
                  <label style={S.fl}>{L('النوع','Type')}</label>
                  <select style={S.fi} value={campaignForm.campaignType} onChange={e => setCampaignForm({ ...campaignForm, campaignType: e.target.value })}>
                    {Object.entries(CAMPAIGN_TYPES).map(([k,v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.fl}>{L('القناة','Channel')}</label>
                  <select style={S.fi} value={campaignForm.channel} onChange={e => setCampaignForm({ ...campaignForm, channel: e.target.value })}>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">{L('بريد إلكتروني','Email')}</option>
                  </select>
                </div>
              </div>
              {multiHospitalEnabled && (
                <div>
                  <label style={S.fl}>{L('المنشأة','Facility')}</label>
                  <select style={S.fi} value={campaignForm.hospitalId || ''} onChange={e => setCampaignForm({ ...campaignForm, hospitalId: e.target.value })}>
                    <option value="">—</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={S.fl}>{L('الفئة المستهدفة','Target Segment')}</label>
                <select style={S.fi} value={campaignForm.targetSegment} onChange={e => setCampaignForm({ ...campaignForm, targetSegment: e.target.value })}>
                  <option value="all">{L('كل المرضى النشطين','All active patients')}</option>
                  <option value="chronic">{L('مرضى مزمنون','Chronic')}</option>
                  <option value="priority">{L('أولوية','Priority')}</option>
                </select>
              </div>
              <div>
                <label style={S.fl}>{L('نص الرسالة (عربي)','Message (Arabic)')}</label>
                <textarea style={{ ...S.fi, minHeight:60 }} value={campaignForm.messageAr} onChange={e => setCampaignForm({ ...campaignForm, messageAr: e.target.value })} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setShowCampaignModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={submitCampaign}>{L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
