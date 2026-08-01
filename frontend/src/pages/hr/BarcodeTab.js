// frontend/src/pages/hr/BarcodeTab.js
//
// Barcode tab for official letters (outgoing/incoming), inside the HR
// page — since letters live there, not in the separate Documents module.
// Generate: look up a letter by reference, print a barcode label.
// Scan: read a barcode off a paper letter, see its full details instantly.
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../api';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';

// ── إصلاح: html5-qrcode ينشئ عنصر <video> داخلياً ويستدعي .play() عليه بمجرد
// scanner.start() — ذلك الوعد غير مكشوف لنا إطلاقاً، فلا يوجد .catch() محلي
// نقدر نعلّقه عليه. لو صار تبديل تبويب (تبويب "قراءة" هنا، أو تبويب HR
// الأعلى الذي يُزيل BarcodeTab كاملاً) قبل ما تشغيل الكاميرا يخلص فعلياً،
// React يزيل <div id="barcode-reader-hr"> (وعنصر الفيديو بداخله) من DOM
// بينما وعد .play() الداخلي لسا معلّق — المتصفح يرفضه كـunhandled rejection
// غير مرتبط بأي سلسلة وعود نملكها هنا.
//
// محاولة أولى (مستمع محلي داخل useEffect، بفلترة نصية تقريبية، وإزالة
// مؤجَّلة بـsetTimeout) لم تحل المشكلة فعلياً — تشخيص لاحق بكاميرا حقيقية
// أكّد الشكل الدقيق للخطأ: DOMException باسم "AbortError" ورسالة "The
// play() request was interrupted because the media was removed from the
// document." بالضبط، حرفاً بحرف. الحل النهائي: مطابقة تامة (لا تخمين نصي)
// لهاتين القيمتين تحديداً، بمستمع دائم بمستوى الملف (وليس داخل useEffect) —
// يبقى فعّالاً طوال عمر الصفحة بلا أي إزالة إطلاقاً، فلا يوجد أي احتمال
// توقيت (إزالة مبكرة/متأخرة) يفوّت الرفض الفعلي كما حصل بالمحاولة الأولى.
// preventDefault() هنا آمن ومقصود: الإلغاء نفسه سلوك صحيح (الكاميرا تُهجَر
// فعلاً عند مغادرة الصفحة)، هذا فقط يمنع ظهوره كخطأ غير معالَج للمستخدم.
if (typeof window !== 'undefined' && !window.__barcodeScanPlayRejectionSuppressed) {
  window.__barcodeScanPlayRejectionSuppressed = true;
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event?.reason?.name === 'AbortError' &&
      event?.reason?.message === 'The play() request was interrupted because the media was removed from the document.'
    ) {
      event.preventDefault();
    }
  });
}

const CODE39 = {
  '0':'NNNWWNWNN','1':'WNNWNNNNW','2':'NNWWNNNNW','3':'WNWWNNNNN',
  '4':'NNNWWNNNW','5':'WNNWWNNNN','6':'NNWWWNNNN','7':'NNNWNNWNW',
  '8':'WNNWNNWNN','9':'NNWWNNWNN','A':'WNNNNWNNW','B':'NNWNNWNNW',
  'C':'WNWNNWNNN','D':'NNNNWWNNW','E':'WNNNWWNNN','F':'NNWNWWNNN',
  'G':'NNNNNWWNW','H':'WNNNNWWNN','I':'NNWNNWWNN','J':'NNNNWWWNN',
  'K':'WNNNNNNWW','L':'NNWNNNNWW','M':'WNWNNNNWN','N':'NNNNWNNWW',
  'O':'WNNNWNNWN','P':'NNWNWNNWN','Q':'NNNNNNWWW','R':'WNNNNNWWN',
  'S':'NNWNNNWWN','T':'NNNNWNWWN','U':'WWNNNNNNW','V':'NWWNNNNNW',
  'W':'WWWNNNNNN','X':'NWNNWNNNW','Y':'WWNNWNNNN','Z':'NWWNWNNNN',
  '-':'NWNNNNWNW','.':'WWNNNNWNN',' ':'NWWNNNWNN','*':'NWNNWNWNN',
  '$':'NWNWNWNNN','/':'NWNWNNNWN','+':'NWNNNWNWN','%':'NNNWNWNWN',
};

