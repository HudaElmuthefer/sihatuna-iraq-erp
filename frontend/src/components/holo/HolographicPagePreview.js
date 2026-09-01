import React from 'react';
import { useApp } from '../../contexts/AppContext';

/*
 * وحدات البناء المشتركة لكل معاينات لوحات الحلقة الهولوغرافية — رأس
 * (أيقونة+عنوان)، مؤشر رقمي واحد بارز، جسم حر المحتوى، وتذييل اختياري. كل
 * معاينة صفحة (أسفل هذا الملف) تُركِّب هذه القطع بدل تكرار نفس الترميز.
 * لا استعلامات API إضافية هنا إطلاقاً — فقط قراءة مما هو مُحمَّل أصلاً
 * بـuseApp()؛ أي صفحة بلا بيانات جاهزة تحصل على GenericPreview (بنية +
 * عنوان + عناصر زخرفية) بدل اختراع أرقام.
 */
export function PreviewHeader({ icon, title, accent }) {
  return (
    <div className="hpv-header">
      <span className="hpv-icon" style={accent ? { color: accent } : undefined}>{icon}</span>
      <span className="hpv-title">{title}</span>
    </div>
  );
}

export function PreviewMetric({ value, label }) {
  return (
    <div className="hpv-metric">
      <div className="hpv-metric-value">{value}</div>
      <div className="hpv-metric-label">{label}</div>
    </div>
  );
}

export function PreviewBody({ children, className = '' }) {
  return <div className={`hpv-body ${className}`}>{children}</div>;
}

export function PreviewFooter({ children }) {
  return <div className="hpv-footer">{children}</div>;
}

function Row({ dotColor, avatarBg, avatarText, text, sub }) {
  return (
    <div className="hpv-row">
      {avatarText !== undefined ? (
        <span className="hpv-row-avatar" style={{ background: avatarBg }}>{avatarText}</span>
      ) : (
        <span className="hpv-row-dot" style={{ background: dotColor }} />
      )}
      <span className="hpv-row-text">{text}</span>
      {sub && <span className="hpv-row-sub">{sub}</span>}
    </div>
  );
}

// ── لوحة التحكم — تندمج بيانات KPI الحقيقية داخل الشاشة المركزية نفسها،
// لا كأرقام عائمة منفصلة (بند صريح بالمواصفة). ─────────────────────────────
export function DashboardPreview({ page, lang }) {
  const { patients, doctors, appointments, documents } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const todayApts = appointments.filter(a => a.date === today).length;
  const activeDoctors = doctors.filter(d => d.status === 'active').length;
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-kpi-grid">
        <PreviewMetric value={patients.length} label={lang === 'ar' ? 'المرضى' : 'Patients'} />
        <PreviewMetric value={activeDoctors} label={lang === 'ar' ? 'أطباء نشطون' : 'Active Doctors'} />
        <PreviewMetric value={todayApts} label={lang === 'ar' ? 'مواعيد اليوم' : 'Today'} />
        <PreviewMetric value={documents.length} label={lang === 'ar' ? 'الوثائق' : 'Documents'} />
      </PreviewBody>
    </>
  );
}

export function PatientsPreview({ page, lang }) {
  const { patients } = useApp();
  const rows = patients.slice(0, 3);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody>
        <PreviewMetric value={patients.length} label={lang === 'ar' ? 'إجمالي المرضى' : 'Total Patients'} />
        {rows.map(p => (
          <Row key={p.id} dotColor={p.color || 'var(--dash-cyan-primary)'} text={p.name} sub={p.patientId} />
        ))}
      </PreviewBody>
    </>
  );
}

export function DoctorsPreview({ page, lang }) {
  const { doctors } = useApp();
  const rows = doctors.filter(d => d.status === 'active').slice(0, 3);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody>
        <PreviewMetric value={doctors.length} label={lang === 'ar' ? 'إجمالي الأطباء' : 'Total Doctors'} />
        {rows.map(d => (
          <Row key={d.id} avatarBg={d.color} avatarText={d.avatar} text={lang === 'ar' ? d.name : (d.nameEn || d.name)} sub={lang === 'ar' ? d.specialization : d.specializationEn} />
        ))}
      </PreviewBody>
    </>
  );
}

