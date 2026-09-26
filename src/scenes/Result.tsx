'use client';
import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { KeywordChip } from '@/ui/Keyword';
import { SLOT_NAMES, type Slot } from '@/domain/keywords';
import type { GuardDef } from '@/domain/guards';
import type { BattleState } from '@/domain/battle';
import type { CreatureRecord, PartRecord } from '@/domain/types';
import { MODEL_POOL, GUARD_SETS } from '@/domain/model-pool';
import styles from './Result.module.css';

export interface WinProps {
  guard: GuardDef;
  battle: BattleState;
  firstTime: boolean;
  nextGuard: GuardDef | null;
  onContinue: (pick: Slot | null, equip: boolean, dive: boolean) => void;
}

export function WinResult({ guard, battle, firstTime, nextGuard, onContinue }: WinProps) {
  const [pick, setPick] = useState<Slot | null>(battle.captured.find(s => s !== 'body') ?? battle.captured[0] ?? null);
  const [equip, setEquip] = useState(true);
  const set = GUARD_SETS[guard.modelSet];
  return (
    <div className={styles.wrap}>
      <div className={styles.dim} />
      <section className={styles.card}>
        <span className={styles.eyebrow}>胜利 · 第 {battle.turn - 1} 回合</span>
        <h1 className={styles.title}>击败了{guard.name}</h1>
        <p className={styles.quote}>
          <small>{guard.name}的谢幕</small>「{guard.farewell}」
        </p>
        {firstTime && (
          <div className={styles.section}>
            <h3>解锁传说</h3>
            <p className={styles.lore}>{guard.lore}</p>
          </div>
        )}
        {battle.captured.length > 0 && (
          <div className={styles.section}>
            <h3>缴获一件部件的蓝图</h3>
            <div className={styles.choices}>
              {battle.captured.map(slot => {
                const pool = MODEL_POOL.find(p => p.set === set && p.slot === slot);
                return (
                  <button key={slot} type="button" className={styles.choice} aria-pressed={pick === slot} onClick={() => setPick(slot)}>
                    <small>{SLOT_NAMES[slot]}</small>
                    <b>{guard.parts[slot].name}</b>
                    {pool && <KeywordChip keyword={pool.keyword} size="sm" />}
                  </button>
                );
              })}
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={equip} onChange={e => setEquip(e.target.checked)} />
              立刻换到我的造物身上
            </label>
          </div>
        )}
        <div className={styles.actions}>
          {nextGuard && (
            <Button variant="primary" size="lg" onClick={() => onContinue(pick, equip, true)}>
              继续下潜 · {nextGuard.name}
              <Icon name="arrow" size={18} />
            </Button>
          )}
          <Button variant={nextGuard ? 'secondary' : 'primary'} onClick={() => onContinue(pick, equip, false)}>
            <Icon name="retreat" size={16} />
            带着战利品回港
          </Button>
        </div>
      </section>
    </div>
  );
}

export interface LossProps {
  creature: CreatureRecord;
  parts: PartRecord[];
  guard: { name: string; victory: string };
  /** 不传承，直接离开：空出名册里的位置。 */
  onLeave?: () => void;
  epitaph: string | null;
  mistakes: string[];
  onInherit: (partId: string) => void;
  onCard?: () => void;
}