function code39ToSvg(rawText, height = 60) {
  const text = ('*' + rawText.toUpperCase() + '*');
  let x = 0;
  const narrow = 3, wide = 9, gap = 3;
  const bars = [];
  for (const ch of text) {
    const pattern = CODE39[ch];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i++) {
      const isBar = i % 2 === 0;
      const w = pattern[i] === 'W' ? wide : narrow;
      if (isBar) bars.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`);
      x += w;
    }
    x += gap;
  }
  const totalWidth = x + 10;
  return { svg: `<svg viewBox="0 0 ${totalWidth} ${height}" xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">${bars.join('')}</svg>` };
}

// -- تحميل مكتبة QR عند الحاجة فقط (لا تُحمَّل ما لم يختر المستخدم هذا النوع) --
let qrLibPromise = null;
function loadQrLib() {
  if (window.qrcode) return Promise.resolve();
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js';
    script.onload = resolve;
    script.onerror = () => { qrLibPromise = null; reject(new Error('failed to load qrcode-generator')); };
    document.body.appendChild(script);
  });
  return qrLibPromise;
}

function qrToSvg(rawText) {
  const qr = window.qrcode(0, 'M');
  qr.addData(rawText);
  qr.make();
  return { svg: qr.createSvgTag({ cellSize: 4, margin: 2 }) };
}

// دالة موحّدة: تولّد الباركود حسب النوع المطلوب، بعد التأكد من تحميل مكتبة
// QR إن كان هذا النوع المختار (Code 39 لا يحتاج أي تحميل، مولَّد محلياً).
async function generateBarcode(type, text) {
  if (type === 'qr') {
    await loadQrLib();
    return qrToSvg(text);
  }
  return code39ToSvg(text);
}

