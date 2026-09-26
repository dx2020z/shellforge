'use client';
import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Battle.module.css';

export type IntentKind = 'strike' | 'sweep' | 'break' | 'charge' | 'fortify' | 'heal';
export const INTENT_META: Record<IntentKind, { name: string; icon: IconName; color: string }> = {
  strike: { name: '攻击', icon: 'intent-strike', color: '#f2a36b' },
  sweep: { name: '横扫', icon: 'intent-sweep', color: '#f07a6a' },
  break: { name: '破甲', icon: 'intent-break', color: '#ee9a45' },
  charge: { name: '蓄力', icon: 'intent-charge', color: '#ffd98a' },
  fortify: { name: '固守', icon: 'intent-fortify', color: '#8fe3f2' },
  heal: { name: '回复', icon: 'intent-heal', color: '#b6ee9f' },
};

export interface IntentBubbleProps {
  kind: IntentKind;
  /** 一句话说明，如「铜尾扫过整片擂台」。 */
  line: string;
  /** 预计伤害，0 或不传则不显示。 */
  damage?: number;
  /** 覆盖默认的意图名（例如「蓄满一击」「发愣」）。 */
  title?: string;
}

export function IntentBubble({ kind, line, damage, title }: IntentBubbleProps) {
  const meta = INTENT_META[kind];
  return (
    <div className={styles.intent} style={{ '--c': meta.color } as CSSProperties} role="status" aria-live="polite">
      <span className={styles.intentIcon}>
        <Icon name={meta.icon} size={22} />
      </span>
      <span>
        <span className={styles.intentName}>
          {title ?? meta.name}
          {damage ? <small className="num">{damage} 伤害</small> : null}
        </span>
        <span className={styles.intentLine}>{line}</span>
      </span>
    </div>
  );
}

/** 小号意图徽章：侦察情报、意图预告条用。 */
export function IntentPip({ kind, title, dim }: { kind: IntentKind; title?: string; dim?: boolean }) {
  const meta = INTENT_META[kind];
  return (
    <span className={styles.intentPip} data-dim={dim ? '' : undefined} style={{ '--c': meta.color } as CSSProperties} title={title ?? meta.name}>
      <i className={styles.pipIcon}>
        <Icon name={meta.icon} size={15} />
      </i>
      <small>{title ?? meta.name}</small>
    </span>
  );
}

export type ActionKind = 'attack' | 'guard' | 'move' | 'burst';
const ACTION_ICON: Record<ActionKind, IconName> = { attack: 'attack', guard: 'guard', move: 'move', burst: 'burst' };

export interface ActionCardProps {
  kind: ActionKind;
  title: string;
  /** 你将受到的伤害。 */
  taken: number;
  /** 守卫将受到的伤害。 */
  dealt: number;
  /** 一句补充：目标部位、完美应对效果等。 */
  note?: string;
  perfect?: boolean;
  hotkey?: number;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

const tone = (value: number, bad: boolean) => (value === 0 ? 'zero' : bad ? 'bad' : 'good');

/** 按钮上直接写明后果：「你将受到 X，守卫受到 Y」。 */
export function ActionCard({ kind, title, taken, dealt, note, perfect, hotkey, selected, disabled, onSelect }: ActionCardProps) {
  return (
    <button
      type="button"
      className={[styles.card, styles[kind]].join(' ')}
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={onSelect}
      aria-label={`${title}：你将受到 ${taken} 伤害，守卫受到 ${dealt} 伤害${note ? '，' + note : ''}`}
    >
      <span className={styles.cardGlow} aria-hidden />
      <span className={styles.cardHead}>
        <span className={styles.medal}>
          <Icon name={ACTION_ICON[kind]} size={20} />
        </span>
        <span className={styles.cardTitle}>{title}</span>
        {hotkey !== undefined && <span className={styles.hotkey}>{hotkey}</span>}
      </span>
      {perfect && <span className={styles.perfect}>完美应对</span>}
      <span className={styles.outcome}>
        <span className={styles.stat} data-tone={tone(taken, true)}>
          <small>承受</small>
          <b className="num">{taken ? `−${taken}` : '0'}</b>
        </span>
        <span className={styles.stat} data-tone={tone(dealt, false)}>
          <small>造成</small>
          <b className="num">{dealt}</b>
        </span>
      </span>
      {note && <span className={styles.note}>{note}</span>}
    </button>
  );
}

export interface GuardPartTagProps {
  glyph: '首' | '躯' | '足';
  name: string;
  hp: number;
  max: number;
  targeted?: boolean;
  onSelect?: () => void;
}

export function GuardPartTag({ glyph, name, hp, max, targeted, onSelect }: GuardPartTagProps) {
  const pips = Math.min(8, Math.ceil(max / 3));
  const on = Math.ceil((hp / max) * pips);
  const broken = hp <= 0;
  return (
    <button type="button" className={styles.part} data-target={targeted || undefined} data-broken={broken || undefined} disabled={broken} onClick={onSelect} aria-pressed={targeted} aria-label={`${name}，生命 ${hp} / ${max}${broken ? '，已击碎' : ''}`}>
      <span className={styles.partGlyph}>
        <span>{glyph}</span>
      </span>
      <span className={styles.partName}>{name}</span>
      <span className={styles.pips} aria-hidden>
        {Array.from({ length: pips }, (_, i) => (
          <i key={i} className={styles.pip} data-on={i < on || undefined} />
        ))}
      </span>
      <span className={styles.partHp}>
        {hp}/{max}
      </span>
    </button>
  );
}
