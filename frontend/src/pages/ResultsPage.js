// frontend/src/pages/ResultsPage.js
//
// A single place to view a patient's lab and radiology results (whether
// entered manually or received automatically via HL7/DICOM), print them,
// or send them via WhatsApp to the patient or the referring doctor.
//
// WhatsApp sending uses the free "click-to-chat" link (wa.me) — it opens
// WhatsApp with the message pre-filled, and staff press Send themselves.
// This requires no WhatsApp Business API account or cost. A fully
// automatic send (no click needed) would require a paid WhatsApp Business
// API account through Meta — a separate, bigger project if ever needed.
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';
import { api } from '../api';

// Iraq-specific: local numbers are written starting with 0 (e.g.
// 07711234567). WhatsApp links need the international format without the
// leading 0, prefixed with the country code (964).
function toWhatsAppNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('964')) return digits;
  if (digits.startsWith('0')) return '964' + digits.slice(1);
  return digits;
}

function openWhatsApp(phone, message) {
  const number = toWhatsAppNumber(phone);
  if (!number) return false;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
  return true;
}

function printContent(title, lines) {
  const win = window.open('', '_blank', 'width=700,height=900');
  if (!win) return;
  win.document.write(`
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 32px; color: #1a1a1a; }
          h1 { font-size: 20px; border-bottom: 2px solid #1a6bab; padding-bottom: 10px; }
          .row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { width: 160px; font-weight: 700; color: #555; }
          .value { flex: 1; }
          .footer { margin-top: 30px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${lines.map(([label, value]) => `<div class="row"><div class="label">${label}</div><div class="value">${value || '—'}</div></div>`).join('')}
        <div class="footer">صحّتنا العراق — طُبع بتاريخ ${new Date().toLocaleString('ar-IQ')}</div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function printCombined(title, items) {
  const win = window.open('', '_blank', 'width=700,height=900');
  if (!win) return;
  win.document.write(`
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 32px; color: #1a1a1a; }
          h1 { font-size: 20px; border-bottom: 2px solid #1a6bab; padding-bottom: 10px; }
          .item { margin-top: 22px; padding-top: 14px; border-top: 1px dashed #ccc; }
          .item h2 { font-size: 15px; margin: 0 0 8px; color: #1a6bab; }
          .row { display: flex; padding: 5px 0; font-size: 13px; }
          .label { width: 150px; font-weight: 700; color: #555; }
          .value { flex: 1; }
          .footer { margin-top: 30px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${items.map((item) => `
          <div class="item">
            <h2>${item.heading}</h2>
            ${item.lines.map(([label, value]) => `<div class="row"><div class="label">${label}</div><div class="value">${value || '—'}</div></div>`).join('')}
          </div>
        `).join('')}
        <div class="footer">صحّتنا العراق — طُبع بتاريخ ${new Date().toLocaleString('ar-IQ')}</div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export default function ResultsPage() {
  const { lang } = useApp();
  const tr = useT(lang);
  const L = (ar, en) => (lang === 'ar' ? ar : en);

  const [search, setSearch] = useState('');
  const [matchingPatients, setMatchingPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientLabResults, setPatientLabResults] = useState([]);
  const [patientRadiologyResults, setPatientRadiologyResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedLabIds, setSelectedLabIds] = useState(new Set());
  const [selectedRadIds, setSelectedRadIds] = useState(new Set());
  const [doctors, setDoctors] = useState([]);

  // Same issue as `patients` above: the app-wide `doctors` context array is
  // stale demo data, not synced with the real database. Fetch it directly
  // once on mount so doctor-phone lookups (for the WhatsApp send buttons)
  // actually match real records.
  useEffect(() => {
    api.get('/doctors').then((data) => setDoctors(Array.isArray(data) ? data : [])).catch(() => setDoctors([]));
  }, []);

  // Live search against the real backend (uses the indexed name/phone
  // columns via pgCrud's ?search= support) — NOT the app-wide `patients`
  // context array, which turned out to be stale demo/localStorage data
  // that's never synced from the actual PostgreSQL database.
  useEffect(() => {
    if (!search.trim() || selectedPatient) { setMatchingPatients([]); return; }
    const timer = setTimeout(() => {
      api.get(`/patients?search=${encodeURIComponent(search.trim())}`)
        .then((data) => setMatchingPatients(Array.isArray(data) ? data.slice(0, 8) : []))
        .catch(() => setMatchingPatients([]));
    }, 300); // small debounce so we don't fire a request on every keystroke
    return () => clearTimeout(timer);
  }, [search, selectedPatient]);

  // Once a patient is selected, fetch ALL lab/radiology records (no ?page=
  // param → pgCrud returns the full unpaginated array) and filter them
  // client-side by name/patientId, since these two tables don't have a
  // server-side "filter by patient" query param yet.
  useEffect(() => {
    if (!selectedPatient) { setPatientLabResults([]); setPatientRadiologyResults([]); return; }
    setSelectedLabIds(new Set());
    setSelectedRadIds(new Set());
    setLoadingResults(true);
    Promise.all([api.get('/labTests'), api.get('/radiology')])
      .then(([labs, rads]) => {
        const matches = (r) => r.patientName === selectedPatient.name || (r.patientId && r.patientId === selectedPatient.patientId);
        setPatientLabResults(Array.isArray(labs) ? labs.filter(matches) : []);
        setPatientRadiologyResults(Array.isArray(rads) ? rads.filter(matches) : []);
      })
      .catch(() => { setPatientLabResults([]); setPatientRadiologyResults([]); })
      .finally(() => setLoadingResults(false));
  }, [selectedPatient]);

  const findDoctorPhone = (doctorName) => {
    if (!doctorName) return null;
    const match = doctors.find((d) => (d.name || '').includes(doctorName) || doctorName.includes(d.name || ''));
    return match?.phone || null;
  };

  const handlePrintLab = (t) => {
    printContent(L('تقرير نتيجة تحليل مخبري', 'Lab Result Report'), [
      [L('المريض', 'Patient'), t.patientName],
      [L('نوع الفحص', 'Test Type'), t.testType],
      [L('الطبيب المحوّل', 'Referring Doctor'), t.doctorName],
      [L('تاريخ النتيجة', 'Result Date'), t.resultDate],
      [L('النتيجة', 'Result'), t.results?.value],
      [L('ملاحظات', 'Notes'), t.results?.notes || t.notes],
    ]);
  };

  const handlePrintRadiology = (r) => {
    printContent(L('تقرير أشعة', 'Radiology Report'), [
      [L('المريض', 'Patient'), r.patientName],
      [L('نوع الفحص', 'Modality'), r.modality],
      [L('الطبيب المحوّل', 'Referring Doctor'), r.doctorName],
      [L('تاريخ الفحص', 'Exam Date'), r.examDate],
      [L('النتائج', 'Findings'), r.findings],
      [L('الانطباع', 'Impression'), r.impression],
    ]);
  };

  const sendLabToPatient = (t) => {
    const msg = L(
      `مرحباً ${t.patientName}، نتيجة فحص ${t.testType} جاهزة: ${t.results?.value || 'راجعي المختبر لمزيد من التفاصيل'}. صحّتنا العراق.`,
      `Hello ${t.patientName}, your ${t.testType} result is ready: ${t.results?.value || 'please visit the lab for details'}. SIHATUNA IRAQ.`
    );
    if (!openWhatsApp(selectedPatient.phone, msg)) alert(L('رقم هاتف المريض غير مسجَّل', "Patient's phone number is not on file"));
  };

  const sendLabToDoctor = (t) => {
    const phone = findDoctorPhone(t.doctorName);
    const msg = L(
      `د. ${t.doctorName}، نتيجة فحص ${t.testType} للمريض ${t.patientName}: ${t.results?.value || 'راجع المختبر'}.`,
      `Dr. ${t.doctorName}, ${t.patientName}'s ${t.testType} result: ${t.results?.value || 'please check with the lab'}.`
    );
    if (!phone || !openWhatsApp(phone, msg)) alert(L('رقم هاتف الطبيب غير مسجَّل بملفه الشخصي', "Doctor's phone number is not on file"));
  };

  const sendRadiologyToPatient = (r) => {
    const msg = L(
      `مرحباً ${r.patientName}، تقرير ${r.modality} جاهز. الانطباع: ${r.impression || 'راجعي قسم الأشعة'}. صحّتنا العراق.`,
      `Hello ${r.patientName}, your ${r.modality} report is ready. Impression: ${r.impression || 'please visit radiology'}. SIHATUNA IRAQ.`
    );
    if (!openWhatsApp(selectedPatient.phone, msg)) alert(L('رقم هاتف المريض غير مسجَّل', "Patient's phone number is not on file"));
  };

  const sendRadiologyToDoctor = (r) => {
    const phone = findDoctorPhone(r.doctorName);
    const msg = L(
      `د. ${r.doctorName}، تقرير ${r.modality} للمريض ${r.patientName}. الانطباع: ${r.impression || 'راجع قسم الأشعة'}.${r.orthancViewerUrl ? ' رابط الصور: ' + r.orthancViewerUrl : ''}`,
      `Dr. ${r.doctorName}, ${r.patientName}'s ${r.modality} report. Impression: ${r.impression || 'please check radiology'}.${r.orthancViewerUrl ? ' Images: ' + r.orthancViewerUrl : ''}`
    );
    if (!phone || !openWhatsApp(phone, msg)) alert(L('رقم هاتف الطبيب غير مسجَّل بملفه الشخصي', "Doctor's phone number is not on file"));
  };

  const toggleLab = (id) => setSelectedLabIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleRad = (id) => setSelectedRadIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedLabs = patientLabResults.filter((t) => selectedLabIds.has(t.id));
  const selectedRads = patientRadiologyResults.filter((r) => selectedRadIds.has(r.id));
  const totalSelected = selectedLabs.length + selectedRads.length;

  const handlePrintSelected = () => {
    const items = [
      ...selectedLabs.map((t) => ({
        heading: `${L('مختبر', 'Lab')} — ${t.testType}`,
        lines: [
          [L('المريض', 'Patient'), t.patientName],
          [L('الطبيب المحوّل', 'Referring Doctor'), t.doctorName],
          [L('تاريخ النتيجة', 'Result Date'), t.resultDate],
          [L('النتيجة', 'Result'), t.results?.value],
          [L('ملاحظات', 'Notes'), t.results?.notes || t.notes],
        ],
      })),
      ...selectedRads.map((r) => ({
        heading: `${L('أشعة', 'Radiology')} — ${r.modality}`,
        lines: [
          [L('المريض', 'Patient'), r.patientName],
          [L('الطبيب المحوّل', 'Referring Doctor'), r.doctorName],
          [L('تاريخ الفحص', 'Exam Date'), r.examDate],
          [L('النتائج', 'Findings'), r.findings],
          [L('الانطباع', 'Impression'), r.impression],
        ],
      })),
    ];
    printCombined(L(`تقرير نتائج مجمَّع — ${selectedPatient.name}`, `Combined Results Report — ${selectedPatient.name}`), items);
  };

  const buildCombinedMessage = (forDoctorName) => {
    const labLines = selectedLabs.map((t) => `• ${t.testType}: ${t.results?.value || L('بانتظار النتيجة', 'pending')}`);
    const radLines = selectedRads.map((r) => `• ${r.modality}: ${r.impression || L('بانتظار التقرير', 'pending')}`);
    const header = forDoctorName
      ? L(`د. ${forDoctorName}، نتائج المريض ${selectedPatient.name}:`, `Dr. ${forDoctorName}, results for patient ${selectedPatient.name}:`)
      : L(`مرحباً ${selectedPatient.name}، نتائجك جاهزة:`, `Hello ${selectedPatient.name}, your results are ready:`);
    const footer = forDoctorName ? '' : L('\nصحّتنا العراق.', '\nSIHATUNA IRAQ.');
    return [header, ...labLines, ...radLines].join('\n') + footer;
  };

  const handleSendSelectedToPatient = () => {
    if (totalSelected === 0) return;
    if (!openWhatsApp(selectedPatient.phone, buildCombinedMessage(null))) {
      alert(L('رقم هاتف المريض غير مسجَّل', "Patient's phone number is not on file"));
    }
  };

  // Selected results might have been ordered by different doctors — group by
  // doctor name and send one combined message per doctor, instead of forcing
  // one click per individual test result.
  const doctorGroups = (() => {
    const names = new Set([...selectedLabs.map((t) => t.doctorName), ...selectedRads.map((r) => r.doctorName)].filter(Boolean));
    return [...names].map((name) => ({
      name,
      count: selectedLabs.filter((t) => t.doctorName === name).length + selectedRads.filter((r) => r.doctorName === name).length,
    }));
  })();

  const handleSendToDoctorGroup = (doctorName) => {
    const phone = findDoctorPhone(doctorName);
    const labsForDoctor = selectedLabs.filter((t) => t.doctorName === doctorName);
    const radsForDoctor = selectedRads.filter((r) => r.doctorName === doctorName);
    const labLines = labsForDoctor.map((t) => `• ${t.testType}: ${t.results?.value || L('بانتظار النتيجة', 'pending')}`);
    const radLines = radsForDoctor.map((r) => `• ${r.modality}: ${r.impression || L('بانتظار التقرير', 'pending')}`);
    const msg = [L(`د. ${doctorName}، نتائج المريض ${selectedPatient.name}:`, `Dr. ${doctorName}, results for patient ${selectedPatient.name}:`), ...labLines, ...radLines].join('\n');
    if (!phone || !openWhatsApp(phone, msg)) alert(L(`رقم هاتف د. ${doctorName} غير مسجَّل بملفه الشخصي`, `Dr. ${doctorName}'s phone number is not on file`));
  };


  const btnStyle = { border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
  const waStyle = { ...btnStyle, background: '#e9f9ef', borderColor: '#25D366', color: '#128C4A' };
  const bulkBtnStyle = { ...btnStyle, padding: '7px 14px', fontSize: 13, fontWeight: 700 };
  const bulkWaStyle = { ...waStyle, padding: '7px 14px', fontSize: 13, fontWeight: 700 };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 16 }}>{L('نتائج التحاليل والأشعة', 'Lab & Radiology Results')}</h2>

      <div style={{ position: 'relative', maxWidth: 420, marginBottom: 20 }}>
        <input
          className="form-control"
          placeholder={L('ابحثي عن مريض بالاسم أو رقم الهاتف...', 'Search patient by name or phone...')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedPatient(null); }}
        />
        {matchingPatients.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', insetInlineStart: 0, insetInlineEnd: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {matchingPatients.map((p) => (
              <div
                key={p.id}
                onClick={() => { setSelectedPatient(p); setSearch(p.name); }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              >
                {p.name} <span style={{ color: '#999', fontSize: 12 }}>({p.phone})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPatient && (
        <>
          {totalSelected > 0 && (
            <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fffbe6', border: '1px solid #f0d876', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{L(`${totalSelected} نتيجة محدَّدة`, `${totalSelected} result(s) selected`)}</span>
              <button style={bulkBtnStyle} onClick={handlePrintSelected}>🖨️ {L('طباعة الكل', 'Print All')}</button>
              <button style={bulkWaStyle} onClick={handleSendSelectedToPatient}>📱 {L('إرسال الكل للمريض', 'Send All to Patient')}</button>
              {doctorGroups.map((g) => (
                <button key={g.name} style={bulkWaStyle} onClick={() => handleSendToDoctorGroup(g.name)}>
                  📱 {L(`إرسال لـ د. ${g.name} (${g.count})`, `Send to Dr. ${g.name} (${g.count})`)}
                </button>
              ))}
              <button
                style={{ ...bulkBtnStyle, background: 'transparent', border: 'none', color: '#999' }}
                onClick={() => { setSelectedLabIds(new Set()); setSelectedRadIds(new Set()); }}
              >
                {L('إلغاء التحديد', 'Clear selection')}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>{L('نتائج المختبر', 'Lab Results')}</h3>
            {patientLabResults.length > 0 && (
              <button
                style={{ ...btnStyle, fontSize: 11 }}
                onClick={() => setSelectedLabIds(new Set(selectedLabIds.size === patientLabResults.length ? [] : patientLabResults.map((t) => t.id)))}
              >
                {selectedLabIds.size === patientLabResults.length ? L('إلغاء تحديد الكل', 'Deselect all') : L('تحديد الكل', 'Select all')}
              </button>
            )}
          </div>
          {patientLabResults.length === 0 ? (
            <p style={{ color: '#999', marginBottom: 20 }}>{L('لا توجد نتائج مختبر لهذا المريض', 'No lab results for this patient')}</p>
          ) : (
            <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {patientLabResults.map((t) => (
                <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={selectedLabIds.has(t.id)} onChange={() => toggleLab(t.id)} style={{ width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{t.testType} {t.resultSource === 'HL7_AUTO' && <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 6, marginInlineStart: 6 }}>{L('استُلمت تلقائيًا', 'Auto-received')}</span>}</div>
                      <div style={{ fontSize: 13, color: '#666' }}>{t.results?.value || L('بانتظار النتيجة', 'Awaiting result')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={btnStyle} onClick={() => handlePrintLab(t)}>🖨️ {L('طباعة', 'Print')}</button>
                    <button style={waStyle} onClick={() => sendLabToPatient(t)}>📱 {L('إرسال للمريض', 'Send to Patient')}</button>
                    <button style={waStyle} onClick={() => sendLabToDoctor(t)}>📱 {L('إرسال للطبيب', 'Send to Doctor')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>{L('نتائج الأشعة', 'Radiology Results')}</h3>
            {patientRadiologyResults.length > 0 && (
              <button
                style={{ ...btnStyle, fontSize: 11 }}
                onClick={() => setSelectedRadIds(new Set(selectedRadIds.size === patientRadiologyResults.length ? [] : patientRadiologyResults.map((r) => r.id)))}
              >
                {selectedRadIds.size === patientRadiologyResults.length ? L('إلغاء تحديد الكل', 'Deselect all') : L('تحديد الكل', 'Select all')}
              </button>
            )}
          </div>
          {patientRadiologyResults.length === 0 ? (
            <p style={{ color: '#999' }}>{L('لا توجد نتائج أشعة لهذا المريض', 'No radiology results for this patient')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {patientRadiologyResults.map((r) => (
                <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={selectedRadIds.has(r.id)} onChange={() => toggleRad(r.id)} style={{ width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {r.modality} {r.dicomStudyId && <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 6, marginInlineStart: 6 }}>{L('صور مستلَمة', 'Images received')}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#666' }}>{r.impression || L('بانتظار التقرير', 'Awaiting report')}</div>
                      {r.orthancViewerUrl && (
                        <a href={r.orthancViewerUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1a6bab' }}>{L('عرض الصور', 'View Images')}</a>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={btnStyle} onClick={() => handlePrintRadiology(r)}>🖨️ {L('طباعة', 'Print')}</button>
                    <button style={waStyle} onClick={() => sendRadiologyToPatient(r)}>📱 {L('إرسال للمريض', 'Send to Patient')}</button>
                    <button style={waStyle} onClick={() => sendRadiologyToDoctor(r)}>📱 {L('إرسال للطبيب', 'Send to Doctor')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
