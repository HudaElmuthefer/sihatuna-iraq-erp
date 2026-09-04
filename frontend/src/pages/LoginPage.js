import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';
import AppLogo from '../components/AppLogo';
import heroDark from '../assets/hero/sihatuna-exact-future-hologram.webp';
import heroLight from '../assets/hero/sihatuna-light-future-hologram.webp';

/*
 * إعادة بناء كاملة (لا ترقيع فوق التصميم السابق — طلب صريح): الصفحة
 * القديمة كانت تعتمد خلفية داكنة ثابتة دائماً (حتى بالوضع الفاتح) وبطاقة
 * بيضاء عادية وزراً أزرق مسطّحاً بغضّ النظر عن الثيم — هوية "ويب تقليدية"
 * منفصلة تماماً عن باقي هوية النظام الهولوغرافية. هذا الملف يستبدلها بالكامل
 * بأصناف CSS جديدة (بادئة la- — Login Access) لا تشترك بأي اسم مع الأصناف
 * القديمة، فلا تعارض/توريث غير مقصود ممكن إطلاقاً. منطق المصادقة
 * (handleSubmit/login/form state) لم يتغيّر حرفاً واحداً.
 *
 * البنية الدلالية المطلوبة صراحةً:
 *   .la-atmosphere   → الخلفية الجوّية (طبقات متعددة، ليست Gradient واحداً)
 *   .la-hologram     → الأيقونة الطبية الهولوغرافية (نفس أصل صور Dashboard
 *                      hero — sihatuna-*-future-hologram.png — لا صورة جديدة
 *                      مُعالَجة من الصفر، هذه الأصول جاهزة وصحيحة الشفافية
 *                      أصلاً من جولة سابقة)
 *   .la-panel        → لوحة الدخول (Floating Access Console، ليست Card عادية)
 *
 * الأبعاد/المسافات مشتركة بالكامل بين الثيمين (بند S بالطلب) — كل قاعدة
 * [data-theme] أدناه تضبط الألوان/الإضاءة/الظل فقط، أبداً width/height/
 * padding/gap/position.
 */
