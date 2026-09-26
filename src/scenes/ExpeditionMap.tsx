'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { ShellHealth } from '@/ui/Meters';
import { IntentPip, type IntentKind } from '@/ui/Battle';
import { KeywordChip } from '@/ui/Keyword';
import { useSnapshot } from '@/ui/useSnapshot';
import { GUARDS, type GuardDef } from '@/domain/guards';
import { guardModelUrls } from '@/domain/model-pool';
import type { Keyword } from '@/domain/keywords';
import type { CreatureRecord, PartRecord } from '@/domain/types';
import styles from './Map.module.css';

/** 每位守卫所在的深度（米），只用来画刻度。 */
export const DEPTH_METRES = [20, 90, 180, 290, 420, 580, 760];
const NODE_X = [50, 30, 70, 32, 68, 34, 58];
const TOP = 180;
const GAP = 168;

export interface ExpeditionMapProps {
  creature: CreatureRecord;
  parts: PartRecord[];
  hp: number;
  maxHp: number;
  depth: number;
  beaten: string[];
  loreUnlocked: string[];
  guardDefeats: Record<string, number>;
  scouted: string[];
  /** 进入地图时从哪一站滑过来（刚打完一场）。 */
  cameFrom: number | null;
  onChallenge: () => void;
  onRetreat: () => void;
}

type NodeState = 'beaten' | 'current' | 'locked' | 'passed';

function GuardPortrait({ guard, silhouette, size }: { guard: GuardDef; silhouette: boolean; size: number }) {
  const u = guardModelUrls(guard.modelSet);
  const src = useSnapshot([u.head, u.body, u.legs], undefined, { width: size * 2, height: size * 2, margin: 0.92, yaw: -0.35, silhouette });
  return src ? <img src={src} alt="" className={styles.portraitImg} draggable={false} /> : <span className={styles.portraitWait} />;
}

function PlayerToken({ parts }: { parts: PartRecord[] }) {
  const src = useSnapshot(
    parts.map(p => p.model.url),
    parts.map(p => p.model.rotation),
    { width: 200, height: 260, margin: 0.95, yaw: 0.45 },
  );
  return src ? <img src={src} alt="" draggable={false} /> : <span className={styles.tokenDot} />;
}

function matchup(guard: GuardDef, parts: PartRecord[]): { weak: { kw: Keyword; quote: string } | null; resist: { kw: Keyword; quote: string } | null } {
  const find = (kw: Keyword | null) => {
    if (!kw) return null;
    for (const p of parts) {
      if (!p.trait.keywords.includes(kw)) continue;
      const reason = p.trait.reasons.find(r => r.keyword === kw);
      return { kw, quote: reason?.quote ?? p.name };
    }
    return null;
  };
  return { weak: find(guard.weak), resist: find(guard.resist) };
}

