import { useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/**
 * ScrollReveal — Animates children into view when they enter the viewport.
 * Inspired by ReactBits ScrollStack but much lighter (no Lenis/GSAP).
 */
export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up', // 'up' | 'down' | 'left' | 'right'
  distance = 40,
  duration = 0.6,
  once = true,
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-50px 0px' });

  const directionMap = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  };

  const { x, y } = directionMap[direction] || directionMap.up;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x, y, scale: 0.95 }}
      animate={isInView ? { opacity: 1, x: 0, y: 0, scale: 1 } : {}}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer — Wraps children and staggers their entrance.
 */
export function StaggerContainer({ children, className = '', staggerDelay = 0.1 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-30px 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