export function LossResult({ creature, parts, guard, epitaph, mistakes, onInherit, onLeave, onCard }: LossProps) {
  const [pick, setPick] = useState(parts[0]?.id ?? '');
  return (
    <div className={styles.wrap}>
      <div className={styles.dim} data-kind="loss" />
      <section className={styles.card} data-kind="loss">
        <span className={styles.eyebrow}>
          标本 No.{String(creature.specimen).padStart(4, '0')} · 第 {creature.generation} 代
        </span>
        <h1 className={styles.title}>{creature.name}长眠了</h1>
        <p className={styles.epitaph}>{epitaph ?? '海水正在为它写下最后一句话……'}</p>
        <span className={styles.stamp}>已长眠</span>
        {mistakes.length > 0 && (
          <div className={styles.section}>
            <h3>它倒下的原因</h3>
            <ul className={styles.mistakes}>
              {mistakes.map(m => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <div className={styles.section}>
          <h3>选一件部件，留给下一代</h3>
          <div className={styles.choices}>
            {parts.map(p => (
              <button key={p.id} type="button" className={styles.choice} aria-pressed={pick === p.id} onClick={() => setPick(p.id)}>
                <small>
                  {SLOT_NAMES[p.slot]}
                  {p.level > 0 ? ` · 印记 ${p.level}` : ''}
                </small>
                <b>{p.name}</b>
                <span>{p.trait.keywords.join(' · ')}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" size="lg" disabled={!pick} onClick={() => onInherit(pick)}>
            传承给下一代
          </Button>
          {onLeave && (
            <Button variant="ghost" onClick={onLeave}>
              不传承，让它安静地离开
            </Button>
          )}
          {onCard && (
            <Button variant="secondary" disabled={!epitaph} onClick={onCard}>
              <Icon name="card" size={16} />
              留一张它的造物卡
            </Button>
          )}
        </div>
        <p className={styles.lore}>{guard.victory}</p>
        <p className={styles.lore}>它会留在档案库里，也会变成海沟里的一位守卫——以后的造物可能会遇到它。</p>
      </section>
    </div>
  );
}

/* ---------------- 写字对决的胜利 ---------------- */

export interface DuelWinProps {
  guard: { name: string; farewell: string; lore: string };
  /** 下一位守卫的名字。 */
  nextName: string;
  riddles: { id: string; text: string; solved: string }[];
  /** 本场解开的谜语。 */
  solvedNow: string[];
  /** 以前就解开过的谜语。 */
  known: string[];
  turns: number;
  firstTime: boolean;
  /** 出战造物身上的三件部件：赢了可以挑一件长出印记。 */
  parts: PartRecord[];
  markMax: number;
  onAgain: (grow: string | null) => void;
  onHome: (grow: string | null) => void;
  onCard: (grow: string | null) => void;
}

export function DuelWin({ guard, nextName, riddles, solvedNow, known, turns, firstTime, parts, markMax, onAgain, onHome, onCard }: DuelWinProps) {
  const growable = parts.filter(p => p.level < markMax);
  const [grow, setGrow] = useState<string | null>(growable[0]?.id ?? null);
  const all = new Set([...known, ...solvedNow]);
  const left = riddles.filter(r => !all.has(r.id));
  return (
    <div className={styles.wrap}>
      <div className={styles.dim} />
      <section className={styles.card}>
        <span className={styles.eyebrow}>胜利 · 用了 {turns} 句话</span>
        <h1 className={styles.title}>击败了{guard.name}</h1>
        <p className={styles.quote}>
          <small>{guard.name}的谢幕</small>「{guard.farewell}」
        </p>
        <div className={styles.section}>
          <h3>
            谜语 {all.size}/{riddles.length}
          </h3>
          <ul className={styles.riddleList}>
            {riddles.map(r => (
              <li key={r.id} data-on={all.has(r.id) || undefined} data-new={solvedNow.includes(r.id) && !known.includes(r.id) ? '' : undefined}>
                <b>「{r.text}」</b>
                <span>{all.has(r.id) ? r.solved : `还没解开。下次再遇到它${left.length ? '，换一句话试试' : ''}。`}</span>
              </li>
            ))}
          </ul>
        </div>
        {growable.length > 0 && (
          <div className={styles.section}>
            <h3>它变强了：选一件部件长出一道印记</h3>
            <p className={styles.lore}>每道印记：生命上限 +2，这件部件的话效果 +1。印记也会跟着传承留给下一代。</p>
            <div className={styles.choices}>
              {parts.map(p => (
                <button key={p.id} type="button" className={styles.choice} aria-pressed={grow === p.id} disabled={p.level >= markMax} onClick={() => setGrow(p.id)}>
                  <small>
                    {SLOT_NAMES[p.slot]} · 印记 {p.level}
                    {grow === p.id ? ` → ${p.level + 1}` : ''}
                  </small>
                  <b>{p.name}</b>
                  <span>{p.trait.keywords.join(' · ')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {firstTime && (
          <div className={styles.section}>
            <h3>解锁传说</h3>
            <p className={styles.lore}>{guard.lore}</p>
          </div>
        )}
        <div className={styles.actions}>
          <Button variant="primary" size="lg" onClick={() => onAgain(grow)}>
            下一位：{nextName}
            <Icon name="arrow" size={18} />
          </Button>
          <Button variant="secondary" onClick={() => onCard(grow)}>
            <Icon name="card" size={16} />
            造物卡
          </Button>
          <Button variant="ghost" onClick={() => onHome(grow)}>
            回港口
          </Button>
        </div>
      </section>
    </div>
  );
}
