'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { ShellHealth, PearlMeter, TideGauge } from '@/ui/Meters';
import { ActionCard, GuardPartTag, IntentBubble, IntentPip, type IntentKind } from '@/ui/Battle';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { SLOTS, SLOT_NAMES, type Slot } from '@/domain/keywords';
import { ENERGY_MAX, broken, currentIntent, enraged, upcomingIntents, guardDamage, preview, recommendedAction, type ActionKind, type BattleEvent, type BattleState, type PlayerAction } from '@/domain/battle';
import { intentLine, type GuardDef, type ResolvedIntent } from '@/domain/guards';
import type { CreatureRecord } from '@/domain/types';
import type { RigHandle } from '@/three/CreatureRig';
import { hitStop, slowMotion } from '@/three/timescale';
import { screenPoints } from '@/three/anchors';
import { useAnchor } from '@/game/useAnchor';
import * as sfx from '@/audio/synth';
import { AnimatePresence, motion } from 'motion/react';
import styles from './Battle.module.css';

export interface BattleSceneProps {
  battle: BattleState;
  guard: GuardDef;
  creature: CreatureRecord;
  playerRig: RefObject<RigHandle | null>;
  guardRig: RefObject<RigHandle | null>;
  shake: RefObject<number>;
  /** 提交一步行动，返回结算后的事件（存档已由上层写入）。 */
  onCommit: (action: PlayerAction) => { events: BattleEvent[]; battle: BattleState };
  onFinished: (battle: BattleState) => void;
  onRetreat: () => void;
  tutorialSeen: string[];
  onTutorialSeen: (id: string) => void;
  taunt: string | null;
  streak: number;
  /** 在潮汐泉侦察过这位守卫：显示接下来的出招。 */
  scouted?: boolean;
  onDisplay: (d: { hp: number; maxHp: number; guardHp: Record<Slot, number>; tide: number }) => void;
}

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  kind: 'num' | 'crit' | 'text';
  dx: number;
}

const INTENT_KIND: Record<ResolvedIntent, IntentKind> = {
  strike: 'strike', sweep: 'sweep', break: 'break', charge: 'charge', fortify: 'fortify', heal: 'heal', unleash: 'sweep', stunned: 'heal',
};
const INTENT_TITLE: Partial<Record<ResolvedIntent, string>> = { unleash: '蓄满一击', stunned: '发愣' };

const COACH: Partial<Record<ResolvedIntent, { id: string; text: string }>> = {
  strike: { id: 'strike', text: '守卫头顶的气泡就是它这回合要做的事。普通攻击不重——选「攻击」还手，瞄准它的躯干。' },
  sweep: { id: 'sweep', text: '横扫躲不开，但守护能挡下全部，还会反击一半。读对意图，就能换来潮能珍珠。' },
  break: { id: 'break', text: '破甲会击穿守护。用「机动」闪开，下一次攻击还会暴击。' },
  charge: { id: 'charge', text: '它在蓄力，下回合会有一记重击。现在「机动」能打断它，让它发愣一回合。' },
};

