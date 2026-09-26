import type { CSSProperties } from 'react';
import styles from './DeepSea.module.css';

/** 固定的伪随机，保证服务端与客户端渲染一致。 */
function seeded(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const MOTES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(seeded(i) * 100).toFixed(2)}%`,
  size: `${(1.5 + seeded(i + 40) * 3).toFixed(1)}px`,
  alpha: (0.25 + seeded(i + 80) * 0.5).toFixed(2),
  dur: `${(18 + seeded(i + 120) * 22).toFixed(1)}s`,
  delay: `${(-seeded(i + 160) * 40).toFixed(1)}s`,
  drift: `${((seeded(i + 200) - 0.5) * 60).toFixed(0)}px`,
}));

export function DeepSea({ danger = false }: { danger?: boolean }) {
  return (
    <div className={[styles.sea, danger && styles.danger].filter(Boolean).join(' ')} aria-hidden>
      <div className={styles.rays} />
      {MOTES.map((m, i) => (
        <span
          key={i}
          className={styles.mote}
          style={{ left: m.left, '--size': m.size, '--alpha': m.alpha, '--dur': m.dur, '--delay': m.delay, '--drift': m.drift } as CSSProperties}
        />
      ))}
      <div className={styles.vignette} />
    </div>
  );
}
