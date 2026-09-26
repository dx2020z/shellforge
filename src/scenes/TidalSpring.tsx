'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '@/ui/Icon';
import { Narration } from '@/ui/Transition';
import { KeywordChip } from '@/ui/Keyword';
import { SLOT_NAMES } from '@/domain/keywords';
import type { GuardDef } from '@/domain/guards';
import type { PartRecord } from '@/domain/types';
import { HEAL_RATIO, type SpringChoice } from '@/game/logic';
import styles from './Spring.module.css';

export interface TidalSpringProps {
  line: string;
  hp: number;
  maxHp: number;
  parts: PartRecord[];
  nextGuard: GuardDef;
  scouted: boolean;
  onChoose: (choice: SpringChoice) => void;
}

type Pending = 'heal' | 'temper' | 'scout' | null;

export function TidalSpring({ line, hp, maxHp, parts, nextGuard, scouted, onChoose }: TidalSpringProps) {
  const [open, setOpen] = useState<Pending>(null);
  const [done, setDone] = useState<string | null>(null);
  const heal = Math.max(0, Math.min(maxHp - hp, Math.ceil(maxHp * HEAL_RATIO)));
  const temperable = parts.filter(p => p.level < 3);

  const choose = (choice: SpringChoice, message: string) => {
    if (done) return;
    setDone(message);
    setTimeout(() => onChoose(choice), 1300);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.pool} aria-hidden>
        <span className={styles.ring} />
        <span className={styles.ring} style={{ animationDelay: '-1.3s' }} />
        <span className={styles.ring} style={{ animationDelay: '-2.6s' }} />
        <span className={styles.glow} />
      </div>

      <section className={styles.panel}>
        <span className={styles.eyebrow}>
          <Icon name="spring" size={14} /> 潮汐泉 · 只能取一样
        </span>
        <h1 className={styles.title}>歇一口气</h1>
        <p className={styles.line}>
          <Narration text={line} />
        </p>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.p key="done" className={styles.done} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} role="status">
              {done}
            </motion.p>
          ) : open === 'temper' ? (
            <motion.div key="temper" className={styles.parts} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className={styles.hint}>把哪一件浸进泉水？印记 +1，生命上限 +2。</p>
              {parts.map(p => (
                <button key={p.id} type="button" className={styles.part} disabled={p.level >= 3} onClick={() => choose({ kind: 'temper', partId: p.id }, `「${p.name}」上多了一道印记。`)}>
                  <small>{SLOT_NAMES[p.slot]}</small>
                  <b>{p.name}</b>
                  <span className={styles.marks} aria-label={`印记 ${p.level} / 3`}>
                    {[0, 1, 2].map(i => (
                      <i key={i} data-on={i < p.level ? '' : undefined} data-next={i === p.level ? '' : undefined} />
                    ))}
                  </span>
                  <span className={styles.kws}>
                    {p.trait.keywords.map(k => (
                      <KeywordChip key={k} keyword={k} size="sm" />
                    ))}
                  </span>
                </button>
              ))}
              <button type="button" className={styles.back} onClick={() => setOpen(null)}>
                ← 换一个
              </button>
            </motion.div>
          ) : (
            <motion.div key="choices" className={styles.choices} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <button type="button" className={styles.choice} data-kind="heal" disabled={heal <= 0} onClick={() => choose({ kind: 'heal' }, `伤口合上了。生命 +${heal}。`)}>
                <span className={styles.choiceIcon}>
                  <Icon name="intent-heal" size={26} />
                </span>
                <b>喝一口泉水</b>
                <span>
                  生命 <em className="num">{hp}</em> → <em className="num">{hp + heal}</em>
                </span>
                {heal <= 0 && <small>它已经很精神了</small>}
              </button>
              <button type="button" className={styles.choice} data-kind="temper" disabled={!temperable.length} onClick={() => setOpen('temper')}>
                <span className={styles.choiceIcon}>
                  <Icon name="forge" size={26} />
                </span>
                <b>淬一件部件</b>
                <span>印记 +1 · 生命上限 +2</span>
                {!temperable.length && <small>三件都满了</small>}
              </button>
              <button type="button" className={styles.choice} data-kind="scout" disabled={scouted} onClick={() => choose({ kind: 'scout' }, `水流带回了${nextGuard.name}的脚步声。`)}>
                <span className={styles.choiceIcon}>
                  <Icon name="scout" size={26} />
                </span>
                <b>听一听前面</b>
                <span>看清{nextGuard.name}的全部出招顺序</span>
                {scouted && <small>已经听过了</small>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
