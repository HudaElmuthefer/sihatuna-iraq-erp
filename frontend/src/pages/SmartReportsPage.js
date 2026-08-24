/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import DiagnosisStatsWidget from '../components/DiagnosisStatsWidget';
import PageBanner from '../components/PageBanner';
import PrintOptionsModal from '../components/PrintOptionsModal';

const BANNER_GRADIENT = 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)';

// ── إصلاح جذري: كانت كل الأرقام بهذي الصفحة وهمية ثابتة بالكود ──────────────
// قبل هذا، monthlyData وdeptStats وtopDoctors كانت مصفوفات ثابتة بأرقام
// مُختلَقة (مثل "420 مريض بيناير"، "د. أحمد الكريم 128 مريض وتقييم 4.9") —
// لا علاقة لها بالبيانات الفعلية بالنظام إطلاقاً، وما تتغيّر أبداً بغض النظر
// عن حالة المستشفى الحقيقية. الآن كل رقم محسوب مباشرة من patients/
// appointments/invoices الحقيقية بالسياق العام (AppContext).
//
// ملاحظة أمانة: حذفنا مؤشرين ما كان لهم أي مصدر بيانات حقيقي بالنظام أصلاً
// ("نسبة رضا المرضى 94%" و"تقييم الأطباء بالنجوم") — النظام لا يملك حالياً
// أي استبيان رضا مرضى أو نظام تقييم أطباء، فعرض رقم لهذا المؤشر كان اختلاقاً
// محضاً. لو أضفتِ نظام تقييم حقيقي مستقبلاً، يسهل إضافته هنا وقتها.

