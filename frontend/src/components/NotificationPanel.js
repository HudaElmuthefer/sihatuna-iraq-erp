/* eslint-disable no-unused-vars */
import React from 'react';
import { useApp } from '../contexts/AppContext';
import { useT } from '../translations';
import { FaBell, FaCalendarAlt, FaUser, FaChartBar, FaExclamationTriangle, FaCheckDouble } from 'react-icons/fa';

const icons = {
  appointment: <FaCalendarAlt />,
  patient: <FaUser />,
  report: <FaChartBar />,
  alert: <FaExclamationTriangle /> };

const colors = {
  appointment: '#1a6bab',
  patient: '#10b981',
  report: '#8b5cf6',
  alert: '#ef4444' };

export default function NotificationPanel({ onClose }) {
  const { notifications, markNotifRead, markAllNotifRead, lang } = useApp();
  const tr = useT(lang);

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 10px)',
      [lang === 'ar' ? 'left' : 'right']: 0,
      width: 340,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 999,
      overflow: 'hidden',
      animation: 'dropDown 0.2s ease' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
          <FaBell style={{ color: 'var(--primary)' }} />
          {tr('notifications_title')}
        </div>
        <button
          onClick={markAllNotifRead}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'inherit' }}
        >
          <FaCheckDouble />
          {tr('notifications_mark_all')}
        </button>
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {tr('notifications_empty')}
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => markNotifRead(n.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: n.read ? 'transparent' : 'rgba(26,107,171,0.05)',
                transition: 'var(--transition)' }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${colors[n.type]}20`,
                color: colors[n.type],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 15 }}>
                {icons[n.type]}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                  {n.message}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.time}</p>
              </div>
              {!n.read && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
