// frontend/src/pages/accounts/ProfitSharingTab.js
//
// تقسيم الحصص: قائمة مستفيدين حرة غير محدودة العدد (اسم + نوع وصفي حر بلا
// قيد + نسبة مئوية)، إضافة/حذف بأي وقت. المستحقات (summary) تُحسَب بالكامل
// من الخادم بكل تحميل — لا تخزين وسيط — فأي إيراد جديد أو تعديل/إضافة/حذف
// مستفيد ينعكس فوراً بأول تحميل تالٍ. إدارة المستفيدين (إضافة/حذف) حصراً
// للإدمن (مسؤول مستشفى أو مدير نظام عام)، راجع backend/routes/
// profitSharingRoutes.js — غير الإدمن يرى القائمة والمستحقات فقط.
import React, { useState, useEffect, useCallback } from 'react';
import { useT } from '../../translations';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../api';
import DateRangeFilter from '../../components/DateRangeFilter';

export default function ProfitSharingTab() {
  const { lang, user, showToast, confirmDialog, viewingHospitalId } = useApp();
  const tr = useT(lang);
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const isAdmin = user?.role === 'admin';

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState({ totalRevenue: 0, totalPercentage: 0, beneficiaries: [] });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', percentage: '' });
  const [saving, setSaving] = useState(false);

  const needsHospitalPick = !user?.hospitalId && viewingHospitalId === 'all';

  const load = useCallback(() => {
    if (needsHospitalPick) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (!user?.hospitalId && viewingHospitalId !== 'all') params.set('hospitalId', viewingHospitalId);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    api.get(`/profit-sharing/summary?${params.toString()}`)
      .then(res => setSummary(res || { totalRevenue: 0, totalPercentage: 0, beneficiaries: [] }))
      .catch(() => setSummary({ totalRevenue: 0, totalPercentage: 0, beneficiaries: [] }))
      .finally(() => setLoading(false));
  }, [needsHospitalPick, user?.hospitalId, viewingHospitalId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const addBeneficiary = async () => {
    if (!form.name || !form.percentage || Number(form.percentage) <= 0) {
      showToast(tr('msg_required'), 'error');
      return;
    }
    setSaving(true);
    try {
      const body = { name: form.name, type: form.type || null, percentage: Number(form.percentage) };
      if (!user?.hospitalId && viewingHospitalId !== 'all') body.hospitalId = viewingHospitalId;
      await api.post('/profit-sharing/beneficiaries', body);
      setForm({ name: '', type: '', percentage: '' });
      showToast(tr('msg_added'), 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteBeneficiary = async (id) => {
    if (!(await confirmDialog(tr('ps_delete_confirm')))) return;
    try {
      await api.delete(`/profit-sharing/beneficiaries/${id}`);
      showToast(tr('msg_deleted'), 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (needsHospitalPick) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
        {tr('rev_select_hospital')}
      </div>
    );
  }

  const unallocated = Math.max(0, 100 - summary.totalPercentage);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <DateRangeFilter lang={lang} from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} label={L('فترة الحساب:', 'Period:')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{tr('acc_total_revenue')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a6bab' }}>{summary.totalRevenue.toLocaleString('en-US')} {L('د.ع', 'IQD')}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{tr('ps_total_percentage')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: summary.totalPercentage > 100 ? '#ef4444' : '#22c55e' }}>{summary.totalPercentage}%</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{tr('ps_unallocated')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: unallocated > 0 ? '#f59e0b' : '#6b7280' }}>{unallocated}%</div>
        </div>
      </div>

      {summary.totalPercentage < 100 && summary.beneficiaries.length > 0 && (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ {tr('ps_warning_under_100')}
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>{tr('ps_add_beneficiary')}</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label className="form-label">{tr('ps_name')}</label>
              <input className="form-control" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label className="form-label">{tr('ps_type')}</label>
              <input className="form-control" placeholder={tr('ps_type_placeholder')} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} />
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <label className="form-label">{tr('ps_percentage')}</label>
              <input type="number" min="0.01" max="100" step="0.01" className="form-control" placeholder={tr('ps_percentage_placeholder')} value={form.percentage} onChange={e => setForm(p => ({ ...p, percentage: e.target.value }))} />
            </div>
            <button onClick={addBeneficiary} disabled={saving} className="btn btn-primary">+ {tr('ps_add_beneficiary')}</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr>
              <th>{tr('ps_name')}</th><th>{tr('ps_type')}</th><th>{tr('ps_percentage')}</th><th>{tr('ps_due_amount')}</th>
              {isAdmin && <th>{tr('field_actions')}</th>}
            </tr></thead>
            <tbody>
              {summary.beneficiaries.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{b.type || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{b.percentage}%</td>
                  <td style={{ fontWeight: 700, color: '#22c55e' }}>{b.due.toLocaleString('en-US')} {L('د.ع', 'IQD')}</td>
                  {isAdmin && (
                    <td><button onClick={() => deleteBeneficiary(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>🗑️</button></td>
                  )}
                </tr>
              ))}
              {loading && (
                <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>{L('جارٍ التحميل...', 'Loading...')}</td></tr>
              )}
              {!loading && summary.beneficiaries.length === 0 && (
                <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>{tr('ps_no_beneficiaries')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
