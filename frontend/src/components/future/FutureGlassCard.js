import React from 'react';
import { useApp } from '../../contexts/AppContext';

/*
 * وحدة تحكّم زجاجية مصغَّرة (mini glass control unit، بند 16 صراحةً) —
 * تمثّل صفحة/قسماً واحداً من صفحات النظام داخل FutureHub. تُستخدَم أيضاً
 * كعنصر "المستنسخ" العائم أثناء حركة السحب نحو المركز (variant="focus").
 */
export default function FutureGlassCard({
  page, count, onClick, panelRef, variant = 'normal', dimmed, hidden, isStatic,
}) {
  const { lang } = useApp();
  const label = lang === 'ar' ? page.label : (page.labelEn || page.label);

  const classes = [
    'fgc',
    `fgc-${variant}`,
    dimmed ? 'fgc-dimmed' : '',
    hidden ? 'fgc-hidden' : '',
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <span className="fgc-edge" aria-hidden="true" />
      <span className="fgc-icon">{page.icon}</span>
      <span className="fgc-title">{label}</span>
      {count !== undefined && count !== null && <span className="fgc-count">{count}</span>}
    </>
  );

  if (isStatic || !onClick) {
    return <div ref={panelRef} className={classes}>{content}</div>;
  }

  return (
    <button type="button" ref={panelRef} className={classes} onClick={onClick}>
      {content}
    </button>
  );
}