let floaterId = 0;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function BattleScene(props: BattleSceneProps) {
  const { battle, guard, creature, playerRig, guardRig, shake, onCommit, onFinished, onRetreat, tutorialSeen, onTutorialSeen, taunt, onDisplay } = props;
  const [display, setDisplay] = useState(() => ({ hp: battle.hp, guardHp: { ...battle.guardHp }, energy: battle.energy, tide: battle.tide }));
  const [target, setTarget] = useState<Slot>('body');
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<ActionKind | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub?: string; kind: 'perfect' | 'burst' | 'rage'; id: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [speech, setSpeech] = useState<string | null>(battle.turn === 1 ? taunt ?? guard.intro : null);
  const [intro, setIntro] = useState(battle.turn === 1 && battle.log.length === 0);
  const intentRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<HTMLDivElement>(null);
  const tagRefs = { head: useRef<HTMLDivElement>(null), body: useRef<HTMLDivElement>(null), legs: useRef<HTMLDivElement>(null) };
  const trayRef = useRef<HTMLDivElement>(null);

  useAnchor(intentRef, 'guard:top', { offsetY: -14 });
  useAnchor(speechRef, 'guard:top', { offsetY: -104 });
  useAnchor(tagRefs.head, 'guard:head', { offsetX: 54, align: 'left' });
  useAnchor(tagRefs.body, 'guard:body', { offsetX: 64, align: 'left' });
  useAnchor(tagRefs.legs, 'guard:legs', { offsetX: 54, align: 'left' });

  useEffect(() => {
    if (taunt && battle.turn === 1) setSpeech(taunt);
  }, [taunt, battle.turn]);
  useEffect(() => {
    if (!speech || intro) return;
    const t = setTimeout(() => setSpeech(null), 3600);
    return () => clearTimeout(t);
  }, [speech, intro]);
  // 开场对决卡：两秒后自动收起，点击可跳过。
  useEffect(() => {
    if (!intro) return;
    sfx.tideRumble();
    const ms = (globalThis as { __sfIntroMs?: number }).__sfIntroMs ?? 2300;
    const t = setTimeout(() => setIntro(false), ms);
    return () => clearTimeout(t);
  }, [intro]);

  // 托盘高度写进 CSS 变量，引导卡片和回合数据据此避让。
  useEffect(() => {
    const el = trayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--tray-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    onDisplay({ hp: display.hp, maxHp: battle.maxHp, guardHp: display.guardHp, tide: display.tide });
  }, [display, battle.maxHp, onDisplay]);

  const intent = currentIntent(battle);
  const low = display.hp > 0 && display.hp / battle.maxHp < 0.3;
  useEffect(() => {
    if (!low) return;
    const t = setInterval(() => sfx.heartbeat(), 1300);
    return () => clearInterval(t);
  }, [low]);

  // 目标部位被击碎时自动改回躯。
  useEffect(() => {
    if (broken(battle, target)) setTarget('body');
  }, [battle, target]);

  const float = useCallback((key: string, text: string, color: string, kind: Floater['kind'] = 'num') => {
    const p = screenPoints.get(key);
    const x = p?.x ?? innerWidth / 2;
    const y = p?.y ?? innerHeight / 2;
    const f: Floater = { id: ++floaterId, x, y, text, color, kind, dx: (Math.random() - 0.5) * 90 };
    setFloaters(list => [...list, f]);
    setTimeout(() => setFloaters(list => list.filter(i => i.id !== f.id)), 950);
  }, []);

  const showBanner = useCallback((text: string, kind: 'perfect' | 'burst' | 'rage', sub?: string) => {
    setBanner({ text, sub, kind, id: ++floaterId });
    setTimeout(() => setBanner(b => (b && b.text === text ? null : b)), 1000);
  }, []);

  /** 逐个播放事件：命中停顿、飘字、部件抖动、音效。 */
  const play = useCallback(
    async (events: BattleEvent[], after: BattleState) => {
      const hp = { value: display.hp };
      const gh = { ...display.guardHp };
      let energy = display.energy;
      for (const e of events) {
        switch (e.type) {
          case 'burst':
            setFlash(f => f + 1);
            showBanner(e.name, 'burst', '潮能全部释放');
            sfx.burstSound();
            playerRig.current?.lunge();
            slowMotion(500, 0.25);
            await wait(700);
            break;
          case 'hit':
            if (e.target === 'player') {
              hp.value = Math.max(0, hp.value - e.amount);
              guardRig.current?.lunge();
              await wait(180);
              playerRig.current?.hit('any', e.amount >= 8);
              hitStop(e.amount >= 8 ? 90 : 65);
              shake.current = Math.min(0.5, 0.12 + e.amount * 0.02);
              sfx.thud(e.amount >= 8);
              float('player:body', `-${e.amount}`, '#f07a6a', e.amount >= 10 ? 'crit' : 'num');
              if (e.note) float('player:top', e.note, '#f07a6a', 'text');
            } else {
              gh[e.target] = Math.max(0, gh[e.target] - e.amount);
              if (!e.note || e.note === '连击') playerRig.current?.lunge();
              await wait(e.note === '反击' || e.note === '反射' ? 60 : 170);
              guardRig.current?.hit(e.target, Boolean(e.crit));
              hitStop(e.crit ? 90 : 60);
              sfx.thud(Boolean(e.crit));
              float(`guard:${e.target}`, `${e.crit ? '暴击 ' : ''}${e.amount}`, e.crit ? '#ffd98a' : '#f1e8d2', e.crit ? 'crit' : 'num');
              if (e.note && e.note !== '连击') float('guard:top', e.note, '#9ff0d8', 'text');
            }
            setDisplay(d => ({ ...d, hp: hp.value, guardHp: { ...gh } }));
            await wait(260);
            break;
          case 'block':
            sfx.blockSound();
            float('player:top', `挡下 ${e.amount}`, '#9ff0d8', 'text');
            await wait(160);
            break;
          case 'dodge':
            guardRig.current?.lunge();
            sfx.bubble(1.4);
            float('player:top', '闪开！', '#c9b8ff', 'text');
            await wait(320);
            break;
          case 'perfect':
            energy = Math.min(ENERGY_MAX, energy + 1);
            slowMotion(300, 0.3);
            sfx.perfectChime(props.streak + 1);
            showBanner('完美应对', 'perfect', e.text);
            setDisplay(d => ({ ...d, energy }));
            await wait(520);
            break;
          case 'interrupt':
            float('guard:top', '被打断了！', '#ffd98a', 'text');
            sfx.bell(4, 5, 0.2);
            await wait(300);
            break;
          case 'stunned':
            float('guard:top', '发愣中……', '#8faaa0', 'text');
            await wait(260);
            break;
          case 'heal':
            if (e.who === 'player') {
              hp.value = Math.min(battle.maxHp, hp.value + e.amount);
              float('player:top', `+${e.amount}${e.note ? ' ' + e.note : ''}`, '#b6ee9f', 'text');
            } else {
              gh.body += e.amount;
              float('guard:body', `+${e.amount}`, '#b6ee9f', 'text');
            }
            setDisplay(d => ({ ...d, hp: hp.value, guardHp: { ...gh } }));
            await wait(240);
            break;
          case 'burn':
            gh[e.slot] = Math.max(0, gh[e.slot] - e.amount);
            float(`guard:${e.slot}`, `灼烧 ${e.amount}`, '#f2784b', 'text');
            setDisplay(d => ({ ...d, guardHp: { ...gh } }));
            await wait(220);
            break;
          case 'break':
            guardRig.current?.shatter(e.slot);
            shake.current = 0.55;
            hitStop(110);
            sfx.thud(true);
            sfx.bell(-1, 4, 0.3);
            setSpeech(guard.broke[e.slot]);
            if (e.slot !== 'body') float(`guard:${e.slot}`, `击碎${SLOT_NAMES[e.slot]}！`, '#ffd98a', 'text');
            await wait(650);
            break;
          case 'rest':
            float('player:top', '停下来吃东西……', '#ee9a45', 'text');
            await wait(400);
            break;
          case 'enrage':
            showBanner('潮位涨满', 'rage', `${guard.name}狂暴了，伤害 ×1.5`);
            sfx.tideRumble();
            await wait(700);
            break;
          case 'tide':
            setDisplay(d => ({ ...d, tide: e.level }));
            break;
        }
      }
      if (after.energy !== energy) setDisplay(d => ({ ...d, energy: after.energy }));
      setDisplay({ hp: after.hp, guardHp: { ...after.guardHp }, energy: after.energy, tide: after.tide });
    },
    [display, float, guardRig, playerRig, shake, showBanner, battle.maxHp, guard, props.streak],
  );

  const act = useCallback(
    async (kind: ActionKind) => {
      if (busy || battle.result) return;
      const action: PlayerAction = { kind, target: kind === 'attack' || kind === 'burst' ? target : undefined };
      if (!preview(battle, action).legal.ok) return;
      sfx.unlockAudio();
      setBusy(true);
      setSpeech(null);
      const { events, battle: after } = onCommit(action);
      await play(events, after);
      if (after.result) {
        if (after.result === 'win') {
          sfx.bell(0, 5, 0.25);
          sfx.bell(4, 5, 0.2);
          playerRig.current?.hop();
        }
        await wait(after.result === 'loss' ? 700 : 900);
        onFinished(after);
      }
      setBusy(false);
    },
    [busy, battle, target, onCommit, play, onFinished, playerRig],
  );

  // 键盘：1 攻击 2 守护 3 机动 4 爆发；Q/W/E 切换目标。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, ActionKind> = { '1': 'attack', '2': 'guard', '3': 'move', '4': 'burst' };
      if (map[e.key]) void act(map[e.key]);
      const slots: Record<string, Slot> = { q: 'head', w: 'body', e: 'legs' };
      const s = slots[e.key.toLowerCase()];
      if (s && !broken(battle, s)) setTarget(s);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [act, battle]);

  const previews = useMemo(() => {
    const out = {} as Record<ActionKind, ReturnType<typeof preview>>;
    for (const kind of ['attack', 'guard', 'move', 'burst'] as ActionKind[]) out[kind] = preview(battle, { kind, target });
    return out;
  }, [battle, target]);

  // 新手引导：教学守卫的每种意图第一次出现时，高亮正确的行动卡。
  const coachEntry = guard.tutorial && !busy && !intro && !battle.result ? (battle.energy >= ENERGY_MAX && !tutorialSeen.includes('burst') ? { id: 'burst', text: `潮能攒满了！释放原话爆发——招式名就是你写下的「${battle.burstQuote}」。` } : COACH[intent] && !tutorialSeen.includes(COACH[intent]!.id) ? COACH[intent]! : null) : null;
  const coachAction = coachEntry ? (coachEntry.id === 'burst' ? 'burst' : recommendedAction({ ...battle, energy: 0 })) : null;
  const doAct = (kind: ActionKind) => {
    if (coachEntry) {
      if (kind !== coachAction) return;
      onTutorialSeen(coachEntry.id);
    }
    void act(kind);
  };

  const incoming = guardDamage(battle, intent);
  const intentTitle = INTENT_TITLE[intent];
  const burstReady = battle.energy >= ENERGY_MAX;

  return (
    <div className={styles.layer}>
      {low && <div className={styles.danger} />}

      <div className={styles.hud}>
        <div className={styles.side}>
          <span className={styles.who}>
            <small>你的造物</small>
            {creature.name}
          </span>
          <ShellHealth hp={display.hp} max={battle.maxHp} preview={hover ? previews[hover].taken : 0} label={`${creature.name}的生命`} />
          <PearlMeter value={display.energy} />
        </div>
        <div className={`${styles.side} ${styles.guardSide}`}>
          <span className={styles.who}>
            <small>{guard.title}</small>
            {guard.name}
          </span>
          <ShellHealth hp={display.guardHp.body} max={battle.guardMax.body} side="enemy" preview={hover && target === 'body' ? previews[hover].dealt : 0} label={`${guard.name}躯干的生命`} />
          <span className={styles.winHint}>击碎躯干即可获胜</span>
        </div>
      </div>

      <div className={styles.turn}>第 {battle.turn} 回合</div>

      <div className={styles.tide}>
        <TideGauge level={display.tide} max={guard.tideMax} height={160} />
        <span>潮位</span>
      </div>

      {!battle.result && !busy && !speech && !intro && (
        <div ref={intentRef} className={styles.anchored}>
          <div key={`${battle.turn}-${intent}`}>
            <IntentBubble kind={INTENT_KIND[intent]} line={intentLine(guard, intent)} damage={incoming} title={intentTitle} />
          </div>
        </div>
      )}
      {speech && !intro && (
        <div ref={speechRef} className={styles.anchored}>
          <div className={styles.speech}>{speech}</div>
        </div>
      )}

      {SLOTS.map(slot => (
        <div key={slot} ref={tagRefs[slot]} className={styles.anchored} style={{ opacity: busy ? 0.4 : undefined }}>
          <GuardPartTag glyph={SLOT_NAMES[slot] as '首' | '躯' | '足'} name={guard.parts[slot].name} hp={display.guardHp[slot]} max={battle.guardMax[slot]} targeted={target === slot && !broken(battle, slot)} onSelect={() => !broken(battle, slot) && setTarget(slot)} />
        </div>
      ))}

      <div ref={trayRef} className={styles.tray}>
        {props.scouted && !battle.result && (
          <div className={styles.upcoming} aria-label="侦察情报：接下来的出招">
            <small>
              <Icon name="scout" size={13} /> 接下来
            </small>
            {upcomingIntents(battle, 4)
              .slice(1)
              .map((k, i) => (
                <IntentPip key={`${battle.turn}-${i}`} kind={INTENT_KIND[k]} title={INTENT_TITLE[k]} dim={i > 0} />
              ))}
          </div>
        )}
        <div className={styles.trayInfo}>
          <span className={styles.targetHint}>
            目标：<b>{guard.parts[target].name}</b>（点守卫身上的标签切换）
          </span>
          <Button size="sm" variant="danger" className={styles.retreat} data-urgent={low || undefined} onClick={onRetreat} disabled={busy}>
            <Icon name="retreat" size={16} />
            撤退
          </Button>
        </div>
        {burstReady && (
          <div className={styles.cardWrap} data-coach={coachAction === 'burst' || undefined}>
            <ActionCard kind="burst" title={`「${battle.burstQuote}」爆发`} taken={previews.burst.taken} dealt={previews.burst.dealt} note="释放全部潮能，守卫这回合无法行动" hotkey={4} disabled={busy} onSelect={() => doAct('burst')} />
          </div>
        )}
        <div className={styles.cards} onPointerLeave={() => setHover(null)}>
          {(['attack', 'guard', 'move'] as const).map((kind, i) => {
            const p = previews[kind];
            const title = kind === 'attack' ? '攻击' : kind === 'guard' ? '守护' : '机动';
            const note = kind === 'attack' ? `目标：${SLOT_NAMES[target]}${p.note ? ' · ' + p.note : ''}` : p.legal.ok ? p.note : p.legal.reason;
            return (
              <div key={kind} className={styles.cardWrap} data-coach={coachAction === kind || undefined} data-dim={(coachEntry && coachAction !== kind) || undefined} onPointerEnter={() => setHover(kind)} onFocus={() => setHover(kind)}>
                <ActionCard kind={kind} title={title} taken={p.taken} dealt={p.dealt} note={note} perfect={Boolean(p.perfect)} hotkey={i + 1} disabled={busy || !p.legal.ok} onSelect={() => doAct(kind)} />
              </div>
            );
          })}
        </div>
      </div>

      {coachEntry && (
        <>
          <div className={styles.coachDim} />
          <div className={styles.coach} role="dialog" aria-live="polite">
            <small>潮汐学徒在教你</small>
            <p>{coachEntry.text}</p>
          </div>
        </>
      )}

      <AnimatePresence>
        {intro && (
          <motion.div key="versus" className={styles.versus} onClick={() => setIntro(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
            <motion.div className={styles.vsSide} data-side="player" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}>
              <small>你的造物</small>
              <b>{creature.name}</b>
              <span>「{creature.origin.length > 18 ? creature.origin.slice(0, 18) + '…' : creature.origin}」</span>
            </motion.div>
            <motion.span className={styles.vs} initial={{ scale: 2.4, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 14 }}>
              VS
            </motion.span>
            <motion.div className={styles.vsSide} data-side="guard" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 170, damping: 22, delay: 0.08 }}>
              <small>{guard.title}</small>
              <b>{guard.name}</b>
              <span>{guard.intro}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {floaters.map(f =>
        f.kind === 'text' ? null : (
          <span key={`s${f.id}`} className={styles.spark} data-kind={f.kind} style={{ left: f.x, top: f.y, color: f.color } as CSSProperties} aria-hidden>
            {Array.from({ length: f.kind === 'crit' ? 12 : 8 }, (_, i) => (
              <i key={i} style={{ '--a': `${(360 / (f.kind === 'crit' ? 12 : 8)) * i + (f.id % 7) * 9}deg` } as CSSProperties} />
            ))}
          </span>
        ),
      )}
      {floaters.map(f => (
        <span key={f.id} className={styles.float} data-kind={f.kind} style={{ left: f.x, top: f.y, color: f.color, '--dx': `${f.dx}px` } as CSSProperties}>
          {f.text}
        </span>
      ))}
      {banner && (
        <div key={banner.id} className={styles.banner} data-kind={banner.kind}>
          <b>{banner.text}</b>
          {banner.sub && <small>{banner.sub}</small>}
        </div>
      )}
      {flash > 0 && <div key={flash} className={styles.flash} />}
      {enraged(battle, guard) && <span className="sr-only">守卫已狂暴</span>}
    </div>
  );
}
