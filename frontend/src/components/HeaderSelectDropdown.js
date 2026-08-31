import React, { useEffect, useRef, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import HeaderFloatingPanel from './HeaderFloatingPanel';
import HolographicScrollHandle from './HolographicScrollHandle';

/*
 * Themed replacement for a native <select> in the top toolbar. A native
 * select's OPEN option list is rendered by the OS/browser itself and can't
 * be styled at all — that's why it looked out of place against the dark
 * glass UI (not a contrast bug, a fundamentally unthemeable element).
 *
 * Panel renders through HeaderFloatingPanel (a portal to document.body) so
 * it isn't clipped by .glass-header's own overflow:hidden.
 */
export default function HeaderSelectDropdown({ value, onChange, options, title, dark }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  // جانب الـrail: يمين تحت RTL يُظهر الشريط الأصلي على اليسار فعلياً (كما
  // لوحظ بصرياً)، فيُوضَع مقبض السحب هناك؛ LTR يعكسها. يُقرَأ من
  // document.documentElement.dir مباشرة (المصدر الموحّد بالمشروع بالفعل —
  // راجع AppContext.js) بدل افتراض جانب ثابت.
  const railSide = document.documentElement.dir === 'ltr' ? 'right' : 'left';

  const selected = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const closeAndFocus = () => {
    setOpen(false);
    if (triggerRef.current) triggerRef.current.focus();
  };

  const selectOption = (opt) => {
    onChange(opt.value);
    closeAndFocus();
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
      setHighlighted(Math.max(0, options.findIndex(o => o.value === value)));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handlePanelKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeAndFocus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(options.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[highlighted]) selectOption(options[highlighted]); }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen(o => !o); setHighlighted(Math.max(0, options.findIndex(o2 => o2.value === value))); }}
        onKeyDown={handleTriggerKeyDown}
        className={`header-dropdown-trigger ${dark ? 'header-dropdown-trigger-dark' : 'header-dropdown-trigger-light'} ${open ? 'header-dropdown-trigger-open' : ''}`}
      >
        <span className="header-dropdown-trigger-label">{selected?.icon} {selected?.label}</span>
        <FaChevronDown className="header-dropdown-chevron" />
      </button>

      <HeaderFloatingPanel anchorRef={triggerRef} open={open} align="end" style={{ minWidth: 210 }}>
        <div
          ref={panelRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          className="header-dropdown-panel hsh-hide-native-scrollbar"
          // العقدة الفعلية المُختبَرة (بند 2 بالطلب الحالي) — مُركَّبة عبر
          // Portal (راجع HeaderFloatingPanel.js)، وليست ابناً عادياً
          // لـ.glass-header/الـtrigger. الـnative scrollbar الخاص بها مخفي
          // بصرياً فقط (hsh-hide-native-scrollbar، بند 26-27: overflow يبقى
          // auto، wheel/keyboard/touchpad تعمل طبيعياً) — السحب أصبح عبر
          // HolographicScrollHandle أدناه حصراً، لا عبر محاولة تمييز مؤشر
          // الشريط الأصلي بعد الآن.
          data-scroll-cursor-aware="true"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                onMouseEnter={() => setHighlighted(i)}
                className={`header-dropdown-option ui-interactive-link ${isSelected ? 'header-dropdown-option-selected' : ''} ${highlighted === i ? 'header-dropdown-option-highlighted' : ''}`}
              >
                {opt.icon && <span className="header-dropdown-option-icon">{opt.icon}</span>}
                <span className="header-dropdown-option-text">{opt.label}</span>
              </div>
            );
          })}
        </div>
        <HolographicScrollHandle targetRef={panelRef} side={railSide} />
      </HeaderFloatingPanel>
    </>
  );
}
