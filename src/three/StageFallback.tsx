'use client';
import styles from './StageFallback.module.css';
import type { StageMode } from './Stage';

interface StageFallbackProps {
  mode: StageMode;
  creatureName?: string;
  error: Error;
  onRetry: () => void;
}

function CreatureMark({ x, scale = 1, color }: { x: number; scale?: number; color: string }) {
  return (
    <g transform={`translate(${x} 0) scale(${scale})`} fill={color} stroke="#f1e8d2" strokeOpacity=".8" strokeWidth="2">
      <path d="M-48 205 Q-52 165 -24 143 L-22 104 Q-20 82 0 82 Q20 82 22 104 L24 143 Q52 165 48 205 L30 220 L26 270 L43 321 L19 321 L0 278 L-19 321 L-43 321 L-26 270 L-30 220 Z" />
      <path d="M-31 97 Q-38 53 -10 36 Q0 29 10 36 Q38 53 31 97 Q22 114 0 114 Q-22 114 -31 97 Z" />
      <circle cx="-11" cy="77" r="4" fill="#07130f" stroke="none" />
      <circle cx="11" cy="77" r="4" fill="#07130f" stroke="none" />
      <path d="M-12 101 Q0 108 12 101" fill="none" stroke="#07130f" strokeWidth="3" />
    </g>
  );
}

export function StageFallback({ mode, creatureName, error, onRetry }: StageFallbackProps) {
  const contextLost = error.message.includes('图形资源') || error.message.toLowerCase().includes('context');
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <svg className={styles.creatures} viewBox="0 0 600 380" aria-hidden="true">
        <ellipse cx="300" cy="343" rx="190" ry="20" fill="none" stroke="#9ff0d8" strokeOpacity=".42" strokeWidth="2" />
        {mode === 'battle' ? (
          <>
            <CreatureMark x={205} scale={0.76} color="#58a98f" />
            <CreatureMark x={400} scale={0.86} color="#d09856" />
          </>
        ) : <CreatureMark x={320} scale={1.06} color="#58a98f" />}
      </svg>
      <div className={styles.message}>
        <span className={styles.kicker}>3D 舞台暂不可用</span>
        <strong>{creatureName || '造物'}</strong>
        <p>{contextLost ? '浏览器回收了图形资源。' : '浏览器暂时无法启动图形渲染。'}游戏和战斗操作仍可继续。</p>
        <button type="button" onClick={onRetry}>重试 3D 画面</button>
      </div>
    </div>
  );
}
