import React from 'react';

/*
 * مكتبة عناصر HUD مصغَّرة قابلة لإعادة الاستخدام — تُبنى منها كل معاينات
 * صفحات الحلقة الهولوغرافية (HolographicPagePreview.js). كل عنصر يمثّل
 * شيئاً حقيقياً (موجة نبض، حلقة تقدّم، عقدة بيانات...) — لا خطوط زخرفية
 * عامة. SVG حيثما كان أنسب (مقاييس/موجات) لحدّة ووضوح بأحجام صغيرة جداً.
 */

// ── موجة نبض/تخطيط قلب مصغَّرة — تمثيل حقيقي، لا خط عشوائي. ─────────────────
export function HoloWaveform({ width = 64, height = 20, color = 'var(--dash-cyan-primary)', animated = true }) {
  const w = width, h = height, mid = h / 2;
  const d = `M0 ${mid} L${w * 0.14} ${mid} L${w * 0.22} ${mid - h * 0.32} L${w * 0.3} ${mid + h * 0.42} L${w * 0.38} ${mid - h * 0.9} L${w * 0.46} ${mid + h * 0.5} L${w * 0.54} ${mid} L${w * 0.72} ${mid} L${w * 0.8} ${mid - h * 0.28} L${w * 0.88} ${mid + h * 0.28} L${w} ${mid}`;
  return (
    <svg className={`holo-waveform ${animated ? 'holo-waveform-live' : ''}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <path d={d} stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── حلقة تقدّم دائرية (نسبة 0-100) — لا رقم مُخترَع، يُمرَّر من المستدعي. ────
export function HoloGauge({ percent, size = 34, color = 'var(--dash-cyan-primary)', label }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <div className="holo-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label !== undefined && <span className="holo-gauge-label">{label}</span>}
    </div>
  );
}

// ── حلقة حالة صغيرة (نشط/مستقر/تنبيه...) — نقطة + إطار ملوَّن. ──────────────
const STATUS_COLORS = {
  stable: '#4ade80', active: '#4ade80', ok: '#4ade80',
  review: 'var(--gold-accent, #d9b878)', pending: 'var(--gold-accent, #d9b878)', low: 'var(--gold-accent, #d9b878)',
  alert: '#f87171', urgent: '#f87171', out: '#f87171',
};
export function HoloStatusRing({ status = 'stable', size = 16 }) {
  const color = STATUS_COLORS[status] || 'var(--dash-cyan-primary)';
  return (
    <span className="holo-status-ring" style={{ width: size, height: size, borderColor: `${color}88` }}>
      <span className="holo-status-dot" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
    </span>
  );
}

// ── عقدة بيانات (صف مريض/موظف...) — صورة رمزية + نص + حالة. ─────────────────
export function HoloDataNode({ avatarBg, avatarText, title, sub, status }) {
  return (
    <div className="holo-node">
      <span className="holo-node-avatar" style={{ background: avatarBg || 'var(--dash-cyan-primary)' }}>{avatarText}</span>
      <span className="holo-node-text">
        <span className="holo-node-title">{title}</span>
        {sub && <span className="holo-node-sub">{sub}</span>}
      </span>
      {status && <HoloStatusRing status={status} size={12} />}
    </div>
  );
}

// ── جدول زمني أفقي مصغَّر (مواعيد) — خط + عقد بأوقات حقيقية. ─────────────────
export function HoloTimeline({ items = [] }) {
  return (
    <div className="holo-timeline">
      <span className="holo-timeline-rail" />
      {items.map((it, i) => (
        <div key={i} className="holo-timeline-node" style={{ insetInlineStart: `${(i + 0.5) * (100 / items.length)}%` }}>
          <span className="holo-timeline-dot" />
          <span className="holo-timeline-time">{it}</span>
        </div>
      ))}
    </div>
  );
}

// ── بطاقة ملف شخصي مصغَّرة (طبيب...) — صورة رمزية + اسم + تخصّص + حالة. ──────
export function HoloProfileNode({ avatarBg, avatarText, name, role, onDuty }) {
  return (
    <div className="holo-profile">
      <span className="holo-profile-avatar" style={{ background: avatarBg || 'var(--dash-cyan-primary)' }}>{avatarText}</span>
      <span className="holo-profile-name">{name}</span>
      <span className="holo-profile-role">{role}</span>
      <span className={`holo-profile-duty ${onDuty ? 'holo-profile-duty-on' : ''}`} />
    </div>
  );
}

// ── رسم بياني صغير (أعمدة أو مسار متجه) — يقرأ قيماً حقيقية فقط. ────────────
export function HoloMiniChart({ values = [], colors = [] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="holo-chart">
      {values.map((v, i) => (
        <span key={i} className="holo-chart-col">
          <span className="holo-chart-bar" style={{ height: `${Math.max(10, (v / max) * 100)}%`, background: colors[i] || 'var(--dash-cyan-primary)' }} />
        </span>
      ))}
    </div>
  );
}

export function HoloTrendLine({ values = [], width = 70, height = 26, color = 'var(--gold-accent, #d9b878)' }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - ((v - min) / span) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      <polyline points={pts} stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── خط اتصال رفيع بين عقدتين (شبكة الأقسام) — زخرفي بحت، pointer-events:none. ─
export function HoloConnector({ vertical }) {
  return <span className={`holo-connector ${vertical ? 'holo-connector-v' : ''}`} aria-hidden="true" />;
}

// ── شبكة مسح خافتة جداً — تُستخدَم كخلفية تقنية داخل لوحات محدَّدة فقط. ──────
export function HoloScanner() {
  return <span className="holo-scanner" aria-hidden="true" />;
}
