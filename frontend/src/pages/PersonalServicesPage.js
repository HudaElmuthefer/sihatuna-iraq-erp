/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { useT } from '../translations';
import { useNavigate } from 'react-router-dom';
import { useApp, translateDays } from '../contexts/AppContext';
import { api } from '../api';
import { FaSearch, FaCalendarAlt, FaUserMd, FaArrowRight } from 'react-icons/fa';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg,#0f2340 0%,#1a6bab 100%)';

export default function PersonalServicesPage() {
  const navigate = useNavigate();
  const { lang, addToast, doctors, departments, appointments, setAppointments, syncToServer, patients } = useApp();
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
  const [form, setForm] = useState({ patientName: '', patientPhone: '', date: '', time: '09:00', notes: '' });
  const [booking, setBooking] = useState(false);
  // ── لوحة الطبيب: عرض مواعيده المحجوزة وتفاصيلها ──────────────────────────────
  const [scheduleModal, setScheduleModal] = useState(null);

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

  // ── الأوقات المحجوزة فعلياً لهذا الطبيب بهذا التاريخ (لمنع تعارض الحجز) ──────
  const takenTimesForDoctor = (doctorName, date) => new Set(
    (appointments || [])
      .filter(a => a && a.doctor === doctorName && a.date === date && a.status !== 'cancelled')
      .map(a => a.time)
  );

  // أول وقت فارغ بعد 09:00 بخطوات نصف ساعة، يتفادى الأوقات المحجوزة فعلياً
  const suggestFreeTime = (doctorName, date) => {
    const taken = takenTimesForDoctor(doctorName, date);
    for (let mins = 9 * 60; mins <= 15 * 60; mins += 30) {
      const h = String(Math.floor(mins / 60)).padStart(2, '0');
      const m = String(mins % 60).padStart(2, '0');
      const t = `${h}:${m}`;
      if (!taken.has(t)) return t;
    }
    return '09:00';
  };

  // ── تسجيل حضور المريض: يختفي فوراً من جدول مواعيد الطبيب بعد الحضور ─────────
  const [markingId, setMarkingId] = useState(null);
  const markArrived = async (appt) => {
    setMarkingId(appt.id);
    const changed = { ...appt, status: 'completed' };
    const ok = await syncToServer('appointments', 'update', changed);
    setMarkingId(null);
    if (!ok) { addToast(lang==='ar' ? 'تعذّر تسجيل الحضور' : 'Could not mark as arrived', 'error'); return; }
    setAppointments(p => (p || []).map(a => a.id === appt.id ? changed : a));
  };

  const handleBook = async () => {
    if (!form.patientName.trim()) { addToast(lang==='ar' ? 'أدخلي اسم المريض' : 'Enter patient name', 'error'); return; }
    if (!form.patientPhone.trim()) { addToast(lang==='ar' ? 'أدخلي رقم الهاتف' : 'Enter phone number', 'error'); return; }
    if (!form.date) { addToast(tr('x_akhtrtarikhalmwad'), 'error'); return; }

    const doctorName = bookModal.name;
    const taken = takenTimesForDoctor(doctorName, form.date);
    if (taken.has(form.time)) {
      addToast(lang==='ar' ? 'هذا الموعد محجوز فعلاً لهذا الطبيب — اختاري وقتاً آخر' : 'This slot is already booked for this doctor — pick another time', 'error');
      return;
    }

    // لو رقم الهاتف يطابق مريضاً مسجَّلاً فعلاً، نستخدم اسمه الرسمي المسجَّل
    // بدل النص المكتوب يدوياً — يقلّل تكرار الأسماء بصيغ مختلفة لنفس المريض
    const existingPatient = (patients || []).find(p => p && p.phone === form.patientPhone.trim());

    const payload = {
      patient: existingPatient ? existingPatient.name : form.patientName.trim(),
      patientPhone: form.patientPhone.trim(),
      doctor: bookModal.name,
      doctorEn: bookModal.nameEn || bookModal.name,
      department: lang==='ar' ? bookModal.specialization : (bookModal.specializationEn || bookModal.specialization),
      date: form.date,
      time: form.time,
      notes: form.notes,
    };

    setBooking(true);
    try {
      // ── مسار حجز مخصَّص يفحص التعارض على قاعدة البيانات الحقيقية مباشرة
      // (مو بس على النسخة المحلية المخزَّنة بالمتصفح) — يمسك حالة نادرة لكن
      // ممكنة: مريضين يحجزون نفس الوقت بنفس اللحظة تقريباً من جهازين مختلفين.
      const saved = await api.post('/booking/book-appointment', payload);
      setAppointments(p => [...(p || []), saved]);
      addToast(`${tr('svc_booking_success')} ${bookModal?.name} ✅`, 'success');
      setBookModal(null);
      setForm({ patientName: '', patientPhone: '', date: '', time: '09:00', notes: '' });
    } catch (err) {
      addToast(err?.message || (lang==='ar' ? 'تعذّر تسجيل الحجز، حاولي مرة ثانية' : 'Could not save the booking, try again'), 'error');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="page-content">
      {/* Hero */}
      <PageBanner icon="🏥" title={tr('svc_title')} subtitle={tr('svc_subtitle')} gradient={BANNER_GRADIENT}>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.12)', border:'2px solid rgba(255,255,255,0.25)', borderRadius:12, padding:'10px 16px', minWidth:280, backdropFilter:'blur(8px)' }}>
          <FaSearch style={{ color:'rgba(255,255,255,0.6)', flexShrink:0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('svc_search')}
            style={{ background:'none', border:'none', outline:'none', color:'#fff', fontFamily:'inherit', fontSize:15, flex:1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:16 }}>×</button>}
        </div>
      </PageBanner>

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
              <div key={doc.id} style={{ padding:20, borderRadius:12, border:'1.5px solid var(--border)', background:'var(--bg-card)', display:'flex', flexDirection:'column', alignItems:'center', transition:'all 0.2s' }}
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
                <div style={{ display:'flex', gap:8, width:'100%' }}>
                  <button className="btn btn-primary" style={{ flex:1, fontSize:13, padding:'8px' }} onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setForm({ patientName:'', patientPhone:'', date: today, time: suggestFreeTime(doc.name, today), notes:'' });
                    setBookModal(doc);
                  }}>
                    <FaCalendarAlt style={{ marginLeft:6 }} /> {tr('svc_book')}
                  </button>
                  <button className="btn btn-outline" style={{ fontSize:13, padding:'8px 10px' }} title={lang==='ar' ? 'عرض المواعيد المحجوزة' : 'View booked appointments'} onClick={() => setScheduleModal(doc)}>
                    📋
                  </button>
                </div>
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
              <div style={{ display:'flex', gap:12, padding:14, background:'var(--bg-card)', borderRadius:10, marginBottom:16, alignItems:'center' }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:bookModal.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 }}>{bookModal.avatar}</div>
                <div>
                  <div style={{ fontWeight:700 }}>{lang==="ar"?bookModal.name:bookModal.nameEn||bookModal.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{lang==="ar"?bookModal.specialization:bookModal.specializationEn||bookModal.specialization}</div>
                  <div style={{ fontSize:11, color:'#22c55e' }}>⏰ {bookModal.workHours}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label className="form-label">{lang==='ar' ? 'اسم المريض' : 'Patient Name'}</label><input className="form-control" value={form.patientName} onChange={e=>setForm(p=>({...p,patientName:e.target.value}))} placeholder={lang==='ar' ? 'الاسم الكامل' : 'Full name'} /></div>
                <div><label className="form-label">{lang==='ar' ? 'رقم الهاتف' : 'Phone Number'}</label><input className="form-control" value={form.patientPhone} onChange={e=>setForm(p=>({...p,patientPhone:e.target.value}))} placeholder="07xxxxxxxxx" /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label className="form-label">{tr('x_altarikh')}</label><input className="form-control" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value,time:suggestFreeTime(bookModal.name,e.target.value)}))} min={new Date().toISOString().split('T')[0]} /></div>
                <div><label className="form-label">{tr('field_time')}</label><input className="form-control" type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))} /></div>
              </div>
              {takenTimesForDoctor(bookModal.name, form.date).has(form.time) && (
                <p style={{ color:'#ef4444', fontSize:12, marginTop:8 }}>⚠️ {lang==='ar' ? 'هذا الموعد محجوز فعلاً — اختاري وقتاً آخر' : 'This slot is already booked — pick another time'}</p>
              )}
              <div style={{ marginTop:12 }}><label className="form-label">{tr('field_notes')}</label><textarea className="form-control" rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder={tr('auto_سبب_الزيارة')} /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setBookModal(null)} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer' }}>{tr('auto_إلغاء')}</button>
              <button className="btn btn-primary" onClick={handleBook} disabled={booking}><FaCalendarAlt /> {booking ? (lang==='ar'?'جارٍ الحجز...':'Booking...') : tr('svc_book_confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Schedule Modal — لوحة الطبيب: مواعيده المحجوزة وتفاصيلها */}
      {scheduleModal && (
        <div className="modal-overlay" onClick={() => setScheduleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display:'flex', alignItems:'center', gap:8 }}>
                📋 {lang==='ar' ? 'مواعيد' : 'Schedule —'} {lang==='ar' ? scheduleModal.name : (scheduleModal.nameEn||scheduleModal.name)}
              </h3>
              <button onClick={() => setScheduleModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 460, overflowY: 'auto' }}>
              {(() => {
                const docAppts = (appointments || [])
                  .filter(a => a && a.doctor === scheduleModal.name && a.status !== 'cancelled' && a.status !== 'completed')
                  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
                if (docAppts.length === 0) {
                  return <div style={{ textAlign:'center', padding:'30px 10px', color:'var(--text-secondary)' }}>
                    <div style={{ fontSize:36, marginBottom:8 }}>📅</div>
                    <p>{lang==='ar' ? 'لا توجد مواعيد محجوزة لهذا الطبيب' : 'No appointments booked for this doctor'}</p>
                  </div>;
                }
                return docAppts.map(a => (
                  <div key={a.id} style={{ border:'1px solid var(--border)', borderRadius:10, padding:12, marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <strong style={{ fontSize:14 }}>{a.patient}</strong>
                      <span style={{
                        fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20,
                        background: a.status==='confirmed' ? '#dcfce7' : a.status==='completed' ? '#dbeafe' : '#fef3c7',
                        color: a.status==='confirmed' ? '#166534' : a.status==='completed' ? '#1e40af' : '#92400e',
                      }}>
                        {a.status==='confirmed' ? (lang==='ar'?'مؤكد':'Confirmed') : a.status==='completed' ? (lang==='ar'?'مكتمل':'Completed') : (lang==='ar'?'انتظار':'Pending')}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', display:'flex', gap:14, flexWrap:'wrap' }}>
                      <span>📅 {a.date}</span>
                      <span>🕐 {a.time}</span>
                      {a.patientPhone && <span>📞 {a.patientPhone}</span>}
                    </div>
                    {a.notes && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>📝 {a.notes}</div>}
                    <button
                      onClick={() => markArrived(a)}
                      disabled={markingId === a.id}
                      style={{ marginTop:8, fontSize:12, fontWeight:600, padding:'6px 12px', borderRadius:8, border:'none', background:'#22c55e', color:'#fff', cursor:'pointer' }}
                    >
                      {markingId === a.id ? (lang==='ar'?'جارٍ...':'...') : `✓ ${lang==='ar' ? 'سجّل الحضور' : 'Mark Arrived'}`}
                    </button>
                  </div>
                ));
              })()}
            </div>
            <div className="modal-footer">
              <button onClick={() => setScheduleModal(null)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{lang==='ar' ? 'إغلاق' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
