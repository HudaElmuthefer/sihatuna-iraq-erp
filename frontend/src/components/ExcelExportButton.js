// frontend/src/components/ExcelExportButton.js
//
// زر تصدير بيانات موديول معيّن لملف Excel — يقابل ExcelImportModal (استيراد)
// لكن بالاتجاه المعاكس. يعمل مع أي موديول مسجَّل عبر pgCrud بالباك إند تلقائياً
// (المسار /api/<apiName>/export-excel عام، لا يحتاج إعداد إضافي لكل موديول).
import React, { useState } from 'react';
import { FaFileExcel } from 'react-icons/fa';
import { apiDownloadFile } from '../api';

// apiName: نفس اسم المسار المستخدم بالموديول (مثل 'patients', 'assets'...)
// label: نص الزر (اختياري، له نص افتراضي بالعربي/الإنجليزي)
// className / style: تخصيص اختياري للمظهر — الافتراضي "btn btn-outline" يناسب
// الخلفيات الفاتحة (بطاقات، أشرطة أدوات بيضاء). على رأسيات ملوّنة/داكنة
// (تدرّجات لونية بأعلى بعض الصفحات) مرّر style بلون نص وحدود واضحين، مثل:
// style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }}
export default function ExcelExportButton({ apiName, lang, label, onError, className, style }) {
  const [downloading, setDownloading] = useState(false);
  const ar = lang === 'ar';

  const handleExport = async () => {
    setDownloading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await apiDownloadFile(`/${apiName}/export-excel`, `${apiName}-${today}.xlsx`);
    } catch (err) {
      if (onError) onError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={downloading} className={className || 'btn btn-outline'} style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <FaFileExcel />
      {downloading ? (ar ? 'جارٍ التصدير...' : 'Exporting...') : (label || (ar ? 'تصدير Excel' : 'Export Excel'))}
    </button>
  );
}
