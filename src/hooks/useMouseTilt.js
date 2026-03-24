import { useState, useEffect } from 'react';

/**
 * Custom hook for 3D mouse-tracking tilt effect.
 * Attach the returned ref to any element to give it an "antigravity" feel.
 */
export default function useMouseTilt(ref, intensity = 20) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const handleMouseMove = (e) => {
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      setTilt({
        x: -(y / rect.height) * intensity,
        y: (x / rect.width) * intensity,
      });
    };

    const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

    const el = ref.current;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [ref, intensity]);

  return tilt;
}
