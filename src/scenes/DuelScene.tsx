'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { RigHandle } from '@/three/CreatureRig';
import { screenPoints } from '@/three/anchors';
import { hitStop, slowMotion } from '@/three/timescale';
import { useAnchor } from '@/game/useAnchor';
import { ShellHealth } from '@/ui/Meters';
import { Icon } from '@/ui/Icon';
import { keywordColor, SLOT_NAMES, type Keyword } from '@/domain/keywords';
import type { CreatureRecord } from '@/domain/types';
import {
  BASIC_WORD,
  DUEL_EFFECTS,
  INK_MAX,
  WRITE_MAX,
  checkDuelAction,
  currentMove,
  readPhrase,
  type DuelAction,
  type DuelEvent,
  type DuelGuardDef,
  type DuelMove,
  type DuelState,
} from '@/domain/duel';
import * as sfx from '@/audio/synth';
import styles from './Duel.module.css';

export interface DuelSceneProps {
  duel: DuelState;
  dg: DuelGuardDef;
  creature: CreatureRecord;
  /** 之前的造物已经解开过的谜语。 */
  known: string[];
  playerRig: RefObject<RigHandle | null>;
  guardRig: RefObject<RigHandle | null>;
  shake: RefObject<number>;
  onAct: (action: DuelAction) => { events: DuelEvent[]; duel: DuelState };
  onFinished: (duel: DuelState) => void;
  onRetreat: () => void;
  onDanger: (danger: boolean) => void;
}

const MOVE_COLOR: Record<DuelMove, string> = { strike: '#f2a36b', charge: '#ffd98a', unleash: '#f07a6a', fortify: '#8fe3f2', heal: '#b6ee9f', stunned: '#8faaa0' };
const DEFENSIVE: Keyword[] = ['坚壳', '反射', '膨胀', '再生', '蓄能', '潜行', '迅捷'];
const BURST_KIND: Partial<Record<Keyword, string>> = { 灼烧: 'fire', 穿刺: 'slash', 连击: 'slash', 震慑: 'ring', 跃击: 'ring', 回旋: 'spin', 吞噬: 'bite', 吸附: 'vine' };

type Fx =
  | { id: number; kind: 'fly'; text: string; color: string; from: P; to: P; big?: boolean; fall?: boolean; hostile?: boolean; dur: number }
  | { id: number; kind: 'cast'; text: string; color: string; at: P }
  | { id: number; kind: 'burst'; style: string; color: string; at: P }
  | { id: number; kind: 'num'; text: string; color: string; at: P; size: 'sm' | 'md' | 'lg'; dx: number }
  | { id: number; kind: 'shield'; text: string; color: string; at: P }
  | { id: number; kind: 'shatter'; color: string; at: P };
type P = { x: number; y: number };
type FxInput = Fx extends infer T ? (T extends Fx ? Omit<T, 'id'> : never) : never;

/** 临场写一句的灵感：点一下填进输入框，玩家一看就知道能写哪几类。 */
const IDEAS: { label: string; text: string; kw: Keyword }[] = [
  { label: '攻击', text: '喷一口火', kw: '灼烧' },
  { label: '扎穿', text: '一针扎进去', kw: '穿刺' },
  { label: '打断', text: '大吼一声', kw: '震慑' },
  { label: '防守', text: '缩进壳里', kw: '坚壳' },
  { label: '回血', text: '躺下休息', kw: '再生' },
  { label: '护体', text: '鼓起身子', kw: '膨胀' },
  { label: '蓄力', text: '深呼吸', kw: '蓄能' },
  { label: '闪避', text: '绕到它背后', kw: '潜行' },
];

let fxId = 0;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const point = (key: string, fallback: P): P => {
  const p = screenPoints.get(key);
  return p ? { x: p.x, y: p.y } : fallback;
};

