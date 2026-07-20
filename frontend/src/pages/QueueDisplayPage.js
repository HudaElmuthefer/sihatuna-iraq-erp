// frontend/src/pages/QueueDisplayPage.js
//
// Public queue display screen — meant to run full-screen on a TV/monitor in
// a waiting area. No login required (a wall-mounted screen can't log in),
// and deliberately shows only ticket numbers and departments — never
// patient names — since anyone walking past a public screen can read it.
//
// Open this page's URL directly on the display device's browser, e.g.:
//   http://<server-ip>:3000/queue-display
// Most browsers/TVs support pressing F11 for true full-screen.
import React, { useState, useEffect, useCallback } from 'react';
import { SERVER_BASE_URL } from '../api';

const REFRESH_MS = 4000;

const DEPT_COLORS = ['#2a9d8f', '#e76f51', '#457b9d', '#e9c46a', '#8338ec', '#118ab2'];

export default function QueueDisplayPage() {
  const [tickets, setTickets] = useState([]);
  const [now, setNow] = useState(new Date());
  const [flash, setFlash] = useState(null); // department name that just got a new "called" ticket, for a brief highlight

  const fetchTickets = useCallback(() => {
    fetch(`${SERVER_BASE_URL}/api/queue-display`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setTickets((prev) => {
          // Detect a ticket that just transitioned to "called" since the last poll,
          // to briefly highlight that department's card (draws the eye on a TV
          // screen when a new number is announced, the way real queue displays do)
          const prevCalledIds = new Set(prev.filter((t) => t.status === 'called').map((t) => t.id));
          const newlyCalled = data.find((t) => t.status === 'called' && !prevCalledIds.has(t.id));
          if (newlyCalled) {
            setFlash(newlyCalled.department);
            setTimeout(() => setFlash(null), 3000);
          }
          return data;
        });
      })
      .catch(() => {}); // silent — a TV screen shouldn't show error toasts, it just retries next tick
  }, []);

  useEffect(() => {
    fetchTickets();
    const dataTimer = setInterval(fetchTickets, REFRESH_MS);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, [fetchTickets]);

  const departments = [...new Set(tickets.map((t) => t.department).filter(Boolean))];

  const forDept = (dept) => tickets.filter((t) => t.department === dept);
  const currentlyServing = (dept) => forDept(dept).find((t) => t.status === 'called');
  const waitingNext = (dept) => forDept(dept).filter((t) => t.status === 'waiting').slice(0, 4);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.logoDot} />
          صحّتنا العراق — شاشة الطابور
        </div>
        <div style={styles.clock}>
          {now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </header>

      {departments.length === 0 ? (
        <div style={styles.empty}>لا يوجد طابور نشط حالياً</div>
      ) : (
        <div style={styles.grid}>
          {departments.map((dept, i) => {
            const serving = currentlyServing(dept);
            const upNext = waitingNext(dept);
            const isFlashing = flash === dept;
            const color = DEPT_COLORS[i % DEPT_COLORS.length];
            return (
              <div
                key={dept}
                style={{
                  ...styles.card,
                  borderTopColor: color,
                  boxShadow: isFlashing ? `0 0 0 4px ${color}, 0 12px 40px rgba(0,0,0,0.5)` : styles.card.boxShadow,
                  transform: isFlashing ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <div style={{ ...styles.deptName, color }}>{dept}</div>

                <div style={styles.servingBlock}>
                  <div style={styles.servingLabel}>الرقم الحالي</div>
                  <div style={{ ...styles.servingNumber, color: serving ? color : '#3a4a5c' }}>
                    {serving ? serving.ticketNo : '—'}
                  </div>
                </div>

                {upNext.length > 0 && (
                  <div style={styles.nextRow}>
                    <span style={styles.nextLabel}>التالي:</span>
                    {upNext.map((t) => (
                      <span key={t.id} style={styles.nextChip}>{t.ticketNo}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100vw',
    background: 'radial-gradient(ellipse at top, #163a5c 0%, #0a1e33 70%)',
    color: '#eaf2fa',
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    padding: '28px 40px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    direction: 'rtl',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 36,
    paddingBottom: 20,
    borderBottom: '1px solid rgba(255,255,255,0.12)',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 0.5,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logoDot: {
    width: 14, height: 14, borderRadius: '50%',
    background: '#2a9d8f',
    boxShadow: '0 0 12px 3px rgba(42,157,143,0.7)',
  },
  clock: {
    fontSize: 34,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: 1,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    fontSize: 28,
    color: '#6b7f93',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 28,
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTop: '5px solid',
    borderRadius: 18,
    padding: '26px 28px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    transition: 'transform 0.4s ease, box-shadow 0.4s ease',
  },
  deptName: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 18,
  },
  servingBlock: {
    textAlign: 'center',
    padding: '18px 0 14px',
  },
  servingLabel: {
    fontSize: 15,
    color: '#8fa4b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  servingNumber: {
    fontSize: 88,
    fontWeight: 800,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  nextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    flexWrap: 'wrap',
  },
  nextLabel: {
    fontSize: 14,
    color: '#8fa4b8',
  },
  nextChip: {
    background: 'rgba(255,255,255,0.08)',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 16,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
};
