import React, { useState } from 'react';

export default function BackupDestinationModal({ onClose, onConfirm }) {
  const [destination, setDestination] = useState('pgadmin');
  const [cloudUrl, setCloudUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setError('');

    if (destination === 'cloud' && !cloudUrl.trim()) {
      setError('الرجاء إدخال رابط الخزن السحابي');
      return;
    }

    if (destination === 'computer') {
      if (!window.showDirectoryPicker) {
        setError('هذه الميزة تعمل فقط على متصفح Chrome أو Edge');
        return;
      }
      try {
        const dirHandle = await window.showDirectoryPicker();
        setLoading(true);
        await onConfirm({ destination, dirHandle });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('فشل اختيار المجلد');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await onConfirm({ destination, cloudUrl });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        <h3 style={styles.title}>اختر وجهة النسخة الاحتياطية</h3>

        <label style={styles.option}>
          <input
            type="radio"
            name="dest"
            checked={destination === 'pgadmin'}
            onChange={() => setDestination('pgadmin')}
          />
          <span>حفظ بصيغة متوافقة مع pgAdmin (على مجلد السيرفر)</span>
        </label>

        <label style={styles.option}>
          <input
            type="radio"
            name="dest"
            checked={destination === 'computer'}
            onChange={() => setDestination('computer')}
          />
          <span>حفظ على الكومبيوتر (تحديد المجلد يدوياً)</span>
        </label>

        <label style={styles.option}>
          <input
            type="radio"
            name="dest"
            checked={destination === 'cloud'}
            onChange={() => setDestination('cloud')}
          />
          <span>رفع على الكلاود (رابط خزن)</span>
        </label>

        {destination === 'cloud' && (
          <input
            type="text"
            placeholder="https://example.com/upload-endpoint"
            value={cloudUrl}
            onChange={(e) => setCloudUrl(e.target.value)}
            style={styles.input}
          />
        )}

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button onClick={onClose} disabled={loading} style={styles.btnSecondary}>
            إلغاء
          </button>
          <button onClick={handleConfirm} disabled={loading} style={styles.btnPrimary}>
            {loading ? 'جاري التنفيذ...' : 'تنفيذ النسخ الاحتياطي'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  // ── إصلاح تباين الوضع الليلي ─────────────────────────────────────────────
  // هذي النافذة مبنية بأنماط محلية سابقة لنظام الألوان الموحَّد (var(--bg-card)
  // إلخ المستخدَم بباقي نوافذ التطبيق عبر صنف .modal بـ index.css) — كانت
  // خلفية الصندوق بيضاء ثابتة (#fff) بينما نصوصها (العنوان h3، خيارات الراديو)
  // بلا لون صريح، فتَرِث color:var(--text-primary) من قاعدة index.css العامة
  // (h3{color:var(--text-primary)}) — بالوضع الليلي هذي القيمة تصير فاتحة/بيضاء
  // تقريباً، فيصير النص أبيض على خلفية بيضاء (غير مرئي عملياً). نفس المشكلة
  // بالضبط بحقل الإدخال (input بلا background/color صريحين، فيرث خلفية بيضاء
  // افتراضية من المتصفح + نص فاتح موروث). الحل: نفس متغيرات الثيم المستخدَمة
  // بصنف .form-control الموحَّد (var(--bg-secondary)/var(--text-primary)).
  box: {
    background: 'var(--bg-card)',
    borderRadius: 8,
    padding: '24px 28px',
    width: 380,
    direction: 'rtl',
    fontFamily: 'Tahoma, Arial, sans-serif',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    color: 'var(--text-primary)',
  },
  title: {
    margin: '0 0 16px',
    fontSize: 18,
    color: 'var(--text-primary)',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 0',
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  input: {
    width: '100%',
    marginTop: 8,
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid var(--border)',
    borderRadius: 4,
    boxSizing: 'border-box',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  btnPrimary: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer',
  },
};