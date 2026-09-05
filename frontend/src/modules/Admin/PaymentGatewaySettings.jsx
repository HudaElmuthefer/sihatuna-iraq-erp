// frontend/src/modules/Admin/PaymentGatewaySettings.jsx
// شاشة الإدمن: تفعيل/تعطيل بوابات الدفع وإدخال بياناتها حسب المستشفى المنصب عليه النظام
// يتبع نفس نمط i18n المعتمد بالمشروع: L(ar, en)

import React, { useCallback, useEffect, useState } from 'react';

const L = (ar, en) => (localStorage.getItem('lang') === 'en' ? en : ar);
// عدّلها لتستخدم AppContext الفعلي بدل localStorage إذا يختلف النمط المعتمد

const PROVIDER_TYPE_LABELS = {
  cash: L('نقدي', 'Cash'),
  local_card: L('بطاقات محلية', 'Local Cards'),
  international: L('دولي', 'International'),
};

export default function PaymentGatewaySettings({ hospitalId, apiBaseUrl = '/api' }) {
  const [allProviders, setAllProviders] = useState([]);
  const [hospitalGateways, setHospitalGateways] = useState([]);
  const [editingProvider, setEditingProvider] = useState(null);
  const [credentialsDraft, setCredentialsDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [providersRes, gatewaysRes] = await Promise.all([
        fetch(`${apiBaseUrl}/admin/payment-providers`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/admin/hospitals/${hospitalId}/payment-gateways`).then((r) => r.json()),
      ]);
      setAllProviders(providersRes);
      setHospitalGateways(gatewaysRes);
    } catch (err) {
      console.error('فشل تحميل إعدادات الدفع:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, hospitalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function isActive(providerCode) {
    return hospitalGateways.find((g) => g.provider_code === providerCode)?.is_active;
  }

  function currentConfig(providerCode) {
    return hospitalGateways.find((g) => g.provider_code === providerCode);
  }

  async function toggleActive(provider) {
    const config = currentConfig(provider.code);
    setSaving(true);
    try {
      await fetch(`${apiBaseUrl}/admin/hospitals/${hospitalId}/payment-gateways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerCode: provider.code,
          isActive: !config?.is_active,
          isSandbox: config?.is_sandbox ?? true,
          displayOrder: config?.display_order ?? 0,
        }),
      });
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function saveCredentials(provider) {
    setSaving(true);
    try {
      await fetch(`${apiBaseUrl}/admin/hospitals/${hospitalId}/payment-gateways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerCode: provider.code,
          isActive: true,
          isSandbox: credentialsDraft.isSandbox ?? true,
          credentials: credentialsDraft,
          displayOrder: 0,
        }),
      });
      setEditingProvider(null);
      setCredentialsDraft({});
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>{L('جاري التحميل...', 'Loading...')}</div>;

  const grouped = allProviders.reduce((acc, p) => {
    acc[p.provider_type] = acc[p.provider_type] || [];
    acc[p.provider_type].push(p);
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, direction: L('rtl', 'ltr'), fontFamily: 'Cairo, sans-serif' }}>
      <h2 style={{ marginBottom: 8 }}>{L('إعدادات بوابات الدفع', 'Payment Gateway Settings')}</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>
        {L(
          'فعّل بوابة أو أكثر حسب اتفاقيات المستشفى مع مزودي الدفع. البيانات الحساسة تُخزّن مشفّرة.',
          'Enable one or more gateways per this hospital\'s agreements. Sensitive credentials are encrypted.'
        )}
      </p>

      {Object.entries(grouped).map(([type, providers]) => (
        <div key={type} style={{ marginBottom: 32 }}>
          <h3 style={{ borderBottom: '2px solid #d4af37', paddingBottom: 8 }}>
            {PROVIDER_TYPE_LABELS[type] || type}
          </h3>
          {providers.map((provider) => {
            const active = isActive(provider.code);
            return (
              <div
                key={provider.code}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  marginTop: 8,
                  background: active ? '#f6fff6' : '#fafafa',
                }}
              >
                <div>
                  <strong>{L(provider.name_ar, provider.name_en)}</strong>
                  {active && (
                    <span style={{ marginInlineStart: 8, color: 'green', fontSize: 12 }}>
                      ● {L('مفعّلة', 'Active')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {provider.requires_credentials && (
                    <button
                      onClick={() => {
                        setEditingProvider(provider);
                        setCredentialsDraft({});
                      }}
                      disabled={saving}
                    >
                      {L('بيانات الاعتماد', 'Credentials')}
                    </button>
                  )}
                  <button onClick={() => toggleActive(provider)} disabled={saving}>
                    {active ? L('تعطيل', 'Disable') : L('تفعيل', 'Enable')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {editingProvider && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ background: 'white', padding: 24, borderRadius: 12, minWidth: 360 }}>
            <h3>{L(editingProvider.name_ar, editingProvider.name_en)}</h3>
            <CredentialsForm
              providerCode={editingProvider.code}
              draft={credentialsDraft}
              setDraft={setCredentialsDraft}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingProvider(null)}>{L('إلغاء', 'Cancel')}</button>
              <button onClick={() => saveCredentials(editingProvider)} disabled={saving}>
                {L('حفظ', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// نموذج بيانات الاعتماد يختلف شكله حسب البوابة
function CredentialsForm({ providerCode, draft, setDraft }) {
  const fieldsByProvider = {
    zaincash: ['merchant_id', 'secret_key'],
    fastpay: ['merchant_id', 'api_key'],
    qicard: ['terminal_id', 'api_key'],
    bank_card: ['gateway_url', 'merchant_id', 'api_key'],
    paypal: ['client_id', 'client_secret'],
    western_union: [], // لا يحتاج بيانات اعتماد (يعمل يدوياً)
  };
  const fields = fieldsByProvider[providerCode] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      {fields.map((field) => (
        <input
          key={field}
          placeholder={field}
          type={field.includes('secret') || field.includes('key') ? 'password' : 'text'}
          value={draft[field] || ''}
          onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
      ))}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={draft.isSandbox ?? true}
          onChange={(e) => setDraft({ ...draft, isSandbox: e.target.checked })}
        />
        {L('وضع تجريبي (Sandbox)', 'Sandbox mode')}
      </label>
    </div>
  );
}
