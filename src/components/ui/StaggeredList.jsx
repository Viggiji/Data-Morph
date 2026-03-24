import { motion, AnimatePresence } from 'framer-motion';

/**
 * StaggeredList — Sidebar items that animate in with staggered timing.
 * Inspired by ReactBits Staggered Menu.
 */
export default function StaggeredList({ items, renderItem, keyExtractor, className = '' }) {
  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item)}
            layout
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{
              duration: 0.35,
              delay: index * 0.05,
              ease: [0.25, 0.46, 0.45, 0.94],
              layout: { type: 'spring', stiffness: 300, damping: 30 },
            }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
