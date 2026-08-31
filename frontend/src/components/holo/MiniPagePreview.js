import React from 'react';
import { useApp } from '../../contexts/AppContext';

/*
 * معاينة مصغَّرة خفيفة لكل صفحة داخل لوحة الحلقة الهولوغرافية — تقرأ فقط من
 * البيانات المُحمَّلة أصلاً بالسياق (useApp) دون أي طلب API إضافي، ودون
 * تركيب مكوّن الصفحة الحقيقي بالكامل (بند صريح بالمواصفة). أي صفحة ليس لها
 * ملخّص جاهز هنا تحصل على معاينة عامة أنيقة (أيقونة + شرائط زخرفية) بدل
 * بيانات وهمية.
 */
export default function MiniPagePreview({ page, lang }) {
  const { patients, doctors, appointments, departments, inventory, procurement, projects, documents } = useApp();

  switch (page.key) {
    case 'patients': {
      const rows = patients.slice(0, 3);
      return (
        <div className="mpp mpp-rows">
          <div className="mpp-count">{patients.length}</div>
          {rows.map(p => (
            <div key={p.id} className="mpp-row">
              <span className="mpp-dot" style={{ background: p.color || 'var(--dash-cyan-primary)' }} />
              <span className="mpp-row-text">{lang === 'ar' ? p.name : p.name}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'doctors': {
      const rows = doctors.filter(d => d.status === 'active').slice(0, 3);
      return (
        <div className="mpp mpp-rows">
          <div className="mpp-count">{doctors.length}</div>
          {rows.map(d => (
            <div key={d.id} className="mpp-row">
              <span className="mpp-avatar" style={{ background: d.color }}>{d.avatar}</span>
              <span className="mpp-row-text">{lang === 'ar' ? d.name : (d.nameEn || d.name)}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'appointments': {
      const today = new Date().toISOString().split('T')[0];
      const rows = appointments.filter(a => a.date === today).slice(0, 3);
      return (
        <div className="mpp mpp-timeline">
          <div className="mpp-count">{rows.length}</div>
          {(rows.length ? rows : appointments.slice(0, 3)).map(a => (
            <div key={a.id} className="mpp-tl-item">
              <span className="mpp-tl-time">{a.time}</span>
              <span className="mpp-tl-bar" />
            </div>
          ))}
        </div>
      );
    }
    case 'departments': {
      return (
        <div className="mpp mpp-grid">
          {departments.slice(0, 4).map(d => (
            <div key={d.id} className="mpp-chip" style={{ borderColor: `${d.color}55` }}>{d.icon}</div>
          ))}
        </div>
      );
    }
    case 'inventory': {
      const low = inventory.filter(i => i.status === 'low' || i.status === 'out').length;
      return (
        <div className="mpp mpp-stat">
          <div className="mpp-stat-value">{inventory.length}</div>
          <div className="mpp-stat-sub" data-alert={low > 0}>{low} {lang === 'ar' ? 'منخفض' : 'low'}</div>
        </div>
      );
    }
    case 'procurement': {
      const pending = procurement.filter(p => p.status === 'pending').length;
      return (
        <div className="mpp mpp-stat">
          <div className="mpp-stat-value">{procurement.length}</div>
          <div className="mpp-stat-sub" data-alert={pending > 0}>{pending} {lang === 'ar' ? 'معلّق' : 'pending'}</div>
        </div>
      );
    }
    case 'projects': {
      const active = projects.filter(p => p.status === 'active');
      const avgProgress = active.length ? Math.round(active.reduce((s, p) => s + (p.progress || 0), 0) / active.length) : 0;
      return (
        <div className="mpp mpp-progress">
          <div className="mpp-count">{active.length}</div>
          <div className="mpp-progress-track"><div className="mpp-progress-fill" style={{ width: `${avgProgress}%` }} /></div>
        </div>
      );
    }
    case 'documents': {
      const urgent = documents.filter(d => d.priority === 'urgent' && d.status === 'pending').length;
      return (
        <div className="mpp mpp-stat">
          <div className="mpp-stat-value">{documents.length}</div>
          <div className="mpp-stat-sub" data-alert={urgent > 0}>{urgent} {lang === 'ar' ? 'عاجل' : 'urgent'}</div>
        </div>
      );
    }
    default:
      return (
        <div className="mpp mpp-generic">
          <span className="mpp-generic-icon">{page.icon}</span>
          <span className="mpp-generic-bar mpp-generic-bar-1" />
          <span className="mpp-generic-bar mpp-generic-bar-2" />
        </div>
      );
  }
}