export function DuelScene(props: DuelSceneProps) {
  const { duel, dg, creature, known, playerRig, guardRig, shake, onAct, onFinished, onRetreat, onDanger } = props;
  const [display, setDisplay] = useState({ hp: duel.hp, guardHp: duel.guardHp, shield: duel.shield, ink: duel.ink });
  const [busy, setBusy] = useState(false);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<{ id: number; title: string; riddle: string; line: string } | null>(null);
  const [speech, setSpeech] = useState<string | null>(duel.turn === 1 ? dg.intro : null);
  const [hurt, setHurt] = useState(0);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [intro, setIntro] = useState(duel.turn === 1 && duel.log.length === 0);
  const [riddlesOpen, setRiddlesOpen] = useState(false);
  const [pulse, setPulse] = useState<DuelMove | null>(null);
  const openingShown = useRef(false);
  const telegraphRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [minTop, setMinTop] = useState(140);
  useEffect(() => {
    const measure = () => {
      const r = hudRef.current?.getBoundingClientRect();
      // 横屏时状态栏在左侧，不挡守卫头顶。
      if (r) setMinTop(r.width < innerWidth * 0.6 && innerWidth > innerHeight ? 12 : Math.round(r.bottom + 8));
    };
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, []);
  useAnchor(telegraphRef, 'guard:top', { offsetY: -10, minTop });

  const move = currentMove(duel);
  const inkMax = duel.inkMax ?? INK_MAX;
  const solvedAll = useMemo(() => new Set([...known, ...duel.solved]), [known, duel.solved]);
  const low = display.hp > 0 && display.hp / duel.maxHp < 0.34;

  useEffect(() => onDanger(low), [low, onDanger]);
  useEffect(() => {
    if (!low) return;
    const t = setInterval(() => sfx.heartbeat(), 1300);
    return () => clearInterval(t);
  }, [low]);

  const spawn = useCallback((item: FxInput, ms: number) => {
    const f = { ...item, id: ++fxId } as Fx;
    setFx(list => [...list, f]);
    setTimeout(() => setFx(list => list.filter(i => i.id !== f.id)), ms);
    return f.id;
  }, []);
  const drop = useCallback((id: number) => setFx(list => list.filter(i => i.id !== id)), []);
  const num = useCallback(
    (key: string, text: string, color: string, size: 'sm' | 'md' | 'lg' = 'md') => {
      spawn({ kind: 'num', text, color, at: point(key, { x: innerWidth / 2, y: innerHeight / 2 }), size, dx: (Math.random() - 0.5) * 80 }, 1100);
    },
    [spawn],
  );

  // 开场：对决卡两秒后收起；原话里就带着秘密时，立刻揭晓。
  useEffect(() => {
    if (!intro) return;
    sfx.tideRumble();
    const ms = (globalThis as { __sfIntroMs?: number }).__sfIntroMs ?? 2600;
    const t = setTimeout(() => setIntro(false), ms);
    return () => clearTimeout(t);
  }, [intro]);
  useEffect(() => {
    if (intro || openingShown.current) return;
    openingShown.current = true;
    if (duel.rusted && duel.log.length === 0 && duel.solved.includes('secret')) {
      const r = dg.riddles.find(x => x.id === 'secret')!;
      setBanner({ id: ++fxId, title: '你的话里就带着答案', riddle: r.text, line: r.solved });
      sfx.perfectChime(3);
      setTimeout(() => setBanner(null), 2600);
    }
  }, [intro, duel, dg]);
  useEffect(() => {
    if (!speech || intro) return;
    const t = setTimeout(() => setSpeech(null), 3200);
    return () => clearTimeout(t);
  }, [speech, intro]);

  /* ------------------------- 播放一回合 ------------------------- */
  const play = useCallback(
    async (events: DuelEvent[], after: DuelState) => {
      const vw = innerWidth;
      const vh = innerHeight;
      const P = () => point('player:body', { x: vw * 0.3, y: vh * 0.5 });
      const G = () => point('guard:body', { x: vw * 0.7, y: vh * 0.45 });
      let hp = display.hp;
      let gh = display.guardHp;
      let shield = display.shield;
      let shieldFx: number | null = null;
      let lastKeyword: Keyword | null = null;
      setDisplay(d => ({ ...d, ink: after.ink }));

      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        switch (e.type) {
          case 'word': {
            lastKeyword = e.keyword;
            const color = e.keyword ? keywordColor(e.keyword) : '#f1e8d2';
                        sfx.bubble(e.source === 'ink' ? 0.8 : 1.1);
            if (e.keyword && DEFENSIVE.includes(e.keyword)) {
              spawn({ kind: 'cast', text: e.text, color, at: P() }, 1300);
              if (e.keyword === '坚壳' || e.keyword === '反射') shieldFx = spawn({ kind: 'shield', text: e.text, color, at: P() }, 4000);
              await wait(650);
            } else {
              playerRig.current?.lunge();
              spawn({ kind: 'fly', text: e.text, color, from: P(), to: G(), big: e.source !== 'basic', dur: 0.55 }, 900);
              await wait(560);
            }
            break;
          }
          case 'fizzle':
            setSpeech(e.line);
            num('guard:top', '没听懂，扑了上去', '#8faaa0', 'sm');
            await wait(700);
            break;
          case 'resist':
            num('guard:top', '没什么用', '#8faaa0', 'sm');
            setSpeech(e.line);
            await wait(300);
            break;
          case 'guard-heal':
            spawn({ kind: 'burst', style: 'heal', color: '#b6ee9f', at: G() }, 1100);
            gh = Math.min(after.guardMax, gh + e.amount);
            num('guard:top', `+${e.amount}`, '#b6ee9f');
            setDisplay(d => ({ ...d, guardHp: gh }));
            await wait(420);
            break;
          case 'rust':
            spawn({ kind: 'burst', style: 'rust', color: '#6fd8a0', at: G() }, 1400);
            slowMotion(500, 0.3);
            sfx.bell(-2, 4, 0.3);
            await wait(500);
            break;
          case 'bounce':
            spawn({ kind: 'burst', style: 'clang', color: '#8fe3f2', at: G() }, 700);
            sfx.blockSound();
            setSpeech(e.line);
            await wait(250);
            break;
          case 'hit':
            if (e.target === 'guard') {
              gh = Math.max(0, gh - e.amount);
              const style = (lastKeyword && BURST_KIND[lastKeyword]) ?? 'rays';
              spawn({ kind: 'burst', style, color: lastKeyword ? keywordColor(lastKeyword) : '#f1e8d2', at: G() }, 900);
              guardRig.current?.hit('any', Boolean(e.crit || e.weak));
              hitStop(e.crit || e.weak ? 110 : 60);
              shake.current = Math.min(0.5, 0.1 + e.amount * 0.04);
              sfx.thud(Boolean(e.crit || e.weak));
              num('guard:body', `${e.amount}`, e.weak ? '#ffb454' : e.crit ? '#ffd98a' : '#f1e8d2', e.amount >= 6 ? 'lg' : 'md');
              if (e.weak) num('guard:top', '弱点！', '#ffb454', 'sm');
              else if (e.crit) num('guard:top', '加倍！', '#ffd98a', 'sm');
              if (e.line) setSpeech(e.line);
              setDisplay(d => ({ ...d, guardHp: gh }));
              await wait(e.amount >= 6 ? 520 : 380);
            } else {
              hp = Math.max(0, hp - e.amount);
              playerRig.current?.hit('any', Boolean(e.crit));
              hitStop(e.crit ? 120 : 70);
              shake.current = Math.min(0.6, 0.15 + e.amount * 0.05);
              sfx.thud(Boolean(e.crit));
              setHurt(h => h + 1);
              spawn({ kind: 'burst', style: 'rays', color: '#f07a6a', at: P() }, 800);
              num('player:body', `-${e.amount}`, '#f07a6a', e.amount >= 6 ? 'lg' : 'md');
              setDisplay(d => ({ ...d, hp }));
              await wait(420);
            }
            break;
          case 'heal':
            hp = Math.min(after.maxHp, hp + e.amount);
            spawn({ kind: 'burst', style: 'heal', color: '#b6ee9f', at: P() }, 1100);
            num('player:top', `+${e.amount}`, '#b6ee9f');
            sfx.bell(2, 5, 0.18);
            setDisplay(d => ({ ...d, hp }));
            await wait(350);
            break;
          case 'shield':
            shield += e.amount;
            spawn({ kind: 'burst', style: 'bubble', color: '#6fd8b6', at: P() }, 1000);
            num('player:top', `护体 +${e.amount}`, '#6fd8b6', 'sm');
            setDisplay(d => ({ ...d, shield }));
            await wait(300);
            break;
          case 'boost':
            num('player:top', '下一招加倍', '#ffd98a', 'sm');
            sfx.bell(4, 5, 0.16);
            await wait(300);
            break;
          case 'solve':
            slowMotion(700, 0.25);
            sfx.perfectChime(3);
            setBanner({ id: ++fxId, title: '谜语解开', riddle: e.text, line: e.line });
            await wait(1900);
            setBanner(null);
            break;
          case 'guard-word': {
            const word = e.word;
            const color = MOVE_COLOR[e.move];
            if (e.move === 'strike' || e.move === 'unleash') {
              await wait(120);
              guardRig.current?.lunge();
              spawn({ kind: 'fly', text: word, color, from: G(), to: P(), big: e.move === 'unleash', hostile: true, dur: 0.45 }, 700);
              await wait(460);
            } else {
              setPulse(e.move);
              if (e.move === 'charge') sfx.tideRumble();
              await wait(520);
              setPulse(null);
            }
            break;
          }
          case 'interrupt':
            spawn({ kind: 'burst', style: 'ring', color: '#ffd98a', at: G() }, 900);
            num('guard:top', '打断了！', '#ffd98a');
            sfx.bell(4, 5, 0.22);
            await wait(450);
            break;
          case 'dodge':
            playerRig.current?.dodge();
            num('player:top', '闪开了', '#c9b8ff');
            sfx.bubble(1.5);
            await wait(420);
            break;
          case 'block':
            if (shieldFx) drop(shieldFx);
            shieldFx = null;
            if (e.word === '鼓起的身体') {
              shield = Math.max(0, shield - e.amount);
              setDisplay(d => ({ ...d, shield }));
            }
            spawn({ kind: 'shatter', color: '#9ff0d8', at: P() }, 900);
            num('player:top', `挡下 ${e.amount}`, '#9ff0d8', 'sm');
            sfx.blockSound();
            hitStop(60);
            await wait(380);
            break;
          case 'reflect':
            spawn({ kind: 'fly', text: '弹回', color: '#8fe3f2', from: P(), to: G(), dur: 0.35 }, 600);
            await wait(360);
            gh = Math.max(0, gh - e.amount);
            guardRig.current?.hit('any', false);
            num('guard:body', `${e.amount}`, '#8fe3f2');
            setDisplay(d => ({ ...d, guardHp: gh }));
            await wait(300);
            break;
          case 'combo':
            slowMotion(420, 0.35);
            spawn({ kind: 'burst', style: 'ring', color: '#ffd98a', at: G() }, 1000);
            num('guard:top', '三件连携！', '#ffd98a');
            gh = Math.max(0, gh - e.amount);
            guardRig.current?.hit('any', true);
            sfx.perfectChime(2);
            num('guard:body', `${e.amount}`, '#ffd98a');
            setDisplay(d => ({ ...d, guardHp: gh }));
            await wait(520);
            break;
          case 'enrage':
            spawn({ kind: 'burst', style: 'rays', color: '#f07a6a', at: G() }, 1100);
            num('guard:top', '狂暴了', '#f07a6a');
            sfx.tideRumble();
            shake.current = 0.35;
            setSpeech(e.line);
            await wait(700);
            break;
          case 'end':
            break;
        }
      }
      if (shieldFx) drop(shieldFx);
      setDisplay({ hp: after.hp, guardHp: after.guardHp, shield: after.shield, ink: after.ink });
    },
    [display, spawn, drop, num, playerRig, guardRig, shake],
  );

  const act = useCallback(
    async (action: DuelAction) => {
      if (busy || intro || duel.result) return;
      if (!checkDuelAction(duel, action).ok) return;
      sfx.unlockAudio();
      setBusy(true);
      setSpeech(null);
      setWriting(false);
      setText('');
      const out = onAct(action);
      await play(out.events, out.duel);
      if (out.duel.result) {
        if (out.duel.result === 'win') {
          playerRig.current?.hop();
          sfx.bell(0, 5, 0.25);
          sfx.bell(4, 5, 0.2);
          setSpeech(dg.farewell);
        } else sfx.deathBell();
        await wait(out.duel.result === 'win' ? 1400 : 900);
        onFinished(out.duel);
      }
      setBusy(false);
    },
    [busy, intro, duel, onAct, play, onFinished, playerRig, dg.farewell],
  );

  // 键盘：数字键出对应的话语卡，W 临场写一句，空格扑过去。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (writing || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const n = Number(e.key);
      const open = duel.cards.filter(c => !c.used);
      if (n >= 1 && n <= open.length) void act({ kind: 'card', cardId: open[n - 1].id });
      else if (e.key === 'w' || e.key === 'W') {
        if (duel.ink > 0) setWriting(true);
      } else if (e.key === ' ') {
        e.preventDefault();
        void act({ kind: 'basic' });
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [act, duel, writing]);

  useEffect(() => {
    if (writing) inputRef.current?.focus();
  }, [writing]);

  const read = text.trim() ? readPhrase(text.trim()) : null;
  const tooLong = [...text.trim()].length > WRITE_MAX;
  const firstTurn = duel.turn === 1 && duel.log.length === 0;
  const tele = dg.moves[move];

  return (
    <div className={styles.layer}>
      {low && <div className={styles.danger} />}
      {hurt > 0 && <div key={hurt} className={styles.hurt} />}

      {/* 顶部：双方状态 */}
      <div ref={hudRef} className={styles.hud}>
        <div className={styles.side}>
          <span className={styles.who}>
            <small>你的造物</small>
            {creature.name}
          </span>
          <ShellHealth hp={display.hp} max={duel.maxHp} label={`${creature.name}的生命`} />
          <span className={styles.subRow}>
            <span className={styles.ink} aria-label={`墨水 ${display.ink} / ${inkMax}`}>
              {Array.from({ length: inkMax }, (_, i) => (
                <i key={i} data-on={i < display.ink || undefined} />
              ))}
              <small>墨</small>
            </span>
            {display.shield > 0 && <span className={styles.shieldTag}>护体 {display.shield}</span>}
            <span className={styles.chain} title="连着三回合分别说首、躯、足的话，会额外打出一击" aria-label={`连携：${(duel.chain ?? []).map(sl => SLOT_NAMES[sl]).join('、') || '还没开始'}`}>
              {(['head', 'body', 'legs'] as const).map(sl => (
                <i key={sl} data-on={(duel.chain ?? []).includes(sl) || undefined}>
                  {SLOT_NAMES[sl]}
                </i>
              ))}
              <small>连携</small>
            </span>
          </span>
        </div>
        <div className={`${styles.side} ${styles.guardSide}`}>
          <span className={styles.who}>
            <small>{dg.title}</small>
            {dg.name}
          </span>
          <ShellHealth hp={display.guardHp} max={duel.guardMax} side="enemy" label={`${dg.name}的生命`} />
          {duel.enraged && <span className={styles.enragedTag}>狂暴 · 出手更重</span>}
          <button type="button" className={styles.riddleBtn} onClick={() => setRiddlesOpen(o => !o)} aria-expanded={riddlesOpen}>
            {dg.riddles.map(r => (
              <i key={r.id} data-on={solvedAll.has(r.id) || undefined} />
            ))}
            谜语 {dg.riddles.filter(r => solvedAll.has(r.id)).length}/3
          </button>
        </div>
      </div>

      <AnimatePresence>
        {riddlesOpen && (
          <motion.div className={styles.riddles} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} onClick={() => setRiddlesOpen(false)}>
            <small>{dg.name}的三道谜语 · 用你写下的话去解</small>
            {dg.riddles.map(r => (
              <p key={r.id} data-on={solvedAll.has(r.id) || undefined}>
                <b>「{r.text}」</b>
                {solvedAll.has(r.id) ? <span>{r.solved}</span> : <span>还没解开</span>}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 守卫亮出它要做的事：一个词 + 一句话，不给数字；它说的话叠在上面，不会互相遮挡 */}
      <div ref={telegraphRef} className={styles.anchored}>
        <div className={styles.guardStack}>
          {speech && !intro && (
            <div key={speech} className={styles.speech}>
              {speech}
            </div>
          )}
          {!busy && !intro && !duel.result && (
            <div key={`${duel.turn}-${move}`} className={styles.telegraph} data-move={move} style={{ '--c': MOVE_COLOR[move] } as CSSProperties}>
              <span className={styles.seal} data-long={[...tele.word].length > 2 || undefined}>{tele.word}</span>
              <span className={styles.teleLine}>{tele.line}</span>
            </div>
          )}
        </div>
      </div>
      {pulse && (
        <div className={styles.pulseWrap} style={{ '--c': MOVE_COLOR[pulse] } as CSSProperties}>
          <span className={styles.pulseWord} style={{ left: point('guard:top', { x: innerWidth * 0.7, y: 200 }).x, top: point('guard:top', { x: 0, y: 200 }).y }}>
            {dg.moves[pulse].word}
          </span>
        </div>
      )}
      {/* 你的话 */}
      <div className={styles.tray}>
        {firstTurn && !writing && (
          <p className={styles.tip}>
            守卫头上是它这回合要做的事。点一句<b>你写过的话</b>出招，或者用墨水<b>临场写一句</b>。
          </p>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {writing ? (
            <motion.form
              key="write"
              className={styles.write}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              onSubmit={e => {
                e.preventDefault();
                if (!tooLong && text.trim()) void act({ kind: 'write', text: text.trim() });
              }}
            >
              <label className={styles.writeField}>
                <span className="sr-only">临场写一句</span>
                <input ref={inputRef} value={text} maxLength={WRITE_MAX + 4} onChange={e => setText(e.target.value)} placeholder="比如：绕到它背后……" enterKeyHint="send" autoComplete="off" />
                <small data-over={tooLong || undefined}>
                  {[...text.trim()].length}/{WRITE_MAX}
                </small>
              </label>
              <p className={styles.readout} aria-live="polite">
                {!text.trim() ? (
                  '写一个动作：打它、护住自己、回血、蓄力、闪开都行。临场写的效果比说过的话多 1 点；也许还能解开谜语。'
                ) : read ? (
                  <>
                    读懂了「<b style={{ color: keywordColor(read.keyword) }}>{read.quote}</b>」→ <span className={styles.kw} style={{ '--c': keywordColor(read.keyword) } as CSSProperties}>{read.keyword}</span>
                    {DUEL_EFFECTS[read.keyword]}（临场 +1）
                  </>
                ) : (
                  '还没读懂……这样写下去，你会直接扑过去咬它一口。'
                )}
              </p>
              <div className={styles.ideas} aria-label="可以写的方向">
                {IDEAS.map(idea => (
                  <button key={idea.label} type="button" className={styles.idea} style={{ '--c': keywordColor(idea.kw) } as CSSProperties} onClick={() => setText(idea.text)}>
                    <b>{idea.label}</b>
                    <span>{idea.text}</span>
                  </button>
                ))}
              </div>
              <div className={styles.writeActions}>
                <button type="submit" className={styles.go} disabled={!text.trim() || tooLong || busy}>
                  写下去（用 1 滴墨）
                </button>
                <button type="button" className={styles.cancel} onClick={() => setWriting(false)}>
                  算了
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div key="cards" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
              <div className={styles.cardsHead}>
                <small>你写下的话 · 说过的歇两回合 · 首躯足连着说触发连携</small>
                <button type="button" className={styles.retreat} onClick={onRetreat} disabled={busy} data-urgent={low || undefined}>
                  <Icon name="retreat" size={14} /> 撤退
                </button>
              </div>
              <div className={styles.cards}>
                {duel.cards.map((c, i) => {
                  const color = keywordColor(c.keyword);
                  const openIndex = duel.cards.filter(x => !x.used).indexOf(c);
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      layout
                      className={styles.card}
                      data-used={c.used || undefined}
                      style={{ '--c': color, '--i': i } as CSSProperties}
                      disabled={c.used || busy || intro}
                      onClick={() => act({ kind: 'card', cardId: c.id })}
                      whileTap={{ scale: 0.95 }}
                      aria-label={`说出「${c.text}」：${c.keyword}，${DUEL_EFFECTS[c.keyword]}`}
                    >
                      <span className={styles.cardText}>「{c.text}」</span>
                      <span className={styles.cardMeta}>
                        <span className={styles.kw}>{c.keyword}</span>
                        {DUEL_EFFECTS[c.keyword]}
                      </span>
                      <span className={styles.cardSlot}>
                        {c.inherited && <em className={styles.inherit}>传</em>}
                        {c.power ? <em className={styles.power}>+{c.power}</em> : null}
                        {SLOT_NAMES[c.slot]}
                      </span>
                      {!c.used && openIndex >= 0 && openIndex < 9 && <span className={styles.hotkey}>{openIndex + 1}</span>}
                      {c.used && <span className={styles.usedStamp}>歇 {c.rest}</span>}
                    </motion.button>
                  );
                })}
              </div>
              <div className={styles.extra}>
                <button type="button" className={styles.writeBtn} disabled={display.ink <= 0 || busy || intro} onClick={() => setWriting(true)}>
                  <span>✎ 临场写一句</span>
                  <span className={styles.inkMini}>
                    {Array.from({ length: inkMax }, (_, i) => (
                      <i key={i} data-on={i < display.ink || undefined} />
                    ))}
                  </span>
                </button>
                <button type="button" className={styles.basic} disabled={busy || intro} onClick={() => act({ kind: 'basic' })}>
                  {BASIC_WORD}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 特效层 */}
      <div className={styles.fxLayer} aria-hidden>
        {fx.map(f => {
          if (f.kind === 'fly') {
            const mid = { x: (f.from.x + f.to.x) / 2, y: Math.min(f.from.y, f.to.y) - (f.hostile ? 40 : 110) };
            return (
              <motion.span
                key={f.id}
                className={styles.fly}
                data-big={f.big || undefined}
                data-hostile={f.hostile || undefined}
                style={{ '--c': f.color } as CSSProperties}
                initial={{ x: f.from.x, y: f.from.y, scale: 0.4, opacity: 0, rotate: f.hostile ? 8 : -10 }}
                animate={
                  f.fall
                    ? { x: [f.from.x, mid.x, mid.x + 20], y: [f.from.y, mid.y, innerHeight], scale: [0.5, 1.1, 0.8], opacity: [0, 1, 0], rotate: [-10, 0, 40] }
                    : { x: [f.from.x, mid.x, f.to.x], y: [f.from.y, mid.y, f.to.y], scale: [0.5, 1.25, 1], opacity: [0, 1, 1], rotate: [f.hostile ? 8 : -10, 0, 0] }
                }
                transition={{ duration: f.fall ? 1 : f.dur, ease: [0.3, 0, 0.4, 1] }}
              >
                <span>{f.text}</span>
              </motion.span>
            );
          }
          if (f.kind === 'cast')
            return (
              <span key={f.id} className={styles.cast} style={{ left: f.at.x, top: f.at.y, '--c': f.color } as CSSProperties}>
                {f.text}
              </span>
            );
          if (f.kind === 'shield')
            return (
              <span key={f.id} className={styles.shield} style={{ left: f.at.x, top: f.at.y, '--c': f.color } as CSSProperties}>
                <i />
              </span>
            );
          if (f.kind === 'shatter')
            return (
              <span key={f.id} className={styles.shatter} style={{ left: f.at.x, top: f.at.y, '--c': f.color } as CSSProperties}>
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} style={{ '--a': `${i * 36 + 12}deg` } as CSSProperties} />
                ))}
              </span>
            );
          if (f.kind === 'burst')
            return (
              <span key={f.id} className={styles.burst} data-style={f.style} style={{ left: f.at.x, top: f.at.y, '--c': f.color } as CSSProperties}>
                {Array.from({ length: f.style === 'fire' || f.style === 'heal' || f.style === 'rust' ? 14 : 10 }, (_, i) => (
                  <i key={i} style={{ '--a': `${i * (360 / 12) + (f.id % 5) * 11}deg`, '--d': `${(i % 4) * 60}ms`, '--r': `${40 + ((i * 37) % 50)}px` } as CSSProperties} />
                ))}
              </span>
            );
          return (
            <span key={f.id} className={styles.num} data-size={f.size} style={{ left: f.at.x, top: f.at.y, color: f.color, '--dx': `${f.dx}px` } as CSSProperties}>
              {f.text}
            </span>
          );
        })}
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div key={banner.id} className={styles.banner} initial={{ opacity: 0, scaleX: 0.3 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
            <small>{banner.title}</small>
            <s>「{banner.riddle}」</s>
            <b>{banner.line}</b>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 开场对决卡：带着三道谜语 */}
      <AnimatePresence>
        {intro && (
          <motion.div key="versus" className={styles.versus} onClick={() => setIntro(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
            <motion.div className={styles.vsSide} data-side="player" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}>
              <small>你的造物</small>
              <b>{creature.name}</b>
              <span>「{creature.origin.length > 20 ? creature.origin.slice(0, 20) + '…' : creature.origin}」</span>
            </motion.div>
            <motion.span className={styles.vs} initial={{ scale: 2.4, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 14 }}>
              VS
            </motion.span>
            <motion.div className={styles.vsSide} data-side="guard" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 170, damping: 22, delay: 0.08 }}>
              <small>{dg.title}</small>
              <b>{dg.name}</b>
              <ul className={styles.vsRiddles}>
                {dg.riddles.map((r, i) => (
                  <motion.li key={r.id} data-on={solvedAll.has(r.id) || undefined} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.25 }}>
                    「{r.text}」
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <span className={styles.vsHint}>它的三道谜语，要用你写下的话去解 · 点击开始</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
