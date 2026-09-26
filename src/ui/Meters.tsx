'use client';
import { useId, type CSSProperties } from 'react';
import { Icon } from './Icon';
import styles from './Meters.module.css';

const SHELL_PATH = 'M2 16.5C2 9 6 2.5 11 2.5S20 9 20 16.5c-2.8 1.6-5.8 2.2-9 2.2s-6.2-.6-9-2.2Z';
const RIBS = 'M11 3.2v15M7 5l1.2 13.3M15 5l-1.2 13.3';
export const HP_PER_SHELL = 5;

export interface ShellHealthProps {
  hp: number;
  max: number;
  /** 预览即将受到的伤害：用斜线标出会被打掉的部分。 */
  preview?: number;
  side?: 'player' | 'enemy';
  label?: string;
}

/** 生命值画成一段段贝壳：每 5 点一片。低于 30% 时心跳、变红。 */
export function ShellHealth({ hp, max, preview = 0, side = 'player', label }: ShellHealthProps) {
  const id = useId().replace(/:/g, '');
  const count = Math.max(1, Math.ceil(max / HP_PER_SHELL));
  const low = side === 'player' && hp > 0 && hp / max < 0.3;
  const after = Math.max(0, hp - preview);
  return (
    <div className={[styles.health, side === 'enemy' && styles.enemy, low && styles.low].filter(Boolean).join(' ')} role="meter" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={max} aria-label={label ?? '生命'}>
      <div className={styles.healthRow}>
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <pattern id="sf-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="rgb(240 122 106 / 0.35)" />
              <rect width="2" height="4" fill="rgb(240 122 106 / 0.9)" />
            </pattern>
          </defs>
        </svg>
        <div className={styles.shells}>
          {Array.from({ length: count }, (_, i) => {
            const lo = i * HP_PER_SHELL;
            const cap = Math.min(HP_PER_SHELL, max - lo);
            const fill = Math.max(0, Math.min(1, (after - lo) / cap));
            const lost = Math.max(0, Math.min(1, (hp - lo) / cap)) - fill;
            return (
              <svg key={i} className={styles.shell} viewBox="0 0 22 20" aria-hidden>
                <clipPath id={`${id}-${i}`}>
                  <path d={SHELL_PATH} />
                </clipPath>
                <path d={SHELL_PATH} className={styles.shellBase} />
                <g clipPath={`url(#${id}-${i})`}>
                  <rect className={styles.shellFill} x="0" y="0" height="20" width={22 * fill} />
                  {lost > 0 && <rect className={styles.shellPreview} x={22 * fill} y="0" height="20" width={22 * lost} />}
                </g>
                <path d={RIBS} className={styles.shellRib} />
              </svg>
            );
          })}
        </div>
        <span className={styles.hpText}>
          <b className="num">{hp}</b>
          <span className="num"> / {max}</span>
        </span>
      </div>
    </div>
  );
}

export interface PearlMeterProps {
  value: number;
  max?: number;
  label?: string;
}

/** 潮能：三颗珍珠。攒满时一起闪光，提示可以释放原话爆发。 */
export function PearlMeter({ value, max = 3, label = '潮能' }: PearlMeterProps) {
  return (
    <div className={styles.pearls} data-ready={value >= max || undefined} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={styles.pearl} data-full={i < value || undefined} />
      ))}
      <span className={styles.pearlLabel}>{label}</span>
    </div>
  );
}

export interface TideGaugeProps {
  level: number;
  max: number;
  height?: number;
}

/** 潮位：擂台的水位每回合上涨一格，涨满后守卫狂暴。 */
export function TideGauge({ level, max, height = 180 }: TideGaugeProps) {
  const enraged = level >= max;
  return (
    <div
      className={[styles.tide, enraged && styles.enraged].filter(Boolean).join(' ')}
      style={{ '--level': Math.min(1, level / max), height } as CSSProperties}
      role="meter"
      aria-valuenow={level}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={enraged ? '潮位已满，守卫狂暴' : `潮位 ${level} / ${max}`}
    >
      <div className={styles.water} />
      {Array.from({ length: max - 1 }, (_, i) => (
        <span key={i} className={styles.tick} style={{ bottom: `${((i + 1) / max) * 100}%` }} />
      ))}
      <Icon name="intent-charge" size={16} className={styles.rage} />
    </div>
  );
}
