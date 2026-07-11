/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import ExcelImportModal from '../components/ExcelImportModal';

const VEH_STATUS = {
  available:   { ar:'متاحة',       en:'Available',    color:'#10b981', bg:'#d1fae5' },
  on_mission:  { ar:'في مأمورية', en:'On Mission',   color:'#f59e0b', bg:'#fef3c7' },
  maintenance: { ar:'صيانة',       en:'Maintenance',  color:'#ef4444', bg:'#fee2e2' },
  standby:     { ar:'احتياطي',    en:'Standby',      color:'#6b7280', bg:'#f3f4f6' },
};
const VEH_TYPE = {
  advanced: { ar:'إسعاف متطور ALS', en:'Advanced Life Support', icon:'🚑', color:'#ef4444' },
  basic:    { ar:'إسعاف أساسي BLS', en:'Basic Life Support',    icon:'🚐', color:'#f59e0b' },
  transport:{ ar:'نقل مرضى',        en:'Patient Transport',     icon:'🚌', color:'#1a6bab' },
};
const MISS_STATUS = {
  active:    { ar:'نشطة',   en:'Active',    color:'#ef4444', bg:'#fee2e2' },
  completed: { ar:'منجزة',  en:'Completed', color:'#10b981', bg:'#d1fae5' },
  cancelled: { ar:'ملغية',  en:'Cancelled', color:'#6b7280', bg:'#f3f4f6' },
};
const MISS_TYPE = {
  emergency: { ar:'طارئ',        en:'Emergency' },
  transfer:  { ar:'نقل مريض',   en:'Transfer' },
  routine:   { ar:'دوري',        en:'Routine' },
};

const EMPTY_VEH  = { code:'', plate:'', type:'advanced', model:'', crew:'', status:'available', lastService:'', nextService:'', km:0, fuel:100, location:'' };
const EMPTY_MISS = { missionNo:'', vehicleId:'', type:'emergency', callTime:'', address:'', patient:'', status:'active', crew:'', notes:'' };

