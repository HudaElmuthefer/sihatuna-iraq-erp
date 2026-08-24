// frontend/src/pages/InventoryPredictionPage.js
//
// توقّع استهلاك المخزون — صفحة مستقلة تماماً (نفس نمط BillingAnomalyPage.js/
// DosageCheckPage.js بالضبط) تشغِّل تحليلاً إحصائياً حتمياً على أصناف
// المخزون (backend/agents/inventoryPredictionAgent.js) عند الطلب فقط — لا
// تحليل تلقائي (نفس سبب القرار بـbillingAnomalyRoutes.js: الإحصاء يحتاج
// كامل سجلات الصرف التاريخية ليكون ذا معنى). ملاحظة الذكاء الاصطناعي
// الاختيارية لصنف واحد منفصلة تماماً عن التحليل نفسه وتحترم
// AiModeSelect/aiProviderRouter.js.
//
// ── تنبيه بيانات حقيقي (اقرأ قبل الاستغراب من نتيجة "بيانات غير كافية"
// لكل الأصناف) ────────────────────────────────────────────────────────────
// لا يوجد أي سجل صرف تاريخي مرتبط فعلياً بجدول المخزون بهذا النظام حالياً
// (راجع التعليق الكامل بأعلى inventoryPredictionAgent.js) — أسماء أصناف
// المخزون بيانات تجريبية مولَّدة، لا تتطابق مع أي طلب صرف حقيقي مسجَّل.
// النتيجة الحالية الصحيحة: كل الأصناف "بيانات غير كافية" — هذا سلوك مقصود
// (لا نتوقّع نتيجة وهمية من بيانات غير موجودة)، وسيبدأ التحليل بإعطاء
// نتائج حقيقية تلقائياً بمجرد ربط طلبات صرف فعلية بنفس اسم/رمز الصنف.
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import { FaSearch, FaRobot, FaExclamationTriangle } from 'react-icons/fa';
import PageBanner from '../components/PageBanner';
import AiModeSelect from '../components/AiModeSelect';

const BANNER_GRADIENT = 'linear-gradient(135deg, #78350f 0%, #b45309 100%)';

const TREND_CONFIG = {
  rising:  { color: '#ef4444', labelKey: 'inv_pred_trend_rising' },
  falling: { color: '#10b981', labelKey: 'inv_pred_trend_falling' },
  stable:  { color: '#6b7280', labelKey: 'inv_pred_trend_stable' },
};

// حرج/مراقبة/ضمن المعدل — نفس ألوان التنبيه المُعتمَدة أصلاً بصفحة المخزون
// (InventoryPage.js: #ef4444 نفاد، #f59e0b منخفض، #10b981 سليم).
function statusOf(item) {
  if (!item.available) return 'insufficient';
  if (item.daysUntilStockOut != null && item.daysUntilStockOut <= 7) return 'critical';
  if (item.reorderDate && new Date(item.reorderDate) <= new Date()) return 'warning';
  return 'ok';
}
const STATUS_CONFIG = {
  insufficient: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', labelKey: 'inv_pred_status_insufficient' },
  critical:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  labelKey: 'inv_pred_status_critical' },
  warning:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', labelKey: 'inv_pred_status_warning' },
  ok:           { color: '#10b981', bg: 'rgba(16,185,129,0.1)', labelKey: 'inv_pred_status_ok' },
};

