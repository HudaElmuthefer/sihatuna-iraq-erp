/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useT } from '../translations';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, DEFAULT_DASHBOARD_WIDGETS } from '../contexts/AppContext';
import HealthBanner from '../components/HealthBanner';
import AppLogo from '../components/AppLogo';

import {
  FaUsers, FaUserMd, FaCalendarAlt, FaBuilding,
  FaCheckCircle, FaClock, FaSearch, FaCog
} from 'react-icons/fa';

// ── لوحة التحكم القابلة للتخصيص (Stage 5) ──────────────────────────────────
// كل مفتاح هنا يقابل قسماً كاملاً بالصفحة (راجعي DEFAULT_DASHBOARD_WIDGETS
// بـ AppContext.js لنفس القائمة كمصدر الحقيقة الافتراضي). appointments/doctors
// مُعاملان كوحدة واحدة عند العرض (الشبكة الجانبية أسفل الصفحة) — ترتيبهما
// النسبي لبعض قابل للتغيير، لكنهما يبقيان بجانب بعض بدل توزيعهما بمكانين
// منفصلين، حتى يبقى التخصيص متوافقاً مع تخطيط الصفحة الحالي دون إعادة بناء
// كاملة له.
const WIDGET_KEYS = ['erp', 'stats', 'departments', 'appointments', 'doctors'];

// deptCards now from context departments

// إصلاح تباين الوضع الليلي: الألوان أدناه (أزرق/بنفسجي) كانت مضبوطة أصلاً على
// خلفية بيضاء فاتحة، وتهبط تحت 4.5:1 (WCAG AA) على --bg-card الغامقة بالوضع
// الليلي. الحل: نسخة أفتح لكل لون تُستخدم بالوضع الليلي فقط (الوضع النهاري
// يبقى بلا تغيير — يمرّ 4.5:1 أصلاً).
const STAT_COLOR_DARK_MODE = { '#1a6bab': '#4299e1', '#8b5cf6': '#a78bfa' };

