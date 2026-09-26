'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { KeywordChip, OriginQuote, ReasonLine } from '@/ui/Keyword';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { SLOTS, SLOT_NAMES, keywordColor, type Slot } from '@/domain/keywords';
import type { ForgeDraft } from '@/game/logic';
import { forgeChime, bubble } from '@/audio/synth';
import styles from './Forge.module.css';

export type RitualPhase = 'rise' | 'reveal' | 'hatch' | 'done';

export interface ForgeRitualProps {
  origin: string;
  draft: ForgeDraft | null;
  phase: RitualPhase;
  note?: string | null;
  onRevealed: () => void;
  onHatched: () => void;
  onDepart: () => void;
  onRewrite: () => void;
  reduced: boolean;
  /** Tripo 正在按原话生成专属外形。 */
  hatching?: { canForgeMore: boolean; others: number } | null;
}

const SHELL_PATH = 'M6 46C6 22 18 6 40 6s34 16 34 40c-9 7-21 10-34 10S15 53 6 46Z';
const SHELL_RIBS = 'M40 8v46M26 12l4 42M54 12l-4 42M14 24l12 28M66 24 54 52';

function Shell() {
  return (
    <svg viewBox="0 0 80 60" aria-hidden>
      <defs>
        <linearGradient id="shellFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f1e4" />
          <stop offset="1" stopColor="#9ff0d8" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <path d={SHELL_PATH} fill="url(#shellFill)" stroke="#d4ae63" strokeWidth="1.2" />
      <path d={SHELL_RIBS} stroke="#15403a" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function ForgeRitual({ origin, draft, phase, note, onRevealed, onHatched, onDepart, onRewrite, reduced, hatching }: ForgeRitualProps) {
  const chars = useMemo(() => [...origin], [origin]);
  const shellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [targets, setTargets] = useState<{ x: number; y: number }[]>([]);
  const reveal = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ d: string; color: string; delay: number }[]>([]);

  // 贝壳位置：字粒子飞向这里。
  useLayoutEffect(() => {
    const measure = () => setTargets(shellRefs.current.map(el => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.45 } : { x: innerWidth / 2, y: innerHeight / 2 };
    }));
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, []);

  // 字飞完、结果到达后进入揭示。
  useEffect(() => {
    if (phase !== 'rise' || !draft) return;
    const wait = reduced ? 200 : Math.max(0, 1400 + chars.length * 40 - 400);
    const timer = setTimeout(onRevealed, wait);
    return () => clearTimeout(timer);
  }, [phase, draft, chars.length, onRevealed, reduced]);

  // 揭示：从原话里被引用的词拉线到对应能力标签。
  useLayoutEffect(() => {
    if (phase !== 'reveal' || !reveal.current) return;
    const root = reveal.current;
    const compute = () => {
      const marks = [...root.querySelectorAll<HTMLElement>('mark[data-keyword]')];
      const out: { d: string; color: string; delay: number }[] = [];
      let i = 0;
      for (const chip of root.querySelectorAll<HTMLElement>('[data-chip]')) {
        const keyword = chip.dataset.chip!;
        const mark = marks.find(m => m.dataset.keyword === keyword);
        if (!mark) continue;
        const a = mark.getBoundingClientRect();
        const b = chip.getBoundingClientRect();
        const x1 = a.left + a.width / 2, y1 = a.bottom + 2;
        const x2 = b.left + b.width / 2, y2 = b.top - 2;
        const my = (y1 + y2) / 2;
        out.push({ d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, color: keywordColor(keyword as never), delay: 0.25 + i * 0.28 });
        i++;
      }
      setPaths(out);
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(compute));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    paths.forEach((p, i) => setTimeout(() => forgeChime(i), p.delay * 1000));
    const timer = setTimeout(onHatched, reduced ? 900 : 2900);
    return () => clearTimeout(timer);
  }, [phase, paths, onHatched, reduced]);

  useEffect(() => {
    if (phase === 'hatch') [0, 1, 2].forEach(i => setTimeout(() => bubble(1 + i * 0.25), i * 140));
  }, [phase]);

  const start = typeof window === 'undefined' ? { x: 0, y: 0 } : { x: innerWidth / 2, y: innerHeight * 0.86 };
  const third = Math.max(1, Math.ceil(chars.length / 3));
  const shellState = phase === 'rise' ? 'wobble' : phase === 'hatch' || phase === 'done' ? 'open' : 'idle';

  return (
    <div className={styles.overlay}>
      <div className={styles.veil} style={{ opacity: phase === 'done' ? 0 : phase === 'hatch' ? 0.4 : 1 }} />

      <div className={styles.shells} style={{ opacity: phase === 'done' ? 0 : 1, transition: 'opacity 600ms' }}>
        {SLOTS.map((slot, i) => (
          <div key={slot} ref={el => { shellRefs.current[i] = el; }} className={styles.shellSlot} data-state={shellState}>
            <Shell />
            <span className={styles.shellLabel}>{SLOT_NAMES[slot]}</span>
          </div>
        ))}
      </div>

      {phase === 'rise' && targets.length === 3 &&
        chars.map((ch, i) => {
          const shell = Math.min(2, Math.floor(i / third));
          const target = targets[shell];
          const spread = (i % third) - third / 2;
          return (
            <motion.span
              key={i}
              className={styles.char}
              style={{ left: 0, top: 0 }}
              initial={{ x: start.x + (i - chars.length / 2) * 22, y: start.y, opacity: 0, scale: 1 }}
              animate={
                reduced
                  ? { x: target.x, y: target.y, opacity: 0 }
                  : {
                      x: [start.x + (i - chars.length / 2) * 22, start.x + spread * 30, target.x],
                      y: [start.y, start.y - 180 - (i % 3) * 30, target.y],
                      opacity: [0, 1, 0],
                      scale: [1, 1.15, 0.4],
                    }
              }
              transition={{ duration: 1.3, delay: 0.05 + i * 0.04, ease: [0.45, 0, 0.2, 1], times: [0, 0.45, 1] }}
            >
              {ch}
            </motion.span>
          );
        })}

      {(phase === 'reveal' || phase === 'hatch') && draft && (
        <motion.div ref={reveal} className={styles.reveal} initial={{ opacity: 0, y: -12 }} animate={{ opacity: phase === 'hatch' ? 0 : 1, y: 0 }} transition={{ duration: 0.5 }}>
          <OriginQuote className={styles.revealQuote} origin={origin} reasons={SLOTS.flatMap(s => draft.parts[s].trait.reasons)} />
          <div className={styles.abilities}>
            {SLOTS.map(slot => (
              <div key={slot} className={styles.ability}>
                <small>{SLOT_NAMES[slot]}</small>
                <b>{draft.parts[slot].name}</b>
                <div className={styles.chips}>
                  {draft.parts[slot].trait.keywords.map(k => (
                    <span key={k} data-chip={k}>
                      <KeywordChip keyword={k} size="sm" />
                    </span>
                  ))}
                  {draft.parts[slot].trait.cost && (
                    <span data-chip={draft.parts[slot].trait.cost}>
                      <KeywordChip keyword={draft.parts[slot].trait.cost!} size="sm" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {phase === 'reveal' && paths.length > 0 && (
        <svg className={styles.lines} aria-hidden>
          {paths.map((p, i) => (
            <path key={i} d={p.d} stroke={p.color} style={{ color: p.color, animationDelay: `${p.delay}s` } as CSSProperties} />
          ))}
        </svg>
      )}

      {phase === 'done' && draft && (
        <motion.section className={styles.done} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
          <span className={styles.born}>它诞生了</span>
          <h1 className={styles.name}>{draft.name}</h1>
          <p className={styles.loreText}>{draft.lore}</p>
          <div className={styles.reasons}>
            {SLOTS.map((slot: Slot) => {
              const reason = draft.parts[slot].trait.reasons[0];
              return (
                <div key={slot} className={styles.reason}>
                  <span className={styles.glyph}>
                    <span>{SLOT_NAMES[slot]}</span>
                  </span>
                  <span>
                    <b style={{ color: 'var(--cream)', fontFamily: 'var(--font-serif)' }}>{draft.parts[slot].name}</b>　{reason && <ReasonLine reason={reason} />}
                  </span>
                </div>
              );
            })}
          </div>
          {note && <p className={styles.note}>{note}</p>}
          {hatching && (
            <div className={styles.hatchTip} role="status">
              <span className={styles.hatchDot} aria-hidden />
              <p>
                <b>专属外形正在按你的话孵化</b>，通常要 1～3 分钟，好了会自动换上，不用守着。
                现在它先穿着部件库里最像的外壳，<b>能力一模一样</b>，可以直接出发。
                {hatching.canForgeMore
                  ? `也可以回港口再写一只，名册最多 ${5} 只，可以同时孵化${hatching.others ? `（另外还有 ${hatching.others} 只在孵化）` : ''}。`
                  : '名册已经满了，先带它们去打一仗吧。'}
              </p>
            </div>
          )}
          <div className={styles.actions}>
            <Button variant="primary" size="lg" onClick={onDepart}>
              带它出发
              <Icon name="arrow" size={18} />
            </Button>
            {hatching?.canForgeMore ? (
              <Button variant="secondary" onClick={onRewrite}>
                再写一只（同时孵化）
              </Button>
            ) : (
              <Button variant="ghost" onClick={onRewrite}>
                回港口
              </Button>
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}
