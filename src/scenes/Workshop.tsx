'use client';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { OriginField } from '@/ui/OriginField';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { KeywordChip } from '@/ui/Keyword';
import { INSPIRATIONS, randomInspiration } from '@/domain/inspirations';
import { judgeInput, liveMatches, SLOT_NAMES } from '@/domain/keywords';
import type { CreatureRecord, PartRecord } from '@/domain/types';
import type { GuardDef } from '@/domain/guards';
import { useAnchor } from '@/game/useAnchor';
import { useSnapshot } from '@/ui/useSnapshot';
import { poke, spin } from '@/three/interaction';
import * as sfx from '@/audio/synth';
import styles from './scenes.module.css';

export interface WorkshopProps {
  creature: CreatureRecord | null;
  parts: PartRecord[];
  nextGuard: { name: string; riddle?: string };
  /** 名册：最多 5 只活着的造物。 */
  roster?: RosterEntry[];
  rosterMax?: number;
  onSelect?: (id: string) => void;
  /** 名册满了就不能再写新的。 */
  canForge?: boolean;
  /** 现在造物用的是什么：DeepSeek 理解原话、Tripo 生成专属外形。 */
  ai?: { deepseek: boolean; tripo: boolean; offline: boolean };
  /** 下一位守卫的三道谜语：写造物之前就能看到，解谜从写字开始。 */
  riddles?: { text: string; solved: boolean }[];
  heir: PartRecord | null;
  busy: boolean;
  onForge: (origin: string) => void;
  onDive: () => void;
  onNewCreature: () => void;
  onCard?: () => void;
  /** 不满意 Tripo 生成的外形时，重新生成一次。 */
  onRegenerate?: () => void;
  serverReply: string | null;
}

