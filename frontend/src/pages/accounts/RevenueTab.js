// frontend/src/pages/accounts/RevenueTab.js
//
// موحِّد إيرادات للقراءة فقط — يعرض كل مصدر دخل حقيقي دخل بالنظام (فواتير
// مرضى مدفوعة، صرفيات صيدلانية، ومعاملات "دخل" يدوية بتبويب "الحسابات
// العامة") بدون أي إدخال مكرَّر: كل صف هنا يعود لسجل حقيقي بموديول آخر —
// راجع backend/utils/revenueAggregation.js لتفاصيل كل مصدر. لا نموذج
// إضافة/تعديل هنا عمداً؛ لإضافة إيراد "أخرى" يدوي، أضفه بتبويب "الحسابات
// العامة" بفئة "إيراد" وسيظهر هنا تلقائياً بأول تحميل تالٍ.
import React, { useState, useEffect, useCallback } from 'react';
import { useT } from '../../translations';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../api';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import DateRangeFilter from '../../components/DateRangeFilter';

const SOURCE_STYLE = {
  patient:  { bg: '#dbeafe', color: '#1e40af', icon: '🧑‍⚕️' },
  pharmacy: { bg: '#dcfce7', color: '#166534', icon: '💊' },
  other:    { bg: '#fef3c7', color: '#92400e', icon: '📄' },
};

export default function RevenueTab() {
  const { lang, user, viewingHospitalId } = useApp();
  const tr = useT(lang);
  const L = (ar, en) => (lang === 'ar' ? ar : en);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [data, setData] = useState({ rows: [], totalRevenue: 0, bySource: { patient: 0, pharmacy: 0, other: 0 } });
  const [loading, setLoading] = useState(false);

  // إدمن عام بدون منشأة خاصة به يختار أي منشأة يعرض إيراداتها عبر نفس
  // فلتر "المنشأة المعروضة حالياً" (viewingHospitalId) المستخدَم ببقية
  // النظام — لا فائدة من تجميع إيرادات كل المنشآت برقم واحد مبهم، فنطلب
  // اختيار منشأة صراحة بدل ذلك.
  const needsHospitalPick = !user?.hospitalId && viewingHospitalId === 'all';

  const load = useCallback(() => {
    if (needsHospitalPick) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (!user?.hospitalId && viewingHospitalId !== 'all') params.set('hospitalId', viewingHospitalId);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    api.get(`/revenue?${params.toString()}`)
      .then(res => setData(res || { rows: [], totalRevenue: 0, bySource: {} }))
      .catch(() => setData({ rows: [], totalRevenue: 0, bySource: { patient: 0, pharmacy: 0, other: 0 } }))
      .finally(() => setLoading(false));
  }, [needsHospitalPick, user?.hospitalId, viewingHospitalId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = sourceFilter === 'all' ? data.rows : data.rows.filter(r => r.source === sourceFilter);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filteredRows, 50);

  if (needsHospitalPick) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
        {tr('rev_select_hospital')}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: tr('acc_total_revenue'), val: data.totalRevenue, color: '#1a6bab', icon: '💰' },
          { label: L('من المرضى', 'From Patients'), val: data.bySource.patient || 0, color: SOURCE_STYLE.patient.color, icon: SOURCE_STYLE.patient.icon },
          { label: L('من الصيدلية', 'From Pharmacy'), val: data.bySource.pharmacy || 0, color: SOURCE_STYLE.pharmacy.color, icon: SOURCE_STYLE.pharmacy.icon },
          { label: tr('rev_source_other'), val: data.bySource.other || 0, color: SOURCE_STYLE.other.color, icon: SOURCE_STYLE.other.icon },
        ].map(s => (
          <div key={s.label} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val.toLocaleString('en-US')} {L('د.ع', 'IQD')}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <DateRangeFilter lang={lang} from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { k: 'all', l: tr('rev_filter_all') },
            { k: 'patient', l: tr('rev_source_patient') },
            { k: 'pharmacy', l: tr('rev_source_pharmacy') },
            { k: 'other', l: tr('rev_source_other') },
          ].map(f => (
            <button key={f.k} onClick={() => setSourceFilter(f.k)} style={{ padding: '7px 14px', borderRadius: 20, border: `2px solid ${sourceFilter === f.k ? '#1a6bab' : 'var(--border)'}`, background: sourceFilter === f.k ? '#1a6bab' : 'transparent', color: sourceFilter === f.k ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr>
              <th>{tr('acc_date')}</th><th>{tr('rev_source')}</th><th>{tr('acc_ref')}</th><th>{tr('acc_amount')}</th>
            </tr></thead>
            <tbody>
              {pageItems.map(r => {
                const st = SOURCE_STYLE[r.source] || SOURCE_STYLE.other;
                return (
                  <tr key={r.id}>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.date}</td>
                    <td><span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{st.icon} {tr(`rev_source_${r.source}`)}</span></td>
                    <td style={{ fontFamily: 'monospace', color: '#1a6bab', fontSize: 12 }}>{r.ref}</td>
                    <td style={{ fontWeight: 700, color: '#22c55e' }}>+{r.amount.toLocaleString('en-US')}</td>
                  </tr>
                );
              })}
              {loading && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>{L('جارٍ التحميل...', 'Loading...')}</td></tr>
              )}
              {!loading && pageItems.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>{tr('rev_no_data')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>
    </div>
  );
}