export default function InventoryPredictionPage() {
  const { lang, showToast } = useApp();
  const tr = useT(lang);

  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [result, setResult] = useState(null);
  const [bufferDays, setBufferDays] = useState(14);

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('stockout');

  const [aiMode, setAiMode] = useState('online');
  useEffect(() => {
    api.get('/inventory-prediction/status').then(r => { if (r?.mode) setAiMode(r.mode); }).catch(() => {});
  }, []);

  const [notes, setNotes] = useState({});

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await api.post('/inventory-prediction/analyze', { bufferDays: Number(bufferDays) || 14 });
      setResult(res);
      setRan(true);
      setNotes({});
    } catch (err) {
      showToast(err.message || (lang === 'ar' ? 'فشل التحليل' : 'Analysis failed'), 'error');
    } finally {
      setRunning(false);
    }
  };

  const requestNote = async (item) => {
    setNotes(prev => ({ ...prev, [item.itemId]: { loading: true } }));
    try {
      const res = await api.post('/inventory-prediction/explain', { item, lang, mode: aiMode });
      if (res?.available) {
        setNotes(prev => ({ ...prev, [item.itemId]: { loading: false, note: res.note, provider: res.provider } }));
      } else {
        setNotes(prev => ({ ...prev, [item.itemId]: { loading: false, unavailable: true } }));
      }
    } catch (err) {
      setNotes(prev => ({ ...prev, [item.itemId]: { loading: false, unavailable: true } }));
    }
  };

  const predictions = result?.predictions || [];
  const filtered = predictions
    .filter(p => {
      if (statusFilter === 'withData') return p.available;
      if (statusFilter === 'insufficient') return !p.available;
      return true;
    })
    .filter(p => {
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      return (p.name || '').toLowerCase().includes(s) || (p.code || '').toLowerCase().includes(s);
    })
    .sort((a, b) => {
      if (sortBy === 'rate') return (b.ratePerWeek || 0) - (a.ratePerWeek || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      // الأقرب للنفاد أولاً — الأصناف بلا بيانات (daysUntilStockOut:null) تُدفَع للنهاية
      const ad = a.daysUntilStockOut ?? Infinity;
      const bd = b.daysUntilStockOut ?? Infinity;
      return ad - bd;
    });

  return (
    <div className="page-content">
      <PageBanner icon="📈" title={tr('inv_pred_title')} subtitle={tr('inv_pred_subtitle')} gradient={BANNER_GRADIENT} />

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            {result && (
              <>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tr('inv_pred_total_analyzed')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{result.totalItemsAnalyzed}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tr('inv_pred_items_with_data')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>{result.itemsWithData}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tr('inv_pred_items_insufficient')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#6b7280' }}>{result.itemsInsufficientData}</div>
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>{tr('inv_pred_buffer_label')}</label>
              <input type="number" min={0} value={bufferDays} onChange={e => setBufferDays(e.target.value)} className="form-control" style={{ width: 90 }} disabled={running} />
            </div>
            <button className="btn btn-primary" onClick={runAnalysis} disabled={running}>
              {running ? `⏳ ${tr('inv_pred_running')}` : (ran ? tr('inv_pred_rerun_btn') : tr('inv_pred_run_btn'))}
            </button>
          </div>
        </div>
      </div>

      {!ran ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📦</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('inv_pred_empty_state')}</p>
        </div>
      ) : (
        <>
          {result.itemsInsufficientData > 0 && (
            <div style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <FaExclamationTriangle style={{ marginTop: 2, flexShrink: 0 }} />
              {tr('inv_pred_insufficient_note')}
            </div>
          )}

          <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <FaSearch style={{ position: 'absolute', top: 12, insetInlineStart: 12, color: 'var(--text-secondary)', fontSize: 13 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tr('inv_pred_search_placeholder')}
                className="form-control"
                style={{ paddingInlineStart: 32 }}
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ maxWidth: 240 }}>
              <option value="all">{tr('inv_pred_filter_all')}</option>
              <option value="withData">{tr('inv_pred_filter_with_data')}</option>
              <option value="insufficient">{tr('inv_pred_filter_insufficient')}</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-control" style={{ maxWidth: 240 }}>
              <option value="stockout">{tr('inv_pred_sort_stockout')}</option>
              <option value="rate">{tr('inv_pred_sort_rate')}</option>
              <option value="name">{tr('inv_pred_sort_name')}</option>
            </select>
            <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>{tr('inv_pred_ai_provider_label')}</label>
              <AiModeSelect value={aiMode} onChange={setAiMode} lang={lang} style={{ maxWidth: 200 }} />
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table id="inventory-prediction-table" className="table">
                <thead><tr>
                  <th>{tr('inv_pred_col_code')}</th>
                  <th>{tr('inv_pred_col_name')}</th>
                  <th>{tr('inv_pred_col_current_qty')}</th>
                  <th>{tr('inv_pred_col_rate')}</th>
                  <th>{tr('inv_pred_col_stockout')}</th>
                  <th>{tr('inv_pred_col_reorder')}</th>
                  <th>{tr('inv_pred_col_status')}</th>
                  <th>{tr('inv_pred_col_actions')}</th>
                </tr></thead>
                <tbody>
                  {filtered.map(item => {
                    const status = statusOf(item);
                    const sCfg = STATUS_CONFIG[status];
                    const note = notes[item.itemId];
                    return (
                      <React.Fragment key={item.itemId}>
                        <tr style={{ background: status === 'critical' ? 'rgba(239,68,68,0.04)' : status === 'warning' ? 'rgba(245,158,11,0.04)' : undefined }}>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.code || '—'}</td>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</td>
                          <td style={{ fontWeight: 700 }}>{item.currentQty} {item.unit || ''}</td>
                          <td style={{ fontSize: 13 }}>
                            {item.available ? (
                              <span title={`${tr('inv_pred_data_points_label')}: ${item.dataPoints} — ${tr('inv_pred_span_days_label')}: ${item.spanDays}`} style={{ cursor: 'help' }}>
                                {item.ratePerWeek} {item.unit || ''}/{lang === 'ar' ? 'أسبوع' : 'wk'}
                                {' '}
                                <span style={{ color: TREND_CONFIG[item.trend]?.color, fontSize: 11 }}>{tr(TREND_CONFIG[item.trend]?.labelKey)}</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ fontSize: 12, fontWeight: status === 'critical' ? 700 : 400, color: status === 'critical' ? '#ef4444' : 'var(--text-secondary)' }}>
                            {item.stockOutDate || '—'}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.reorderDate || '—'}</td>
                          <td>
                            <span style={{ background: sCfg.bg, color: sCfg.color, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                              {tr(sCfg.labelKey)}
                            </span>
                          </td>
                          <td>
                            {item.available && (
                              <button
                                onClick={() => requestNote(item)}
                                disabled={note?.loading}
                                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                              >
                                {note?.loading ? `⏳ ${tr('inv_pred_note_loading')}` : tr('inv_pred_note_btn')}
                              </button>
                            )}
                          </td>
                        </tr>
                        {note && !note.loading && (
                          <tr>
                            <td colSpan={8} style={{ background: 'var(--bg-secondary)', padding: '10px 16px' }}>
                              {note.unavailable ? (
                                <span style={{ color: '#6b7280', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <FaExclamationTriangle /> {tr('inv_pred_note_unavailable')}
                                </span>
                              ) : (
                                <span style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <FaRobot style={{ marginTop: 2, color: '#7c3aed', flexShrink: 0 }} />
                                  {note.note}
                                </span>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
