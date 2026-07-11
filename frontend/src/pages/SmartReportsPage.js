/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';

const monthlyData = [
  { monthAr: 'يناير', monthEn: 'Jan', patients: 420, appointments: 380, revenue: 15200 },
  { monthAr: 'فبراير', monthEn: 'Feb', patients: 380, appointments: 340, revenue: 13800 },
  { monthAr: 'مارس', monthEn: 'Mar', patients: 510, appointments: 470, revenue: 18400 },
  { monthAr: 'أبريل', monthEn: 'Apr', patients: 460, appointments: 420, revenue: 16600 },
  { monthAr: 'مايو', monthEn: 'May', patients: 540, appointments: 500, revenue: 19800 },
  { monthAr: 'يونيو', monthEn: 'Jun', patients: 495, appointments: 455, revenue: 17900 },
];

const deptStats = [
  { nameAr: 'الباطنية', nameEn: 'Internal Medicine', patients: 312, pct: 85 },
  { nameAr: 'الجراحة', nameEn: 'Surgery', patients: 220, pct: 60 },
  { nameAr: 'الأطفال', nameEn: 'Pediatrics', patients: 189, pct: 52 },
  { nameAr: 'النساء والولادة', nameEn: 'OB/GYN', patients: 165, pct: 45 },
  { nameAr: 'العيون', nameEn: 'Ophthalmology', patients: 142, pct: 39 },
  { nameAr: 'الطوارئ', nameEn: 'Emergency', patients: 290, pct: 79 },
];

const topDoctors = [
  { nameAr: 'د. أحمد الكريم', nameEn: 'Dr. Ahmed Al-Kareem', specialtyAr: 'باطنية', specialtyEn: 'Internal Medicine', patients: 128, rating: 4.9 },
  { nameAr: 'د. فاطمة الموسوي', nameEn: 'Dr. Fatima Al-Mousawi', specialtyAr: 'نساء وولادة', specialtyEn: 'OB/GYN', patients: 115, rating: 4.8 },
  { nameAr: 'د. حسين العبادي', nameEn: 'Dr. Hussein Al-Abadi', specialtyAr: 'أطفال', specialtyEn: 'Pediatrics', patients: 98, rating: 4.7 },
  { nameAr: 'د. نورا سعد', nameEn: 'Dr. Nora Saad', specialtyAr: 'جراحة', specialtyEn: 'Surgery', patients: 87, rating: 4.6 },
  { nameAr: 'د. ليلى الهاشمي', nameEn: 'Dr. Layla Al-Hashimi', specialtyAr: 'عيون', specialtyEn: 'Ophthalmology', patients: 76, rating: 4.8 },
];

const BarChart = ({ data, color, lang }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {data.map((d, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 80, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left', flexShrink: 0 }}>{lang === 'ar' ? d.nameAr : d.nameEn}</div>
        <div style={{ flex: 1, height: 24, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${d.pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease', display: 'flex', alignItems: 'center', paddingRight: 8 }}>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{d.patients}</span>
          </div>
        </div>
        <div style={{ width: 30, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{d.pct}%</div>
      </div>
    ))}
  </div>
);

export default function SmartReportsPage() {
  const { showToast, lang } = useApp();
  const tr = useT(lang);
  const [period, setPeriod] = useState('6months');

  const totals = monthlyData.reduce((acc, m) => ({
    patients: acc.patients + m.patients,
    appointments: acc.appointments + m.appointments,
    revenue: acc.revenue + m.revenue }), { patients: 0, appointments: 0, revenue: 0 });

  const maxPatients = Math.max(...monthlyData.map(m => m.patients));

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 36 }}>📊</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{tr('rep_title')}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 13 }}>{tr('rep_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
            <option value="month" style={{ background: '#312e81' }}>{tr('auto_pair_139')}</option>
            <option value="3months" style={{ background: '#312e81' }}>{tr('auto_pair_140')}</option>
            <option value="6months" style={{ background: '#312e81' }}>{tr('auto_pair_141')}</option>
            <option value="year" style={{ background: '#312e81' }}>{tr('auto_pair_142')}</option>
          </select>
          <button className="btn" onClick={() => showToast(tr('msg_exporting_report'), 'info')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
            📥 {tr('btn_export_pdf')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[
          { label: tr('rep_total_patients'), val: totals.patients.toLocaleString(lang==='ar'?'ar-IQ':'en-US'), change: '+12%', icon: '👥', color: '#1a6bab' },
          { label: tr('rep_total_apts'), val: totals.appointments.toLocaleString(lang==='ar'?'ar-IQ':'en-US'), change: '+8%', icon: '📅', color: '#8b5cf6' },
          { label: tr('rep_revenue_iqd'), val: (totals.revenue * 1000).toLocaleString(lang==='ar'?'ar-IQ':'en-US'), change: '+15%', icon: '💰', color: '#22c55e' },
          { label: tr('rep_satisfaction_rate'), val: '94%', change: '+2%', icon: '⭐', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, borderRadius: '50%', background: `${s.color}15` }} />
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>▲ {s.change} {tr('rep_change_this_month')}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Monthly chart */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 15 }}>{tr('auto_pair_143')}</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, justifyContent: 'space-around' }}>
            {monthlyData.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 11, color: '#1a6bab', fontWeight: 600 }}>{m.patients}</span>
                <div style={{ width: '100%', background: `rgba(26,107,171,0.2)`, borderRadius: 4, height: 120, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', background: '#1a6bab', borderRadius: 4, height: `${(m.patients / maxPatients) * 100}%`, transition: 'height 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{lang === 'ar' ? m.monthAr.slice(0, 3) : m.monthEn}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue chart */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 15 }}>{tr('auto_pair_144')}</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, justifyContent: 'space-around' }}>
            {monthlyData.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>{m.revenue / 1000}k</span>
                <div style={{ width: '100%', background: 'rgba(34,197,94,0.15)', borderRadius: 4, height: 120, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', background: '#22c55e', borderRadius: 4, height: `${(m.revenue / 20000) * 100}%`, transition: 'height 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{lang === 'ar' ? m.monthAr.slice(0, 3) : m.monthEn}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Dept stats */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 15 }}>{tr('auto_pair_145')}</h3>
          <BarChart data={deptStats} color="#1a6bab" lang={lang} />
        </div>

        {/* Top doctors */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>{tr('auto_pair_146')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topDoctors.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < topDoctors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a6bab', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                  #{i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{lang === 'ar' ? d.nameAr : d.nameEn}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lang === 'ar' ? d.specialtyAr : d.specialtyEn}</div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#1a6bab', fontSize: 13 }}>{d.patients} {tr('doc_patients')}</div>
                  <div style={{ fontSize: 12, color: '#f59e0b' }}>⭐ {d.rating}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
