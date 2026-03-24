import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * PillNav — Animated navigation with a sliding pill indicator.
 * Inspired by ReactBits PillNav but uses framer-motion (no GSAP).
 */
export default function PillNav({ items, activeIndex = 0, onChange, className = '' }) {
  const [active, setActive] = useState(activeIndex);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const navRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    updatePill(active);
  }, [active]);

  useEffect(() => {
    const handleResize = () => updatePill(active);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [active]);

  const updatePill = (index) => {
    const el = itemRefs.current[index];
    if (!el) return;
    const navRect = navRef.current?.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (!navRect) return;
    setPillStyle({
      left: elRect.left - navRect.left,
      width: elRect.width,
    });
  };

  const handleClick = (index) => {
    setActive(index);
    onChange?.(index);
  };

  return (
    <nav
      ref={navRef}
      className={`pill-nav-container ${className}`}
      style={{
        display: 'inline-flex',
        position: 'relative',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '9999px',
        padding: '4px',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Animated pill indicator */}
      <motion.div
        layout
        className="pill-nav-indicator"
        style={{
          position: 'absolute',
          top: '4px',
          height: 'calc(100% - 8px)',
          borderRadius: '9999px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
          zIndex: 0,
        }}
        animate={{
          left: pillStyle.left,
          width: pillStyle.width,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
      />

      {items.map((item, i) => (
        <button
          key={item.label}
          ref={(el) => { itemRefs.current[i] = el; }}
          onClick={() => handleClick(i)}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 18px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: active === i ? '#fff' : 'rgba(255,255,255,0.6)',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'color 0.2s ease',
            whiteSpace: 'nowrap',
            borderRadius: '9999px',
            fontFamily: 'inherit',
          }}
        >
          {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
