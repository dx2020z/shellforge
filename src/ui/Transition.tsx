'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * 场景转场：潮水从下往上漫过，再退去露出新场景（600–1000ms）。
 * 系统开启「减少动态效果」时改为 200ms 淡入淡出。
 */
export function SceneTransition({ sceneKey, children }: { sceneKey: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={sceneKey}
        style={{ position: 'relative' }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, filter: 'blur(6px)' }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay: 0.15 } }}
        exit={reduce ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, y: -16, filter: 'blur(6px)', transition: { duration: 0.35, ease: [0.65, 0, 0.35, 1] } }}
      >
        {!reduce && (
          <motion.div
            aria-hidden
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(159,240,216,0.0) 0%, rgba(21,64,58,0.95) 12%, #0a1f1a 100%)',
              transformOrigin: '50% 100%',
            }}
            initial={{ scaleY: 1 }}
            animate={{ scaleY: 0, transition: { duration: 0.7, ease: [0.65, 0, 0.35, 1] } }}
          />
        )}
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** 一句旁白：逐字浮现，适合潮汐泉、结算、加载状态。 */
export function Narration({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduce = useReducedMotion();
  const chars = [...text];
  return (
    <span>
      <span className="sr-only">{text}</span>
      {chars.map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { delay: delay + i * 0.035, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/** 场景切换时，一道潮水从下往上漫过屏幕，带着一串气泡。 */
export function TideWipe({ id }: { id: number }) {
  const reduce = useReducedMotion();
  if (!id || reduce) return null;
  return (
    <div key={id} className="sf-tide-wipe" aria-hidden>
      <svg viewBox="0 0 100 20" preserveAspectRatio="none">
        <path d="M0 20V8c8-6 17-6 25 0s17 6 25 0 17-6 25 0 17 6 25 0v12Z" />
      </svg>
      <div className="sf-tide-body" />
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ transform: 'scaleY(-1)' }}>
        <path d="M0 20V8c8-6 17-6 25 0s17 6 25 0 17-6 25 0 17 6 25 0v12Z" />
      </svg>
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 61) % 100}%`, width: 6 + (i % 4) * 5, height: 6 + (i % 4) * 5, animationDelay: `${(i % 5) * 40}ms` }} />
      ))}
    </div>
  );
}
