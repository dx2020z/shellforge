'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { RigHandle } from '@/three/CreatureRig';
import type { StageCreature, StageMode } from '@/three/Stage';
import { StageViewport } from '@/three/StageViewport';
import { setReducedMotion } from '@/three/timescale';
import { clearPoints } from '@/three/anchors';
import { Workshop } from '@/scenes/Workshop';
import { ForgeRitual, type RitualPhase } from '@/scenes/ForgeRitual';
import { BattleScene } from '@/scenes/BattleScene';
import { WinResult, LossResult, DuelWin } from '@/scenes/Result';
import { DuelScene } from '@/scenes/DuelScene';
import { reviewDuel, type DuelAction, type DuelState } from '@/domain/duel';
import { nextDuelGuard, PRESET_GUARDS } from '@/domain/duel-guards';
import { ExpeditionMap } from '@/scenes/ExpeditionMap';
import { TidalSpring } from '@/scenes/TidalSpring';
import { Codex, CreatureCard } from '@/scenes/Codex';
import { Icon } from '@/ui/Icon';
import { TideWipe } from '@/ui/Transition';
import { browserStorage, DEMO_SAVE_KEY, loadSave, newGame, SAVE_KEY, writeSave } from '@/domain/save';
import { creatureParts, findCreature, maxHp, partTints, updatePartModel } from '@/domain/creature';
import { guardById, GUARDS } from '@/domain/guards';
import { guardModelUrls, MODEL_POOL } from '@/domain/model-pool';
import { reviewMistakes, type BattleState, type PlayerAction } from '@/domain/battle';
import type { CreatureRecord, GameSave } from '@/domain/types';
import { SLOT_NAMES, type Slot } from '@/domain/keywords';
import { localCreatureDraft } from '@/server/providers/creature';
import { applyDuel, MARK_MAX, canForge, deleteCreature, roster as rosterOf, ROSTER_MAX, selectCreature, retreatDuel, settleDuelLoss, settleDuelWin, startDuel, applyAction, burstQuote, fallbackEpitaph, forgeFromDraft, guardForDepth, retreat, settleDeath, settleWin, SPRING_LINES, startBattle, startExpedition, uid, applySpring, type ForgeDraft, type SpringChoice } from './logic';
import * as sfx from '@/audio/synth';
import styles from '@/scenes/scenes.module.css';

type Scene = 'loading' | 'workshop' | 'forging' | 'omen' | 'map' | 'spring' | 'battle' | 'result' | 'duel' | 'duelResult';

