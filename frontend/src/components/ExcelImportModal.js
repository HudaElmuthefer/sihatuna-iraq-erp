// frontend/src/components/ExcelImportModal.js
//
// نافذة استيراد جماعي من ملف Excel — قابلة لإعادة الاستخدام لأي موديول
// (حالياً: المرضى والأطباء). تتعامل مع تحميل قالب فارغ، رفع الملف، وعرض
// نتيجة الاستيراد بالتفصيل (كم سجل انضاف، كم فشل ولیش بالضبط).
import React, { useState } from 'react';
import { FaTimes, FaFileExcel, FaDownload, FaUpload, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { apiUploadFile, apiDownloadFile } from '../api';

// apiName: 'patients' | 'doctors' — يحدد المسار الفعلي بالباك إند
// title: عنوان النافذة (مثل "استيراد مرضى من Excel")
// onClose: تُستدعى عند إغلاق النافذة
// onImported: تُستدعى بعد استيراد ناجح (لو انضاف سجل واحد على الأقل) لتحديث القائمة بالصفحة
export default function ExcelImportModal({ apiName, title, lang, onClose, onImported }) {
  const ar = lang === 'ar';
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [results, setResults] = useState(null); // { imported, failed, errors: [{row, messages}] }
  const [error, setError] = useState('');

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError('');
    try {
      await apiDownloadFile(`/${apiName}/import-template`, `${apiName}-template.xlsx`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setResults(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const data = await apiUploadFile(`/${apiName}/import-excel`, file);
      setResults(data);
      if (data.imported > 0) onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><FaFileExcel style={{ color: '#10b981', marginInlineEnd: 8 }} />{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}><FaTimes /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* خطوة 1: تحميل القالب */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {ar ? '1. حمّلي القالب الفارغ' : '1. Download the empty template'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {ar
                ? 'يحتوي أسماء الأعمدة الصحيحة وصف مثال — عبّيه بنفس الترتيب وارفعيه.'
                : 'Contains the correct column headers and an example row — fill it in and upload it below.'}
            </div>
            <button className="btn btn-sm" onClick={handleDownloadTemplate} disabled={downloadingTemplate}
              style={{ background: 'var(--bg-primary)', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}>
              <FaDownload /> {downloadingTemplate ? (ar ? 'جاري التحميل...' : 'Downloading...') : (ar ? 'تحميل القالب' : 'Download Template')}
            </button>
          </div>

          {/* خطوة 2: رفع الملف */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {ar ? '2. ارفعي الملف المعبّى' : '2. Upload the filled file'}
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
            <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading} style={{ marginTop: 10, width: '100%' }}>
              <FaUpload /> {uploading ? (ar ? 'جاري الاستيراد...' : 'Importing...') : (ar ? 'استيراد' : 'Import')}
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* نتيجة الاستيراد */}
          {results && (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 700 }}>
                  <FaCheckCircle /> {results.imported} {ar ? 'تم استيرادهم' : 'imported'}
                </div>
                {results.failed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 700 }}>
                    <FaExclamationTriangle /> {results.failed} {ar ? 'فشلوا' : 'failed'}
                  </div>
                )}
              </div>
              {results.errors?.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', padding: '10px 16px' }}>
                  {results.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 12.5, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{ar ? `صف ${e.row}` : `Row ${e.row}`}:</strong>{' '}
                      {e.messages.join('، ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{ar ? 'إغلاق' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