export function ExpeditionMap(props: ExpeditionMapProps) {
  const { creature, parts, hp, maxHp, depth, beaten, loreUnlocked, guardDefeats, scouted, cameFrom, onChallenge, onRetreat } = props;
  const [selected, setSelected] = useState(depth);
  const scroller = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const finished = depth >= GUARDS.length;

  const states: NodeState[] = GUARDS.map(g => {
    if (beaten.includes(g.id)) return 'beaten';
    if (g.depth < depth) return 'passed';
    if (g.depth === depth) return 'current';
    return 'locked';
  });

  // 进场时把当前站滚到视野中间。
  useEffect(() => {
    const el = nodeRefs.current[Math.min(depth, GUARDS.length - 1)];
    const box = scroller.current;
    if (!el || !box) return;
    const top = el.offsetTop - box.clientHeight * 0.38;
    box.scrollTo({ top: Math.max(0, top), behavior: 'instant' as ScrollBehavior });
  }, [depth]);

  const height = TOP + GAP * (GUARDS.length - 1) + 140;
  const path = useMemo(() => {
    const pts = [[50, 40], ...GUARDS.map((_, i) => [NODE_X[i], TOP + GAP * i])];
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const my = (y0 + y1) / 2;
      d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
    }
    return d;
  }, []);
  const progressY = TOP + GAP * Math.min(depth, GUARDS.length - 1);

  const token = Math.min(depth, GUARDS.length - 1);
  const tokenFrom = cameFrom ?? token;
  const sel = GUARDS[selected] ?? GUARDS[GUARDS.length - 1];
  const selState = states[selected] ?? 'locked';
  const known = selState !== 'locked' || loreUnlocked.includes(sel.id);
  const m = matchup(sel, parts);
  const tier = guardDefeats[sel.id] ?? 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.backdrop} aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className={styles.bubble} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${6 + (i % 5) * 1.7}s`, '--delay': `${-i * 1.3}s`, '--s': `${4 + (i % 4) * 3}px` } as CSSProperties} />
        ))}
      </div>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>远征 · 海沟</span>
          <h1 className={styles.title}>{creature.name}</h1>
        </div>
        <div className={styles.hp}>
          <ShellHealth hp={hp} max={maxHp} label="造物生命" />
          <small>生命在远征里延续，只有潮汐泉能回复</small>
        </div>
      </header>

      <div className={styles.scroller} ref={scroller}>
        <div className={styles.trench} style={{ height }}>
          <svg className={styles.path} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="trench-glow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#9ff0d8" stopOpacity="0.9" />
                <stop offset="1" stopColor="#d4ae63" stopOpacity="0.9" />
              </linearGradient>
              <clipPath id="trench-progress">
                <rect x="0" y="0" width="100" height={progressY} />
              </clipPath>
            </defs>
            <path d={path} className={styles.pathBase} vectorEffect="non-scaling-stroke" />
            <path d={path} className={styles.pathLit} clipPath="url(#trench-progress)" stroke="url(#trench-glow)" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className={styles.harbor} style={{ top: 40 }}>
            <Icon name="retreat" size={16} />
            港口
          </div>

          {GUARDS.map((g, i) => {
            const st = states[i];
            const visible = st !== 'locked' || loreUnlocked.includes(g.id);
            return (
              <div key={g.id}>
                <span className={styles.depth} style={{ top: TOP + GAP * i }}>
                  −{DEPTH_METRES[i]}m
                </span>
                {i > 0 && i <= GUARDS.length - 1 && (
                  <span className={styles.spring} data-lit={i <= depth ? '' : undefined} style={{ top: TOP + GAP * (i - 0.5), left: `${(NODE_X[i - 1] + NODE_X[i]) / 2}%` }} aria-hidden>
                    <Icon name="spring" size={14} />
                  </span>
                )}
                <motion.button
                  ref={el => {
                    nodeRefs.current[i] = el;
                  }}
                  type="button"
                  className={styles.node}
                  data-state={st}
                  aria-pressed={selected === i}
                  style={{ top: TOP + GAP * i, left: `${NODE_X[i]}%` }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.08 * i, type: 'spring', stiffness: 260, damping: 20 }}
                  onClick={() => setSelected(i)}
                  aria-label={visible ? `${g.name}，${st === 'beaten' ? '已击败' : st === 'current' ? '下一站' : ''}` : '未知的守卫'}
                >
                  <span className={styles.portrait}>
                    <GuardPortrait guard={g} silhouette={!visible} size={88} />
                    {st === 'beaten' && <span className={styles.seal}>破</span>}
                  </span>
                  <span className={styles.nodeLabel}>
                    <small>{visible ? g.title : `第 ${i} 位守卫`}</small>
                    <b>{visible ? g.name : '？？？'}</b>
                  </span>
                </motion.button>
              </div>
            );
          })}

          {!finished && (
            <motion.div
              className={styles.token}
              data-side={NODE_X[token] > 50 ? 'left' : 'right'}
              initial={{ top: TOP + GAP * tokenFrom, left: `${NODE_X[tokenFrom]}%` }}
              animate={{ top: TOP + GAP * token, left: `${NODE_X[token]}%` }}
              transition={{ duration: cameFrom !== null && cameFrom !== token ? 1.4 : 0, ease: [0.65, 0, 0.35, 1], delay: 0.3 }}
              aria-hidden
            >
              <PlayerToken parts={parts} />
            </motion.div>
          )}

          <div className={styles.abyss} style={{ top: TOP + GAP * (GUARDS.length - 1) + 90 }}>
            {finished ? '你抵达了海沟的尽头' : '再往下，是还没有人见过的海'}
          </div>
        </div>
      </div>

      <motion.aside key={selected} className={styles.sheet} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
        <div className={styles.sheetHead}>
          <span className={styles.eyebrow}>
            −{DEPTH_METRES[selected]}m · {known ? sel.title : '未知'}
            {tier > 0 && known ? ` · 已被击败 ${tier} 次，更强了` : ''}
          </span>
          <h2>{known ? sel.name : '深处的影子'}</h2>
        </div>
        {selState === 'locked' && !known && <p className={styles.riddle}>太深了，还看不清。先打败前面的守卫。</p>}
        {(selState !== 'locked' || known) && (
          <>
            {selState === 'beaten' || selState === 'passed' ? (
              <p className={styles.lore}>{loreUnlocked.includes(sel.id) ? sel.lore : `「${sel.farewell}」`}</p>
            ) : (
              <p className={styles.riddle}>
                <small>谜语</small>
                {sel.riddle}
              </p>
            )}
            {selState === 'current' && (m.weak || m.resist) && (
              <div className={styles.matchups}>
                {m.weak && (
                  <span className={styles.match} data-good="">
                    <KeywordChip keyword={m.weak.kw} size="sm" />
                    因为你写了「{m.weak.quote}」，它会怕你
                  </span>
                )}
                {m.resist && (
                  <span className={styles.match}>
                    <KeywordChip keyword={m.resist.kw} size="sm" />
                    它不怕「{m.resist.quote}」，这类攻击会被削弱
                  </span>
                )}
              </div>
            )}
            {selState === 'current' && scouted.includes(sel.id) && (
              <div className={styles.intel}>
                <small>
                  <Icon name="scout" size={14} /> 侦察到的出招顺序
                </small>
                <div className={styles.intelRow}>
                  {sel.pattern.map((k, i) => (
                    <IntentPip key={i} kind={k as IntentKind} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className={styles.actions}>
          {!finished && selected === depth && (
            <Button variant="primary" size="lg" onClick={onChallenge}>
              下潜，挑战{GUARDS[depth].name}
              <Icon name="arrow" size={18} />
            </Button>
          )}
          {!finished && selected !== depth && (
            <Button variant="primary" size="lg" onClick={() => setSelected(depth)}>
              看看下一站
            </Button>
          )}
          <Button variant="secondary" onClick={onRetreat}>
            <Icon name="retreat" size={16} />
            {beaten.length ? '带着战利品回港' : '回到港口'}
          </Button>
        </div>
      </motion.aside>
    </div>
  );
}
