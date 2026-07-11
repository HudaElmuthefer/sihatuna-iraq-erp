// frontend/src/modules/CRM/CRMDashboard.jsx
// موديول CRM الشامل: تواصل + متابعات + حملات توعية + تقارير
// يتبع نفس نمط i18n المعتمد بالمشروع

import React, { useState } from 'react';
import FollowUpsPanel from './components/FollowUpsPanel';
import CampaignsPanel from './components/CampaignsPanel';
import ReportsPanel from './components/ReportsPanel';

const L = (ar, en) => (localStorage.getItem('lang') === 'en' ? en : ar);

const TABS = [
  { key: 'followups', label: L('المتابعات والتذكيرات', 'Follow-ups & Reminders') },
  { key: 'campaigns', label: L('حملات التوعية', 'Awareness Campaigns') },
  { key: 'reports', label: L('التقارير', 'Reports') },
];

export default function CRMDashboard({ hospitalId, apiBaseUrl = '/api/crm' }) {
  const [activeTab, setActiveTab] = useState('followups');

  return (
    <div style={{ padding: 24, direction: L('rtl', 'ltr'), fontFamily: 'Cairo, sans-serif' }}>
      <h2 style={{ marginBottom: 16 }}>{L('إدارة علاقات المرضى (CRM)', 'Patient CRM')}</h2>

      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #eee', marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid #d4af37' : '3px solid transparent',
              background: 'transparent',
              fontWeight: activeTab === tab.key ? 'bold' : 'normal',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'followups' && <FollowUpsPanel hospitalId={hospitalId} apiBaseUrl={apiBaseUrl} />}
      {activeTab === 'campaigns' && <CampaignsPanel hospitalId={hospitalId} apiBaseUrl={apiBaseUrl} />}
      {activeTab === 'reports' && <ReportsPanel hospitalId={hospitalId} apiBaseUrl={apiBaseUrl} />}
    </div>
  );
}