const BarChart = ({ data, color, lang }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {data.map((d, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 80, fontSize: 12, color: 'var(--text-secondary)', textAlign: lang==='ar'?'right':'left', flexShrink: 0 }}>{d.name}</div>
        <div style={{ flex: 1, height: 24, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${d.pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease', display: 'flex', alignItems: 'center', paddingRight: 8 }}>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{d.count}</span>
          </div>
        </div>
        <div style={{ width: 30, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{d.pct}%</div>
      </div>
    ))}
  </div>
);

// عدد الأشهر السابقة (بما فيها الحالي) حسب الفترة المختارة بالقائمة المنسدلة
const PERIOD_MONTHS = { month: 1, '3months': 3, '6months': 6, year: 12 };

export default function SmartReportsPage() {
  const { showToast, lang, patients, appointments, doctors, departments, invoices, setPrintOverlay } = useApp();
  const tr = useT(lang);
  const [period, setPeriod] = useState('6months');
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  const monthsBack = PERIOD_MONTHS[period] || 6;

  // ── الأشهر المشمولة بالفترة المختارة (الأحدث أولاً بالترتيب المعكوس بالعرض) ──
  const months = useMemo(() => {
    const arr = [];
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-US', { month: 'short' }) });
    }
    return arr;
  }, [monthsBack, lang]);

  const inMonth = (dateStr, y, m) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === y && d.getMonth() === m;
  };

  // مواعيد وإيرادات حقيقية مجمّعة بالشهر (من التواريخ الفعلية بالبيانات، وليست أرقاماً مختلَقة)
  const monthlyAppointments = useMemo(() => months.map(mo => ({
    ...mo,
    count: (appointments || []).filter(a => inMonth(a.date, mo.year, mo.month)).length,
  })), [months, appointments]);

  const monthlyRevenue = useMemo(() => months.map(mo => ({
    ...mo,
    total: (invoices || []).filter(inv => inv.status === 'paid' && inMonth(inv.paidAt, mo.year, mo.month))
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0),
  })), [months, invoices]);

  const periodStart = new Date(months[0]?.year || new Date().getFullYear(), months[0]?.month ?? 0, 1);
  const appointmentsInPeriod = (appointments || []).filter(a => a.date && new Date(a.date) >= periodStart);
  const revenueInPeriod = (invoices || []).filter(inv => inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) >= periodStart)
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  // نشاط كل قسم = عدد المواعيد المرتبطة فيه بالفترة المختارة (بيانات حقيقية من appointments.department)
  const deptActivity = useMemo(() => {
    const counts = {};
    appointmentsInPeriod.forEach(a => {
      const key = a.department || (lang === 'ar' ? 'غير محدَّد' : 'Unspecified');
      counts[key] = (counts[key] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [appointmentsInPeriod, lang]);

  // ترتيب الأطباء الأكثر نشاطاً = عدد المواعيد الفعلية المرتبطة باسمهم (بيانات حقيقية، بدون أي تقييم مُختلَق)
  const topDoctorsReal = useMemo(() => {
    const counts = {};
    appointmentsInPeriod.forEach(a => {
      const key = a.doctor || (lang === 'ar' ? 'غير محدَّد' : 'Unspecified');
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => {
        const docRecord = (doctors || []).find(d => d.name === name || d.nameEn === name);
        return {
          name: lang === 'ar' ? name : (docRecord?.nameEn || name),
          specialty: docRecord ? (lang === 'ar' ? docRecord.specialization : (docRecord.specializationEn || docRecord.specialization)) : '',
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [appointmentsInPeriod, doctors, lang]);

  const maxMonthlyAppointments = Math.max(1, ...monthlyAppointments.map(m => m.count));
  const maxMonthlyRevenue = Math.max(1, ...monthlyRevenue.map(m => m.total));

  const L = (ar, en) => lang === 'ar' ? ar : en;

  return (
    <div className="page-content">
      <PageBanner icon="📊" title={tr('rep_title')} subtitle={L('بيانات حقيقية مباشرة من النظام','Real-time data directly from the system')} gradient={BANNER_GRADIENT}>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
            <option value="month" style={{ background: '#312e81' }}>{tr('auto_pair_139')}</option>
            <option value="3months" style={{ background: '#312e81' }}>{tr('auto_pair_140')}</option>
            <option value="6months" style={{ background: '#312e81' }}>{tr('auto_pair_141')}</option>
            <option value="year" style={{ background: '#312e81' }}>{tr('auto_pair_142')}</option>
          </select>
          {/* ── إصلاح: زر التصدير كان يستدعي window.print() مباشرة بدون أي تحكّم
              بالرأس/التذييل/الشعار — الآن يفتح نفس لوحة خيارات الطباعة المستخدَمة
              بباقي الصفحات (PrintOptionsModal) قبل الطباعة الفعلية، بنفس منطق
              الأولوية الثلاثي (لكل طباعة > افتراضي عام > افتراضي مبرمَج). */}
          <button className="btn" onClick={() => setShowPrintOptions(true)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
            📥 {tr('btn_export_pdf')}
          </button>
        </div>
      </PageBanner>

      <PrintOptionsModal
        show={showPrintOptions}
        onClose={() => setShowPrintOptions(false)}
        onConfirm={(options) => { setShowPrintOptions(false); setPrintOverlay(options); }}
      />

      <DiagnosisStatsWidget lang={lang} />

      {/* KPI Cards — كلها أرقام حقيقية محسوبة من بيانات النظام الفعلية */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[
          { label: tr('rep_total_patients'), val: (patients || []).length.toLocaleString('en-US'), icon: '👥', color: '#1a6bab' },
          { label: L('مواعيد بالفترة المختارة','Appointments in period'), val: appointmentsInPeriod.length.toLocaleString('en-US'), icon: '📅', color: '#8b5cf6' },
          { label: tr('rep_revenue_iqd'), val: revenueInPeriod.toLocaleString('en-US'), icon: '💰', color: '#22c55e' },
          { label: L('عدد الأطباء المسجَّلين','Registered doctors'), val: (doctors || []).length.toLocaleString('en-US'), icon: '👨‍⚕️', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, borderRadius: '50%', background: `${s.color}15` }} />
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Monthly appointments chart (حقيقي — من تواريخ المواعيد الفعلية) */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 15 }}>{L('المواعيد شهرياً','Appointments per Month')}</h3>
          {monthlyAppointments.every(m => m.count === 0) ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '40px 0' }}>{L('لا توجد مواعيد مسجَّلة بهذه الفترة','No appointments recorded for this period')}</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, justifyContent: 'space-around' }}>
              {monthlyAppointments.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 11, color: '#1a6bab', fontWeight: 600 }}>{m.count}</span>
                  <div style={{ width: '100%', background: 'rgba(26,107,171,0.2)', borderRadius: 4, height: 120, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', background: '#1a6bab', borderRadius: 4, height: `${(m.count / maxMonthlyAppointments) * 100}%`, transition: 'height 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly revenue chart (حقيقي — من الفواتير المدفوعة فعلياً) */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 15 }}>{L('الإيرادات شهرياً (فواتير مدفوعة)','Revenue per Month (paid invoices)')}</h3>
          {monthlyRevenue.every(m => m.total === 0) ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '40px 0' }}>{L('لا توجد فواتير مدفوعة بهذه الفترة','No paid invoices for this period')}</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, justifyContent: 'space-around' }}>
              {monthlyRevenue.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>{m.total > 0 ? Math.round(m.total / 1000) + 'k' : '0'}</span>
                  <div style={{ width: '100%', background: 'rgba(34,197,94,0.15)', borderRadius: 4, height: 120, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', background: '#22c55e', borderRadius: 4, height: `${(m.total / maxMonthlyRevenue) * 100}%`, transition: 'height 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Dept activity (حقيقي — عدد المواعيد الفعلي لكل قسم) */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 15 }}>{L('نشاط الأقسام (عدد المواعيد)','Department Activity (appointments)')}</h3>
          {deptActivity.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0' }}>{L('لا توجد بيانات كافية بعد','Not enough data yet')}</p>
          ) : (
            <BarChart data={deptActivity} color="#1a6bab" lang={lang} />
          )}
        </div>

        {/* Top doctors (حقيقي — مرتَّبين حسب عدد المواعيد الفعلي، بدون أي تقييم مُختلَق) */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>{L('الأطباء الأكثر نشاطاً (حسب عدد المواعيد)','Most Active Doctors (by appointment count)')}</h3>
          {topDoctorsReal.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0' }}>{L('لا توجد مواعيد مسجَّلة بعد','No appointments recorded yet')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topDoctorsReal.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < topDoctorsReal.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a6bab', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                    {d.specialty && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.specialty}</div>}
                  </div>
                  <div style={{ textAlign: lang==='ar'?'right':'left' }}>
                    <div style={{ fontWeight: 600, color: '#1a6bab', fontSize: 13 }}>{d.count} {L('موعد','appts')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
