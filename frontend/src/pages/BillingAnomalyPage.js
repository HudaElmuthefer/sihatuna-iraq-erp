// frontend/src/pages/BillingAnomalyPage.js
//
// كشف القيم المتطرفة بالفوترة — صفحة مستقلة تماماً (نفس نمط
// DosageCheckPage.js/AllergyCheckPage.js/DrugInteractionsPage.js بالضبط)
// تشغِّل تحليلاً إحصائياً حتمياً على أوامر الشراء (backend/agents/
// billingAnomalyAgent.js) عند الطلب فقط — لا تحليل تلقائي عند إضافة سجل
// جديد (راجع تعليق POST /billing-anomaly/analyze بالباك إند لسبب هذا
// القرار: الإحصاء يحتاج كامل السجلات التاريخية ليكون ذا معنى، وليس سجلاً
// واحداً جديداً بمعزل عن الباقي). شرح الذكاء الاصطناعي الاختياري لعنصر واحد
// منفصل تماماً عن التحليل نفسه ويحترم AiModeSelect/aiProviderRouter.js.
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import { FaSearch, FaRobot, FaExclamationTriangle } from 'react-icons/fa';
import PageBanner from '../components/PageBanner';
import AiModeSelect from '../components/AiModeSelect';

const BANNER_GRADIENT = 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)';

const REASON_CONFIG = {
  vendor_price_outlier:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '📈', labelKey: 'billing_anomaly_reason_vendor' },
  category_price_deviation: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: '📊', labelKey: 'billing_anomaly_reason_category' },
  duplicate_invoice:        { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '♻️', labelKey: 'billing_anomaly_reason_duplicate' },
};