export function Workshop({ creature, parts, nextGuard, roster = [], rosterMax = 5, onSelect, canForge = true, ai, riddles, heir, busy, onForge, onDive, onNewCreature, onCard, onRegenerate, serverReply }: WorkshopProps) {
  const [text, setText] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [writing, setWriting] = useState(!creature);
  const tag = useRef<HTMLDivElement>(null);
  useAnchor(tag, 'player:top', { offsetY: -8 });

  const submit = () => {
    const verdict = judgeInput(text);
    if (!verdict.ok) {
      setReply(verdict.reply);
      return;
    }
    setReply(null);
    onForge(verdict.text);
  };

  const keywords = parts.flatMap(p => [...p.trait.keywords, ...(p.trait.cost ? [p.trait.cost] : [])]);

  return (
    <div className={styles.layer}>
      <SpinPad />
      <div ref={tag} className={styles.specimenTag} style={{ left: 0, top: 0 }}>
        {creature ? (
          <>
            <span>标本 No.{String(creature.specimen).padStart(4, '0')} · 第 {creature.generation} 代</span>
            <b>{creature.name}</b>
          </>
        ) : (
          <>
            <span>海底留下的一只标本</span>
            <small>写一句话，就能造出你自己的</small>
          </>
        )}
      </div>

      <motion.section className={styles.workshop} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
        <RosterStrip
          roster={roster}
          max={rosterMax}
          activeId={writing ? null : creature?.id ?? null}
          onSelect={id => {
            setWriting(false);
            onSelect?.(id);
          }}
          onNew={canForge ? () => setWriting(true) : undefined}
        />
        {creature && !writing ? (
          <>
            <span className={styles.eyebrow}>港口 · 它在等你下令</span>
            <h1 className={styles.headline}>{creature.name}</h1>
            <p className={styles.lead}>{creature.lore}</p>
            <CreatureStats creature={creature} parts={parts} />
            <div className={styles.row}>
              {keywords.map(k => (
                <KeywordChip key={k} keyword={k} size="sm" />
              ))}
            </div>
            <RiddleBox title={`下一位 · ${nextGuard.name}的谜语`} riddles={riddles ?? [{ text: nextGuard.riddle ?? '', solved: false }]} />
            <div className={styles.row}>
              <Button variant="primary" size="lg" onClick={onDive}>
                带它下潜
                <Icon name="arrow" size={18} />
              </Button>
              {onCard && (
                <Button variant="secondary" onClick={onCard}>
                  <Icon name="card" size={18} />
                  造物卡
                </Button>
              )}
              {onRegenerate && (
                <Button variant="ghost" onClick={onRegenerate}>
                  换一副外形
                </Button>
              )}
              {canForge && (
                <Button variant="ghost" onClick={() => { setWriting(true); onNewCreature(); }}>
                  写一只新的
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <span className={styles.eyebrow}>造物之海 · 工坊</span>
            <h1 className={styles.headline}>写下你的造物</h1>
            <p className={styles.lead}>一句话就够了。你写下的每个字，都会变成它的样子和本领。</p>
            {ai && <AiLine ai={ai} />}
            {heir && (
              <div className={styles.heir}>
                <Icon name="shell" size={20} />
                <span>
                  上一代留下了 <b>{heir.name}</b>，它会长在新造物身上。
                </span>
              </div>
            )}
            {!canForge && <p className={styles.full}>名册满了：最多同时养 {rosterMax} 只活着的造物。先带一只去冒险吧。</p>}
            <OriginField
              value={text}
              onChange={value => {
                setText(value);
                setReply(null);
              }}
              onSubmit={submit}
              onDice={() => setText(randomInspiration(text))}
              examples={INSPIRATIONS}
              reply={reply ?? serverReply}
              busy={busy}
            />
            <LiveTraits text={text} />
            <RiddleBox title={`${nextGuard.name}的三道谜语 · 写一只能解开它们的造物`} riddles={riddles ?? [{ text: nextGuard.riddle ?? '', solved: false }]} />
          </>
        )}
      </motion.section>
    </div>
  );
}

/** 边写边看：命中的词立刻变成一枚枚能力徽章。 */
function LiveTraits({ text }: { text: string }) {
  const matches = liveMatches(text);
  if (!text.trim()) return null;
  return (
    <div className={styles.live} aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {matches.length === 0 ? (
          <motion.span key="hint" className={styles.liveHint} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            再写写它的样子：会喷火？背着硬壳？跑得飞快？
          </motion.span>
        ) : (
          matches.map(m => (
            <motion.span
              key={m.keyword}
              layout
              className={styles.liveItem}
              initial={{ opacity: 0, scale: 0.4, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            >
              <small>
                {SLOT_NAMES[m.slot]} ·「{m.quote}」
              </small>
              <KeywordChip keyword={m.keyword} size="sm" />
            </motion.span>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

/** 造物所在的区域：左右拖动旋转，轻点一下它会跳。 */
function SpinPad() {
  const start = useRef<{ x: number; t: number; last: number; moved: boolean } | null>(null);
  return (
    <div
      className={styles.spinPad}
      aria-hidden
      onPointerDown={e => {
        start.current = { x: e.clientX, t: performance.now(), last: e.clientX, moved: false };
        spin.dragging = true;
        spin.velocity = 0;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={e => {
        const s = start.current;
        if (!s) return;
        const dx = e.clientX - s.last;
        if (Math.abs(e.clientX - s.x) > 6) s.moved = true;
        spin.yaw += dx * 0.012;
        spin.velocity = dx * 0.012;
        s.last = e.clientX;
      }}
      onPointerUp={() => {
        const s = start.current;
        start.current = null;
        spin.dragging = false;
        if (s && !s.moved && performance.now() - s.t < 400) {
          poke();
          sfx.bubble(1.3);
        }
      }}
      onPointerCancel={() => {
        start.current = null;
        spin.dragging = false;
      }}
    />
  );
}

function RiddleBox({ title, riddles }: { title: string; riddles: { text: string; solved: boolean }[] }) {
  return (
    <div className={styles.riddle}>
      <small>{title}</small>
      <ul className={styles.riddleLines}>
        {riddles.map(r => (
          <li key={r.text} data-on={r.solved || undefined}>
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface RosterEntry {
  id: string;
  name: string;
  generation: number;
  wins: number;
  urls: (string | null)[];
  rotations?: [number, number, number][];
  tints?: (string | null)[];
}

function RosterFace({ entry }: { entry: RosterEntry }) {
  const src = useSnapshot(entry.urls, entry.rotations as never, { width: 120, height: 140, margin: 0.95, yaw: 0.2, tints: entry.tints });
  return src ? <img src={src} alt="" draggable={false} /> : <span className={styles.rosterWait} />;
}

/** 名册：五个位置，活着的造物才占位；空位可以写一只新的。 */
function RosterStrip({ roster, max, activeId, onSelect, onNew }: { roster: RosterEntry[]; max: number; activeId: string | null; onSelect: (id: string) => void; onNew?: () => void }) {
  if (!roster.length) return null;
  return (
    <div className={styles.roster}>
      <small>
        我的造物 {roster.length}/{max}
      </small>
      <div className={styles.rosterRow}>
        {roster.map(r => (
          <button key={r.id} type="button" className={styles.rosterSlot} aria-pressed={activeId === r.id} onClick={() => onSelect(r.id)} title={`${r.name} · 第 ${r.generation} 代 · 胜 ${r.wins}`}>
            <RosterFace entry={r} />
            <span>{r.name}</span>
          </button>
        ))}
        {Array.from({ length: Math.max(0, max - roster.length) }, (_, i) => (
          <button key={`empty-${i}`} type="button" className={styles.rosterSlot} data-empty="" aria-pressed={activeId === null && i === 0 && Boolean(onNew)} disabled={!onNew} onClick={onNew} aria-label="写一只新的造物">
            <b>+</b>
            <span>空位</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 这只造物的成长：印记、墨水、传承。让玩家看得见"上一代留下了什么"。 */
function CreatureStats({ creature, parts }: { creature: CreatureRecord; parts: PartRecord[] }) {
  const marks = parts.reduce((n, p) => n + p.level, 0);
  const hp = 14 + 2 * marks;
  const ink = Math.min(5, 3 + Math.max(0, creature.generation - 1));
  const inherited = parts.find(p => p.id === creature.inheritedPartId);
  const growing = parts.filter(p => p.model.taskId && p.model.kind !== 'generated');
  return (
    <div className={styles.stats}>
      <span>
        生命 <b>{hp}</b>
      </span>
      <span>
        墨水 <b>{ink}</b>
      </span>
      <span>
        印记 <b>{marks}</b>
      </span>
      {creature.wins > 0 && (
        <span>
          胜 <b>{creature.wins}</b>
        </span>
      )}
      {inherited && (
        <p className={styles.inheritLine}>
          传承自上一代：「{inherited.name}」印记 {inherited.level}，它的话效果 +{inherited.level}、只歇一回合；第 {creature.generation} 代墨水 +{ink - 3}。
        </p>
      )}
      {growing.length > 0 && (
        <p className={styles.growing}>
          专属外形正在海底孵化：{parts.map(p => `${SLOT_NAMES[p.slot]}${p.model.kind === 'generated' ? '✓' : p.model.taskId ? '…' : '·'}`).join('  ')}（生成需要几分钟，好了会自动换上）
        </p>
      )}
    </div>
  );
}

function AiLine({ ai }: { ai: { deepseek: boolean; tripo: boolean; offline: boolean } }) {
  if (ai.offline || (!ai.deepseek && !ai.tripo))
    return <p className={styles.aiLine}>现在是离线造物：用本地规则读你的话，外形从部件库里挑。配好 DeepSeek / Tripo 密钥后，会理解得更准、并生成专属外形。</p>;
  return (
    <p className={styles.aiLine} data-on="">
      {ai.deepseek ? 'DeepSeek 会读懂你的话' : '用本地规则读你的话'}
      {ai.tripo ? '，Tripo 会为三个部位各生成一件专属外形（后台几分钟，先用部件库顶上）。' : '，外形从部件库里挑（没有配置 Tripo）。'}
    </p>
  );
}
