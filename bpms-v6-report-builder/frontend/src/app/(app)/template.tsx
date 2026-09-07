'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Page transition (UI redesign Phase 2).
 * Subtle MD3-style fade + rise on every (app) route change; skipped
 * entirely when the user prefers reduced motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
