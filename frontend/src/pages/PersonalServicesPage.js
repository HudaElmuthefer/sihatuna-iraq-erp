/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { useT } from '../translations';
import { useNavigate } from 'react-router-dom';
import { useApp, translateDays } from '../contexts/AppContext';
import { FaSearch, FaCalendarAlt, FaUserMd, FaArrowRight } from 'react-icons/fa';

export default function PersonalServicesPage() {
  const navigate = useNavigate();
  const { lang, addToast, doctors, departments } = useApp();
  const tr = useT(lang);
  const ar = lang === 'ar';
  const [search, setSearch] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedDept, setSelectedDept] = useState(null);
  const doctorsRef = useRef(null);

  // عند الانتقال من صفحة رئيسية بضغط قسم معين
  useEffect(() => {
    const savedDeptId = sessionStorage.getItem('services_deptId');
    if (savedDeptId) {
      setSelectedDept(Number(savedDeptId));
      sessionStorage.removeItem('services_deptId');
      setTimeout(() => doctorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, []);
  const [bookModal, setBookModal] = useState(null);
  const [form, setForm] = useState({ date: '', time: '09:00', notes: '' });

  // Get all unique specializations from doctors
  const specializations = lang==='ar' ? [...new Set(doctors.map(d=>d.specialization).filter(Boolean))] : [...new Set(doctors.map(d=>d.specializationEn||d.specialization).filter(Boolean))];

  // Filter doctors
  const filtered = doctors.filter(d => {
    if (d.status !== 'active') return false;
    const matchSearch = !search ||
      (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
      ((d.specialization||'')+' '+(d.specializationEn||'')).toLowerCase().includes(search.toLowerCase());
    const matchSpec = !selectedSpec || d.specialization===selectedSpec || d.specializationEn===selectedSpec;
    const matchDept = !selectedDept || d.deptId === selectedDept;
    return matchSearch && matchSpec && matchDept;
  });

  const handleBook = () => {
    if (!form.date) { addToast(tr('x_akhtrtarikhalmwad'), 'error'); return; }
    addToast(`${tr('svc_booking_success')} ${bookModal?.name} ✅`, 'success');
    setBookModal(null);
    setForm({ date: '', time: '09:00', notes: '' });
  };

  return (
    <div className="page-content">
      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#0f2340 0%,#1a6bab 100%)', borderRadius:16, padding:'32px', marginBottom:24, color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-20, left:-20, fontSize:140, opacity:0.06 }}>🏥</div>
        <h1 style={{ margin:'0 0 6px', fontSize:28, fontWeight:900 }}>{tr('svc_title')}</h1>
        <p style={{ margin:'0 0 20px', opacity:0.75, fontSize:14 }}>{tr('svc_subtitle')}</p>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.12)', border:'2px solid rgba(255,255,255,0.25)', borderRadius:12, padding:'12px 16px', maxWidth:480, backdropFilter:'blur(8px)' }}>
          <FaSearch style={{ color:'rgba(255,255,255,0.6)', flexShrink:0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('svc_search')}
            style={{ background:'none', border:'none', outline:'none', color:'#fff', fontFamily:'inherit', fontSize:15, flex:1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:16 }}>×</button>}
        </div>
      </div>

      {/* Departments */}
      <div className="card" style={{ marginBottom:24 }}>
        <h3 style={{ margin:'0 0 16px', fontSize:18, fontWeight:700 }}>🏢 {tr('svc_available_depts')}</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {departments.map(dept => (
            <button key={dept.id} onClick={() => { setSelectedSpec(''); setSelectedDept(selectedDept === dept.id ? null : dept.id); setTimeout(() => doctorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 10px', borderRadius:12,
                background: selectedDept === dept.id ? `${dept.color}35` : `${dept.color}15`,
                border:`2px solid ${selectedDept === dept.id ? dept.color : dept.color+'30'}`,
                cursor:'pointer', transition:'all 0.2s',
                transform: selectedDept === dept.id ? 'translateY(-4px)' : 'none',
                boxShadow: selectedDept === dept.id ? `0 6px 20px ${dept.color}40` : 'none' }}
              onMouseEnter={e => { if(selectedDept !== dept.id) { e.currentTarget.style.background = `${dept.color}25`; e.currentTarget.style.borderColor = dept.color; } }}
              onMouseLeave={e => { if(selectedDept !== dept.id) { e.currentTarget.style.background = `${dept.color}15`; e.currentTarget.style.borderColor = `${dept.color}30`; } }}>
              <span style={{ fontSize:32 }}>{dept.icon}</span>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', textAlign:'center' }}>{lang==="ar"?dept.name:dept.nameEn||dept.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Specialization filter */}
      <div style={{ marginBottom:16, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:600 }}>🔍 {tr('x_tsfia')}</span>
        <button onClick={() => setSelectedSpec('')}
          style={{ padding:'6px 14px', borderRadius:20, border:`2px solid ${!selectedSpec?'#1a6bab':'var(--border)'}`,
            background:!selectedSpec?'#1a6bab':'transparent', color:!selectedSpec?'#fff':'var(--text-primary)',
            cursor:'pointer', fontSize:12, fontWeight:600 }}>
          {tr('svc_filter_all')}
        </button>
        {specializations.map(spec => (
          <button key={spec} onClick={() => setSelectedSpec(spec === selectedSpec ? '' : spec)}
            style={{ padding:'6px 14px', borderRadius:20, border:`2px solid ${selectedSpec===spec?'#1a6bab':'var(--border)'}`,
              background:selectedSpec===spec?'#1a6bab':'transparent', color:selectedSpec===spec?'#fff':'var(--text-primary)',
              cursor:'pointer', fontSize:12 }}>
            {spec}
          </button>
        ))}
      </div>

      {/* Doctors */}
      <div className="card" ref={doctorsRef}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <FaUserMd style={{ color:'#1a6bab' }} />
            {tr('svc_available_docs')}
            {selectedDept && <span style={{ background:'rgba(26,107,171,0.15)', color:'#1a6bab', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>
              {departments.find(d => d.id === selectedDept)?.name || ''}
            </span>}
            <span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:700 }}>{filtered.length}</span>
          </h3>
          {(selectedDept || selectedSpec || search) && (
            <button onClick={() => { setSelectedDept(null); setSelectedSpec(''); setSearch(''); }}
              style={{ fontSize:12, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'5px 12px', cursor:'pointer' }}>
              ✕ {tr('btn_clear_filter')}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-secondary)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>👨‍⚕️</div>
            <p>{tr('svc_no_results')}</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16 }}>
            {filtered.map(doc => (
              <div key={doc.id} style={{ padding:20, borderRadius:12, border:'1.5px solid var(--border)', background:'var(--bg-secondary)', display:'flex', flexDirection:'column', alignItems:'center', transition:'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#1a6bab'; e.currentTarget.style.transform='translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:doc.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, marginBottom:10 }}>{doc.avatar}</div>
                <div style={{ fontWeight:700, fontSize:14, textAlign:'center', marginBottom:4 }}>{lang==="ar"?doc.name:doc.nameEn||doc.name}</div>
                <div style={{ fontSize:12, color:'#1a6bab', fontWeight:600, marginBottom:8, textAlign:'center' }}>{lang==="ar"?doc.specialization:doc.specializationEn||doc.specialization}</div>
                <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--text-secondary)', marginBottom:12 }}>
                  <span>⭐ {doc.rating}</span>
                  <span>👥 {doc.patients}</span>
                  <span>🕐 {doc.experience} {lang==='ar'?'سنة':'yr'}</span>
                </div>
                <button className="btn btn-primary" style={{ width:'100%', fontSize:13, padding:'8px' }} onClick={() => setBookModal(doc)}>
                  <FaCalendarAlt style={{ marginLeft:6 }} /> {tr('svc_book')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {bookModal && (
        <div className="modal-overlay" onClick={() => setBookModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:460 }}>
            <div className="modal-header">
              <h3 style={{ margin:0 }}>{tr('svc_book_title')}</h3>
              <button onClick={() => setBookModal(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', gap:12, padding:14, background:'var(--bg-secondary)', borderRadius:10, marginBottom:16, alignItems:'center' }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:bookModal.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 }}>{bookModal.avatar}</div>
                <div>
                  <div style={{ fontWeight:700 }}>{lang==="ar"?bookModal.name:bookModal.nameEn||bookModal.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{lang==="ar"?bookModal.specialization:bookModal.specializationEn||bookModal.specialization}</div>
                  <div style={{ fontSize:11, color:'#22c55e' }}>⏰ {bookModal.workHours}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label className="form-label">{tr('x_altarikh')}</label><input className="form-control" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} min={new Date().toISOString().split('T')[0]} /></div>
                <div><label className="form-label">{tr('field_time')}</label><input className="form-control" type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))} /></div>
              </div>
              <div style={{ marginTop:12 }}><label className="form-label">{tr('field_notes')}</label><textarea className="form-control" rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder={tr('auto_سبب_الزيارة')} /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setBookModal(null)} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer' }}>{tr('auto_إلغاء')}</button>
              <button className="btn btn-primary" onClick={handleBook}><FaCalendarAlt /> {tr('svc_book_confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
