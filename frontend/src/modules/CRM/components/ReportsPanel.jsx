// frontend/src/modules/CRM/components/ReportsPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';

const L = (ar, en) => (localStorage.getItem('lang') === 'en' ? en : ar);

export default function ReportsPanel({ hospitalId, apiBaseUrl }) {
  const [compliance, setCompliance] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c1, c2] = await Promise.all([
        fetch(`${apiBaseUrl}/reports/follow-up-compliance?hospitalId=${hospitalId}`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/reports/campaign-performance?hospitalId=${hospitalId}`).then((r) => r.json()),
      ]);
      setCompliance(c1);
      setCampaigns(c2);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, hospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p>{L('جاري التحميل...', 'Loading...')}</p>;

  return (
    <div>
      <h3>{L('نسبة الالتزام بالمتابعات', 'Follow-up Compliance Rate')}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee' }}>
            <th style={{ padding: 8 }}>{L('النوع', 'Type')}</th>
            <th style={{ padding: 8 }}>{L('مكتملة', 'Completed')}</th>
            <th style={{ padding: 8 }}>{L('فائتة', 'Missed')}</th>
            <th style={{ padding: 8 }}>{L('قيد الانتظار', 'Pending')}</th>
            <th style={{ padding: 8 }}>{L('نسبة الالتزام', 'Compliance %')}</th>
          </tr>
        </thead>
        <tbody>
          {compliance.map((row) => (
            <tr key={row.follow_up_type} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td style={{ padding: 8 }}>{row.follow_up_type}</td>
              <td style={{ padding: 8 }}>{row.completed_count}</td>
              <td style={{ padding: 8 }}>{row.missed_count}</td>
              <td style={{ padding: 8 }}>{row.pending_count}</td>
              <td style={{ padding: 8, fontWeight: 'bold' }}>{row.compliance_rate_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{L('أداء حملات التوعية', 'Campaign Performance')}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee' }}>
            <th style={{ padding: 8 }}>{L('الحملة', 'Campaign')}</th>
            <th style={{ padding: 8 }}>{L('إجمالي المستهدفين', 'Total Targets')}</th>
            <th style={{ padding: 8 }}>{L('تم التوصيل', 'Delivered')}</th>
            <th style={{ padding: 8 }}>{L('استجابوا', 'Responded')}</th>
            <th style={{ padding: 8 }}>{L('نسبة الاستجابة', 'Response %')}</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((row) => (
            <tr key={row.campaign_id} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td style={{ padding: 8 }}>{L(row.name_ar, row.name_en)}</td>
              <td style={{ padding: 8 }}>{row.total_targets}</td>
              <td style={{ padding: 8 }}>{row.delivered}</td>
              <td style={{ padding: 8 }}>{row.responded}</td>
              <td style={{ padding: 8, fontWeight: 'bold' }}>{row.response_rate_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
