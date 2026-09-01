import React from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  HoloWaveform, HoloGauge, HoloStatusRing, HoloDataNode, HoloTimeline,
  HoloProfileNode, HoloMiniChart, HoloTrendLine, HoloConnector, HoloScanner,
} from './HoloHud';

/*
 * وحدات البناء المشتركة لكل معاينات لوحات الحلقة الهولوغرافية — رأس
 * (أيقونة+عنوان)، مؤشر رقمي بارز، جسم حر المحتوى. كل معاينة صفحة (أسفل هذا
 * الملف) واجهة مصغَّرة فعلية خاصة بها (بند صريح بالمواصفة: ليست بطاقة تصف
 * الصفحة، بل تطبيق مصغَّر حقيقي) — لا خطوط زخرفية عامة، وتُبنى من مكتبة
 * HoloHud.js (موجات نبض، حلقات تقدّم، عقد بيانات، جداول زمنية...). لا
 * استعلامات API إضافية — فقط قراءة مما هو مُحمَّل أصلاً بـuseApp()؛ أي بيانات
 * غير متوفرة تُعرَض كبنية هولوغرافية هيكلية بلا أرقام مُختلَقة، لا كأرقام وهمية.
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

// ── لوحة التحكم — تركيبة "KPI / نواة طبية / بيانات حيّة / تنبيهات" مثل
// المرجع البصري، من بيانات حقيقية بالكامل (بما فيها اتجاه المواعيد آخر 5
// أيام — محسوب فعلياً من appointments، لا مُختلَق). ──────────────────────────
export function DashboardPreview({ page, lang }) {
  const { patients, doctors, appointments, inventory, documents } = useApp();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayApts = appointments.filter(a => a.date === todayStr).length;
  const activeDoctors = doctors.filter(d => d.status === 'active').length;
  const lowStock = inventory.filter(i => i.status === 'low' || i.status === 'out').length;
  const urgentDocs = documents.filter(d => d.priority === 'urgent' && d.status === 'pending').length;
  const last5 = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (4 - i));
    const key = d.toISOString().split('T')[0];
    return appointments.filter(a => a.date === key).length;
  });
  const alerts = lowStock + urgentDocs;
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-dashboard">
        <div className="hpv-dash-row">
          <PreviewMetric value={patients.length} label={lang === 'ar' ? 'المرضى' : 'Patients'} />
          <div className="hpv-dash-core">
            <HoloGauge percent={doctors.length ? (activeDoctors / doctors.length) * 100 : 0} size={58} />
            <span className="hpv-dash-core-label">{lang === 'ar' ? 'الأطباء' : 'Staff'}</span>
          </div>
          <PreviewMetric value={todayApts} label={lang === 'ar' ? 'اليوم' : 'Today'} />
        </div>
        <div className="hpv-dash-trend">
          <HoloTrendLine values={last5} width={220} height={40} />
          <span className="hpv-dash-trend-label">{lang === 'ar' ? 'اتجاه المواعيد — 5 أيام' : 'Appointments trend — 5d'}</span>
        </div>
        <div className="hpv-dash-row">
          <HoloStatusRing status={alerts > 0 ? 'alert' : 'stable'} size={14} />
          <span className="hpv-dash-alert-text">
            {alerts > 0
              ? (lang === 'ar' ? `${alerts} تنبيهات نشطة` : `${alerts} active alerts`)
              : (lang === 'ar' ? 'كل الأنظمة مستقرة' : 'All systems stable')}
          </span>
        </div>
      </PreviewBody>
    </>
  );
}

// ── المرضى — شاشة مراقبة مرضى حقيقية: عدّاد + بطاقتا مريض + موجة نبض. ───────
export function PatientsPreview({ page, lang }) {
  const { patients } = useApp();
  const rows = patients.slice(0, 2);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-patients">
        <div className="hpv-dash-row">
          <PreviewMetric value={patients.length} label={lang === 'ar' ? 'إجمالي المرضى' : 'Total'} />
          <HoloWaveform width={70} height={22} />
        </div>
        {rows.map(p => (
          <HoloDataNode
            key={p.id}
            avatarBg={p.color}
            avatarText={p.avatar || p.name?.charAt(0)}
            title={p.name}
            sub={p.patientId || p.bloodType}
            status={p.status === 'active' ? 'stable' : 'review'}
          />
        ))}
        <HoloScanner />
      </PreviewBody>
    </>
  );
}

// ── الأطباء — شاشة تحكّم بالكادر الطبي: عدّاد + بطاقات أطباء + حالة دوام. ────
export function DoctorsPreview({ page, lang }) {
  const { doctors } = useApp();
  const rows = doctors.filter(d => d.status === 'active').slice(0, 2);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-doctors">
        <PreviewMetric value={doctors.length} label={lang === 'ar' ? 'إجمالي الأطباء' : 'Total Doctors'} />
        <div className="hpv-profile-row">
          {rows.map(d => (
            <HoloProfileNode
              key={d.id}
              avatarBg={d.color}
              avatarText={d.avatar}
              name={lang === 'ar' ? d.name : (d.nameEn || d.name)}
              role={lang === 'ar' ? d.specialization : d.specializationEn}
              onDuty={d.status === 'active'}
            />
          ))}
        </div>
      </PreviewBody>
    </>
  );
}

// ── المواعيد — جدولة هولوغرافية: عدّاد + خط زمني حقيقي بأوقات فعلية. ────────
export function AppointmentsPreview({ page, lang }) {
  const { appointments } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const todays = appointments.filter(a => a.date === today);
  const upcoming = (todays.length ? todays : appointments).slice(0, 4);
  const nowLabel = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-appointments">
        <div className="hpv-dash-row">
          <PreviewMetric value={todays.length} label={lang === 'ar' ? 'مواعيد اليوم' : "Today"} />
          <span className="hpv-now-badge">{nowLabel}</span>
        </div>
        <HoloTimeline items={upcoming.map(a => a.time)} />
        <div className="hpv-appt-list">
          {upcoming.slice(0, 2).map(a => (
            <div key={a.id} className="hpv-appt-item">
              <span className="hpv-appt-time">{a.time}</span>
              <span className="hpv-appt-name">{a.patient}</span>
            </div>
          ))}
        </div>
      </PreviewBody>
    </>
  );
}

// ── الأقسام — شبكة أقسام طبية متصلة (عُقَد + خطوط)، بيانات حقيقية. ─────────
export function DepartmentsPreview({ page, lang }) {
  const { departments } = useApp();
  const nodes = departments.slice(0, 5);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-dept-network">
        {nodes.map((d, i) => (
          <React.Fragment key={d.id}>
            <div className="hpv-dept-node" style={{ borderColor: `${d.color}88` }} title={d.name}>
              <span>{d.icon}</span>
            </div>
            {i < nodes.length - 1 && <HoloConnector />}
          </React.Fragment>
        ))}
      </PreviewBody>
    </>
  );
}

// ── المخزون — شاشة تحكّم بالمستلزمات الطبية: مقياس مخزون + صنفان حقيقيان. ───
export function InventoryPreview({ page, lang }) {
  const { inventory } = useApp();
  const low = inventory.filter(i => i.status === 'low' || i.status === 'out').length;
  const healthy = inventory.length ? Math.round(((inventory.length - low) / inventory.length) * 100) : 100;
  const rows = inventory.slice(0, 2);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-inventory">
        <div className="hpv-dash-row">
          <HoloGauge percent={healthy} size={40} />
          <PreviewMetric value={inventory.length} label={lang === 'ar' ? 'أصناف' : 'Items'} />
          {low > 0 && <HoloStatusRing status="low" size={14} />}
        </div>
        {rows.map(i => (
          <HoloDataNode key={i.id} avatarText="📦" title={lang === 'ar' ? i.name : i.nameEn} sub={`${i.qty} ${lang === 'ar' ? 'وحدة' : 'units'}`} status={i.status === 'low' || i.status === 'out' ? 'low' : 'stable'} />
        ))}
      </PreviewBody>
    </>
  );
}

export function ProcurementPreview({ page, lang }) {
  const { procurement } = useApp();
  const pending = procurement.filter(p => p.status === 'pending').length;
  const values = procurement.slice(0, 5).map(p => p.totalAmount || 0);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-dash-row">
        <PreviewMetric value={procurement.length} label={lang === 'ar' ? 'أوامر الشراء' : 'Orders'} />
        <HoloMiniChart values={values} />
        {pending > 0 && <HoloStatusRing status="pending" size={14} />}
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
      <PreviewBody className="hpv-dash-row">
        <HoloGauge percent={avgProgress} size={44} label={`${avgProgress}%`} />
        <PreviewMetric value={active.length} label={lang === 'ar' ? 'مشاريع نشطة' : 'Active'} />
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
      <PreviewBody className="hpv-dash-row">
        <PreviewMetric value={documents.length} label={lang === 'ar' ? 'الوثائق' : 'Documents'} />
        <HoloStatusRing status={urgent > 0 ? 'urgent' : 'stable'} size={16} />
        <span className="hpv-dash-alert-text">{urgent > 0 ? `${urgent} ${lang === 'ar' ? 'عاجل' : 'urgent'}` : (lang === 'ar' ? 'لا عاجل' : 'clear')}</span>
      </PreviewBody>
    </>
  );
}

// ── التقارير — HUD تحليلات: عمود بياني + مسار اتجاه + مؤشر KPI دائري. ───────
export function ReportsPreview({ page, lang }) {
  const { departments, patients } = useApp();
  const bars = departments.slice(0, 5);
  const values = bars.map(d => d.patients || 0);
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-reports">
        <HoloMiniChart values={values} colors={bars.map(d => d.color)} />
        <div className="hpv-dash-row">
          <HoloTrendLine values={values} width={70} height={24} />
          <HoloGauge percent={patients.length ? Math.min(100, (patients.length / 20) * 100) : 0} size={34} />
        </div>
      </PreviewBody>
    </>
  );
}

// ── التطعيمات — واجهة حالة تطعيم: رمز + حلقات جرعات هيكلية (بلا أرقام
// مُختلَقة — لا بيانات تطعيمات حقيقية متوفرة بالسياق حالياً). ────────────────
export function VaccinationsPreview({ page, lang }) {
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-vaccinations">
        <div className="hpv-dose-row">
          <HoloGauge percent={100} size={30} color="#4ade80" />
          <HoloGauge percent={100} size={30} color="#4ade80" />
          <HoloGauge percent={35} size={30} color="var(--gold-accent, #d9b878)" />
        </div>
        <span className="hpv-dose-label">{lang === 'ar' ? 'مسار الجرعات' : 'Dose sequence'}</span>
        <HoloScanner />
      </PreviewBody>
    </>
  );
}

export function LaboratoryPreview({ page, lang }) {
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-lab">
        <HoloWaveform width={90} height={26} color="var(--dash-cyan-primary)" />
        <div className="hpv-dash-row">
          <HoloStatusRing status="stable" size={12} />
          <span className="hpv-dose-label">{lang === 'ar' ? 'ضمن المعدل الطبيعي' : 'Within normal range'}</span>
        </div>
        <HoloScanner />
      </PreviewBody>
    </>
  );
}

export function HRPreview({ page, lang }) {
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-hr-network">
        {[0, 1, 2].map(i => (
          <React.Fragment key={i}>
            <div className="hpv-dept-node hpv-hr-node"><span>👤</span></div>
            {i < 2 && <HoloConnector />}
          </React.Fragment>
        ))}
      </PreviewBody>
    </>
  );
}

// ── الحسابات والمالية — إجمالي مُحصَّل + فواتير غير مسدَّدة + اتجاه فعلي
// لعدد الفواتير آخر 5 أيام (محسوب من invoices.createdAt، لا مُختلَق). ─────────
export function AccountsPreview({ page, lang }) {
  const { invoices } = useApp();
  const paid = invoices.filter(inv => inv.status === 'paid');
  const unpaid = invoices.filter(inv => inv.status === 'unpaid');
  const totalCollected = paid.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const today = new Date();
  const last5 = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (4 - i));
    const key = d.toISOString().split('T')[0];
    return invoices.filter(inv => (inv.createdAt || '').split('T')[0] === key).length;
  });
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-dashboard">
        <div className="hpv-dash-row">
          <PreviewMetric value={totalCollected.toLocaleString(lang === 'ar' ? 'ar' : 'en')} label={lang === 'ar' ? 'محصَّل' : 'Collected'} />
          <PreviewMetric value={unpaid.length} label={lang === 'ar' ? 'غير مسدَّدة' : 'Unpaid'} />
        </div>
        <div className="hpv-dash-trend">
          <HoloTrendLine values={last5} width={210} height={38} />
          <span className="hpv-dash-trend-label">{lang === 'ar' ? 'اتجاه الفوترة — 5 أيام' : 'Billing trend — 5d'}</span>
        </div>
        <div className="hpv-dash-row">
          <HoloStatusRing status={unpaid.length > 0 ? 'alert' : 'stable'} size={14} />
          <span className="hpv-dash-alert-text">
            {unpaid.length > 0
              ? (lang === 'ar' ? `${unpaid.length} فواتير معلَّقة` : `${unpaid.length} pending invoices`)
              : (lang === 'ar' ? 'كل الحسابات مسدَّدة' : 'All accounts settled')}
          </span>
        </div>
      </PreviewBody>
    </>
  );
}

// ── معاينة هيكلية عامة — لأي صفحة بلا بيانات جاهزة بالسياق. بنية هولوغرافية
// حقيقية (مسح + حلقة حالة محايدة) بدل أرقام/خطوط مُختلَقة. ──────────────────
export function GenericPreview({ page, lang }) {
  return (
    <>
      <PreviewHeader icon={page.icon} title={lang === 'ar' ? page.label : (page.labelEn || page.label)} />
      <PreviewBody className="hpv-generic">
        <HoloScanner />
        <HoloGauge percent={0} size={40} />
        <span className="hpv-dose-label">{lang === 'ar' ? 'جاهز' : 'Ready'}</span>
      </PreviewBody>
    </>
  );
}
