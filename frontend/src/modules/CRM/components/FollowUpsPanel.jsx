// frontend/src/modules/CRM/components/FollowUpsPanel.jsx
import React, { useEffect, useState } from 'react';

const L = (ar, en) => (localStorage.getItem('lang') === 'en' ? en : ar);

const STATUS_LABELS = {
  pending: { ar: 'قيد الانتظار', en: 'Pending', color: '#f0ad4e' },
  completed: { ar: 'مكتملة', en: 'Completed', color: '#5cb85c' },
  missed: { ar: 'فائتة', en: 'Missed', color: '#d9534f' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', color: '#999' },
};

const TYPE_LABELS = {
  appointment: L('موعد', 'Appointment'),
  checkup: L('فحص دوري', 'Checkup'),
  vaccination: L('لقاح', 'Vaccination'),
  lab_result: L('نتيجة مختبر', 'Lab Result'),
  medication: L('دواء', 'Medication'),
  other: L('أخرى', 'Other'),
};

export default function FollowUpsPanel({ hospitalId, apiBaseUrl }) {
  const [followUps, setFollowUps] = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [hospitalId, filterStatus]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ hospitalId, ...(filterStatus !== 'all' && { status: filterStatus }) });
      const res = await fetch(`${apiBaseUrl}/follow-ups?${params}`);
      setFollowUps(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function markStatus(id, status) {
    await fetch(`${apiBaseUrl}/follow-ups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {['pending', 'completed', 'missed', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: filterStatus === s ? '2px solid #d4af37' : '1px solid #ddd',
              background: filterStatus === s ? '#fff8e1' : 'white',
              cursor: 'pointer',
            }}
          >
            {s === 'all' ? L('الكل', 'All') : L(STATUS_LABELS[s].ar, STATUS_LABELS[s].en)}
          </button>
        ))}
      </div>

      {loading ? (
        <p>{L('جاري التحميل...', 'Loading...')}</p>
      ) : followUps.length === 0 ? (
        <p style={{ color: '#888' }}>{L('لا توجد متابعات', 'No follow-ups found')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: L('right', 'left'), borderBottom: '2px solid #eee' }}>
              <th style={{ padding: 8 }}>{L('المريض', 'Patient')}</th>
              <th style={{ padding: 8 }}>{L('النوع', 'Type')}</th>
              <th style={{ padding: 8 }}>{L('العنوان', 'Title')}</th>
              <th style={{ padding: 8 }}>{L('تاريخ الاستحقاق', 'Due Date')}</th>
              <th style={{ padding: 8 }}>{L('الحالة', 'Status')}</th>
              <th style={{ padding: 8 }}>{L('إجراء', 'Action')}</th>
            </tr>
          </thead>
          <tbody>
            {followUps.map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8 }}>
                  {f.patient_name}
                  <div style={{ fontSize: 12, color: '#888' }}>{f.patient_phone}</div>
                </td>
                <td style={{ padding: 8 }}>{TYPE_LABELS[f.follow_up_type] || f.follow_up_type}</td>
                <td style={{ padding: 8 }}>{f.title}</td>
                <td style={{ padding: 8 }}>
                  {new Date(f.due_date).toLocaleDateString(L('ar-IQ', 'en-US'))}
                </td>
                <td style={{ padding: 8 }}>
                  <span style={{ color: STATUS_LABELS[f.status]?.color, fontWeight: 'bold' }}>
                    {L(STATUS_LABELS[f.status]?.ar, STATUS_LABELS[f.status]?.en)}
                  </span>
                </td>
                <td style={{ padding: 8 }}>
                  {f.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => markStatus(f.id, 'completed')}>
                        {L('تمت', 'Done')}
                      </button>
                      <button onClick={() => markStatus(f.id, 'missed')}>
                        {L('فائتة', 'Missed')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
