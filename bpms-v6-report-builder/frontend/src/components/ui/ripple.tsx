'use client';

import { useCallback, useRef, useState, type MouseEvent } from 'react';

interface RippleDot {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * MD3 ripple — attach to any interactive element.
 * The host element needs `md-ripple-host` (clips the ripple) and the
 * returned element must be rendered inside it.
 *
 * ```tsx
 * const { addRipple, rippleElement } = useRipple();
 * <button className="md-ripple-host" onPointerDown={addRipple}>
 *   {children}
 *   {rippleElement}
 * </button>
 * ```
 */
export function useRipple() {
  const [ripples, setRipples] = useState<RippleDot[]>([]);
  const seq = useRef(0);

  const addRipple = useCallback((e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const id = ++seq.current;
    setRipples((r) => [...r.slice(-4), { id, x, y, size }]);
    window.setTimeout(() => {
      setRipples((r) => r.filter((rp) => rp.id !== id));
    }, 600);
  }, []);

  const rippleElement = (
    <>
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="md-ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </>
  );

  return { addRipple, rippleElement };
}
