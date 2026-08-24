// frontend/src/pages/ForceChangePasswordScreen.js
//
// شاشة إجبارية تُعرض بدل كامل التطبيق لما يكون user.mustChangePassword صحيحاً
// (يصير هذا فقط بعد إعادة ضبط كلمة مرور من الإدمن — انظر SettingsPage.js).
// المستخدم لا يستطيع تصفح أي شيء آخر بالنظام حتى يغيّر كلمة مروره المؤقتة
// بكلمة دائمة يختارها هو بنفسه.
import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';

export default function ForceChangePasswordScreen() {
  const { lang, user, logout, updateUser, showToast } = useApp();
  const ar = lang === 'ar';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError(ar ? 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف' : 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(ar ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      updateUser({ mustChangePassword: false });
      showToast(ar ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully', 'success');
    } catch (err) {
      setError(err.message || (ar ? 'حدث خطأ' : 'Something went wrong'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 20 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
          <h2 style={{ margin: 0, fontSize: 19 }}>{ar ? 'يجب أن تغيّر كلمة المرور' : 'You must change your password'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
            {ar
              ? `مرحباً ${user?.name || ''} — سجّلت دخول بكلمة مرور مؤقتة. اختر كلمة مرور دائمة جديدة للمتابعة.`
              : `Hi ${user?.name || ''} — you logged in with a temporary password. Choose a new permanent one to continue.`}
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">{ar ? 'كلمة المرور المؤقتة الحالية' : 'Current temporary password'}</label>
            <input type="password" className="form-control" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">{ar ? 'كلمة المرور الجديدة' : 'New password'}</label>
            <input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="form-group">
            <label className="form-label">{ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}</label>
            <input type="password" className="form-control" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 6 }}>
            {saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'تغيير كلمة المرور والمتابعة' : 'Change password and continue')}
          </button>
          <button type="button" onClick={logout} className="btn btn-outline">
            {ar ? 'تسجيل خروج' : 'Log out'}
          </button>
        </form>
      </div>
    </div>
  );
}
