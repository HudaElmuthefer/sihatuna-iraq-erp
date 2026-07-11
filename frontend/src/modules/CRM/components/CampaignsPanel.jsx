// frontend/src/modules/CRM/components/CampaignsPanel.jsx
import React, { useState } from 'react';

const L = (ar, en) => (localStorage.getItem('lang') === 'en' ? en : ar);

const CAMPAIGN_TYPES = ['vaccination', 'checkup_reminder', 'awareness', 'seasonal'];
const CAMPAIGN_TYPE_LABELS = {
  vaccination: L('حملة لقاحات', 'Vaccination'),
  checkup_reminder: L('تذكير بفحص دوري', 'Checkup Reminder'),
  awareness: L('توعية صحية عامة', 'General Awareness'),
  seasonal: L('حملة موسمية', 'Seasonal'),
};

export default function CampaignsPanel({ hospitalId, apiBaseUrl }) {
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', campaignType: 'awareness', targetSegment: 'all',
    channel: 'sms', messageAr: '', messageEn: '', scheduledAt: '',
  });
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const [buildResult, setBuildResult] = useState(null);
  const [saving, setSaving] = useState(false);

  async function createCampaign() {
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId, ...form }),
      });
      const campaign = await res.json();
      setLastCreatedId(campaign.id);
      setBuildResult(null);
    } finally {
      setSaving(false);
    }
  }

  async function buildTargets() {
    if (!lastCreatedId) return;
    const res = await fetch(`${apiBaseUrl}/campaigns/${lastCreatedId}/targets/build`, { method: 'POST' });
    setBuildResult(await res.json());
  }

  return (
    <div>
      <h3>{L('إنشاء حملة توعية جديدة', 'Create New Awareness Campaign')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 700 }}>
        <input
          placeholder={L('اسم الحملة (عربي)', 'Campaign Name (Arabic)')}
          value={form.nameAr}
          onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
        />
        <input
          placeholder={L('اسم الحملة (إنجليزي)', 'Campaign Name (English)')}
          value={form.nameEn}
          onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
        />
        <select value={form.campaignType} onChange={(e) => setForm({ ...form, campaignType: e.target.value })}>
          {CAMPAIGN_TYPES.map((t) => (
            <option key={t} value={t}>{CAMPAIGN_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">{L('بريد إلكتروني', 'Email')}</option>
        </select>
        <input
          placeholder={L('الفئة المستهدفة (segment_code أو all)', 'Target segment (segment_code or all)')}
          value={form.targetSegment}
          onChange={(e) => setForm({ ...form, targetSegment: e.target.value })}
        />
        <input
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
        />
        <textarea
          placeholder={L('نص الرسالة (عربي)', 'Message text (Arabic)')}
          value={form.messageAr}
          onChange={(e) => setForm({ ...form, messageAr: e.target.value })}
          style={{ gridColumn: '1 / -1', minHeight: 60 }}
        />
        <textarea
          placeholder={L('نص الرسالة (إنجليزي)', 'Message text (English)')}
          value={form.messageEn}
          onChange={(e) => setForm({ ...form, messageEn: e.target.value })}
          style={{ gridColumn: '1 / -1', minHeight: 60 }}
        />
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={createCampaign} disabled={saving}>
          {L('حفظ الحملة', 'Save Campaign')}
        </button>
        {lastCreatedId && (
          <button onClick={buildTargets}>
            {L('بناء قائمة المستفيدين', 'Build Target List')}
          </button>
        )}
      </div>

      {buildResult && (
        <p style={{ marginTop: 12, color: 'green' }}>
          {L(
            `تم بناء قائمة المستفيدين: ${buildResult.targetsCount} مريض`,
            `Target list built: ${buildResult.targetsCount} patients`
          )}
        </p>
      )}
    </div>
  );
}