export default function AmbulancePage() {
  const { ambulanceData, setAmbulanceData, lang, showToast, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled, user } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [tab, setTab] = useState('vehicles');
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([api.get('/ambulanceVehicles').catch(() => []), api.get('/ambulanceMissions').catch(() => [])])
      .then(([vehicles, missions]) => {
        if (cancelled) return;
        setAmbulanceData(p => ({
          vehicles: Array.isArray(vehicles) && vehicles.length > 0 ? vehicles : p.vehicles,
          missions: Array.isArray(missions) && missions.length > 0 ? missions : p.missions,
        }));
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showVehModal, setShowVehModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMissModal, setShowMissModal] = useState(false);
  const [editVehId, setEditVehId] = useState(null);
  const [editMissId, setEditMissId] = useState(null);
  const [vehForm, setVehForm] = useState({});
  const [missForm, setMissForm] = useState({});

  const { vehicles: vehiclesRaw = [], missions: missionsRaw = [] } = ambulanceData;
  const vehicles = filterByViewingHospital(vehiclesRaw);
  const missions = filterByViewingHospital(missionsRaw);

  const stats = useMemo(() => ({
    total:        vehicles.length,
    available:    vehicles.filter(v => v.status === 'available').length,
    onMission:    vehicles.filter(v => v.status === 'on_mission').length,
    maintenance:  vehicles.filter(v => v.status === 'maintenance').length,
    activeMissions: missions.filter(m => m.status === 'active').length,
  }), [vehicles, missions]);

  // ── VEHICLE CRUD ────────────────────────────────────────────────────
  const openAddVeh = () => {
    setVehForm({ ...EMPTY_VEH, location: L('المستشفى','Hospital') });
    setEditVehId(null); setShowVehModal(true);
  };
  const saveVeh = async () => {
    if (!vehForm.code || !vehForm.plate) {
      showToast(L('يرجى إدخال الرمز ورقم اللوحة','Please enter code and plate number'), 'error'); return;
    }
    if (editVehId) {
      const uv = { ...vehForm, id: editVehId };
      setAmbulanceData(p => ({ ...p, vehicles: p.vehicles.map(v => v.id === editVehId ? { ...v, ...uv } : v) }));
      await syncToServer('ambulanceVehicles', 'update', uv);
      showToast(L('تم التحديث','Updated'), 'success');
    } else {
      const nv = { ...vehForm, id: Date.now() };
      setAmbulanceData(p => ({ ...p, vehicles: [...p.vehicles, nv] }));
      const synced = await syncToServer('ambulanceVehicles', 'create', nv);
      if (synced && typeof synced === 'object' && synced.id !== nv.id) {
        setAmbulanceData(p => ({ ...p, vehicles: p.vehicles.map(v => v.id === nv.id ? synced : v) }));
      }
      showToast(L('تمت إضافة المركبة','Vehicle added'), 'success');
    }
    setShowVehModal(false);
  };
  const deleteVeh = id => {
    setAmbulanceData(p => ({ ...p, vehicles: p.vehicles.filter(v => v.id !== id) }));
    syncToServer('ambulanceVehicles', 'delete', { id });
    showToast(L('تم الحذف','Deleted'), 'info');
  };

  // ── MISSION CRUD ────────────────────────────────────────────────────
  const openAddMiss = (prefill = {}) => {
    setMissForm({ ...EMPTY_MISS, callTime: new Date().toISOString().slice(0, 16), ...prefill });
    setEditMissId(null); setShowMissModal(true);
  };
  const saveMiss = async () => {
    if (!missForm.address) {
      showToast(L('يرجى إدخال العنوان','Please enter address'), 'error'); return;
    }
    const mNo = `MSN-${new Date().getFullYear()}-${String(missions.length + 1).padStart(3, '0')}`;
    if (editMissId) {
      const um = { ...missForm, id: editMissId };
      setAmbulanceData(p => ({ ...p, missions: p.missions.map(m => m.id === editMissId ? { ...m, ...um } : m) }));
      syncToServer('ambulanceMissions', 'update', um);
      showToast(L('تم التحديث','Updated'), 'success');
    } else {
      const newMission = { ...missForm, missionNo: mNo, id: Date.now() };
      let updatedVehicle = null;
      setAmbulanceData(p => {
        const vehicles = missForm.vehicleId
          ? p.vehicles.map(v => { if (v.id === +missForm.vehicleId) { updatedVehicle = { ...v, status: 'on_mission' }; return updatedVehicle; } return v; })
          : p.vehicles;
        return { ...p, missions: [...p.missions, newMission], vehicles };
      });
      syncToServer('ambulanceMissions', 'create', newMission).then(synced => {
        if (synced && typeof synced === 'object' && synced.id !== newMission.id) {
          setAmbulanceData(p => ({ ...p, missions: p.missions.map(m => m.id === newMission.id ? synced : m) }));
        }
      });
      if (updatedVehicle) syncToServer('ambulanceVehicles', 'update', updatedVehicle);
      showToast(L('تم إرسال المأمورية','Mission dispatched'), 'success');
    }
    setShowMissModal(false);
  };
  const completeMission = id => {
    const miss = missions.find(m => m.id === id);
    const completedMission = { ...miss, status: 'completed' };
    let updatedVehicle = null;
    setAmbulanceData(p => ({
      ...p,
      missions: p.missions.map(m => m.id === id ? completedMission : m),
      vehicles: p.vehicles.map(v => { if (v.id === miss?.vehicleId) { updatedVehicle = { ...v, status: 'available', location: L('المستشفى','Hospital') }; return updatedVehicle; } return v; }),
    }));
    syncToServer('ambulanceMissions', 'update', completedMission);
    if (updatedVehicle) syncToServer('ambulanceVehicles', 'update', updatedVehicle);
    showToast(L('تمت المأمورية','Mission completed'), 'success');
  };
  const cancelMission = id => {
    setAmbulanceData(p => {
      const updated = p.missions.map(m => m.id === id ? { ...m, status: 'cancelled' } : m);
      const changed = updated.find(m => m.id === id);
      if (changed) syncToServer('ambulanceMissions', 'update', changed);
      return { ...p, missions: updated };
    });
    showToast(L('تم الإلغاء','Cancelled'), 'info');
  };

  const n = v => Number(v).toLocaleString(lang==='ar'?'ar-IQ':'en-US');

  const S = {
    page:  { padding: 24, direction: dir },
    stats: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 },
    sCard: c => ({ background:'var(--bg-secondary)', borderRadius:12, padding:'14px 18px', borderTop:`3px solid ${c}` }),
    btn:   (c='#1a6bab') => ({ padding:'8px 16px', background:c, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }),
    smBtn: (c='#6b7280') => ({ padding:'4px 10px', background:c, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }),
    vCard: { background:'var(--bg-secondary)', borderRadius:12, padding:18, border:'1px solid var(--border)' },
    badge: (c, bg) => ({ display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, color:c, background:bg }),
    modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
    mbox:  (w=500) => ({ background:'var(--bg-primary)', borderRadius:16, padding:28, width:'100%', maxWidth:w, maxHeight:'90vh', overflowY:'auto', direction:dir }),
    g2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
    fl:    { display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 },
    fi:    { width:'100%', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13, boxSizing:'border-box' },
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:0 }}>🚑 {L('الإسعاف والمركبات','Ambulance & Vehicles')}</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:13, margin:'4px 0 0' }}>{L('إدارة سيارات الإسعاف والمأموريات الطارئة','Manage ambulances and emergency missions')}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={S.btn('#ef4444')} onClick={() => openAddMiss()}>🆘 {L('مأمورية طارئة','Emergency Mission')}</button>
          <button style={{ ...S.btn(), background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }} onClick={() => setShowImport(true)}>📊 {L('استيراد من Excel','Import from Excel')}</button>
          <button style={S.btn()} onClick={openAddVeh}>+ {L('مركبة','Vehicle')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="ambulanceVehicles"
          title={L('استيراد مركبات من Excel','Import Vehicles from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/ambulanceVehicles');
              if (Array.isArray(fresh)) setAmbulanceData(p => ({ ...p, vehicles: fresh }));
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}

      {/* Stats */}
      <div style={S.stats}>
        {[
          [L('إجمالي المركبات','Total Vehicles'), stats.total,          '#1a6bab'],
          [L('متاحة','Available'),                 stats.available,      '#10b981'],
          [L('في مأمورية','On Mission'),            stats.onMission,      '#f59e0b'],
          [L('صيانة','Maintenance'),                stats.maintenance,    '#ef4444'],
          [L('مأموريات نشطة','Active Missions'),    stats.activeMissions, '#ef4444'],
        ].map(([l, v, c], i) => (
          <div key={i} style={S.sCard(c)}>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>{v}</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[['vehicles', L('🚑 المركبات','🚑 Vehicles')], ['missions', L('📋 المأموريات','📋 Missions')]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            ...S.btn(tab === k ? '#1a6bab' : 'transparent'),
            color: tab === k ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}>{l}</button>
        ))}
      </div>

      {/* ── VEHICLES TAB ── */}
      {tab === 'vehicles' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
          {vehicles.map(v => {
            const st  = VEH_STATUS[v.status] || VEH_STATUS.available;
            const tp  = VEH_TYPE[v.type]     || VEH_TYPE.basic;
            return (
              <div key={v.id} style={{ ...S.vCard, borderRight: `4px solid ${st.color}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:20 }}>{tp.icon}</span>
                      <span style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{v.code}</span>
                      <span style={S.badge(st.color, st.bg)}>{L(st.ar, st.en)}</span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{v.plate} | {v.model}</div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{L(tp.ar, tp.en)}</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:2 }}>{L('وقود','Fuel')}</div>
                    <div style={{ width:50, height:8, background:'var(--border)', borderRadius:4 }}>
                      <div style={{ width:`${v.fuel}%`, height:'100%', background: v.fuel > 50 ? '#10b981' : v.fuel > 20 ? '#f59e0b' : '#ef4444', borderRadius:4 }}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:1 }}>{v.fuel}%</div>
                  </div>
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.8 }}>
                  <div>👤 {v.crew || L('غير مُعيَّن','Unassigned')}</div>
                  <div>📍 {v.location}</div>
                  <div>🔧 {L('صيانة قادمة:','Next service:')} {v.nextService || '—'}</div>
                  <div>🛣️ {L('العداد:','Odometer:')} {n(v.km)} {L('كم','km')}</div>
                </div>
                <div style={{ display:'flex', gap:6, marginTop:12 }}>
                  {v.status === 'available' && (
                    <button onClick={() => openAddMiss({ vehicleId: v.id, crew: v.crew })} style={S.smBtn('#ef4444')}>
                      🆘 {L('إرسال','Dispatch')}
                    </button>
                  )}
                  <button onClick={() => { setVehForm({ ...v }); setEditVehId(v.id); setShowVehModal(true); }} style={S.smBtn('#6b7280')}>✏️</button>
                  <button onClick={() => deleteVeh(v.id)} style={S.smBtn('#ef4444')}>🗑</button>
                </div>
              </div>
            );
          })}
          {vehicles.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:48, color:'var(--text-secondary)', background:'var(--bg-secondary)', borderRadius:12 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🚑</div>
              <p>{L('لا توجد مركبات','No vehicles found')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── MISSIONS TAB ── */}
      {tab === 'missions' && (
        <div>
          {[...missions].sort((a, b) => a.status === 'active' ? -1 : 1).map(m => {
            const ms  = MISS_STATUS[m.status]  || MISS_STATUS.active;
            const mt  = MISS_TYPE[m.type]      || MISS_TYPE.emergency;
            const veh = vehicles.find(v => v.id === m.vehicleId);
            return (
              <div key={m.id} style={{ ...S.vCard, marginBottom:12, borderRight: m.status === 'active' ? '4px solid #ef4444' : '1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:14, fontWeight:700, color: m.status === 'active' ? '#ef4444' : 'var(--text-primary)' }}>
                        {m.status === 'active' ? '🔴' : m.status === 'completed' ? '✅' : '⬜'} {m.missionNo}
                      </span>
                      <span style={S.badge(ms.color, ms.bg)}>{L(ms.ar, ms.en)}</span>
                      <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:12, background: m.type === 'emergency' ? '#fee2e2' : '#dbeafe', color: m.type === 'emergency' ? '#ef4444' : '#1a6bab' }}>
                        {L(mt.ar, mt.en)}
                      </span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>📍 {m.address}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                      👤 {m.patient || L('مجهول','Unknown')}
                      {' | '}🚑 {veh?.code || '—'} {veh?.plate ? `(${veh.plate})` : ''}
                      {' | '}⏰ {m.callTime}
                    </div>
                    {m.notes && <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4 }}>📝 {m.notes}</div>}
                  </div>
                </div>
                {m.status === 'active' && (
                  <div style={{ display:'flex', gap:8, marginTop:10, borderTop:'1px solid var(--border)', paddingTop:8 }}>
                    <button onClick={() => completeMission(m.id)} style={S.btn('#10b981')}>✅ {L('إنجاز المأمورية','Complete Mission')}</button>
                    <button onClick={() => cancelMission(m.id)} style={S.btn('#ef4444')}>❌ {L('إلغاء','Cancel')}</button>
                  </div>
                )}
              </div>
            );
          })}
          {missions.length === 0 && (
            <div style={{ textAlign:'center', padding:48, color:'var(--text-secondary)', background:'var(--bg-secondary)', borderRadius:12 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>📋</div>
              <p>{L('لا توجد مأموريات','No missions found')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── VEHICLE MODAL ── */}
      {showVehModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowVehModal(false)}>
          <div style={S.mbox()}>
            <h3 style={{ margin:'0 0 18px', color:'var(--text-primary)' }}>{editVehId ? L('✏️ تعديل المركبة','✏️ Edit Vehicle') : L('🚑 إضافة مركبة','🚑 Add Vehicle')}</h3>
            <div style={S.g2}>
              {[
                ['code',        L('رمز المركبة','Vehicle Code'),      'text'],
                ['plate',       L('رقم اللوحة','Plate Number'),       'text'],
                ['model',       L('الموديل','Model'),                 'text'],
                ['km',          L('قراءة العداد (كم)','Odometer (km)'), 'number'],
                ['fuel',        L('نسبة الوقود %','Fuel %'),          'number'],
                ['lastService', L('آخر صيانة','Last Service'),        'date'],
                ['nextService', L('الصيانة القادمة','Next Service'),  'date'],
              ].map(([k, lbl, tp]) => (
                <label key={k}>
                  <span style={S.fl}>{lbl}</span>
                  <input type={tp} style={S.fi} value={vehForm[k] || ''} onChange={e => setVehForm(p => ({ ...p, [k]: e.target.value }))}/>
                </label>
              ))}
              <label style={{ gridColumn:'span 2' }}>
                <span style={S.fl}>{L('الطاقم','Crew')}</span>
                <input style={S.fi} value={vehForm.crew || ''} onChange={e => setVehForm(p => ({ ...p, crew: e.target.value }))}/>
              </label>
              <label style={{ gridColumn:'span 2' }}>
                <span style={S.fl}>{L('الموقع الحالي','Current Location')}</span>
                <input style={S.fi} value={vehForm.location || ''} onChange={e => setVehForm(p => ({ ...p, location: e.target.value }))}/>
              </label>
              {multiHospitalEnabled && (
                <label style={{ gridColumn:'span 2' }}>
                  <span style={S.fl}>{L('المنشأة','Facility')}</span>
                  <select style={S.fi} value={vehForm.hospitalId || ''} onChange={e => setVehForm(p => ({ ...p, hospitalId: e.target.value }))}>
                    <option value="">—</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span style={S.fl}>{L('النوع','Type')}</span>
                <select style={S.fi} value={vehForm.type || 'basic'} onChange={e => setVehForm(p => ({ ...p, type: e.target.value }))}>
                  {Object.entries(VEH_TYPE).map(([k, v]) => <option key={k} value={k}>{v.icon} {L(v.ar, v.en)}</option>)}
                </select>
              </label>
              <label>
                <span style={S.fl}>{L('الحالة','Status')}</span>
                <select style={S.fi} value={vehForm.status || 'available'} onChange={e => setVehForm(p => ({ ...p, status: e.target.value }))}>
                  {Object.entries(VEH_STATUS).map(([k, v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setShowVehModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={saveVeh}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MISSION MODAL ── */}
      {showMissModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowMissModal(false)}>
          <div style={S.mbox(440)}>
            <h3 style={{ margin:'0 0 18px', color:'var(--text-primary)' }}>{editMissId ? L('تعديل المأمورية','Edit Mission') : L('🆘 مأمورية جديدة','🆘 New Mission')}</h3>
            <div style={S.g2}>
              <label>
                <span style={S.fl}>{L('نوع المأمورية','Mission Type')}</span>
                <select style={S.fi} value={missForm.type || 'emergency'} onChange={e => setMissForm(p => ({ ...p, type: e.target.value }))}>
                  {Object.entries(MISS_TYPE).map(([k, v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
                </select>
              </label>
              <label>
                <span style={S.fl}>{L('المركبة','Vehicle')}</span>
                <select style={S.fi} value={missForm.vehicleId || ''} onChange={e => setMissForm(p => ({ ...p, vehicleId: +e.target.value }))}>
                  <option value="">{L('اختر مركبة...','Select vehicle...')}</option>
                  {vehicles.filter(v => v.status === 'available').map(v => (
                    <option key={v.id} value={v.id}>{v.code} - {v.plate}</option>
                  ))}
                </select>
              </label>
              <label style={{ gridColumn:'span 2' }}>
                <span style={S.fl}>{L('العنوان / الموقع','Address / Location')}</span>
                <input style={S.fi} value={missForm.address || ''} onChange={e => setMissForm(p => ({ ...p, address: e.target.value }))}/>
              </label>
              {multiHospitalEnabled && (
                <label style={{ gridColumn:'span 2' }}>
                  <span style={S.fl}>{L('المنشأة','Facility')}</span>
                  <select style={S.fi} value={missForm.hospitalId || ''} onChange={e => setMissForm(p => ({ ...p, hospitalId: e.target.value }))}>
                    <option value="">—</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span style={S.fl}>{L('المريض','Patient')}</span>
                <input style={S.fi} value={missForm.patient || ''} onChange={e => setMissForm(p => ({ ...p, patient: e.target.value }))}/>
              </label>
              <label>
                <span style={S.fl}>{L('وقت الاستدعاء','Call Time')}</span>
                <input type="datetime-local" style={S.fi} value={missForm.callTime || ''} onChange={e => setMissForm(p => ({ ...p, callTime: e.target.value }))}/>
              </label>
              <label style={{ gridColumn:'span 2' }}>
                <span style={S.fl}>{L('ملاحظات','Notes')}</span>
                <input style={S.fi} value={missForm.notes || ''} onChange={e => setMissForm(p => ({ ...p, notes: e.target.value }))}/>
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setShowMissModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn('#ef4444')} onClick={saveMiss}>🆘 {L('إرسال المأمورية','Dispatch Mission')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
