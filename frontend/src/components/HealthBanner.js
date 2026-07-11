import React from 'react';
import { useApp } from '../contexts/AppContext';

// بانر صحي عام — رسوم SVG توضيحية طبية (بدون شعارات حكومية رسمية أو صور أشخاص حقيقيين)
// hero=true يعرض نسخة كبيرة (للوحة التحكم)، hero=false يعرض شريط رفيع (لبقية الصفحات)
export default function HealthBanner({ hero = false }) {
  const { lang } = useApp();
  const L = (ar, en) => (lang === 'ar' ? ar : en);

  if (hero) {
    return (
      <div style={{
        position:'relative', overflow:'hidden', borderRadius:18, marginBottom:24,
        background:'linear-gradient(135deg, #0f5c8f 0%, #1a6bab 45%, #14a085 100%)',
        padding:'32px 36px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:24,
      }}>
        <div style={{ position:'relative', zIndex:2, color:'#fff' }}>
          <div style={{ fontSize:13, opacity:0.85, fontWeight:600, letterSpacing:0.5 }}>
            {L('نظام إدارة المعلومات الصحية', 'Health Information Management System')}
          </div>
          <div style={{ fontSize:26, fontWeight:800, marginTop:6 }}>
            {L('صحّتك أمانة بأيدٍ متخصصة 🏥', 'Your Health, Our Priority 🏥')}
          </div>
          <div style={{ fontSize:13, opacity:0.85, marginTop:8, maxWidth:420, lineHeight:1.7 }}>
            {L(
              'رعاية صحية متكاملة، سجلات دقيقة، وخدمات رقمية تواكب احتياجات المرضى والكادر الطبي',
              'Integrated care, accurate records, and digital services for patients and medical staff'
            )}
          </div>
        </div>
        <MedicalIllustration />
      </div>
    );
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14, padding:'10px 18px', borderRadius:12, marginBottom:16,
      background:'linear-gradient(90deg, rgba(26,107,171,0.12), rgba(20,160,133,0.12))',
      border:'1px solid rgba(26,107,171,0.2)',
    }}>
      <StripeIcon />
      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>
        {L('صحّتنا العراق — منصة صحية متكاملة لخدمة المرضى والكادر الطبي', 'Sihatuna Iraq — Integrated healthcare platform for patients and staff')}
      </span>
    </div>
  );
}

function StripeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#1a6bab" opacity="0.15" />
      <path d="M12 6v12M6 12h12" stroke="#1a6bab" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function MedicalIllustration() {
  return (
    <svg width="180" height="140" viewBox="0 0 180 140" style={{ position:'relative', zIndex:2, flexShrink:0 }}>
      <circle cx="90" cy="70" r="64" fill="#ffffff" opacity="0.08" />
      <circle cx="90" cy="70" r="46" fill="#ffffff" opacity="0.10" />
      {/* نبضة قلب */}
      <polyline points="20,75 55,75 65,50 78,95 92,60 102,75 160,75"
        fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {/* صليب طبي */}
      <g transform="translate(78,20)">
        <rect x="10" y="0" width="8" height="28" rx="2" fill="#ffffff" opacity="0.95" />
        <rect x="0" y="10" width="28" height="8" rx="2" fill="#ffffff" opacity="0.95" />
      </g>
      {/* سماعة طبيب مبسّطة */}
      <g transform="translate(118,88)" opacity="0.9">
        <circle cx="0" cy="0" r="8" fill="none" stroke="#ffffff" strokeWidth="2.5" />
        <path d="M0,8 C0,20 20,20 20,8" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="6" r="4" fill="#ffffff" />
      </g>
    </svg>
  );
}