export default function BillingAnomalyPage() {
  const { lang, showToast } = useApp();
  const tr = useT(lang);

  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [result, setResult] = useState(null);

  const [reasonFilter, setReasonFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');

  // اختيار مزوّد الذكاء الاصطناعي لشرح عنصر واحد فقط — لا علاقة له بالتحليل
  // الإحصائي نفسه، المتاح دائماً بغض النظر عن هذا الاختيار.
  const [aiMode, setAiMode] = useState('online');
  useEffect(() => {
    api.get('/billing-anomaly/status').then(r => { if (r?.mode) setAiMode(r.mode); }).catch(() => {});
  }, []);

  // شروحات مولَّدة لكل سجل — مفتاحة بـrecordId، كل عنصر: { loading, explanation, unavailable }
  const [explanations, setExplanations] = useState({});

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await api.post('/billing-anomaly/analyze', {});
      setResult(res);
      setRan(true);
      setExplanations({});
    } catch (err) {
      showToast(err.message || (lang === 'ar' ? 'فشل التحليل' : 'Analysis failed'), 'error');
    } finally {
      setRunning(false);
    }
  };

  const explain = async (item) => {
    setExplanations(prev => ({ ...prev, [item.recordId]: { loading: true } }));
    try {
      const res = await api.post('/billing-anomaly/explain', { item, lang, mode: aiMode });
      if (res?.available) {
        setExplanations(prev => ({ ...prev, [item.recordId]: { loading: false, explanation: res.explanation, provider: res.provider } }));
      } else {
        setExplanations(prev => ({ ...prev, [item.recordId]: { loading: false, unavailable: true } }));
      }
    } catch (err) {
      setExplanations(prev => ({ ...prev, [item.recordId]: { loading: false, unavailable: true } }));
    }
  };

  const maxZScore = (item) => Math.max(0, ...item.reasons.filter(r => r.zScore != null).map(r => r.zScore));

  const flaggedRecords = result?.flaggedRecords || [];
  const filtered = flaggedRecords
    .filter(r => reasonFilter === 'all' || r.reasons.some(x => x.type === reasonFilter))
    .filter(r => {
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      return (r.supplier || '').toLowerCase().includes(s) || (r.poNo || '').toLowerCase().includes(s);
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount;
      if (sortBy === 'severity') return maxZScore(b) - maxZScore(a);
      return new Date(b.date) - new Date(a.date);
    });

  return (
    <div className="page-content">
      <PageBanner icon="🔍" title={tr('billing_anomaly_title')} subtitle={tr('billing_anomaly_subtitle')} gradient={BANNER_GRADIENT} />

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {result && (
              <>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tr('billing_anomaly_total_analyzed')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{result.totalRecordsAnalyzed}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tr('billing_anomaly_total_flagged')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: result.totalFlagged > 0 ? '#ef4444' : '#22c55e' }}>{result.totalFlagged}</div>
                </div>
              </>
            )}
          </div>
          <button className="btn btn-primary" onClick={runAnalysis} disabled={running}>
            {running ? `⏳ ${tr('billing_anomaly_running')}` : (ran ? tr('billing_anomaly_rerun_btn') : tr('billing_anomaly_run_btn'))}
          </button>
        </div>
      </div>

      {!ran ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('billing_anomaly_empty_state')}</p>
        </div>
      ) : flaggedRecords.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{tr('billing_anomaly_no_flags')}</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <FaSearch style={{ position: 'absolute', top: 12, insetInlineStart: 12, color: 'var(--text-secondary)', fontSize: 13 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tr('billing_anomaly_search_placeholder')}
                className="form-control"
                style={{ paddingInlineStart: 32 }}
              />
            </div>
            <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)} className="form-control" style={{ maxWidth: 240 }}>
              <option value="all">{tr('billing_anomaly_filter_all')}</option>
              {Object.entries(REASON_CONFIG).map(([type, cfg]) => (
                <option key={type} value={type}>{cfg.icon} {tr(cfg.labelKey)}</option>
              ))}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-control" style={{ maxWidth: 240 }}>
              <option value="date">{tr('billing_anomaly_sort_date')}</option>
              <option value="amount">{tr('billing_anomaly_sort_amount')}</option>
              <option value="severity">{tr('billing_anomaly_sort_severity')}</option>
            </select>
            <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>{tr('billing_anomaly_ai_provider_label')}</label>
              <AiModeSelect value={aiMode} onChange={setAiMode} lang={lang} style={{ maxWidth: 200 }} />
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table id="billing-anomaly-table" className="table">
                <thead><tr>
                  <th>{tr('billing_anomaly_col_po')}</th>
                  <th>{tr('billing_anomaly_col_supplier')}</th>
                  <th>{tr('billing_anomaly_col_category')}</th>
                  <th>{tr('billing_anomaly_col_amount')}</th>
                  <th>{tr('billing_anomaly_col_date')}</th>
                  <th>{tr('billing_anomaly_col_reasons')}</th>
                  <th>{tr('billing_anomaly_col_actions')}</th>
                </tr></thead>
                <tbody>
                  {filtered.map(item => {
                    const exp = explanations[item.recordId];
                    return (
                      <React.Fragment key={item.recordId}>
                        <tr>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.poNo || '—'}</td>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{item.supplier}</td>
                          <td style={{ fontSize: 13 }}>{item.category}</td>
                          <td style={{ fontWeight: 700, color: '#22c55e' }}>{Number(item.amount).toLocaleString('en-US')}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.date}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {item.reasons.map((r, i) => {
                                const cfg = REASON_CONFIG[r.type] || {};
                                return (
                                  <span key={i} title={
                                    r.type === 'duplicate_invoice'
                                      ? `${tr('billing_anomaly_matched_with')}: ${r.matchedPoNo || '—'} (${tr('billing_anomaly_days_apart')}: ${r.daysApart})`
                                      : `${tr('billing_anomaly_unit_price_label')}: ${r.unitPrice?.toLocaleString('en-US')} — ${tr('billing_anomaly_group_mean_label')}: ${r.groupMean?.toLocaleString('en-US')} — ${tr('billing_anomaly_zscore_label')}: ${r.zScore}σ`
                                  } style={{ background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help', width: 'fit-content' }}>
                                    {cfg.icon} {tr(cfg.labelKey)}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td>
                            <button
                              onClick={() => explain(item)}
                              disabled={exp?.loading}
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                            >
                              {exp?.loading ? `⏳ ${tr('billing_anomaly_explaining')}` : tr('billing_anomaly_explain_btn')}
                            </button>
                          </td>
                        </tr>
                        {exp && !exp.loading && (
                          <tr>
                            <td colSpan={7} style={{ background: 'var(--bg-secondary)', padding: '10px 16px' }}>
                              {exp.unavailable ? (
                                <span style={{ color: '#6b7280', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <FaExclamationTriangle /> {tr('billing_anomaly_explain_unavailable')}
                                </span>
                              ) : (
                                <span style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <FaRobot style={{ marginTop: 2, color: '#7c3aed', flexShrink: 0 }} />
                                  {exp.explanation}
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
