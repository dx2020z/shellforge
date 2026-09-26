'use client';
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import styles from './Field.module.css';

export interface OriginFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  /** 轮换的占位示例，每 3 秒换一句。 */
  examples: readonly string[];
  onDice?: () => void;
  maxLength?: number;
  /** 幽默回应（空输入、乱码）。 */
  reply?: string | null;
  busy?: boolean;
}

/** 工坊中央的大输入框：「写下你的造物」。 */
export function OriginField({ value, onChange, onSubmit, examples, onDice, maxLength = 60, reply, busy }: OriginFieldProps) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (value || examples.length < 2) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % examples.length), 3000);
    return () => clearInterval(timer);
  }, [value, examples.length]);
  const length = [...value].length;
  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        <span className="sr-only">写下你的造物</span>
        {!value && (
          <span className={styles.placeholder} aria-hidden>
            <span key={index} className={styles.placeholderText}>
              {examples[index]}
            </span>
          </span>
        )}
        <textarea
          className={styles.textarea}
          value={value}
          rows={2}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit?.();
            }
          }}
        />
        <span className={styles.count} data-over={length > maxLength || undefined}>
          <span className="num">{length}</span>/{maxLength}
        </span>
        <span className={styles.tools}>
          {onDice && (
            <Button variant="ghost" iconOnly onClick={onDice} aria-label="随机灵感" title="随机灵感">
              <Icon name="dice" size={22} />
            </Button>
          )}
          {onSubmit && (
            <Button variant="primary" iconOnly onClick={onSubmit} busy={busy} aria-label="开始锻造" disabled={busy}>
              <Icon name="forge" size={22} />
            </Button>
          )}
        </span>
      </label>
      {reply && (
        <p className={styles.reply} role="status">
          {reply}
        </p>
      )}
    </div>
  );
}
