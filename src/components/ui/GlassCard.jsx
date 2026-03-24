/**
 * GlassCard — A premium frosted-glass card with customizable blur and tint.
 * Inspired by ReactBits Fluid Glass but pure CSS (zero JS overhead).
 */
export default function GlassCard({
  children,
  className = '',
  blur = 12,
  opacity = 0.06,
  borderOpacity = 0.12,
  tintColor = '255, 255, 255',
  hoverScale = false,
  style = {},
}) {
  return (
    <div
      className={`glass-card ${className}`}
      style={{
        background: `rgba(${tintColor}, ${opacity})`,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: `1px solid rgba(${tintColor}, ${borderOpacity})`,
        borderRadius: '16px',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease',
        ...(hoverScale ? {} : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverScale) {
          e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(99, 102, 241, 0.15)';
          e.currentTarget.style.background = `rgba(${tintColor}, ${opacity * 1.5})`;
        }
      }}
      onMouseLeave={(e) => {
        if (hoverScale) {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.background = `rgba(${tintColor}, ${opacity})`;
        }
      }}
    >
      {children}
    </div>
  );
}