export default function BarcodeTab({ lang }) {
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [subTab, setSubTab] = useState('generate');
  const [showImport, setShowImport] = useState(false);

  // -- توليد --------------------------------------------------------------
  const hasArabic = (text) => /[\u0600-\u06FF]/.test(text || '');
  const [barcodeType, setBarcodeType] = useState('qr');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [letter, setLetter] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [previewSvg, setPreviewSvg] = useState('');

  const code39Disabled = letter ? hasArabic(letter.ref) : false;

  // يحدد النوع تلقائياً مرة واحدة فقط عند اختيار كتاب جديد — لا يفرضه بعدها
  // عند تبديل يدوي لاحق، لهذا letter وحده بقائمة الاعتماديات لا barcodeType.
  useEffect(() => {
    if (!letter) return;
    setBarcodeType(hasArabic(letter.ref) ? 'qr' : 'code39');
  }, [letter]); // eslint-disable-line react-hooks/exhaustive-deps

  const [qrError, setQrError] = useState('');
  useEffect(() => {
    if (!letter) { setPreviewSvg(''); return; }
    setQrError('');
    // إصلاح: لو الكتاب عنده صورة باركود محفوظة مسبقاً (barcodeSvg)، نعرضها
    // كما هي بدل توليدها من جديد — يضمن تطابق الملصق المطبوع فعلياً على
    // الورق مع اللي يظهر هنا لاحقاً، حتى لو تغيّرت طريقة التوليد مستقبلاً.
    if (letter.barcodeSvg && letter.barcodeType === barcodeType) {
      setPreviewSvg(letter.barcodeSvg);
      return;
    }
    generateBarcode(barcodeType, letter.ref)
      .then((r) => {
        setPreviewSvg(r.svg);
        // أول توليد لهذا النوع لهذا الكتاب — نحفظه فوراً بسجل الكتاب نفسه
        api.post('/document-lookup/save-barcode', {
          type: letter.type, id: letter.id, barcodeSvg: r.svg, barcodeType,
        }).then((saved) => setLetter((prev) => (prev ? { ...prev, ...saved } : prev))).catch(() => {});
      })
      .catch(() => { setPreviewSvg(''); setQrError(L('تعذّر تحميل أداة QR، تحقق من الاتصال بالإنترنت', 'Could not load the QR tool, check the internet connection')); });
  }, [letter, barcodeType]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchLetters = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    setLetter(null);
    try {
      const result = await api.get(`/document-lookup/search?q=${encodeURIComponent(query.trim())}`);
      setResults(Array.isArray(result) ? result : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const printLabel = async (l) => {
    let svg;
    if (l.barcodeSvg && l.barcodeType === barcodeType) {
      svg = l.barcodeSvg;
    } else {
      try {
        ({ svg } = await generateBarcode(barcodeType, l.ref));
      } catch {
        alert(L('تعذّر تحميل أداة QR، تحقق من الاتصال بالإنترنت', 'Could not load the QR tool, check the internet connection'));
        return;
      }
    }
    const win = window.open('', '_blank', 'width=500,height=300');
    if (!win) return;
    // اتجاه نافذة الطباعة يتبع لغة الواجهة الحالية وقت الطباعة (نفس منطق
    // إصلاح printTable() بـ accounts/hr shared.js) بدل rtl/ar الثابتة سابقاً.
    const dir = document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl';
    const htmlLang = dir === 'rtl' ? 'ar' : 'en';
    win.document.write(`
      <html dir="${dir}" lang="${htmlLang}">
        <head><meta charset="utf-8" /><title>${l.ref}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; text-align: center; padding: 20px; }
            svg { width: 9cm; height: auto; }
            .ref { font-size: 16px; font-weight: 700; margin-top: 8px; letter-spacing: 2px; }
            .title { font-size: 13px; color: #555; margin-top: 4px; }
          </style>
        </head>
        <body>
          ${svg}
          <div class="ref">${l.ref}</div>
          <div class="title">${l.title || ''}</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  // -- قراءة ----------------------------------------------------------------
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scannerReady, setScannerReady] = useState(false);
  const scannerInstance = useRef(null);

  useEffect(() => {
    if (subTab !== 'scan') return;
    // `cancelled` is the mounted/active flag for this specific effect run —
    // fresh per invocation (reset to false every time subTab becomes 'scan'
    // again), which is exactly what's needed here: a useRef would persist
    // across renders and would have to be manually reset on every re-run,
    // while this closure variable already does that correctly for free.
    let cancelled = false;
    let startPromise = null;
    const scriptId = 'html5-qrcode-script';
    const start = () => {
      if (cancelled || !window.Html5Qrcode) return;
      // بدون تحديد formatsToSupport صراحة، المكتبة تحاول قراءة أنواع أخرى
      // فقط ولا تتعرف على Code 39 المُستخدَم هنا — هذا سبب فتح الكاميرا
      // دون قراءة فعلية للباركود.
      const scanner = new window.Html5Qrcode('barcode-reader-hr', {
        formatsToSupport: [
          window.Html5QrcodeSupportedFormats.CODE_39,
          window.Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      scannerInstance.current = scanner;
      startPromise = scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 120 } },
        (decodedText) => {
          if (cancelled) return; // العنصر قد يكون أُزيل فعلاً من DOM
          setScanResult({ code: decodedText, loading: true });
          try { scanner.stop().catch(() => {}); } catch { /* الماسح متوقف أصلاً */ }
          api.get(`/document-lookup-ref?ref=${encodeURIComponent(decodedText.trim())}`)
            .then((r) => { if (!cancelled) setScanResult({ code: decodedText, ...r, loading: false }); })
            .catch(() => { if (!cancelled) setScanResult({ code: decodedText, found: false, loading: false }); });
        },
        () => {}
      ).then(() => {
        // ── إصلاح: لو صار تبديل التبويب (cancelled=true) قبل ما start()
        // يخلص فعلياً، الكاميرا كانت تضل شغّالة — لأن cleanup سبق واستدعى
        // stop() ومكتبة html5-qrcode ترفض إيقاف ماسح لسا بمرحلة "بدء التشغيل"
        // (يرمي خطأ يُبتلَع بصمت بالـ catch). الآن لو صار الإلغاء أثناء
        // الانتظار، نوقف الكاميرا فوراً بمجرد ما start() يخلص فعلياً، ولا
        // نلمس الحالة/العنصر إطلاقاً لأنه قد يكون أُزيل فعلاً من DOM.
        if (cancelled) { scanner.stop().catch(() => {}); return; }
        setScannerReady(true);
      }).catch(() => {
        if (!cancelled) setScanError(L('تعذّر تشغيل الكاميرا', 'Could not start the camera'));
      });
    };
    if (window.Html5Qrcode) {
      start();
    } else if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/html5-qrcode';
      script.onload = start;
      script.onerror = () => { if (!cancelled) setScanError(L('تعذّر تحميل أداة القراءة', 'Could not load the scanner')); };
      document.body.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (startPromise) {
        // ننتظر start() قبل استدعاء stop() — استدعاؤه مبكراً هو أصل المشكلة
        startPromise.finally(() => {
          try { scannerInstance.current?.stop().catch(() => {}); } catch { /* الماسح متوقف أصلاً */ }
        });
      } else {
        try { scannerInstance.current?.stop().catch(() => {}); } catch { /* الماسح متوقف أصلاً */ }
      }
      setScannerReady(false);
      setScanResult(null);
      setScanError('');
    };
  }, [subTab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setSubTab('generate')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: subTab === 'generate' ? '#1a6bab' : '#e5e7eb', color: subTab === 'generate' ? '#fff' : '#333', fontWeight: 700 }}>{L('توليد باركود', 'Generate')}</button>
        <button onClick={() => setSubTab('scan')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: subTab === 'scan' ? '#1a6bab' : '#e5e7eb', color: subTab === 'scan' ? '#fff' : '#333', fontWeight: 700 }}>{L('قراءة باركود', 'Scan')}</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowImport(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#333', cursor: 'pointer', fontSize: 13 }}>📊 {L('استيراد دفعة من Excel', 'Bulk Import from Excel')}</button>
        <ExcelExportButton apiName="barcode" lang={lang} onError={(m) => alert(m)} />
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="barcode"
          title={L('توليد باركود دفعة من Excel', 'Bulk-Generate Barcodes from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={() => { /* لا حاجة لتحديث حالة محلية — النتائج تظهر مباشرة بنافذة الاستيراد نفسها */ }}
        />
      )}

      {subTab === 'generate' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="form-control"
              placeholder={L('رقم الكتاب أو عنوانه أو الجهة', 'Number, title, or entity')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchLetters()}
            />
            <button onClick={searchLetters} disabled={searching} style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: '#1a6bab', color: '#fff', cursor: 'pointer' }}>{searching ? L('جارٍ البحث...', 'Searching...') : L('بحث', 'Search')}</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{L('نوع الباركود', 'Barcode type')}:</span>
            <button
              onClick={() => !code39Disabled && setBarcodeType('code39')}
              disabled={code39Disabled}
              title={code39Disabled ? L('غير مدعوم لهذا الرقم — يحوي حرفاً عربياً', 'Not supported for this number — contains an Arabic letter') : ''}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: code39Disabled ? 'not-allowed' : 'pointer', background: code39Disabled ? '#f3f4f6' : (barcodeType === 'code39' ? '#1a6bab' : '#fff'), color: code39Disabled ? '#9ca3af' : (barcodeType === 'code39' ? '#fff' : '#333'), fontSize: 12 }}
            >Code 39</button>
            <button
              onClick={() => setBarcodeType('qr')}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: barcodeType === 'qr' ? '#1a6bab' : '#fff', color: barcodeType === 'qr' ? '#fff' : '#333', fontSize: 12 }}
            >QR</button>
          </div>
          {code39Disabled && (
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>{L('رقم هذا الكتاب يحوي حرفاً عربياً، وCode 39 لا يدعم العربية — QR فقط متاح له.', "This letter's number contains an Arabic letter, and Code 39 doesn't support Arabic — only QR is available for it.")}</p>
          )}

          {searched && results.length === 0 && <p style={{ color: '#dc2626' }}>{L('لم يُعثر على كتاب مطابق', 'No matching letter found')}</p>}

          {results.length > 0 && !letter && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r) => (
                <div key={`${r.type}-${r.id}`} onClick={() => setLetter(r)} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, cursor: 'pointer' }}>
                  <strong>{r.ref}</strong> — {r.title} <span style={{ color: '#6b7280', fontSize: 12 }}>({r.type === 'outgoing' ? L('صادر', 'Outgoing') : L('وارد', 'Incoming')})</span>
                </div>
              ))}
            </div>
          )}

          {letter && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <p><strong>{L('النوع', 'Type')}:</strong> {letter.type === 'outgoing' ? L('صادر', 'Outgoing') : L('وارد', 'Incoming')}</p>
              <p><strong>{L('العنوان', 'Title')}:</strong> {letter.title}</p>
              <p><strong>{letter.type === 'outgoing' ? L('الجهة المرسل إليها', 'Sent To') : L('الجهة المرسلة', 'Sent From')}:</strong> {letter.to || letter.from}</p>
              <p><strong>{L('الموضوع', 'Subject')}:</strong> {letter.subject}</p>
              <p><strong>{L('التاريخ', 'Date')}:</strong> {letter.date}</p>
              {qrError ? <p style={{ color: '#dc2626', fontSize: 13 }}>{qrError}</p> : (
                <div dangerouslySetInnerHTML={{ __html: previewSvg }} style={{ margin: '12px 0' }} />
              )}
              <p style={{ fontWeight: 700, letterSpacing: 2 }}>{letter.ref}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => printLabel(letter)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a6bab', color: '#fff', cursor: 'pointer' }}>{L('طباعة الملصق', 'Print Label')}</button>
                <button onClick={() => setLetter(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', cursor: 'pointer' }}>{L('رجوع للنتائج', 'Back to results')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'scan' && (
        <div>
          {scanError && <p style={{ color: '#dc2626' }}>{scanError}</p>}
          <div id="barcode-reader-hr" style={{ maxWidth: 400 }} />
          {!scannerReady && !scanError && <p style={{ color: '#6b7280', fontSize: 13 }}>{L('جارٍ تشغيل الكاميرا...', 'Starting camera...')}</p>}

          {scanResult && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginTop: 16 }}>
              <p><strong>{L('الرمز المقروء', 'Scanned code')}:</strong> {scanResult.code}</p>
              {scanResult.loading ? (
                <p>{L('جارٍ البحث...', 'Searching...')}</p>
              ) : scanResult.found ? (
                <>
                  <p><strong>{L('النوع', 'Type')}:</strong> {scanResult.type === 'outgoing' ? L('صادر', 'Outgoing') : L('وارد', 'Incoming')}</p>
                  <p><strong>{L('العنوان', 'Title')}:</strong> {scanResult.title}</p>
                  <p><strong>{scanResult.type === 'outgoing' ? L('الجهة المرسل إليها', 'Sent To') : L('الجهة المرسلة', 'Sent From')}:</strong> {scanResult.to || scanResult.from}</p>
                  <p><strong>{L('الموضوع', 'Subject')}:</strong> {scanResult.subject}</p>
                  <p><strong>{L('التاريخ', 'Date')}:</strong> {scanResult.date}</p>
                  {scanResult.barcodeSvg && (
                    <div dangerouslySetInnerHTML={{ __html: scanResult.barcodeSvg }} style={{ margin: '12px 0' }} />
                  )}
                </>
              ) : (
                <p style={{ color: '#dc2626' }}>{L('لم يُعثر على كتاب بهذا الرمز', 'No letter found with this code')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
