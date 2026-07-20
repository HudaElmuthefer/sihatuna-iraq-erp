import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';

export default function LoginPage() {
  const { login, addToast, lang, toggleLang, theme, toggleTheme } = useApp();
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
    <div className="login-page">
      {/* Background */}
      <div className="login-bg">
        <div className="login-bg-overlay" />
        <div className="login-circles">
          <div className="circle circle-1" />
          <div className="circle circle-2" />
          <div className="circle circle-3" />
        </div>
      </div>

      {/* Top bar */}
      <div className="login-topbar">
        <button onClick={toggleLang} className="topbar-btn">
          {tr('login_lang_toggle')}
        </button>
        <button onClick={toggleTheme} className="topbar-btn">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      {/* Card */}
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="50" height="50" viewBox="0 0 60 60" fill="none">
              <circle cx="30" cy="30" r="30" fill="rgba(26,107,171,0.12)" />
              <circle cx="30" cy="30" r="22" fill="rgba(26,107,171,0.18)" />
              <path d="M30 14 L30 46 M14 30 L46 30" stroke="#1a6bab" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="login-title">
            {tr('auto_pair_126')}
          </h1>
          <p className="login-subtitle">
            {tr('auto_pair_127')}
          </p>
          <div className="login-ministry">
            {tr('auto_pair_128')}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>{tr('auto_pair_129')}</label>
            <div className="login-input-wrapper">
              <FaUser className="field-icon" />
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder={tr('auto_pair_130')}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="login-field">
            <label>{tr('auto_pair_131')}</label>
            <div className="login-input-wrapper">
              <FaLock className="field-icon" />
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={tr('auto_pair_132')}
                autoComplete="current-password"
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)}>
                {showPw ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading
              ? <><FaSpinner className="spin" /> {tr('auto_pair_133')}</>
              : (tr('auto_pair_134'))
            }
          </button>

          <div className="login-hint">
            {lang === 'ar'
              ? tr('login_demo_hint')
              : 'Demo: username "admin" with any password'
            }
          </div>
        </form>

        {/* Quick roles */}
        <div className="login-roles">
          <p>{tr('auto_pair_135')}</p>
          <div className="roles-list">
            {[
              { label: tr('auto_pair_136'), user: 'admin' },
              { label: tr('auto_pair_137'), user: 'doctor' },
              { label: tr('auto_pair_138'), user: 'nurse' },
            ].map(r => (
              <button
                key={r.user}
                type="button"
                className="role-chip"
                onClick={() => setForm({ username: r.user, password: r.user })}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #0a1628 0%, #0f2340 40%, #0d1b2e 100%);
        }

        .login-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .login-bg-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 20% 50%, rgba(26,107,171,0.25) 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, rgba(0,200,150,0.1) 0%, transparent 50%);
        }

        .login-circles .circle {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .circle-1 { width: 500px; height: 500px; top: -200px; right: -150px; }
        .circle-2 { width: 300px; height: 300px; bottom: -100px; left: -100px; }
        .circle-3 { width: 200px; height: 200px; top: 50%; right: 10%; }

        .login-topbar {
          position: fixed;
          top: 20px;
          left: 20px;
          display: flex;
          gap: 10px;
          z-index: 10;
        }

        .topbar-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
          color: white;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          transition: var(--transition);
          backdrop-filter: blur(8px);
        }
        .topbar-btn:hover { background: rgba(255,255,255,0.15); }

        .login-card {
          background: rgba(255,255,255,0.97);
          border-radius: 20px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 25px 80px rgba(0,0,0,0.4);
          position: relative;
          z-index: 5;
          animation: slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }

        [data-theme="dark"] .login-card {
          background: rgba(26,35,50,0.97);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .login-logo {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo-icon {
          display: inline-flex;
          margin-bottom: 12px;
        }

        .login-title {
          font-size: 26px;
          font-weight: 900;
          color: var(--primary);
          margin-bottom: 4px;
        }

        .login-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .login-ministry {
          display: inline-block;
          padding: 4px 12px;
          background: rgba(26,107,171,0.1);
          color: var(--primary);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .login-field label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .login-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-icon {
          position: absolute;
          right: 14px;
          color: var(--text-muted);
          font-size: 15px;
          pointer-events: none;
          z-index: 1;
        }

        .login-input-wrapper input {
          width: 100%;
          padding: 13px 44px 13px 44px;
          border: 2px solid var(--border);
          border-radius: 10px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: inherit;
          font-size: 15px;
          outline: none;
          transition: var(--transition);
        }

        .login-input-wrapper input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(26,107,171,0.12);
        }

        .pw-toggle {
          position: absolute;
          left: 14px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 16px;
          display: flex;
          padding: 0;
        }

        .login-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: var(--transition);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 15px rgba(26,107,171,0.4);
          margin-top: 4px;
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(26,107,171,0.5);
        }

        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .spin { animation: spin 0.8s linear infinite; }

        .login-hint {
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          padding: 8px;
          background: var(--bg-primary);
          border-radius: 8px;
          border: 1px dashed var(--border);
        }

        .login-roles {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          text-align: center;
        }

        .login-roles p {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 10px;
          font-weight: 600;
        }

        .roles-list {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .role-chip {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1.5px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: var(--transition);
        }

        .role-chip:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(26,107,171,0.06);
        }
      `}</style>
    </div>
  );
}