export default function LoginPage() {
  const { login, addToast, lang, toggleLang, theme, toggleTheme, appName } = useApp();
  const tr = useT(lang);
  const [form, setForm] = useState({ username: 'admin', password: 'admin' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      addToast(tr('auto_pair_124'), 'error');
      return;
    }
    setLoading(true);
    const res = await login(form);
    setLoading(false);
    if (!res.success) addToast(res.message || (tr('auto_pair_125')), 'error');
  };

  return (
    <div className="la-shell">
      {/* LoginAtmosphere — طبقات متعددة (لؤلؤي/وردي/سماوي/بنفسجي خفيف +
         شبكة HUD شبه غير مرئية)، لا خلفية داكنة ثابتة بصرف النظر عن الثيم. */}
      <div className="la-atmosphere" aria-hidden="true">
        <span className="la-atmosphere-grid" />
      </div>

      <div className="la-topbar">
        <button type="button" onClick={toggleLang} className="la-topbar-btn">
          {tr('login_lang_toggle')}
        </button>
        <button type="button" onClick={toggleTheme} className="la-topbar-btn">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      <div className="la-stage">
        {/* MedicalHologramArea — العنصر البصري الرئيسي الثاني بجانب اللوحة
           (MAIN VISUAL CORE، وليس زخرفة جانبية صغيرة — بند 1 صراحةً).
           حقل ضوء متعدد الطبقات (large atmospheric → medium → core →
           ground) بدل توهّج دائري واحد واضح الحدود. جميع طبقات الضوء
           position:absolute + pointer-events:none — لا تؤثر على أبعاد
           الـLayout (بند 24). */}
        <div className="la-hologram" aria-hidden="true">
          <div className="la-light-field la-light-outer" />
          <div className="la-light-field la-light-mid" />
          <div className="la-light-field la-light-core" />
          <div className="la-light-ground" />
          <img
            src={theme === 'dark' ? heroDark : heroLight}
            alt=""
            className="la-hologram-img"
          />
        </div>

        {/* LoginAccessPanel — لوحة تحكّم زجاجية عائمة، وليست Card تقليدية. */}
        <div className="la-panel">
          <div className="la-logo">
            <div className="la-logo-module">
              <AppLogo size={52} radius={14} fontSize={24} />
            </div>
          </div>
          <h1 className="la-title">{appName}</h1>
          <p className="la-subtitle">{tr('auto_pair_127')}</p>
          <div className="la-ministry">{tr('auto_pair_128')}</div>

          <form onSubmit={handleSubmit} className="la-form">
            <div className="la-field">
              <label>{tr('auto_pair_129')}</label>
              <div className="la-input-wrap">
                <FaUser className="la-field-icon" />
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder={tr('auto_pair_130')}
                  autoComplete="username"
                  className="la-input"
                />
              </div>
            </div>

            <div className="la-field">
              <label>{tr('auto_pair_131')}</label>
              <div className="la-input-wrap">
                <FaLock className="la-field-icon" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={tr('auto_pair_132')}
                  autoComplete="current-password"
                  className="la-input"
                />
                <button type="button" className="la-pw-toggle" onClick={() => setShowPw(p => !p)}>
                  {showPw ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button type="submit" className="la-submit" disabled={loading}>
              {loading
                ? <><FaSpinner className="la-spin" /> {tr('auto_pair_133')}</>
                : (tr('auto_pair_134'))
              }
            </button>

            <div className="la-hint">
              {lang === 'ar' ? tr('login_demo_hint') : 'Demo: username "admin" with any password'}
            </div>
          </form>

          <div className="la-roles">
            <p>{tr('auto_pair_135')}</p>
            <div className="la-roles-list">
              {[
                { label: tr('auto_pair_136'), user: 'admin' },
                { label: tr('auto_pair_137'), user: 'doctor' },
                { label: tr('auto_pair_138'), user: 'nurse' },
              ].map(r => (
                <button
                  key={r.user}
                  type="button"
                  className="la-role-chip"
                  onClick={() => setForm({ username: r.user, password: r.user })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ══════════════════════════════════════════════════════════════
           تخطيط مشترك بالكامل بين الثيمين — لا width/height/padding/gap/
           position مختلف أبداً حسب data-theme (بند S بالطلب صراحةً).
           ══════════════════════════════════════════════════════════════ */
        .la-shell {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .la-atmosphere {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .la-atmosphere-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(120, 150, 200, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120, 150, 200, 0.05) 1px, transparent 1px);
          background-size: 42px 42px;
          -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, black, transparent 78%);
          mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, black, transparent 78%);
        }

        /* أعلى يمين الصفحة (بند 9 صراحةً) — RTL افتراضياً يجعل flex-start
           تبدأ من اليمين أصلاً، لكن التصريح الصريح هنا أوضح وأقل هشاشة من
           الاعتماد على الافتراضي الضمني فقط. padding-inline-end يطابق
           margin-inline-start الخاص بـ.la-stage أدناه كي يقع الشريط تماماً
           فوق مجموعة اللوحة+الهولوغرام، لا في زاوية منفصلة عنها. */
        .la-topbar {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: flex-start;
          gap: 10px;
          padding: 24px 48px 0 20px;
        }

        .la-topbar-btn {
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, box-shadow 0.2s ease;
          backdrop-filter: blur(10px);
        }
        .la-topbar-btn:hover { transform: scale(1.05); }
        .la-topbar-btn:active { transform: scale(0.95); }

        /* المجموعة كاملة (Hologram + Panel) — width:fit-content بدل عرض
           كامل مُمركَز (بند 12 صراحةً): الصندوق يلتصق بحجم محتواه الفعلي،
           ثم margin-inline-end:auto يدفعه بالكامل نحو "بداية" المحور
           (اليمين تحت RTL) تاركاً الفراغ المتبقي على الجهة الأخرى، بدل
           center الذي كان يُوسّط المجموعة بمنتصف الشاشة تماماً. margin-top
           صغير (بدل flex:1/align-items:center التي كانت تُوسّط عمودياً في
           كامل الارتفاع المتبقي) يرفع المجموعة لأعلى الصفحة بدل منتصفها
           (بند 4). لا flex-grow هنا — الحجم النهائي يأتي من flex-basis
           الثابتة بالأسفل، فلا "تمدّد" غير مقصود حتى مع width:fit-content. */
        .la-stage {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 24px;
          width: fit-content;
          max-width: calc(100% - 40px);
          margin-top: 28px;
          margin-inline-start: 48px;
          margin-inline-end: auto;
          padding-bottom: 40px;
        }

        /* تكبير إضافي فوق الجولة السابقة (كانت clamp(440px, 34vw, 620px) —
           ≈464px عند 1366px). القيد كان لا يزال في الـcontainer نفسه
           (max-width) لا بالصورة (1536×1024px يتحمّل تكبيراً أكبر بكثير
           بلا فقدان جودة). القيم الجديدة: 42vw عند 1366px ≈574px (زيادة
           ~24% عن 464px السابقة، ضمن مدى 20-30% المطلوب)، ومع اللوحة
           الثابتة 420px يصبح وزن الهولوغرام البصري ≈574/(574+420)≈58%
           تقريباً (أكبر من اللوحة كما طُلب صراحةً). الحد الأقصى رُفع أيضاً
           إلى 820px (كان 620px) كي يستمر بالتكبير المنطقي على 1920px بدل
           التجمّد مبكراً. */
        .la-hologram {
          position: relative;
          flex: 0 0 auto;
          width: clamp(560px, 42vw, 820px);
          max-width: 820px;
          display: flex;
          align-items: center;
          justify-content: center;
          isolation: isolate;
        }

        .la-hologram-img {
          position: relative;
          z-index: 3;
          width: 100%;
          max-width: 100%;
          height: auto;
          object-fit: contain;
          animation: laHologramFloat 7s ease-in-out infinite;
        }

        /* حقل ضوء حجمي متعدد الطبقات (بند 10-15 صراحةً) بدل هالة دائرية
           واحدة واضحة الحدود — كل طبقة عبارة عن radial-gradient غير متمركز
           (نقطتا لون مختلفتان، وردي + سماوي) خلف تمويه ثقيل، فيندمج
           بصرياً كضوء منتشر طبيعي بدل "دائرة" يمكن تمييز حافتها. الطبقات
           الثلاث بأحجام مختلفة (كبيرة/متوسطة/مركزية) تعطي إحساس العمق
           الحجمي (volumetric) المطلوب. */
        .la-light-field {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        /* النسب (بند "الضوء المحيط" بالطلب الحالي صراحةً): كبيرة 130-160%
           من حجم الصورة → 145% مُختارة (inset:-22.5%)، متوسطة 110-130% →
           120% (inset:-10%)، والمركزية ملاصقة للكرة/القاعدة → أضيق بكثير
           (inset:18% أي 64% من الحجم). بما أنها نسب مئوية من حجم الحاوية
           نفسها (لا px ثابتة)، تكبر تلقائياً مع أي تكبير مستقبلي للهولوغرام
           بلا الحاجة لتعديلها يدوياً كل مرة. */
        .la-light-outer {
          inset: -22.5%;
          filter: blur(60px);
          animation: laLightPulse 7s ease-in-out infinite;
        }

        .la-light-mid {
          inset: -10%;
          z-index: 1;
          filter: blur(38px);
          animation: laLightPulse 7s ease-in-out infinite 0.4s;
        }

        .la-light-core {
          inset: 18%;
          z-index: 2;
          filter: blur(20px);
          animation: laLightPulse 6s ease-in-out infinite 0.8s;
        }

        /* بركة ضوء أرضية أسفل قاعدة الهولوغرام (بند 27-30) — تمنحه ثقلاً
           بصرياً وكأنه فعلاً موضوع على سطح مضاء، لا عائم بلا وزن. إهليجية
           عريضة ومسطّحة، بلا خط أرضية مرسوم بوضوح. */
        .la-light-ground {
          position: absolute;
          left: 10%;
          right: 10%;
          bottom: 6%;
          height: 20%;
          border-radius: 50%;
          filter: blur(22px);
          pointer-events: none;
          z-index: 0;
        }

        @keyframes laHologramFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }

        /* نبض بطيء جداً للضوء فقط (لا حجم/موضع) — إحساس طاقة مستمرة، ليس
           وميضاً واضحاً (بند 32 صراحةً: 0.88 → 1 → 0.88). */
        @keyframes laLightPulse {
          0%, 100% { opacity: 0.88; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .la-hologram-img { animation: none; }
          .la-light-outer, .la-light-mid, .la-light-core { animation: none; opacity: 0.94; }
        }

        .la-panel {
          position: relative;
          flex: 0 0 400px;
          max-width: 420px;
          width: 100%;
          border-radius: 22px;
          padding: 36px 34px;
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          animation: laPanelRise 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes laPanelRise {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .la-panel::before {
          content: '';
          position: absolute;
          inset: 0 0 auto 0;
          height: 1px;
          border-radius: 22px 22px 0 0;
          pointer-events: none;
        }

        .la-panel::after {
          content: '';
          position: absolute;
          inset-inline-start: 0;
          top: 12%;
          bottom: 12%;
          width: 1px;
          pointer-events: none;
        }

        .la-logo { text-align: center; margin-bottom: 18px; }

        .la-logo-module {
          display: inline-flex;
          padding: 5px;
          border-radius: 16px;
        }

        .la-title {
          font-size: 25px;
          font-weight: 900;
          text-align: center;
          margin-bottom: 4px;
        }

        .la-subtitle {
          font-size: 13px;
          text-align: center;
          margin-bottom: 10px;
        }

        .la-ministry {
          display: block;
          width: fit-content;
          margin: 0 auto 26px;
          padding: 4px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .la-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .la-field label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .la-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .la-field-icon {
          position: absolute;
          right: 14px;
          font-size: 15px;
          pointer-events: none;
          z-index: 1;
        }

        .la-input {
          width: 100%;
          padding: 13px 44px 13px 44px;
          border-radius: 12px;
          font-family: inherit;
          font-size: 15px;
          outline: none;
          border-width: 1.5px;
          border-style: solid;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }

        .la-pw-toggle {
          position: absolute;
          left: 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          padding: 0;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .la-pw-toggle:hover { transform: scale(1.12); }

        .la-submit {
          position: relative;
          overflow: hidden;
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
        }
        .la-submit:hover:not(:disabled) { transform: translateY(-2px) scale(1.02); }
        .la-submit:active:not(:disabled) { transform: translateY(0) scale(0.97); }
        .la-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .la-spin { animation: laSpin 0.8s linear infinite; }
        @keyframes laSpin { to { transform: rotate(360deg); } }

        .la-hint {
          text-align: center;
          font-size: 12px;
          padding: 8px;
          border-radius: 10px;
          border-width: 1px;
          border-style: dashed;
        }

        .la-roles {
          margin-top: 22px;
          padding-top: 18px;
          border-top-width: 1px;
          border-top-style: solid;
          text-align: center;
        }

        .la-roles p {
          font-size: 12px;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .la-roles-list {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .la-role-chip {
          padding: 6px 14px;
          border-radius: 20px;
          border-width: 1.5px;
          border-style: solid;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
        }
        .la-role-chip:hover { transform: scale(1.05); }
        .la-role-chip:active { transform: scale(0.96); }

        @media (prefers-reduced-motion: reduce) {
          .la-topbar-btn, .la-pw-toggle, .la-submit, .la-role-chip { transition: box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease; }
          .la-topbar-btn:hover, .la-pw-toggle:hover, .la-submit:hover, .la-role-chip:hover,
          .la-submit:active, .la-role-chip:active, .la-topbar-btn:active { transform: none; }
          .la-panel { animation: none; }
        }

        @media (max-width: 900px) {
          /* الشاشات الصغيرة: تكديس عمودي مُوسَّط (بند 18 صراحةً) بدل التركيب
             المضغوط أعلى-يمين — لا مساحة كافية لهما جنباً إلى جنب أصلاً. */
          .la-topbar { justify-content: center; padding: 20px; }
          .la-stage {
            flex-direction: column;
            width: 100%;
            max-width: 100%;
            justify-content: center;
            margin-top: 8px;
            margin-inline-start: 0;
            margin-inline-end: 0;
            gap: 20px;
            padding: 10px 20px 30px;
          }
          .la-hologram { width: min(320px, 70vw); max-width: 320px; }
          .la-panel { max-width: 440px; flex-basis: auto; padding: 30px 26px; }
        }

        /* ══════════════════════════════════════════════════════════════
           DARK MODE — نفس هوية Dashboard الداكنة (سماوي/أزرق كهربائي).
           ══════════════════════════════════════════════════════════════ */
        [data-theme="dark"] .la-shell {
          background:
            /* Light spill إضافي قرب موضع الهولوغرام الفعلي (يمين المشهد،
               بند 20) — طبقة رابعة تُضاف فوق الجو العام الموجود أصلاً بدل
               استبداله. */
            radial-gradient(ellipse 34% 42% at 82% 40%, rgba(79, 195, 247, 0.10), transparent 68%),
            radial-gradient(ellipse 60% 55% at 18% 12%, rgba(79, 195, 247, 0.14), transparent 65%),
            radial-gradient(ellipse 55% 50% at 85% 82%, rgba(79, 195, 247, 0.10), transparent 65%),
            linear-gradient(160deg, #0a121c 0%, #0d1b28 45%, #050a10 100%);
        }
        [data-theme="dark"] .la-atmosphere-grid { background-image:
            linear-gradient(rgba(79, 195, 247, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79, 195, 247, 0.07) 1px, transparent 1px); }
        [data-theme="dark"] .la-topbar-btn {
          border: 1px solid rgba(79, 195, 247, 0.3);
          background: rgba(15, 30, 42, 0.55);
          color: #eaf9ff;
        }
        [data-theme="dark"] .la-topbar-btn:hover { background: rgba(79, 195, 247, 0.18); box-shadow: 0 0 12px rgba(79,195,247,0.3); }

        /* حقل الضوء الحجمي — DARK MODE (بند 21 صراحةً): أزرق كهربائي +
           سماوي مهيمنان، بنفسجي ثانوي، وردي كلمسة خفيفة جداً فقط. شدة أعلى
           قليلاً من الفاتح (خلفية داكنة تحتاج تبايناً أقوى، بند 22) دون
           Neon. مركزان لونيان غير متطابقين في كل طبقة (بدل دائرة واحدة
           متمركزة) يمنعان ظهور "حافة دائرة" واضحة بعد التمويه الثقيل. */
        [data-theme="dark"] .la-light-outer {
          background:
            radial-gradient(circle at 35% 40%, rgba(80, 150, 255, 0.34), transparent 62%),
            radial-gradient(circle at 68% 62%, rgba(140, 110, 230, 0.22), transparent 60%);
        }
        [data-theme="dark"] .la-light-mid {
          background:
            radial-gradient(circle at 42% 45%, rgba(79, 195, 247, 0.42), transparent 58%),
            radial-gradient(circle at 62% 58%, rgba(160, 120, 235, 0.28), transparent 58%),
            radial-gradient(circle at 76% 28%, rgba(230, 150, 200, 0.14), transparent 50%);
        }
        [data-theme="dark"] .la-light-core {
          background: radial-gradient(circle at 48% 46%,
            rgba(235, 250, 255, 0.88) 0%,
            rgba(150, 220, 255, 0.6) 30%,
            rgba(120, 150, 255, 0.3) 60%,
            transparent 80%);
        }
        [data-theme="dark"] .la-light-ground {
          background: radial-gradient(ellipse, rgba(79, 195, 247, 0.32), rgba(120, 110, 220, 0.14) 55%, transparent 75%);
        }

        [data-theme="dark"] .la-panel {
          background: linear-gradient(165deg, rgba(32,45,58,0.88) 0%, rgba(13,22,32,0.92) 100%);
          border: 1px solid rgba(79, 195, 247, 0.28);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 -12px 24px rgba(0,0,0,0.4),
            0 30px 60px rgba(0,0,0,0.5),
            0 0 40px rgba(79,195,247,0.12);
        }
        [data-theme="dark"] .la-panel::before { background: linear-gradient(90deg, transparent, rgba(79,195,247,0.8), transparent); }
        /* الحافة المقابلة للهولوغرام (بداية المحور المنطقي = يمين تحت RTL،
           حيث يقع الهولوغرام فعلياً) تستقبل انعكاساً خفيفاً منه (بند 19) —
           لا يتغيّر لون اللوحة كاملة، فقط خط رفيع على هذا الجانب تحديداً. */
        [data-theme="dark"] .la-panel::after {
          background: linear-gradient(180deg, transparent, rgba(79,195,247,0.55), rgba(160,120,230,0.3), transparent);
        }
        [data-theme="dark"] .la-logo-module {
          background: linear-gradient(160deg, rgba(60,80,95,0.6), rgba(20,30,40,0.5));
          border: 1px solid rgba(79,195,247,0.35);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px rgba(79,195,247,0.22);
        }
        [data-theme="dark"] .la-title { color: #eaf9ff; text-shadow: 0 0 16px rgba(79,195,247,0.3); }
        [data-theme="dark"] .la-subtitle { color: #9db6c4; }
        [data-theme="dark"] .la-ministry { background: rgba(79,195,247,0.14); color: #bfeeff; border: 1px solid rgba(79,195,247,0.3); }
        [data-theme="dark"] .la-field label { color: #b8ccd6; }
        [data-theme="dark"] .la-field-icon { color: #7fa3b3; }
        [data-theme="dark"] .la-input {
          background: rgba(10, 18, 26, 0.55);
          border-color: rgba(79,195,247,0.25);
          color: #eaf9ff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        [data-theme="dark"] .la-input::placeholder { color: rgba(184, 204, 214, 0.4); }
        [data-theme="dark"] .la-input:focus { border-color: rgba(79,195,247,0.7); box-shadow: 0 0 0 3px rgba(79,195,247,0.18); }
        [data-theme="dark"] .la-pw-toggle { color: #7fa3b3; }
        [data-theme="dark"] .la-submit {
          background: linear-gradient(135deg, #0f4c75 0%, #1b8fb8 60%, #38c6e8 100%);
          color: #eafcff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 22px rgba(38,166,206,0.35), 0 0 16px rgba(79,195,247,0.25);
        }
        [data-theme="dark"] .la-submit:hover:not(:disabled) { box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 26px rgba(38,166,206,0.45), 0 0 24px rgba(79,195,247,0.4); }
        [data-theme="dark"] .la-hint { color: #8298a3; background: rgba(10,18,26,0.4); border-color: rgba(79,195,247,0.22); }
        [data-theme="dark"] .la-roles { border-top-color: rgba(79,195,247,0.18); }
        [data-theme="dark"] .la-roles p { color: #8298a3; }
        [data-theme="dark"] .la-role-chip { border-color: rgba(79,195,247,0.3); color: #b8ccd6; }
        [data-theme="dark"] .la-role-chip:hover { border-color: rgba(79,195,247,0.7); color: #eaf9ff; background: rgba(79,195,247,0.1); }

        /* ══════════════════════════════════════════════════════════════
           LIGHT MODE — الهوية الفعلية المطلوبة: لؤلؤي + وردي + سماوي +
           بنفسجي خفيف جداً كعمق فقط. لا كحلي داكن، لا بطاقة بيضاء صافية،
           لا زر أزرق مسطّح (بند K صراحةً).
           ══════════════════════════════════════════════════════════════ */
        [data-theme="light"] .la-shell {
          background:
            radial-gradient(ellipse 34% 42% at 82% 40%, rgba(220, 140, 195, 0.09), rgba(80, 190, 230, 0.07) 60%, transparent 72%),
            radial-gradient(ellipse 60% 50% at 14% 10%, rgba(230, 140, 195, 0.22), transparent 65%),
            radial-gradient(ellipse 60% 55% at 88% 15%, rgba(80, 190, 230, 0.20), transparent 65%),
            radial-gradient(ellipse 70% 55% at 50% 118%, rgba(150, 120, 200, 0.15), transparent 70%),
            linear-gradient(160deg, #fdf5f9 0%, #f2f4fb 55%, #eae6f2 100%);
        }
        [data-theme="light"] .la-atmosphere-grid { background-image:
            linear-gradient(rgba(120, 110, 170, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120, 110, 170, 0.05) 1px, transparent 1px); }
        [data-theme="light"] .la-topbar-btn {
          border: 1px solid rgba(220, 130, 190, 0.3);
          background: rgba(255,255,255,0.5);
          color: #33445c;
        }
        [data-theme="light"] .la-topbar-btn:hover { background: rgba(255,255,255,0.75); box-shadow: 0 0 12px rgba(80,180,220,0.25); }

        /* حقل الضوء الحجمي — LIGHT MODE (بند 16-18 صراحةً): وردي + سماوي
           متعادلان (لا أزرق فقط)، مع لمسة بنفسجية خفيفة جداً كعمق فقط.
           الوردي أعلى-يسار الصورة تقريباً، السماوي أسفل-يمين — نفس منطق
           توزيع الأيقونات الأخرى بالمشروع (حافة كهربائية ← سماوي ← أزرق ←
           زجاج). */
        [data-theme="light"] .la-light-outer {
          background:
            radial-gradient(circle at 32% 38%, rgba(235, 150, 205, 0.30), transparent 62%),
            radial-gradient(circle at 68% 62%, rgba(90, 195, 235, 0.30), transparent 62%);
        }
        [data-theme="light"] .la-light-mid {
          background:
            radial-gradient(circle at 38% 42%, rgba(240, 160, 210, 0.38), transparent 58%),
            radial-gradient(circle at 64% 60%, rgba(80, 190, 230, 0.40), transparent 58%),
            radial-gradient(circle at 50% 50%, rgba(190, 160, 235, 0.14), transparent 55%);
        }
        [data-theme="light"] .la-light-core {
          background: radial-gradient(circle at 48% 46%,
            rgba(255, 255, 255, 0.92) 0%,
            rgba(190, 235, 255, 0.65) 28%,
            rgba(230, 170, 215, 0.35) 58%,
            transparent 80%);
        }
        [data-theme="light"] .la-light-ground {
          background: radial-gradient(ellipse, rgba(80, 190, 230, 0.28), rgba(230, 150, 200, 0.16) 55%, transparent 75%);
        }

        [data-theme="light"] .la-panel {
          background: linear-gradient(165deg, rgba(255,255,255,0.85) 0%, rgba(245,240,255,0.72) 45%, rgba(255,238,248,0.62) 100%);
          border: 1px solid rgba(80, 180, 220, 0.28);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            inset 0 -10px 22px rgba(150, 120, 200, 0.10),
            0 30px 60px rgba(120, 110, 170, 0.16),
            0 0 40px rgba(220, 130, 190, 0.12);
        }
        [data-theme="light"] .la-panel::before { background: linear-gradient(90deg, transparent, rgba(220,130,190,0.6), rgba(80,180,220,0.6), transparent); }
        [data-theme="light"] .la-panel::after {
          background: linear-gradient(180deg, transparent, rgba(80,180,220,0.5), rgba(230,150,200,0.35), transparent);
        }
        [data-theme="light"] .la-logo-module {
          background: linear-gradient(160deg, rgba(255,255,255,0.85), rgba(245,240,255,0.5));
          border: 1px solid rgba(80,180,220,0.32);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 0 14px rgba(220,130,190,0.2), 0 6px 14px rgba(120,110,170,0.12);
        }
        [data-theme="light"] .la-title { color: #17293c; text-shadow: 0 0 16px rgba(220,130,190,0.18); }
        [data-theme="light"] .la-subtitle { color: #55637a; }
        [data-theme="light"] .la-ministry { background: rgba(80,180,220,0.14); color: #14283d; border: 1px solid rgba(80,180,220,0.3); }
        [data-theme="light"] .la-field label { color: #33445c; }
        [data-theme="light"] .la-field-icon { color: #6b7a99; }
        [data-theme="light"] .la-input {
          background: linear-gradient(180deg, rgba(255,255,255,0.75), rgba(245,248,255,0.55));
          border-color: rgba(80,180,220,0.3);
          color: #17293c;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
        }
        [data-theme="light"] .la-input::placeholder { color: rgba(60,80,110,0.45); }
        [data-theme="light"] .la-input:focus { border-color: rgba(80,180,220,0.65); box-shadow: 0 0 0 3px rgba(80,180,220,0.16), inset 0 1px 0 rgba(255,255,255,0.8); }
        [data-theme="light"] .la-pw-toggle { color: #6b7a99; }
        [data-theme="light"] .la-submit {
          background: linear-gradient(135deg, #1a5f9e 0%, #2fa9c9 70%, #6fd3e8 100%);
          color: #ffffff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 20px rgba(47,169,201,0.32), 0 0 0 1px rgba(220,130,190,0.15);
        }
        [data-theme="light"] .la-submit:hover:not(:disabled) { box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 26px rgba(47,169,201,0.42), 0 0 22px rgba(80,180,220,0.4); }
        [data-theme="light"] .la-hint { color: #6b7a99; background: rgba(255,255,255,0.4); border-color: rgba(80,180,220,0.3); }
        [data-theme="light"] .la-roles { border-top-color: rgba(150,130,170,0.2); }
        [data-theme="light"] .la-roles p { color: #6b7a99; }
        [data-theme="light"] .la-role-chip { border-color: rgba(80,180,220,0.3); color: #33445c; }
        [data-theme="light"] .la-role-chip:hover { border-color: rgba(220,130,190,0.55); color: #14283d; background: rgba(220,130,190,0.1); }
      `}</style>
    </div>
  );
}