function StatCard({ icon, value, label, color, bg, trend, theme }) {
  const effectiveColor = (theme === 'dark' && STAT_COLOR_DARK_MODE[color]) || color;
  return (
    <div className="stat-card" style={{ borderRight: `4px solid ${effectiveColor}` }}>
      <div className="stat-icon" style={{ background: bg, color: effectiveColor }}>
        {icon}
      </div>
      <div className="stat-info">
        <h3 style={{ color: effectiveColor }}>{value}</h3>
        <p>{label}</p>
        {trend && (
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginTop: 2, display: 'block' }}>
            ↑ {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function AppointmentRow({ apt, tr, lang, theme }) {
  // إصلاح تباين الوضع الليلي: نفس القصة — الألوان الغامقة (نص) مع خلفية
  // شفافة خفيفة (rgba بأوباسيتي منخفض) كانت مضبوطة لبطاقة بيضاء، فتفشل
  // 4.5:1 على --bg-card الغامقة. نسخة أفتح لكل حالة بالوضع الليلي فقط.
  const statusColors = theme === 'dark' ? {
    confirmed: { bg: 'rgba(72,187,120,0.16)', color: '#48bb78', label: tr('auto_pair_92') },
    pending: { bg: 'rgba(246,173,85,0.16)', color: '#ed8936', label: tr('auto_pair_93') },
    cancelled: { bg: 'rgba(229,62,62,0.16)', color: '#f56565', label: tr('auto_pair_94') },
    completed: { bg: 'rgba(66,153,225,0.16)', color: '#4299e1', label: tr('auto_pair_95') } } : {
    confirmed: { bg: 'rgba(72,187,120,0.12)', color: '#276749', label: tr('auto_pair_92') },
    pending: { bg: 'rgba(246,173,85,0.12)', color: '#c05621', label: tr('auto_pair_93') },
    cancelled: { bg: 'rgba(229,62,62,0.12)', color: '#c53030', label: tr('auto_pair_94') },
    completed: { bg: 'rgba(66,153,225,0.12)', color: '#2b6cb0', label: tr('auto_pair_95') } };
  const s = statusColors[apt.status] || statusColors.pending;
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{apt.patient}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lang==="ar"?apt.department:apt.departmentEn||apt.department}</div>
      </td>
      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lang==="ar"?apt.doctor:apt.doctorEn||apt.doctor}</td>
      <td>
        <div style={{ fontSize: 13 }}>{apt.date}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{apt.time}</div>
      </td>
      <td>
        <span className="badge" style={{ background: s.bg, color: s.color }}>
          {s.label}
        </span>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { lang, theme, doctors, patients, appointments, departments, inventory, procurement, projects, documents, dashboardLayout, saveDashboardLayout, resetDashboardLayout, showToast, confirmDialog } = useApp();
  const tr = useT(lang);
  const [searchQ, setSearchQ] = useState('');

  const filteredDoctors = doctors.filter(d =>
    (d.name || '').toLowerCase().includes(searchQ.toLowerCase()) ||
    (d.specialization || '').toLowerCase().includes(searchQ.toLowerCase())
  );

  const today = new Date().toISOString().split('T')[0];
  const todayApts = appointments.filter(a => a.date === today);
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
  const pendingCount = appointments.filter(a => a.status === 'pending').length;

  // ── تخصيص لوحة التحكم ────────────────────────────────────────────────────
  const [showCustomize, setShowCustomize] = useState(false);
  // مسودة الترتيب بالنافذة — تشمل الـ5 ودجت كلها دائماً (حتى المخفية منها
  // تظهر بالقائمة بعلامة غير محدَّدة)، حتى يقدر المستخدم يعيد إظهارها لاحقاً
  // بدل اختفائها نهائياً من واجهة التخصيص نفسها بمجرد إخفائها. draftVisible
  // (Set منفصل) يتتبّع أيّها محدَّد فعلياً بشكل مستقل عن الترتيب.
  const [draftLayout, setDraftLayout] = useState([]);
  const [draftVisible, setDraftVisible] = useState(new Set());
  const [savingLayout, setSavingLayout] = useState(false);

  const openCustomize = () => {
    const current = (dashboardLayout || DEFAULT_DASHBOARD_WIDGETS).filter(k => WIDGET_KEYS.includes(k));
    const withHidden = [...current, ...WIDGET_KEYS.filter(k => !current.includes(k))];
    setDraftLayout(withHidden);
    setDraftVisible(new Set(current));
    setShowCustomize(true);
  };

  const toggleDraftWidget = (key) => {
    setDraftVisible(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const moveDraftWidget = (index, dir) => {
    setDraftLayout(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveCustomization = async () => {
    setSavingLayout(true);
    // فقط الودجت المُفعَّلة (بترتيبها الحالي بالمسودة) تُحفَظ فعلياً
    const toSave = draftLayout.filter(k => draftVisible.has(k));
    const ok = await saveDashboardLayout(toSave);
    if (ok) { showToast(tr('dash_layout_saved'), 'success'); setShowCustomize(false); }
    setSavingLayout(false);
  };

  const resetCustomization = async () => {
    if (!(await confirmDialog(lang === 'ar' ? 'إعادة لوحة التحكم لوضعها الافتراضي؟' : 'Reset the dashboard to its default layout?'))) return;
    setSavingLayout(true);
    const ok = await resetDashboardLayout();
    if (ok) { showToast(tr('dash_layout_reset'), 'success'); setShowCustomize(false); }
    setSavingLayout(false);
  };

  // ── ترتيب العرض الفعلي المُطبَّق (خارج نافذة التخصيص) ────────────────────
  const visibleOrder = (dashboardLayout || DEFAULT_DASHBOARD_WIDGETS).filter(k => WIDGET_KEYS.includes(k));
  const showWidget = (key) => visibleOrder.includes(key);
  // appointments/doctors يُعامَلان كوحدة واحدة بالشبكة السفلية — نحسب أول ظهور
  // لأي منهما بالترتيب لتحديد مكان الوحدة كاملة بين باقي الودجت الكاملة العرض
  const renderBlocks = [];
  let bottomGridDone = false;
  visibleOrder.forEach(key => {
    if (key === 'appointments' || key === 'doctors') {
      if (bottomGridDone) return;
      bottomGridDone = true;
      renderBlocks.push({ type: 'bottom-grid', order: ['appointments', 'doctors'].filter(k => visibleOrder.includes(k)) });
    } else {
      renderBlocks.push({ type: key });
    }
  });

  const renderAppointmentsCard = () => (
    <div className="card" key="appointments-card">
      <div className="card-header">
        <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaCalendarAlt style={{ color: 'var(--primary)' }} />
          {tr('auto_pair_107')}
        </h2>
        <Link to="/appointments" className="btn btn-outline btn-sm">
          {tr('auto_pair_108')}
        </Link>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>{tr('auto_pair_109')}</th>
              <th>{tr('auto_pair_110')}</th>
              <th>{tr('auto_pair_111')}</th>
              <th>{tr('auto_pair_112')}</th>
            </tr>
          </thead>
          <tbody>
            {appointments.slice(0, 5).map(apt => (
              <AppointmentRow key={apt.id} apt={apt} tr={tr} lang={lang} theme={theme} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDoctorsCard = () => (
    <div className="card" key="doctors-card">
      <div className="card-header">
        <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaUserMd style={{ color: 'var(--primary)' }} />
          {tr('auto_pair_113')}
        </h2>
        <Link to="/doctors" className="btn btn-outline btn-sm">
          {tr('auto_pair_114')}
        </Link>
      </div>
      <div className="card-body">
        {(searchQ ? filteredDoctors : doctors.filter(d => d.status === 'active')).slice(0, 5).map(doc => (
          <div key={doc.id} className="doctor-row">
            <div className="avatar" style={{ background: doc.color, color: 'white', fontSize: 16, width: 44, height: 44 }}>
              {doc.avatar}
            </div>
            <div className="doctor-info">
              <div className="doctor-name">{lang==="ar"?doc.name:doc.nameEn||doc.name}</div>
              <div className="doctor-spec">{lang === 'ar' ? doc.specialization : doc.spec}</div>
            </div>
            <div className="doctor-meta">
              <div className="doctor-rating">⭐ {doc.rating}</div>
              <div className="doctor-patients">{doc.patients} {tr('auto_pair_115')}</div>
            </div>
          </div>
        ))}
        {searchQ && filteredDoctors.length === 0 && (
          <div className="empty-state" style={{ padding: 30 }}>
            <p>{tr('auto_pair_116')}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* ─── HEALTH BRANDING BANNER ─────────────────────────── */}
      <HealthBanner hero />

      {/* ─── CUSTOMIZE DASHBOARD BUTTON ─────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={openCustomize} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FaCog /> {tr('dash_customize_btn')}
        </button>
      </div>

      {/* ─── ERP INDICATORS ─────────────────────────────────── */}
      {showWidget('erp') && (
        <ERPDashboardBanner inventory={inventory} procurement={procurement} projects={projects} documents={documents} patients={patients} appointments={appointments} lang={lang} theme={theme} />
      )}
      {/* ─── HERO BANNER ───────────────────────────────────── */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-badge">🏥 {tr('auto_pair_96')}</div>
          <h1 className="hero-title">
            {tr('auto_pair_97')}
          </h1>
          <p className="hero-sub">
            {lang === 'ar'
              ? tr('dash_welcome_sub')
              : 'Access healthcare services easily and quickly.'
            }
          </p>
          <div className="hero-search">
            <FaSearch className="hs-icon" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={tr('auto_pair_98')}
            />
          </div>
        </div>
        {/* ── الشعار بالترويسة الرئيسية للوحة التحكم فقط (استثناء مقصود) ──────
            كل الصفحات الثانية تعرض الشعار بجانب الشريط الرمادي الرفيع فقط
            (راجعي HealthBanner.js وPageBanner.js) — هذي البانر الوحيدة اللي
            يظهر فيها الشعار بحجم كبير وبارز، لأنها "واجهة" النظام الرئيسية. */}
        <div className="hero-illustration">
          <div className="hero-circle hero-circle-1" />
          <div className="hero-circle hero-circle-2" />
          <div className="hero-logo-wrap">
            <AppLogo size={100} radius={20} fontSize={52} />
          </div>
        </div>
      </div>

      {/* ─── CUSTOMIZABLE WIDGET BLOCKS (order + visibility per user) ───── */}
      {renderBlocks.map((b) => {
        if (b.type === 'stats') {
          return (
            <div className="stats-grid" key="stats">
              <StatCard icon={<FaUsers />} value={patients.length.toLocaleString()} label={tr('auto_pair_99')} color="#1a6bab" bg="rgba(26,107,171,0.1)" trend={tr('auto_pair_100')} theme={theme} />
              <StatCard icon={<FaUserMd />} value={doctors.filter(d => d.status === 'active').length} label={tr('auto_pair_101')} color="#10b981" bg="rgba(16,185,129,0.1)" theme={theme} />
              <StatCard icon={<FaCalendarAlt />} value={todayApts.length} label={tr('dash_todays_apts')} color="#8b5cf6" bg="rgba(139,92,246,0.1)" theme={theme} />
              <StatCard icon={<FaCheckCircle />} value={confirmedCount} label={tr('auto_pair_102')} color="#10b981" bg="rgba(16,185,129,0.1)" theme={theme} />
              <StatCard icon={<FaClock />} value={pendingCount} label={tr('auto_pair_103')} color="#f59e0b" bg="rgba(245,158,11,0.1)" theme={theme} />
              <StatCard icon={<FaBuilding />} value="6" label={tr('auto_pair_104')} color="#06b6d4" bg="rgba(6,182,212,0.1)" theme={theme} />
            </div>
          );
        }
        if (b.type === 'departments') {
          return (
            <div className="card" style={{ marginBottom: 28 }} key="departments">
              <div className="card-header">
                <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaBuilding style={{ color: 'var(--primary)' }} />
                  {tr('auto_pair_105')}
                </h2>
                <Link to="/departments" className="btn btn-outline btn-sm">
                  {tr('auto_pair_106')}
                </Link>
              </div>
              <div className="card-body">
                <div className="dept-grid">
                  {departments.map((d) => (
                    <button key={d.id} onClick={() => {
                      sessionStorage.setItem('services_deptId', d.id);
                      navigate('/services');
                    }} className="dept-card" style={{ '--dept-color': d.color, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                      <div className="dept-card-icon">{d.icon}</div>
                      <span className="dept-card-label">{d.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        if (b.type === 'bottom-grid') {
          // كلا الودجت ظاهرَين: شبكة عمودَين كالمعتاد، بترتيب b.order.
          // ودجت واحد بس ظاهر: يُعرَض بعرض كامل بدل عمود فارغ بجانبه.
          if (b.order.length === 2) {
            return (
              <div className="dashboard-bottom" key="bottom-grid">
                {b.order[0] === 'appointments' ? renderAppointmentsCard() : renderDoctorsCard()}
                {b.order[1] === 'appointments' ? renderAppointmentsCard() : renderDoctorsCard()}
              </div>
            );
          }
          return <div key="bottom-grid">{b.order[0] === 'appointments' ? renderAppointmentsCard() : renderDoctorsCard()}</div>;
        }
        return null;
      })}

      {/* ─── CUSTOMIZE DASHBOARD MODAL ──────────────────────── */}
      {showCustomize && (
        <div className="modal-overlay" onClick={() => setShowCustomize(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}><FaCog /> {tr('dash_customize_title')}</h3>
              <button onClick={() => setShowCustomize(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {tr('dash_customize_desc')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftLayout.map((key, i) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={draftVisible.has(key)} onChange={() => toggleDraftWidget(key)} />
                    <span style={{ flex: 1, fontSize: 13, opacity: draftVisible.has(key) ? 1 : 0.5 }}>{tr(`dash_widget_${key}`)}</span>
                    <button type="button" onClick={() => moveDraftWidget(i, -1)} disabled={i === 0} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.4 : 1, width: 26, height: 26 }}>↑</button>
                    <button type="button" onClick={() => moveDraftWidget(i, 1)} disabled={i === draftLayout.length - 1} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: i === draftLayout.length - 1 ? 'not-allowed' : 'pointer', opacity: i === draftLayout.length - 1 ? 0.4 : 1, width: 26, height: 26 }}>↓</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-outline" onClick={resetCustomization} disabled={savingLayout} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                {tr('dash_reset_default')}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setShowCustomize(false)} disabled={savingLayout}>{tr('btn_cancel')}</button>
                <button className="btn btn-primary" onClick={saveCustomization} disabled={savingLayout}>{tr('btn_save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Hero ── */
        .hero-banner {
          background: linear-gradient(135deg, #0f2340 0%, #1a6bab 60%, #0d4a7a 100%);
          border-radius: var(--radius-lg);
          padding: 36px 40px;
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
          min-height: 220px;
        }

        .hero-content { position: relative; z-index: 2; flex: 1; }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          background: rgba(255,255,255,0.15);
          border-radius: 20px;
          color: rgba(255,255,255,0.9);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 14px;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .hero-title {
          font-size: 26px;
          font-weight: 900;
          color: white;
          margin-bottom: 10px;
          line-height: 1.2;
        }

        .hero-sub {
          color: rgba(255,255,255,0.8);
          font-size: 14px;
          margin-bottom: 20px;
        }

        .hero-search {
          position: relative;
          max-width: 380px;
        }

        .hs-icon {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.5);
          font-size: 16px;
        }

        .hero-search input {
          width: 100%;
          padding: 13px 44px 13px 20px;
          border-radius: 12px;
          border: 2px solid rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.12);
          color: white;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          backdrop-filter: blur(10px);
          transition: var(--transition);
        }

        .hero-search input::placeholder { color: rgba(255,255,255,0.55); }
        .hero-search input:focus {
          border-color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.18);
        }

        .hero-illustration {
          position: relative;
          width: 160px;
          height: 160px;
          flex-shrink: 0;
        }

        .hero-circle {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.12);
        }

        .hero-circle-1 { width: 140px; height: 140px; top: 10px; right: 10px; }
        .hero-circle-2 { width: 100px; height: 100px; top: 30px; right: 30px; }

        .hero-logo-wrap {
          position: absolute;
          top: 50%;
          right: 50%;
          transform: translate(50%, -50%);
          filter: drop-shadow(0 4px 14px rgba(0,0,0,0.25));
        }

        /* ── Department Cards ── */
        .dept-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
        }

        .dept-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px 10px;
          border-radius: var(--radius);
          background: var(--bg-primary);
          border: 2px solid transparent;
          cursor: pointer;
          text-decoration: none;
          transition: var(--transition);
          text-align: center;
        }

        .dept-card:hover {
          border-color: var(--dept-color, var(--primary));
          background: color-mix(in srgb, var(--dept-color, var(--primary)) 8%, transparent);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }

        .dept-card-icon {
          font-size: 36px;
          line-height: 1;
        }

        .dept-card-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          line-height: 1.3;
        }

        /* ── Dashboard Bottom Grid ── */
        .dashboard-bottom {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 20px;
        }

        /* ── Doctor Row ── */
        .doctor-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .doctor-row:last-child { border-bottom: none; }

        .doctor-info { flex: 1; }

        .doctor-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .doctor-spec {
          font-size: 12px;
          color: var(--text-muted);
        }

        .doctor-meta {
          text-align: center;
        }

        .doctor-rating {
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
        }

        .doctor-patients {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* ── Responsive ── */
        @media (max-width: 1200px) {
          .dept-grid { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 900px) {
          .dashboard-bottom { grid-template-columns: 1fr; }
          .hero-illustration { display: none; }
          .hero-banner { padding: 28px 24px; }
          .hero-title { font-size: 20px; }
        }

        @media (max-width: 600px) {
          .dept-grid { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 400px) {
          .dept-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

// ── ERP Dashboard Overlay ──────────────────────────────────────────────────────
// Exported as a named component to be used as a wrapper
export function ERPDashboardBanner({ inventory, procurement, projects, documents, patients, appointments, lang, theme }) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const lowStock = (inventory || []).filter(i => i.status === 'low' || i.status === 'out').length;
  const pendingPO = (procurement || []).filter(p => p.status === 'pending').length;
  const activeProjects = (projects || []).filter(p => p.status === 'active').length;
  const urgentDocs = (documents || []).filter(d => d.priority === 'urgent' && d.status === 'pending').length;
  const n = v => Number(v).toLocaleString(lang==='ar'?'ar-IQ':'en-US');
  // إصلاح تباين الوضع الليلي: نفس مشكلة STAT_COLOR_DARK_MODE أعلاه — أزرق/أحمر
  // مضبوطان لخلفية بيضاء يهبطان تحت 4.5:1 على --bg-card الغامقة.
  const darkColor = c => (theme === 'dark' && ({ '#1a6bab': '#4299e1', '#ef4444': '#f87171' }[c])) || c;

  const erp = [
    { icon: '📦', label: lang === 'ar' ? 'مخزون منخفض' : 'Low Stock', value: lowStock, color: darkColor(lowStock > 0 ? '#ef4444' : '#10b981'), path: '/inventory' },
    { icon: '🛒', label: lang === 'ar' ? 'مشتريات معلقة' : 'Pending POs', value: pendingPO, color: darkColor(pendingPO > 0 ? '#f59e0b' : '#10b981'), path: '/procurement' },
    { icon: '📐', label: lang === 'ar' ? 'مشاريع نشطة' : 'Active Projects', value: activeProjects, color: darkColor('#1a6bab'), path: '/projects' },
    { icon: '📁', label: lang === 'ar' ? 'وثائق عاجلة' : 'Urgent Docs', value: urgentDocs, color: darkColor(urgentDocs > 0 ? '#ef4444' : '#10b981'), path: '/documents' },
  ];

  return (
    <div style={{ direction: dir, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {lang === 'ar' ? '— مؤشرات ERP —' : '— ERP Indicators —'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {erp.map(({ icon, label, value, color, path }) => (
          <a key={path} href={path} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${color}`, transition: 'box-shadow 0.2s' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