export function AppointmentsPreview({ page, lang }) {
  const { appointments } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const todays = appointments.filter(a => a.date === today);
  const upcoming = (todays.length ? todays : appointments).slice(0, 3);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody>
        <PreviewMetric value={todays.length} label={lang === 'ar' ? 'مواعيد اليوم' : "Today's Appointments"} />
        {upcoming.map(a => (
          <div key={a.id} className="hpv-tl-item">
            <span className="hpv-tl-time">{a.time}</span>
            <span className="hpv-tl-text">{lang === 'ar' ? a.patient : a.patient}</span>
          </div>
        ))}
      </PreviewBody>
    </>
  );
}

export function DepartmentsPreview({ page, lang }) {
  const { departments } = useApp();
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-chip-grid">
        {departments.slice(0, 6).map(d => (
          <div key={d.id} className="hpv-chip" style={{ borderColor: `${d.color}66` }} title={d.name}>
            <span>{d.icon}</span>
          </div>
        ))}
      </PreviewBody>
    </>
  );
}

export function InventoryPreview({ page, lang }) {
  const { inventory } = useApp();
  const low = inventory.filter(i => i.status === 'low' || i.status === 'out').length;
  const rows = inventory.slice(0, 2);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody>
        <PreviewMetric value={inventory.length} label={lang === 'ar' ? 'أصناف المخزون' : 'Inventory Items'} />
        {low > 0 && <div className="hpv-alert-badge">{low} {lang === 'ar' ? 'منخفض' : 'low stock'}</div>}
        {rows.map(i => <Row key={i.id} dotColor="var(--dash-cyan-primary)" text={lang === 'ar' ? i.name : i.nameEn} sub={i.qty} />)}
      </PreviewBody>
    </>
  );
}

export function ProcurementPreview({ page, lang }) {
  const { procurement } = useApp();
  const pending = procurement.filter(p => p.status === 'pending').length;
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody>
        <PreviewMetric value={procurement.length} label={lang === 'ar' ? 'أوامر الشراء' : 'Purchase Orders'} />
        {pending > 0 && <div className="hpv-alert-badge">{pending} {lang === 'ar' ? 'معلّق' : 'pending'}</div>}
      </PreviewBody>
    </>
  );
}

export function ProjectsPreview({ page, lang }) {
  const { projects } = useApp();
  const active = projects.filter(p => p.status === 'active');
  const avgProgress = active.length ? Math.round(active.reduce((s, p) => s + (p.progress || 0), 0) / active.length) : 0;
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody>
        <PreviewMetric value={active.length} label={lang === 'ar' ? 'مشاريع نشطة' : 'Active Projects'} />
        <div className="hpv-progress-track"><div className="hpv-progress-fill" style={{ width: `${avgProgress}%` }} /></div>
        <div className="hpv-progress-label">{avgProgress}%</div>
      </PreviewBody>
    </>
  );
}

export function DocumentsPreview({ page, lang }) {
  const { documents } = useApp();
  const urgent = documents.filter(d => d.priority === 'urgent' && d.status === 'pending').length;
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody>
        <PreviewMetric value={documents.length} label={lang === 'ar' ? 'الوثائق' : 'Documents'} />
        {urgent > 0 && <div className="hpv-alert-badge">{urgent} {lang === 'ar' ? 'عاجل' : 'urgent'}</div>}
      </PreviewBody>
    </>
  );
}

// تصوّر مصغّر حقيقي (لا وهمي) — توزيع عدد المرضى الفعلي عبر الأقسام
// الفعلية، كأعمدة صغيرة نسبية. لا أرقام مُخترَعة.
export function ReportsPreview({ page, lang }) {
  const { departments } = useApp();
  const bars = departments.slice(0, 5);
  const max = Math.max(1, ...bars.map(d => d.patients || 0));
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-chart">
        {bars.map(d => (
          <div key={d.id} className="hpv-chart-col" title={d.name}>
            <div className="hpv-chart-bar" style={{ height: `${Math.max(8, ((d.patients || 0) / max) * 100)}%`, background: d.color }} />
          </div>
        ))}
      </PreviewBody>
    </>
  );
}

export function GenericPreview({ page, lang }) {
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-generic">
        <span className="hpv-generic-bar hpv-generic-bar-1" />
        <span className="hpv-generic-bar hpv-generic-bar-2" />
        <span className="hpv-generic-bar hpv-generic-bar-3" />
      </PreviewBody>
    </>
  );
}
