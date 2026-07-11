import React from 'react';
import { useApp } from '../contexts/AppContext';
import { FaCheckCircle, FaTimesCircle, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';

export default function ToastContainer() {
  const { toasts } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <FaCheckCircle />}
          {t.type === 'error' && <FaTimesCircle />}
          {t.type === 'info' && <FaInfoCircle />}
          {t.type === 'warning' && <FaExclamationTriangle />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
