// frontend/src/components/DateRangeFilter.js
//
// Reusable date-range filter: "from" / "to" date inputs plus quick-select
// presets (Today / This week / This month / Last 30 days). Bilingual (AR/EN),
// reuses the same form-control / btn-sm styling already used by the search
// box and status filter buttons on list pages (see AppointmentsPage.js,
// PatientsPage.js), so it drops into an existing filter bar without any new
// CSS and follows light/dark theme + RTL automatically via CSS variables.
import React from 'react';
import { FaCalendarAlt, FaTimes } from 'react-icons/fa';

const pad = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD. Deliberately not toISOString(), which
// converts to UTC first and can shift the date by a day near midnight in
// Iraq's UTC+3 timezone.
const toLocalISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function buildPresets() {
  const today = new Date();
  const todayStr = toLocalISODate(today);

  // Week starts Saturday (Iraq's Fri/Sat weekend convention).
  const weekStart = new Date(today);
  const daysSinceSaturday = (today.getDay() + 1) % 7; // Sat=6 -> 0, Sun=0 -> 1, ... Fri=5 -> 6
  weekStart.setDate(today.getDate() - daysSinceSaturday);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const last30Start = new Date(today);
  last30Start.setDate(today.getDate() - 29);

  return {
    today: { from: todayStr, to: todayStr },
    week: { from: toLocalISODate(weekStart), to: todayStr },
    month: { from: toLocalISODate(monthStart), to: todayStr },
    last30: { from: toLocalISODate(last30Start), to: todayStr },
  };
}

const presetBtnStyle = { background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', whiteSpace: 'nowrap' };

export default function DateRangeFilter({ lang = 'ar', from, to, onChange, label }) {
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const presets = buildPresets();
  const isActive = !!(from || to);

  const applyPreset = (key) => {
    const { from: f, to: t } = presets[key];
    onChange(f, t);
  };

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {label && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>}
      <FaCalendarAlt style={{ color: 'var(--text-muted)', fontSize: 16 }} />
      <input
        type="date"
        className="form-control"
        style={{ width: 150, padding: '9px 10px' }}
        value={from || ''}
        max={to || undefined}
        onChange={(e) => onChange(e.target.value, to)}
        aria-label={L('من تاريخ', 'From date')}
      />
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{L('إلى', 'to')}</span>
      <input
        type="date"
        className="form-control"
        style={{ width: 150, padding: '9px 10px' }}
        value={to || ''}
        min={from || undefined}
        onChange={(e) => onChange(from, e.target.value)}
        aria-label={L('إلى تاريخ', 'To date')}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm" onClick={() => applyPreset('today')} style={presetBtnStyle}>
          {L('اليوم', 'Today')}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => applyPreset('week')} style={presetBtnStyle}>
          {L('هذا الأسبوع', 'This week')}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => applyPreset('month')} style={presetBtnStyle}>
          {L('هذا الشهر', 'This month')}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => applyPreset('last30')} style={presetBtnStyle}>
          {L('آخر 30 يوم', 'Last 30 days')}
        </button>
        {isActive && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onChange('', '')}
            title={L('مسح فلتر التاريخ', 'Clear date filter')}
            style={{ ...presetBtnStyle, color: '#ef4444' }}
          >
            <FaTimes />
          </button>
        )}
      </div>
    </div>
  );
}
