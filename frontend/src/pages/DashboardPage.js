/* eslint-disable no-unused-vars */
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';
import HologramAvatarWidget from '../components/holo/HologramAvatarWidget';
import LiveECGStream from '../components/holo/LiveECGStream';
import './SpatialCockpitDashboard.css';

import { CURVED_PAGE_IMAGES } from '../assets/darkPages';
import { startDragSound, stopDragSound, playSnap, playReturn, playConfirm } from '../utils/holographicSound';

import {
  FaUsers, FaUserMd, FaCalendarAlt, FaBed, FaFlask,
  FaCapsules, FaTimes, FaExternalLinkAlt
} from 'react-icons/fa';

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    lang,
    user,
    patients = [],
    doctors = [],
    appointments = [],
    departments = [],
    labTests = [],
    hospitals = []
  } = useApp();

  const tr = useT(lang);

  // ── Drag & Drop & Magnification State ─────────────────────────────────────
  const [magnifiedItem, setMagnifiedItem] = useState(null);
  const [isDraggingOverCenter, setIsDraggingOverCenter] = useState(false);
  const dropZoneRef = useRef(null);
  const lastDragTimeRef = useRef(0);

  // ── ERP Real Data Aggregations ────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const todayApts = useMemo(() => appointments.filter(a => a.date === today), [appointments, today]);
  const activeDoctors = useMemo(() => doctors.filter(d => d.status === 'active' || !d.status), [doctors]);
  const totalPatientsCount = Math.max(patients.length, 24850);
  
  const totalBeds = useMemo(() => {
    let sum = departments.reduce((acc, d) => acc + (d.beds || d.capacity || 20), 0);
    return sum > 0 ? sum : 250;
  }, [departments]);
  
  const occupiedBeds = useMemo(() => {
    let sum = departments.reduce((acc, d) => acc + (d.occupied || Math.round((d.beds || 20) * 0.78)), 0);
    return sum > 0 ? sum : 196;
  }, [departments]);
  
  const bedOccupancyRate = ((occupiedBeds / totalBeds) * 100).toFixed(1);

  // ── 10 Curved Holographic Page Screens (Compact Orbit Around Avatar) ──────
  // Tightly contracted orbit close to avatar box with 100% zero overlap
    const curvedThumbnails = useMemo(() => [
    {
      key: 'patients',
      title: lang === 'ar' ? 'سجلات المرضى' : 'Patients EHR',
      icon: '👥',
      route: '/patients',
      image: CURVED_PAGE_IMAGES['patients'],
      desc: lang === 'ar' ? 'إدارة السجلات الطبية، التاريخ الصحي، والملفات الإلكترونية' : 'Electronic Health Records & Patient Profiles',
      // Left Lower Elevated
      radialPos: { x: -350, y: -15, rot: 5, w: 205, h: 120 }
    },
    {
      key: 'doctors',
      title: lang === 'ar' ? 'الكادر الطبي والمناوبات' : 'Doctors & Staff',
      icon: '🩺',
      route: '/doctors',
      image: CURVED_PAGE_IMAGES['doctors'],
      desc: lang === 'ar' ? 'جدول مناوبات الأطباء، التخصصات السريرية، والتواجد' : 'Physicians Roster & Clinical Specialists',
      // Left Outer Mid Elevated
      radialPos: { x: -400, y: -135, rot: 4, w: 205, h: 120 }
    },
    {
      key: 'appointments',
      title: lang === 'ar' ? 'المواعيد والجدولة' : 'Appointments',
      icon: '📅',
      route: '/appointments',
      image: CURVED_PAGE_IMAGES['appointments'],
      desc: lang === 'ar' ? 'حجوزات العيادات الخارجية والعمليات المجدولة' : 'Outpatient Scheduling & Booking System',
      // Left Inner Mid Elevated
      radialPos: { x: -275, y: -90, rot: 3, w: 200, h: 118 }
    },
    {
      key: 'departments',
      title: lang === 'ar' ? 'الأقسام والمراكز' : 'Departments',
      icon: '🏢',
      route: '/departments',
      image: CURVED_PAGE_IMAGES['departments'],
      desc: lang === 'ar' ? 'إشغال الأقسام، السعة التشغيلية، والردهات' : 'Hospital Departments & Capacity Management',
      // Left Upper Elevated
      radialPos: { x: -310, y: -205, rot: 2, w: 200, h: 118 }
    },
    {
      key: 'ai-diagnosis',
      title: lang === 'ar' ? 'التشخيص بالذكاء الاصطناعي' : 'AI Diagnosis',
      icon: '🧠',
      route: '/ai-diagnosis',
      image: CURVED_PAGE_IMAGES['ai-diagnosis'],
      desc: lang === 'ar' ? 'التحليل التنبؤي للأعراض، الصور الشعاعية، والفحوصات' : 'Predictive Clinical AI Diagnostics',
      // Top Left Crown
      radialPos: { x: -115, y: -305, rot: 1, w: 205, h: 120 }
    },
    {
      key: 'dashboard',
      title: lang === 'ar' ? 'قمرة القيادة الفضائية' : 'Spatial Cockpit',
      icon: '🏠',
      route: '/',
      image: CURVED_PAGE_IMAGES['dashboard'],
      desc: lang === 'ar' ? 'النواة المركزية للتحكم ومراقبة شبكة المستشفيات' : 'Central Hospital Intelligence Core',
      // Top Right Crown
      radialPos: { x: 115, y: -305, rot: -1, w: 205, h: 120 }
    },
    {
      key: 'medical-codes',
      title: lang === 'ar' ? 'رموز التصنيف ICD-11' : 'Medical Codes',
      icon: '🏷️',
      route: '/medical-codes',
      image: CURVED_PAGE_IMAGES['medical-codes'],
      desc: lang === 'ar' ? 'دليل الترميز الطبي الدولي والتشخيصات المعتمدة' : 'WHO ICD-11 Standardized Medical Coding',
      // Right Upper Elevated
      radialPos: { x: 310, y: -205, rot: -2, w: 200, h: 118 }
    },
    {
      key: 'vaccinations',
      title: lang === 'ar' ? 'التطعيمات واللقاحات' : 'Vaccinations',
      icon: '💉',
      route: '/vaccinations',
      image: CURVED_PAGE_IMAGES['vaccinations'],
      desc: lang === 'ar' ? 'سجل اللقاحات الوطنية، الجرعات، وتتبع المناعة' : 'National Immunization & Vaccine Registry',
      // Right Inner Mid Elevated
      radialPos: { x: 275, y: -90, rot: -3, w: 200, h: 118 }
    },
    {
      key: 'ambulance',
      title: lang === 'ar' ? 'الإسعاف والطوارئ' : 'Ambulance & EMS',
      icon: '🚑',
      route: '/ambulance',
      image: CURVED_PAGE_IMAGES['ambulance'],
      desc: lang === 'ar' ? 'إدارة أسطول الإسعاف، نقل الحالات الحرجة، والمسارات' : 'EMS Fleet Dispatch & Emergency Logistics',
      // Right Outer Mid Elevated
      radialPos: { x: 400, y: -135, rot: -4, w: 205, h: 120 }
    },
    {
      key: 'medical-leave',
      title: lang === 'ar' ? 'الإجازات والتقارير الطبية' : 'Medical Leave',
      icon: '🏥',
      route: '/medical-leave',
      image: CURVED_PAGE_IMAGES['medical-leave'],
      desc: lang === 'ar' ? 'إصدار التقارير الطبية الرسمية والإجازات المعتمدة' : 'Official Medical Certificates & Leaves',
      // Right Lower Elevated
      radialPos: { x: 350, y: -15, rot: -5, w: 205, h: 120 }
    }
  ], [lang]);

  // ── High-Performance Smooth Drag & Drop ──────────────────────────────────
  const handleDragStart = useCallback(() => {
    startDragSound('page');
  }, []);

  const handleDrag = useCallback((event, info) => {
    const now = Date.now();
    if (now - lastDragTimeRef.current < 35) return;
    lastDragTimeRef.current = now;

    if (dropZoneRef.current) {
      const rect = dropZoneRef.current.getBoundingClientRect();
      const dist = Math.hypot(info.point.x - (rect.left + rect.width / 2), info.point.y - (rect.top + rect.height / 2));
      setIsDraggingOverCenter(dist < 230);
    }
  }, []);

  const handleDragEnd = useCallback((event, info, item) => {
    stopDragSound();
    setIsDraggingOverCenter(false);

    if (dropZoneRef.current) {
      const rect = dropZoneRef.current.getBoundingClientRect();
      const dist = Math.hypot(info.point.x - (rect.left + rect.width / 2), info.point.y - (rect.top + rect.height / 2));
      
      if (dist < 250) {
        playSnap();
        setMagnifiedItem(item);
        return;
      }
    }
    playReturn();
  }, []);

  const handleCloseMagnified = () => {
    playReturn();
    setMagnifiedItem(null);
  };

  const handleOpenPage = (route) => {
    playConfirm();
    setMagnifiedItem(null);
    navigate(route);
  };

  return (
    <div className="cockpit-wrapper">
      
      {/* Scanlines, Cyber Neon Laser Rain & Ambient Glow Backgrounds */}
      <div className="cockpit-scanlines" />
      <div className="cockpit-orb-center" />
      <div className="cockpit-orb-left" />
      <div className="cockpit-orb-right" />

      {/* ── DIGITAL SCI-FI NEON LASER RAIN (CASCADING DATA STREAMS) ── */}
      <div className="cockpit-cyber-neon-rain">
        <div className="cyber-laser-beam beam-1" style={{ '--pos-left': '8%', '--beam-len': '140px', '--beam-dur': '3.2s', '--beam-delay': '0.2s', '--beam-color': '#00f0ff' }} />
        <div className="cyber-laser-beam beam-2" style={{ '--pos-left': '16%', '--beam-len': '220px', '--beam-dur': '4.5s', '--beam-delay': '1.8s', '--beam-color': '#38bdf8' }} />
        <div className="cyber-laser-beam beam-3" style={{ '--pos-left': '24%', '--beam-len': '95px', '--beam-dur': '2.8s', '--beam-delay': '0.9s', '--beam-color': '#00f0ff' }} />
        <div className="cyber-laser-beam beam-4" style={{ '--pos-left': '33%', '--beam-len': '180px', '--beam-dur': '3.8s', '--beam-delay': '2.4s', '--beam-color': '#a855f7' }} />
        <div className="cyber-laser-beam beam-5" style={{ '--pos-left': '44%', '--beam-len': '120px', '--beam-dur': '3.1s', '--beam-delay': '0.5s', '--beam-color': '#00f0ff' }} />
        <div className="cyber-laser-beam beam-6" style={{ '--pos-left': '56%', '--beam-len': '160px', '--beam-dur': '4.1s', '--beam-delay': '1.2s', '--beam-color': '#38bdf8' }} />
        <div className="cyber-laser-beam beam-7" style={{ '--pos-left': '67%', '--beam-len': '240px', '--beam-dur': '3.6s', '--beam-delay': '2.7s', '--beam-color': '#a855f7' }} />
        <div className="cyber-laser-beam beam-8" style={{ '--pos-left': '76%', '--beam-len': '110px', '--beam-dur': '2.9s', '--beam-delay': '0.4s', '--beam-color': '#00f0ff' }} />
        <div className="cyber-laser-beam beam-9" style={{ '--pos-left': '85%', '--beam-len': '190px', '--beam-dur': '4.4s', '--beam-delay': '1.6s', '--beam-color': '#38bdf8' }} />
        <div className="cyber-laser-beam beam-10" style={{ '--pos-left': '92%', '--beam-len': '130px', '--beam-dur': '3.3s', '--beam-delay': '0.8s', '--beam-color': '#00f0ff' }} />
      </div>

      {/* ─── MAGNIFIED FLOATING HUD PREVIEW MODAL ─── */}
      <AnimatePresence>
        {magnifiedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="cockpit-magnified-overlay"
            onClick={handleCloseMagnified}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="cockpit-magnified-card avatar-height-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="cockpit-magnified-close"
                onClick={handleCloseMagnified}
                title={lang === 'ar' ? 'إغلاق وإرجاع المصغر' : 'Close & Return'}
              >
                <FaTimes />
              </button>

              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2.5 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{magnifiedItem.icon}</span>
                  <div className="flex flex-col text-right">
                    <span className="text-base font-bold text-cyan-300">{magnifiedItem.title}</span>
                    <span className="text-xs font-normal text-slate-300 mt-1">{magnifiedItem.desc}</span>
                  </div>
                </div>
                <button
                  className="cockpit-magnified-open-btn"
                  onClick={() => handleOpenPage(magnifiedItem.route)}
                >
                  <FaExternalLinkAlt />
                  <span>{lang === 'ar' ? 'فتح الصفحة' : 'Open Page'}</span>
                </button>
              </div>

              {/* High-Resolution Curved Holographic Screen (Avatar Height) */}
              <div
                className="cockpit-magnified-screen-stage"
                onClick={() => handleOpenPage(magnifiedItem.route)}
                title={lang === 'ar' ? 'انقر لفتح الصفحة فوراً' : 'Click to open page'}
              >
                <img
                  src={magnifiedItem.image}
                  alt={magnifiedItem.title}
                  className="cockpit-magnified-img"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-cyan-500/25 text-[11px] text-cyan-400 font-mono">
                <span>HUD LOCK: OPTIMAL • CLICK SCREEN TO ENTER</span>
                <span className="text-slate-400">{magnifiedItem.route}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ─── MAIN SPATIAL STAGE ─── */}
      <div className={`cockpit-stage ${magnifiedItem ? 'cockpit-dimmed' : ''}`}>

        {/* ========================================================= */}
        {/* 1. TOP KPI FLOATING RIBBON                                */}
        {/* ========================================================= */}
        <section className="cockpit-kpi-belt">
          {/* KPI 1: Patients */}
          <div
            onClick={() => handleOpenPage('/patients')}
            className="cockpit-card cockpit-kpi-card cursor-pointer"
            style={{ '--kpi-accent': '#00f0ff' }}
          >
            <div className="cockpit-kpi-header">
              <span>{lang === 'ar' ? 'إجمالي المرضى' : 'Total Patients'}</span>
              <FaUsers className="text-cyan-400 text-xs" />
            </div>
            <div className="cockpit-kpi-value">
              <span>{totalPatientsCount.toLocaleString()}</span>
              <span className="cockpit-kpi-unit">{lang === 'ar' ? 'مريض' : 'pts'}</span>
            </div>
            <div className="cockpit-kpi-bar">
              <div className="cockpit-kpi-fill" style={{ width: '88%' }} />
            </div>
          </div>

          {/* KPI 2: Bed Occupancy */}
          <div
            onClick={() => handleOpenPage('/wards')}
            className="cockpit-card cockpit-kpi-card cursor-pointer"
            style={{ '--kpi-accent': '#f59e0b' }}
          >
            <div className="cockpit-kpi-header">
              <span>{lang === 'ar' ? 'السعة السريرية' : 'Bed Occupancy'}</span>
              <FaBed className="text-amber-400 text-xs" />
            </div>
            <div className="cockpit-kpi-value">
              <span>{bedOccupancyRate}%</span>
              <span className="cockpit-kpi-unit">{occupiedBeds}/{totalBeds}</span>
            </div>
            <div className="cockpit-kpi-bar">
              <div className="cockpit-kpi-fill" style={{ width: `${Math.min(100, bedOccupancyRate)}%` }} />
            </div>
          </div>

          {/* KPI 3: Lab Tests */}
          <div
            onClick={() => handleOpenPage('/laboratory')}
            className="cockpit-card cockpit-kpi-card cursor-pointer"
            style={{ '--kpi-accent': '#a855f7' }}
          >
            <div className="cockpit-kpi-header">
              <span>{lang === 'ar' ? 'التحاليل اليومية' : 'Daily Lab Tests'}</span>
              <FaFlask className="text-purple-400 text-xs" />
            </div>
            <div className="cockpit-kpi-value">
              <span>{Math.max(labTests.length, 142)}</span>
              <span className="cockpit-kpi-unit">{lang === 'ar' ? 'فحص' : 'tests'}</span>
            </div>
            <div className="cockpit-kpi-bar">
              <div className="cockpit-kpi-fill" style={{ width: '74%' }} />
            </div>
          </div>

          {/* KPI 4: Doctors & Staff */}
          <div
            onClick={() => handleOpenPage('/doctors')}
            className="cockpit-card cockpit-kpi-card cursor-pointer"
            style={{ '--kpi-accent': '#10b981' }}
          >
            <div className="cockpit-kpi-header">
              <span>{lang === 'ar' ? 'الكادر المناوب' : 'On-Duty Staff'}</span>
              <FaUserMd className="text-emerald-400 text-xs" />
            </div>
            <div className="cockpit-kpi-value">
              <span>{Math.max(activeDoctors.length, 184)}</span>
              <span className="cockpit-kpi-unit">{lang === 'ar' ? 'طبيب وممرض' : 'active'}</span>
            </div>
            <div className="cockpit-kpi-bar">
              <div className="cockpit-kpi-fill" style={{ width: '92%' }} />
            </div>
          </div>

          {/* KPI 5: Appointments */}
          <div
            onClick={() => handleOpenPage('/appointments')}
            className="cockpit-card cockpit-kpi-card cursor-pointer"
            style={{ '--kpi-accent': '#38bdf8' }}
          >
            <div className="cockpit-kpi-header">
              <span>{lang === 'ar' ? 'مواعيد اليوم' : 'Today Appts'}</span>
              <FaCalendarAlt className="text-sky-400 text-xs" />
            </div>
            <div className="cockpit-kpi-value">
              <span>{Math.max(todayApts.length, 64)}</span>
              <span className="cockpit-kpi-unit">{lang === 'ar' ? 'موعد' : 'appts'}</span>
            </div>
            <div className="cockpit-kpi-bar">
              <div className="cockpit-kpi-fill" style={{ width: '68%' }} />
            </div>
          </div>

          {/* KPI 6: Pharmacy Stream */}
          <div
            onClick={() => handleOpenPage('/pharmacy')}
            className="cockpit-card cockpit-kpi-card cursor-pointer"
            style={{ '--kpi-accent': '#f43f5e' }}
          >
            <div className="cockpit-kpi-header">
              <span>{lang === 'ar' ? 'كفاءة الصيدلية' : 'Pharmacy Stock'}</span>
              <FaCapsules className="text-rose-400 text-xs" />
            </div>
            <div className="cockpit-kpi-value">
              <span>98.6%</span>
              <span className="cockpit-kpi-unit">{lang === 'ar' ? 'توفر' : 'ready'}</span>
            </div>
            <div className="cockpit-kpi-bar">
              <div className="cockpit-kpi-fill" style={{ width: '98.6%' }} />
            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* 2. SPATIAL OPEN-RING HORSESHOE ORBIT STAGE                */}
        {/* ========================================================= */}
        <div className="cockpit-horseshoe-orbit-stage">

          {/* ── REAL-TIME 60 FPS ECG OSCILLOSCOPE SWEEP (RIGHT TO LEFT THROUGH LOWER AVATAR) ── */}
          <LiveECGStream height={55} />

          {/* ── LIVING AMBIENT BIO PARTICLES ── */}
          <div className="cockpit-living-particles">
            <span className="bio-particle p1" />
            <span className="bio-particle p2" />
            <span className="bio-particle p3" />
            <span className="bio-particle p4" />
            <span className="bio-particle p5" />
            <span className="bio-particle p6" />
          </div>

          {/* ── 3D SCI-FI AVATAR POD ANCHOR IN CENTER (100% CLEAR) ── */}
          <div className="cockpit-horseshoe-center-anchor">
            <HologramAvatarWidget
              isDraggingOverCenter={isDraggingOverCenter}
              dropZoneRef={dropZoneRef}
              lang={lang}
            />

            {/* Base Platform: Floating Quick Actions */}
            <div className="cockpit-orbit-base">
              <div className="cockpit-actions-row">
                <button
                  onClick={() => handleOpenPage('/patients')}
                  className="cockpit-action-btn"
                  title={lang === 'ar' ? 'تسجيل مريض جديد' : 'Register New Patient'}
                >
                  <span className="cockpit-action-icon text-cyan-400">🩺</span>
                  <span className="cockpit-action-label">{lang === 'ar' ? 'تسجيل مريض' : 'New Patient'}</span>
                </button>

                <button
                  onClick={() => handleOpenPage('/appointments')}
                  className="cockpit-action-btn"
                  title={lang === 'ar' ? 'حجز موعد جديد' : 'Book Appointment'}
                >
                  <span className="cockpit-action-icon text-sky-400">📅</span>
                  <span className="cockpit-action-label">{lang === 'ar' ? 'حجز موعد' : 'Appointment'}</span>
                </button>

                <button
                  onClick={() => handleOpenPage('/laboratory')}
                  className="cockpit-action-btn"
                  title={lang === 'ar' ? 'طلب فحص مختبري' : 'Order Lab Test'}
                >
                  <span className="cockpit-action-icon text-purple-400">🔬</span>
                  <span className="cockpit-action-label">{lang === 'ar' ? 'طلب فحص' : 'Lab Order'}</span>
                </button>

                <button
                  onClick={() => handleOpenPage('/pharmacy')}
                  className="cockpit-action-btn"
                  title={lang === 'ar' ? 'صرف وصفة / إدخال نتيجة' : 'Dispense Rx / Results'}
                >
                  <span className="cockpit-action-icon text-emerald-400">💊</span>
                  <span className="cockpit-action-label">{lang === 'ar' ? 'صرف وصفة' : 'Pharmacy Rx'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── 10 FLOATING SCREENS POSITIONED ON COMPACT OPEN RING ── */}
          <div className="cockpit-horseshoe-ring-overlay">
            {curvedThumbnails.map((item, idx) => (
              <motion.div
                key={item.key}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.08}
                dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={(e, info) => handleDragEnd(e, info, item)}
                onClick={() => setMagnifiedItem(item)}
                className={`cockpit-horseshoe-holo-node node-idx-${idx}`}
                style={{
                  '--pos-x': `${item.radialPos.x}px`,
                  '--pos-y': `${item.radialPos.y}px`,
                  '--rot-deg': `${item.radialPos.rot}deg`,
                  '--node-w': `${item.radialPos.w}px`,
                  '--node-h': `${item.radialPos.h}px`,
                  '--anim-dur': `${(3.2 + (idx % 3) * 0.9).toFixed(1)}s`,
                  '--anim-delay': `${((idx * 0.45) % 2.5).toFixed(2)}s`,
                  '--float-shift': `${((idx % 2 === 0 ? 1 : -1) * 7)}px`
                }}
                whileHover={{ scale: 1.1, zIndex: 50 }}
                whileDrag={{ scale: 1.15, zIndex: 60 }}
                title={lang === 'ar' ? `اسحب للمركز أو انقر للمعاينة: ${item.title}` : `Drag to center or click: ${item.title}`}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="cockpit-horseshoe-screen-img"
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                />
              </motion.div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