const SHOWCASE: StageCreature = {
  urls: [MODEL_POOL.find(p => p.id === 'fluffy:head')!.url, MODEL_POOL.find(p => p.id === 'bull:body')!.url, MODEL_POOL.find(p => p.id === 'moon-fish:legs')!.url],
};

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export default function Game() {
  const [save, setSave] = useState<GameSave | null>(null);
  const [scene, setScene] = useState<Scene>('loading');
  const [demo, setDemo] = useState(false);
  /** 只有 ?offline=1 才完全离线；演示存档（?demo=1）只是换一个独立的存档，AI 照常可用。 */
  const [offline, setOffline] = useState(false);
  const [status, setStatus] = useState({ deepseek: false, tripo: false });
  const [muted, setMutedState] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [forge, setForge] = useState<{ origin: string; draft: ForgeDraft | null; phase: RitualPhase; note: string | null; dropKey: string } | null>(null);
  const [serverReply, setServerReply] = useState<string | null>(null);
  const [hud, setHud] = useState<{ hp: number; maxHp: number; guardHp: Record<Slot, number>; tide: number } | null>(null);
  const [taunt, setTaunt] = useState<string | null>(null);
  const [epitaph, setEpitaph] = useState<string | null>(null);
  const [firstWin, setFirstWin] = useState(false);
  const [cameFrom, setCameFrom] = useState<number | null>(null);
  const [springLine, setSpringLine] = useState(SPRING_LINES[0]);
  const [codex, setCodex] = useState(false);
  /** Tripo 生成进度（部件编号 → 0–100）。 */
  const [hatch, setHatch] = useState<Record<string, number>>({});
  const [wipe, setWipe] = useState(0);
  const lastScene = useRef<Scene>('loading');
  const [card, setCard] = useState<CreatureRecord | null>(null);
  const [duelDanger, setDuelDanger] = useState(false);
  const [duelFirstWin, setDuelFirstWin] = useState(false);
  const playerRig = useRef<RigHandle>(null);
  const guardRig = useRef<RigHandle>(null);
  const shake = useRef(0);
  const saveRef = useRef<GameSave | null>(null);
  const key = demo ? DEMO_SAVE_KEY : SAVE_KEY;

  /** 每次存档变化立刻写入浏览器：刷新页面无法逃避死亡。 */
  const commit = useCallback(
    (next: GameSave) => {
      saveRef.current = next;
      setSave(next);
      if (!writeSave(browserStorage(), next, key)) setNotice('这台设备不允许保存进度，本次远征结束后不会留下记录。');
    },
    [key],
  );

  // 读档、减少动态效果、集成状态。
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isDemo = params.get('demo') === '1';
    const isOffline = params.get('offline') === '1';
    setOffline(isOffline);
    setDemo(isDemo);
    // 请浏览器把本站存档当作「持久存储」，减少手机 Safari 等在空间紧张或久未访问时清掉进度的可能。
    void navigator.storage?.persist?.().catch(() => false);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const loaded = loadSave(browserStorage(), isDemo ? DEMO_SAVE_KEY : SAVE_KEY);
    let initial = loaded.status === 'ok' || loaded.status === 'restored' ? loaded.save : newGame();
    // 旧版的地图远征（没有进行中的对决或战斗）直接回到港口。
    if (initial.expedition && !initial.expedition.duel && !initial.expedition.battle) initial = { ...initial, expedition: null };
    if (loaded.status === 'restored' || loaded.status === 'unreadable') setNotice(loaded.status === 'restored' && loaded.detail ? `${loaded.note}（技术信息：${loaded.detail}）` : loaded.note);
    saveRef.current = initial;
    setSave(initial);
    setMutedState(initial.settings.muted);
    sfx.setMuted(initial.settings.muted);
    const battle = initial.expedition?.battle;
    const exp = initial.expedition;
    setScene(exp?.duel ? (exp.duel.result ? 'duelResult' : 'duel') : battle ? (battle.result ? 'result' : 'battle') : 'workshop');
    if (!isOffline) {
      fetch('/api/status')
        .then(r => r.json())
        .then(s => setStatus({ deepseek: Boolean(s.deepseek), tripo: Boolean(s.tripo) }))
        .catch(() => {});
    }
  }, []);

  // 在海沟、战斗、潮汐泉、港口之间切换时放一道潮水。
  useEffect(() => {
    const prev = lastScene.current;
    lastScene.current = scene;
    const wet: Scene[] = ['map', 'battle', 'spring', 'workshop'];
    if (prev !== scene && wet.includes(prev) && wet.includes(scene)) setWipe(w => w + 1);
  }, [scene]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.length > 40 ? 12000 : 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const creature = save ? findCreature(save, save.activeCreatureId) : undefined;
  const alive = creature?.status === 'alive' ? creature : undefined;
  const parts = save && creature ? creatureParts(save, creature) : [];
  const battle = save?.expedition?.battle ?? null;
  const guard = battle ? guardById(battle.guardId) : null;
  const nextDepth = save?.tutorial.done ? 1 : 0;

  /* ---------------- Tripo：后台生成，完成后热替换外观 ---------------- */
  const startTripo = useCallback(
    async (next: GameSave, creatureId: string, retry = false) => {
      if (!status.tripo || offline) return next;
      const c = findCreature(next, creatureId);
      if (!c) return next;
      let current = next;
      const failed: string[] = [];
      for (const part of creatureParts(next, c)) {
        if (part.origin.kind !== 'forged' || !part.visualPrompt) continue;
        const res = await postJson<{ task: { id: string }; error?: string }>('/api/models/tasks', { id: uid(), slot: part.slot, prompt: part.visualPrompt, retry });
        if (res.ok && res.data?.task) current = updatePartModel(current, part.id, { ...part.model, taskId: res.data.task.id }); // 孵化中：保留现在的样子，完成后逐件替换
        else failed.push(`${part.name}${res.data?.error ? `（${res.data.error}）` : ''}`);
      }
      if (failed.length) setNotice(`专属外形没能开始生成：${failed.join('、')}。先用部件库的样子。`);
      return current;
    },
    [status.tripo, offline],
  );

  useEffect(() => {
    if (!save || offline || !status.tripo) return;
    const pending = save.parts.filter(p => p.model.taskId);
    if (!pending.length) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      for (const part of pending) {
        try {
          const res = await fetch(`/api/models/tasks/${part.model.taskId}`, { cache: 'no-store' });
          const data = (await res.json()) as { task?: { status: string; modelUrl: string | null; progress?: number; message?: string } };
          const current = saveRef.current;
          if (!current || !data.task) continue;
          setHatch(h => ({ ...h, [part.id]: Math.round(data.task!.progress ?? 0) }));
          if (data.task.status === 'succeeded' && data.task.modelUrl) {
            commit(updatePartModel(current, part.id, { kind: 'generated', url: data.task.modelUrl, rotation: [0, 0, 0] }));
            setNotice(`「${part.name}」的新外壳孵化好了。`);
          } else if (['failed', 'unknown'].includes(data.task.status)) {
            commit(updatePartModel(current, part.id, { ...part.model, taskId: undefined }));
            setNotice(`「${part.name}」的专属外形没生成出来${data.task.message ? `（${data.task.message}）` : ''}，先用部件库的样子。`);
          }
        } catch {
          /* 下次再查。 */
        }
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [save, offline, status.tripo, commit]);

  /* ---------------- 锻造 ---------------- */
  const onForge = useCallback(
    async (origin: string) => {
      if (saveRef.current && !canForge(saveRef.current)) {
        setNotice(`名册满了：最多同时养 ${ROSTER_MAX} 只活着的造物。`);
        return;
      }
      sfx.unlockAudio();
      setServerReply(null);
      setForge({ origin, draft: null, phase: 'rise', note: null, dropKey: '' });
      setScene('forging');
      sfx.bubble();
      let draft: ForgeDraft | null = null;
      let note: string | null = null;
      if (!offline) {
        const res = await postJson<{ draft?: ForgeDraft; note?: string; reply?: string; error?: string }>('/api/forge', { description: origin });
        if (res.status === 422 && res.data?.reply) {
          setServerReply(res.data.reply);
          setForge(null);
          setScene('workshop');
          return;
        }
        if (res.ok && res.data?.draft) {
          draft = res.data.draft;
          note = res.data.note ?? null;
        } else if (res.status === 429 && res.data?.error) note = res.data.error;
      }
      if (!draft) draft = localCreatureDraft(origin);
      setForge(f => (f ? { ...f, draft, note } : f));
    },
    [offline],
  );

  const onRevealed = useCallback(() => setForge(f => (f ? { ...f, phase: 'reveal' } : f)), []);
  const onHatched = useCallback(async () => {
    const current = saveRef.current;
    if (!current || !forge?.draft) return;
    let next = forgeFromDraft(current, forge.draft);
    commit(next);
    setForge(f => (f ? { ...f, phase: 'hatch', dropKey: uid() } : f));
    setTimeout(() => setForge(f => (f ? { ...f, phase: 'done' } : f)), 1900);
    if (next.activeCreatureId) {
      next = await startTripo(next, next.activeCreatureId);
      if (next !== saveRef.current) commit({ ...saveRef.current!, parts: next.parts });
    }
  }, [forge, commit, startTripo]);

  /* ---------------- 出征 ---------------- */
  /** 从港口出发：进入海沟地图。 */
  const toMap = useCallback(() => {
    const current = saveRef.current;
    if (!current) return;
    commit(startExpedition(current));
    setCameFrom(null);
    setScene('map');
  }, [commit]);

  /** 在地图上点「挑战」：挑战当前深度的守卫。 */
  const begin = useCallback(() => {
    const current = saveRef.current;
    if (!current) return;
    clearPoints('guard');
    const next = startBattle(current);
    commit(next);
    setTaunt(null);
    setScene('battle');
    const c = findCreature(next, next.activeCreatureId)!;
    const g = guardForDepth(next.expedition!.depth);
    if (!offline) {
      void postJson<{ line: string | null }>('/api/lines/taunt', {
        guard: g.name,
        catchphrase: g.catchphrase,
        creature: c.name.slice(0, 12),
        origin: c.origin.slice(0, 60),
        keywords: creatureParts(next, c).flatMap(p => p.trait.keywords),
      }).then(r => r.data?.line && setTaunt(r.data.line));
    }
  }, [commit, offline]);

  /* ---------------- 写字对决（核心玩法样板） ---------------- */
  const beginDuel = useCallback(() => {
    const current = saveRef.current;
    if (!current) return;
    clearPoints('guard');
    setDuelDanger(false);
    commit(startDuel(current));
    setScene('duel');
  }, [commit]);

  const onDuelAct = useCallback(
    (action: DuelAction) => {
      const out = applyDuel(saveRef.current!, action);
      commit(out.save);
      return { events: out.events, duel: out.duel };
    },
    [commit],
  );

  const onDuelFinished = useCallback(
    (d: DuelState) => {
      const current = saveRef.current!;
      setScene('duelResult');
      if (d.result === 'win') setDuelFirstWin(!current.loreUnlocked.includes(d.guardId));
      if (d.result === 'loss') {
        setEpitaph(null);
        const c = findCreature(current, current.expedition!.creatureId)!;
        const g = guardById(d.guardId);
        const fallback = fallbackEpitaph(c, burstQuote(current, c), g, 0);
        if (offline) setEpitaph(fallback);
        else
          void postJson<{ line: string | null }>('/api/lines/epitaph', {
            creature: c.name.slice(0, 12),
            origin: c.origin.slice(0, 60),
            killedBy: g.name,
            guardsBeaten: [],
            generation: c.generation,
          }).then(r => setEpitaph(r.data?.line ?? fallback));
      }
    },
    [offline],
  );

  const onDuelRetreat = useCallback(() => {
    commit(retreatDuel(saveRef.current!));
    setScene('workshop');
    setNotice('它带着伤回到了港口。活着，就还能再出发。');
  }, [commit]);

  const onDepart = useCallback(() => {
    setForge(null);
    const c = saveRef.current && findCreature(saveRef.current, saveRef.current.activeCreatureId);
    if (c && c.expeditions === 0 && c.wins === 0) setScene('omen');
    else beginDuel();
  }, [beginDuel]);

  const onDive = useCallback(() => {
    const c = saveRef.current && findCreature(saveRef.current, saveRef.current.activeCreatureId);
    if (c && c.expeditions === 0 && c.wins === 0) setScene('omen');
    else beginDuel();
  }, [beginDuel]);

  const onCommit = useCallback(
    (action: PlayerAction) => {
      const out = applyAction(saveRef.current!, action);
      commit(out.save);
      return { events: out.events, battle: out.battle };
    },
    [commit],
  );

  const onFinished = useCallback(
    (b: BattleState) => {
      setScene('result');
      const current = saveRef.current!;
      if (b.result === 'win') setFirstWin(!current.loreUnlocked.includes(b.guardId));
      if (b.result === 'loss') {
        sfx.deathBell();
        setEpitaph(null);
        const c = findCreature(current, current.expedition!.creatureId)!;
        const g = guardById(b.guardId);
        const fallback = fallbackEpitaph(c, burstQuote(current, c), g, current.expedition?.beaten.length ?? 0);
        if (offline) setEpitaph(fallback);
        else
          void postJson<{ line: string | null }>('/api/lines/epitaph', {
            creature: c.name.slice(0, 12),
            origin: c.origin.slice(0, 60),
            killedBy: g.name,
            guardsBeaten: (current.expedition?.beaten ?? []).map(id => guardById(id).name),
            generation: c.generation,
          }).then(r => setEpitaph(r.data?.line ?? fallback));
      }
    },
    [offline],
  );

  const onWinContinue = useCallback(
    (pick: Slot | null, equip: boolean, dive: boolean) => {
      const before = saveRef.current!.expedition!.depth;
      let next = settleWin(saveRef.current!, pick, equip);
      if (dive && next.expedition) {
        commit(next);
        setCameFrom(before);
        if (next.expedition.spring) {
          setSpringLine(SPRING_LINES[(next.expedition.beaten.length + next.revision) % SPRING_LINES.length]);
          sfx.bubble();
          setScene('spring');
        } else setScene('map');
        return;
      }
      next = retreat(next);
      commit(next);
      setScene('workshop');
      setNotice('它带着战利品回到了港口。');
    },
    [commit],
  );

  const onSpring = useCallback(
    (choice: SpringChoice) => {
      commit(applySpring(saveRef.current!, choice));
      sfx.bell(0, 4, 0.25);
      setScene('map');
    },
    [commit],
  );

  const onInherit = useCallback(
    (partId: string) => {
      const current = saveRef.current!;
      const c = findCreature(current, current.expedition!.creatureId)!;
      const fallback = fallbackEpitaph(c, burstQuote(current, c), guardById(current.expedition!.battle!.guardId), current.expedition!.beaten.length);
      commit(settleDeath(current, partId, epitaph ?? fallback));
      setScene('workshop');
    },
    [commit, epitaph],
  );

  const onRetreat = useCallback(() => {
    const wasFighting = Boolean(saveRef.current?.expedition?.battle);
    commit(retreat(saveRef.current!));
    setScene('workshop');
    setNotice(wasFighting ? '它带着伤回到了港口。活着，就还能再出发。' : '它回到了港口。');
  }, [commit]);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    sfx.setMuted(next);
    if (saveRef.current) commit({ ...saveRef.current, settings: { ...saveRef.current.settings, muted: next } });
  };

  /* ---------------- 舞台数据 ---------------- */
  const mode: StageMode = scene === 'battle' || scene === 'result' || scene === 'duel' || scene === 'duelResult' ? 'battle' : scene === 'forging' || scene === 'omen' || scene === 'spring' ? 'forge' : 'workshop';
  const playerStage: StageCreature | null = useMemo(() => {
    if (!save) return null;
    if (scene === 'forging' && forge && (forge.phase === 'rise' || forge.phase === 'reveal')) return null;
    const c = findCreature(save, scene === 'result' || scene === 'battle' || scene === 'duel' || scene === 'duelResult' ? save.expedition?.creatureId ?? save.activeCreatureId : save.activeCreatureId);
    if (!c) return scene === 'workshop' ? SHOWCASE : null;
    const ps = creatureParts(save, c);
    return {
      urls: ps.map(p => p.model.url) as StageCreature['urls'],
      tints: partTints(ps),
      rotations: ps.map(p => p.model.rotation) as StageCreature['rotations'],
      secrets: c.secrets,
      dropKey: scene === 'forging' ? forge?.dropKey : undefined,
    };
  }, [save, scene, forge]);
  const duel = save?.expedition?.duel ?? null;
  const duelG = duel?.g ?? null;
  const upcoming = useMemo(() => (save && alive ? nextDuelGuard(save, alive) : PRESET_GUARDS[0]), [save, alive]);
  const afterWinNext = useMemo(() => {
    if (!save || !duel || duel.result !== 'win') return null;
    try {
      const next = settleDuelWin(save);
      const c = findCreature(next, next.activeCreatureId);
      return c ? nextDuelGuard(next, c).name : null;
    } catch {
      return null;
    }
  }, [save, duel]);
  const guardStage: StageCreature | null = useMemo(() => {
    if (duelG) return { urls: duelG.models, rotations: duelG.rotations, tints: duelG.tints };
    const g = battle ? guard : null;
    if (!g) return null;
    const u = guardModelUrls(g.modelSet);
    return { urls: [u.head, u.body, u.legs] };
  }, [battle, guard, duelG]);

  const guardBroken = hud ? (['head', 'body', 'legs'] as Slot[]).filter(s => hud.guardHp[s] <= 0) : [];
  const heir = save?.heir ? save.parts.find(p => p.id === save.heir!.partId) ?? null : null;

  return (
    <>
      <StageViewport
        mode={mode}
        creatureName={alive?.name}
        player={playerStage}
        guard={mode === 'battle' ? guardStage : null}
        playerRef={playerRig}
        guardRef={guardRig}
        tide={scene === 'duel' || scene === 'duelResult' ? 0 : hud && guard ? hud.tide / guard.tideMax : 0}
        enraged={scene !== 'duel' && Boolean(hud && guard && hud.tide >= guard.tideMax)}
        danger={scene === 'duel' ? duelDanger : Boolean(hud && hud.hp / hud.maxHp < 0.3)}
        school={save?.expedition?.streak ?? 0}
        playerDead={(scene === 'result' && battle?.result === 'loss') || (scene === 'duelResult' && duel?.result === 'loss')}
        guardBroken={scene === 'duel' || scene === 'duelResult' ? [] : guardBroken}
        shakeRef={shake}
        paused={scene === 'map'}
      />

      <div className={styles.topbar} data-scene={scene} style={{ zIndex: 45 }}>
        <div className={styles.brand}>
          <b>SHELLFORGE</b>
          <span>造物之海{demo ? ' · 演示' : ''}</span>
        </div>
        <div className={styles.topActions}>
          {save && save.creatures.length > 0 && (scene === 'workshop' || scene === 'map') && (
            <button type="button" className={styles.roundButton} onClick={() => setCodex(true)} aria-label="打开图鉴">
              <Icon name="book" size={20} />
            </button>
          )}
          <button type="button" className={styles.roundButton} onClick={toggleMute} aria-label={muted ? '打开声音' : '静音'}>
            <Icon name={muted ? 'mute' : 'sound'} size={20} />
          </button>
        </div>
      </div>

      {scene === 'loading' && (
        <div className={styles.omen} style={{ background: 'var(--abyss)', cursor: 'default' }}>
          <p className={styles.omenHint}>潮水正在退去……</p>
        </div>
      )}

      {scene === 'workshop' && save && (
        <Workshop
          key={alive?.id ?? 'new'}
          creature={alive ?? null}
          parts={alive ? parts : []}
          nextGuard={upcoming}
          riddles={upcoming.riddles.map(r => ({ text: r.text, solved: (save.riddles[upcoming.id] ?? []).includes(r.id) }))}
          roster={rosterOf(save).map(c => {
            const ps = creatureParts(save, c);
            return { id: c.id, name: c.name, generation: c.generation, wins: c.wins, urls: ps.map(p => p.model.url), rotations: ps.map(p => p.model.rotation), tints: partTints(ps) };
          })}
          rosterMax={ROSTER_MAX}
          ai={{ deepseek: status.deepseek, tripo: status.tripo, offline }}
          canForge={canForge(save)}
          onSelect={id => saveRef.current && !saveRef.current.expedition && commit(selectCreature(saveRef.current, id))}
          heir={heir}
          busy={false}
          onForge={onForge}
          onDive={onDive}
          onNewCreature={() => {}}
          onCard={alive ? () => setCard(alive) : undefined}
          onDelete={alive ? () => {
            if (!window.confirm(`确定删除「${alive.name}」吗？删除后会释放一个名额，不能撤销。`)) return;
            const current = saveRef.current;
            if (current) commit(deleteCreature(current, alive.id));
          } : undefined}
          onRegenerate={
            alive && status.tripo && !offline && !parts.some(p => p.model.taskId) && parts.some(p => p.origin.kind === 'forged' && p.visualPrompt)
              ? async () => {
                  const current = saveRef.current!;
                  setNotice('好，让它重新孵化一副外形，几分钟后自动换上。');
                  const next = await startTripo(current, alive.id, true);
                  if (next !== current) commit({ ...saveRef.current!, parts: next.parts });
                }
              : undefined
          }
          serverReply={serverReply}
        />
      )}

      {scene === 'forging' && forge && (
        <ForgeRitual
          origin={forge.origin}
          draft={forge.draft}
          phase={forge.phase}
          note={forge.note}
          onRevealed={onRevealed}
          onHatched={onHatched}
          onDepart={onDepart}
          onRewrite={() => {
            setForge(null);
            setScene('workshop');
          }}
          reduced={typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches}
          hatching={(() => {
            if (!save || offline || !status.tripo) return null;
            const hatchingOf = (c: CreatureRecord) => creatureParts(save, c).some(p => p.model.taskId);
            const active = findCreature(save, save.activeCreatureId);
            if (!active || !hatchingOf(active)) return null;
            return { canForgeMore: canForge(save), others: rosterOf(save).filter(c => c.id !== active.id && hatchingOf(c)).length };
          })()}
        />
      )}

      <AnimatePresence>
        {scene === 'omen' && alive && (
          <motion.div
            key="omen"
            className={styles.omen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            onClick={() => {
              sfx.bell(0, 4, 0.3);
              beginDuel();
            }}
          >
            <div className={styles.omenInner}>
              <p className={styles.omenLine}>
                这是<em>{alive.name}</em>
                <br />
                唯一的一条命。
              </p>
              <p className={styles.omenSub}>
                它倒下之后不会回来，只会留下一句墓志铭和一件部件。
                <br />
                读懂守卫的意图，在需要的时候，带它撤退。
              </p>
              <span className={styles.omenHint}>点击任意处，潜入海沟</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {scene === 'map' && save?.expedition && alive && (
        <ExpeditionMap
          creature={alive}
          parts={parts}
          hp={save.expedition.hp}
          maxHp={maxHp(parts)}
          depth={save.expedition.depth}
          beaten={save.expedition.beaten}
          loreUnlocked={save.loreUnlocked}
          guardDefeats={save.guardDefeats}
          scouted={save.expedition.scouted}
          cameFrom={cameFrom}
          onChallenge={begin}
          onRetreat={onRetreat}
        />
      )}

      {scene === 'spring' && save?.expedition && alive && (
        <TidalSpring
          line={springLine}
          hp={save.expedition.hp}
          maxHp={maxHp(parts)}
          parts={parts}
          nextGuard={guardForDepth(save.expedition.depth)}
          scouted={save.expedition.scouted.includes(guardForDepth(save.expedition.depth).id)}
          onChoose={onSpring}
        />
      )}

      {scene === 'duel' && duel && duelG && alive && save && (
        <DuelScene
          key={`${duel.guardId}-${save.expedition?.creatureId}-${duel.tier}-${save.guardDefeats[duel.guardId] ?? 0}`}
          duel={duel}
          dg={duelG}
          creature={alive}
          known={save.riddles[duel.guardId] ?? []}
          playerRig={playerRig}
          guardRig={guardRig}
          shake={shake}
          onAct={onDuelAct}
          onFinished={onDuelFinished}
          onRetreat={onDuelRetreat}
          onDanger={setDuelDanger}
        />
      )}
      {scene === 'duelResult' && duel && duelG && save && duel.result === 'win' && (
        <DuelWin
          guard={duelG}
          nextName={afterWinNext ?? '下一位守卫'}
          riddles={duelG.riddles}
          solvedNow={duel.solved}
          known={save.riddles[duel.guardId] ?? []}
          turns={duel.log.length}
          firstTime={duelFirstWin}
          parts={parts}
          markMax={MARK_MAX}
          onAgain={grow => {
            commit(settleDuelWin(saveRef.current!, Date.now(), grow));
            beginDuel();
          }}
          onHome={grow => {
            commit(settleDuelWin(saveRef.current!, Date.now(), grow));
            setScene('workshop');
          }}
          onCard={grow => {
            const next = settleDuelWin(saveRef.current!, Date.now(), grow);
            commit(next);
            setScene('workshop');
            const c = findCreature(next, next.activeCreatureId);
            if (c) setCard(c);
          }}
        />
      )}
      {scene === 'duelResult' && duel && duelG && save && duel.result === 'loss' && creature && (
        <LossResult
          creature={creature}
          parts={parts}
          guard={duelG}
          epitaph={epitaph}
          mistakes={reviewDuel(duel)}
          onInherit={partId => {
            const current = saveRef.current!;
            const c = findCreature(current, current.expedition!.creatureId)!;
            commit(settleDuelLoss(current, partId, epitaph ?? fallbackEpitaph(c, burstQuote(current, c), duelG, 0)));
            setScene('workshop');
          }}
          onLeave={() => {
            const current = saveRef.current!;
            const c = findCreature(current, current.expedition!.creatureId)!;
            commit(settleDuelLoss(current, null, epitaph ?? fallbackEpitaph(c, burstQuote(current, c), duelG, 0)));
            setScene('workshop');
            setNotice(`${c.name}安静地离开了。名册里空出了一个位置。`);
          }}
          onCard={() => setCard({ ...creature, status: 'fallen', epitaph: epitaph ?? undefined, fallenAt: Date.now() })}
        />
      )}

      {scene === 'battle' && battle && guard && alive && save && (
        <BattleScene
          key={`${battle.guardId}-${save.expedition?.creatureId}`}
          battle={battle}
          guard={guard}
          creature={alive}
          playerRig={playerRig}
          guardRig={guardRig}
          shake={shake}
          onCommit={onCommit}
          onFinished={onFinished}
          onRetreat={onRetreat}
          tutorialSeen={save.tutorial.seen}
          onTutorialSeen={id => saveRef.current && commit({ ...saveRef.current, tutorial: { ...saveRef.current.tutorial, seen: [...new Set([...saveRef.current.tutorial.seen, id])] } })}
          taunt={taunt}
          streak={save.expedition?.streak ?? 0}
          scouted={save.expedition?.scouted.includes(battle.guardId)}
          onDisplay={setHud}
        />
      )}

      {scene === 'result' && battle && guard && save && battle.result === 'win' && (
        <WinResult guard={guard} battle={battle} firstTime={firstWin} nextGuard={GUARDS[guard.depth + 1] ?? null} onContinue={onWinContinue} />
      )}
      {scene === 'result' && battle && guard && save && battle.result === 'loss' && creature && (
        <LossResult creature={creature} parts={parts} guard={guard} epitaph={epitaph} mistakes={reviewMistakes(battle.log)} onInherit={onInherit} onCard={() => setCard({ ...creature, status: 'fallen', epitaph: epitaph ?? undefined, fallenAt: Date.now() })} />
      )}

      <TideWipe id={wipe} />
      {save && !offline && status.tripo && (() => {
        const c = findCreature(save, save.expedition?.creatureId ?? save.activeCreatureId);
        const isHatching = (x: CreatureRecord) => creatureParts(save, x).some(p => p.model.taskId);
        const others = rosterOf(save).filter(x => x.id !== c?.id && isHatching(x));
        const ps = c ? creatureParts(save, c) : [];
        const mine = c && isHatching(c);
        if (!mine && !others.length) return null;
        return (
          <div className={styles.hatchBadge} role="status">
            <span className={styles.hatchEgg} />
            <span>
              <b>{mine ? `${c!.name}的专属外形孵化中` : '专属外形孵化中'}</b>
              <small>
                {mine
                  ? ps.map(p => `${SLOT_NAMES[p.slot]} ${p.model.taskId ? `${hatch[p.id] ?? 0}%` : p.model.kind === 'generated' ? '✓' : '—'}`).join(' · ')
                  : others.map(x => x.name).join('、')}
                {mine && others.length ? ` · 另有 ${others.length} 只` : ''}
              </small>
            </span>
          </div>
        );
      })()}
      <AnimatePresence>{codex && save && <Codex key="codex" save={save} onClose={() => setCodex(false)} />}</AnimatePresence>
      <AnimatePresence>{card && save && <CreatureCard key="card" save={save} creature={card} onClose={() => setCard(null)} />}</AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice}
            role="status"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)', zIndex: 70, maxWidth: 'calc(100vw - 32px)', padding: '10px 16px', borderRadius: 999, background: 'rgb(7 19 15 / 0.9)', border: '1px solid var(--gold-line)', fontSize: 14, color: 'var(--cream)' }}
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
