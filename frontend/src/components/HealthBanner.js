import React, { useRef } from 'react';
import useMagneticHover from '../hooks/useMagneticHover';
// FaBullseye بدل FaCog لزر "تخصيص لوحة التحكم" تحديداً — حلقات متحدة
// المركز تقرأ بصرياً كـ"نواة تحكّم" مضيئة من الوسط (راجع
// .health-hero-customize-gear بـindex.css)، لا ترس إعدادات عادي. لا علاقة
// لهذا بأيقونة صفحة "الإعدادات" الفعلية بالقائمة الجانبية (تبقى FaCog كما
// هي في Layout.js — NAV_ICON_COMPONENTS.settings).
import { FaBullseye } from 'react-icons/fa';
import { useApp } from '../contexts/AppContext';
import AppLogo from './AppLogo';
// الملف الفعلي المزوَّد صراحةً (وليس الكرة البسيطة القديمة) — نسخة مطابقة
// بايتاً لبايت لـ components/dark/ChatGPT Image Aug 30, 2026, 05_36_29 PM
// (5).png (تحقّق SHA256 مطابق تماماً). هذه الصورة نفسها تحتوي فعلياً على كل
// العناصر (الحلقات المدارية، DNA، لوحة الدماغ، لوحة التشريح، الجزيئات،
// الكوكب، القاعدة المستقبلية) — لذلك لا حاجة لأي رسم CSS/SVG إضافي فوقها؛
// أُزيلت كل الطبقات الزخرفية اليدوية السابقة (HudRings/HudCoil/particles)
// لتفادي ازدواجية العناصر.
import sihatunaExactFutureHologram from '../assets/hero/sihatuna-exact-future-hologram.png';

// ملاحظة تعمّد عدم استخدام banner-glass-frame.png هنا (رغم كونها من الأصول
// المعتمدة): تلك الصورة ترسم إطاراً مزدوجاً بالفعل (بروَاز معدني خارجي +
// لوح زجاجي داخلي بحدّه الخاص) داخل ملف واحد. تمديدها كخلفية كاملة لبانر
// بعرض متغيّر (background-size:cover) مع إضافة حدّ CSS منفصل فوقها كان
// يُنتج فعلياً "إطارين متراكبين" غير متطابقين — بالضبط المشكلة المُبلَّغ
// عنها. الحل: إطار واحد مبني بالكامل بـCSS (يتبع نفس الألوان المستخرجة من
// الصورة) بدل الاعتماد على حدود صورة ثابتة الأبعاد لا يمكنها التمدد بأمان.

// بانر صحي عام — رسوم SVG توضيحية طبية (بدون شعارات حكومية رسمية أو صور أشخاص حقيقيين)
// hero=true يعرض نسخة كبيرة (للوحة التحكم)، hero=false يعرض شريط رفيع (لبقية الصفحات)
export default function HealthBanner({ hero = false, onCustomize, customizeLabel }) {
  const { lang, appName, theme } = useApp();
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  // Magnetic hover خفيف جداً (٤px) على نواة التحكّم فقط — أيقونة كبيرة
  // مفردة، وليست نصاً عادياً (راجع useMagneticHover.js).
  const customizeGearRef = useRef(null);
  useMagneticHover(customizeGearRef, 4);

  // نسخة الوضع الداكن فقط — إطار زجاجي بـCSS (راجع الملاحظة أعلاه) + صورة
  // الهولوغرام الفعلية المزوَّدة صراحةً (sihatuna-exact-future-hologram.png)
  // تُعرَض كاملة بلا قص أو قناع. الوضع الفاتح لا يمر من هنا إطلاقاً — يتابع
  // إلى نفس التصميم القديم أدناه بلا أي تغيير.
  if (hero && theme === 'dark') {
    return (
      <div className="health-hero-dark">
        {/* لوح داخلي غائر (inset panel) — البانر بالمرجع إطار خارجي + سطح
           داخلي أغمق منخفض، وليس بطاقة مسطحة واحدة. */}
        <div className="health-hero-dark-inner">
          {/* ترتيب DOM مقصود: أول عنصر يظهر في أقصى يمين الحاوية (flex-row
             تحت RTL) — الصورة المرجعية تضع الكرة يميناً والنص يساراً، عكس ما
             كان مطبَّقاً (تأكدتُ بمقارنة فعلية للقطة شاشة حيّة مقابل المرجع). */}
          <div className="health-hero-caduceus">
            {/* الصورة المزوَّدة صراحةً تُعرَض كما هي بلا أي معالجة أو قناع أو
               زخرفة إضافية — كل التفاصيل (الحلقات، DNA، لوحات HUD، الكوكب،
               القاعدة) موجودة أصلاً داخل الملف نفسه. */}
            <img
              src={sihatunaExactFutureHologram}
              alt=""
              aria-hidden="true"
              className="hero-medical-hologram"
            />
          </div>
          <div className="health-hero-dark-content">
            <div className="health-hero-dark-eyebrow">
              {L('نظام إدارة المعلومات الصحية', 'Health Information Management System')}
            </div>
            <div className="health-hero-dark-title">
              {L('صحّتك أمانة بأيدٍ متخصصة', 'Your Health, Our Priority')}
            </div>
          </div>
        </div>
        {/* زر التخصيص — عنصر ابن للبانر بموضع مطلق، مثبَّت على حافته السفلى
           اليسرى ومتراكب جزئياً معها (كما بالمرجع بالضبط)، وليس صفاً منفصلاً
           فوق البانر. */}
        {onCustomize && (
          <button type="button" onClick={onCustomize} className="health-hero-customize">
            <span className="health-hero-customize-label">{customizeLabel}</span>
            <span ref={customizeGearRef} className="health-hero-customize-gear" aria-hidden="true">
              <FaBullseye />
            </span>
          </button>
        )}
      </div>
    );
  }

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
      <AppLogo size={24} radius={6} fontSize={13} />
      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>
        {appName} — {L('منصة صحية متكاملة لخدمة المرضى والكادر الطبي', 'Integrated healthcare platform for patients and staff')}
      </span>
    </div>
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
