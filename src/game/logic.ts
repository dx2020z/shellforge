import { liveMatches, SLOTS, type Keyword, type Slot, type Trait } from '@/domain/keywords';
import { createBattle, step, type BattleEvent, type BattleState, type PlayerAction } from '@/domain/battle';
import { GUARDS, guardById, type GuardDef } from '@/domain/guards';
import { creatureParts, findCreature, forgeCreature, maxHp, requirePart, type CreatureDesign } from '@/domain/creature';
import { GUARD_SETS, MODEL_POOL, pickPoolPart } from '@/domain/model-pool';
import type { CreatureRecord, GameSave, PartRecord } from '@/domain/types';
import { createDuel, stepDuel, type DuelAction, type DuelEvent, type DuelGuardDef, type DuelState } from '@/domain/duel';
import { PRESET_GUARDS, findDuelGuard, nextDuelGuard } from '@/domain/duel-guards';

/**
 * 串起领域层的流程函数：锻造、出征、结算、传承。全部是纯函数，输入存档输出新存档。
 */

export interface ForgeDraft {
  name: string;
  lore: string;
  origin: string;
  parts: Record<Slot, { name: string; description: string; visualPrompt: string; trait: Trait }>;
  source: 'deepseek' | 'local';
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

/** 名册里其他造物和海沟里的亡者守卫正在用的部件：新造物尽量不撞款。 */
export function modelsInUse(save: GameSave): string[] {
  const urls: string[] = [];
  for (const c of save.creatures) for (const id of c.partIds) {
    const p = save.parts.find(x => x.id === id);
    if (p?.model.url) urls.push(p.model.url);
  }
  return urls;
}

/** 为草稿的每个槽位挑一件离线部件外观（Tripo 生成完成后会热替换）。 */
export function designFromDraft(draft: ForgeDraft, context: { avoidUrls?: string[]; salt?: string | number } = {}): CreatureDesign {
  const used: string[] = [];
  const parts = {} as CreatureDesign['parts'];
  const live = liveMatches(draft.origin);
  for (const slot of SLOTS) {
    const d = draft.parts[slot];
    // 这个槽位的能力如果只是兜底（原话里没写到），外观就不必死守关键词，多换换样子。
    const weak = !live.some(m => m.slot === slot && d.trait.keywords.includes(m.keyword as Keyword));
    const pool = pickPoolPart(slot, draft.origin, d.trait.keywords, used, { avoidUrls: context.avoidUrls, weak, salt: context.salt });
    used.push(pool.set);
    parts[slot] = { name: d.name, description: d.description, trait: d.trait, visualPrompt: d.visualPrompt, model: { kind: 'preset', url: pool.url, rotation: [0, 0, 0] } };
  }
  return { name: draft.name, lore: draft.lore, origin: draft.origin, parts };
}

export function forgeFromDraft(save: GameSave, draft: ForgeDraft, now = Date.now()): GameSave {
  if (!canForge(save)) throw new Error(`名册满了：最多同时养 ${ROSTER_MAX} 只造物`);
  const heir = save.heir;
  let next = forgeCreature(save, designFromDraft(draft, { avoidUrls: modelsInUse(save), salt: save.nextSpecimen }), { id: uid, now, inheritedPartId: heir?.partId ?? null, parentId: heir?.fromCreatureId ?? null });
  next = { ...next, heir: null };
  return next;
}

export function creatureTraits(save: GameSave, creature: CreatureRecord): Trait[] {
  return creatureParts(save, creature).map(p => p.trait);
}

/** 爆发招式名：取头部第一条理由引用的原话片段。 */
export function burstQuote(save: GameSave, creature: CreatureRecord): string {
  const [head, body, legs] = creatureParts(save, creature);
  // 取原话里最长的一段引用（不超过 8 个字），招式名更像一句话。
  const quotes = [head, body, legs].flatMap(p => p.trait.reasons).map(r => r.quote).filter(q => creature.origin.includes(q) && [...q].length <= 8);
  quotes.sort((a, b) => [...b].length - [...a].length);
  return quotes[0] ?? creature.name;
}

/** 从港口出发：生命值满，从教学守卫（还没通关时）或第 1 位守卫开始。 */
export function startExpedition(save: GameSave): GameSave {
  const creature = findCreature(save, save.activeCreatureId);
  if (!creature || creature.status !== 'alive') throw new Error('没有可以出征的造物');
  if (save.expedition?.creatureId === creature.id) return save;
  const next = structuredClone(save);
  next.expedition = { creatureId: creature.id, depth: save.tutorial.done ? 1 : 0, battle: null, streak: 0, beaten: [], hp: maxHp(creatureParts(save, creature)), spring: false, scouted: [] };
  next.revision += 1;
  return next;
}

export function startBattle(save: GameSave, depth?: number): GameSave {
  let next = startExpedition(save);
  const exp = next.expedition!;
  const creature = findCreature(next, exp.creatureId)!;
  const d = depth ?? exp.depth;
  const guard = GUARDS[Math.min(d, GUARDS.length - 1)];
  const parts = creatureParts(next, creature);
  const battle = createBattle({
    guardId: guard.id,
    traits: parts.map(p => p.trait),
    maxHp: maxHp(parts),
    burstQuote: burstQuote(next, creature),
    tier: Math.min(3, next.guardDefeats[guard.id] ?? 0),
    startHp: exp.hp,
  });
  next = structuredClone(next);
  next.expedition = { ...next.expedition!, depth: d, battle, spring: false };
  next.revision += 1;
  return next;
}

export type SpringChoice = { kind: 'heal' } | { kind: 'temper'; partId: string } | { kind: 'scout' };

export const SPRING_LINES = [
  '泉水从岩缝里渗出来，带着一点温度。',
  '这眼泉很老了，水面上漂着前人留下的鳞片。',
  '泉底的沙在发光，像有人在下面点了一盏灯。',
  '水流在这里打了个旋，把远处守卫的声音送了过来。',
  '一群小鱼围着泉眼转圈，好像在等你做决定。',
  '泉水尝起来有点咸，也有点像眼泪。',
];

export const HEAL_RATIO = 0.5;

/** 潮汐泉三选一：回复生命、强化一件部件（印记 +1）、侦察下一位守卫的完整意图序列。 */
export function applySpring(save: GameSave, choice: SpringChoice): GameSave {
  const next = structuredClone(save);
  const exp = next.expedition;
  if (!exp || !exp.spring) throw new Error('现在不在潮汐泉');
  const creature = findCreature(next, exp.creatureId)!;
  const parts = creatureParts(next, creature);
  const max = maxHp(parts);
  if (choice.kind === 'heal') exp.hp = Math.min(max, exp.hp + Math.ceil(max * HEAL_RATIO));
  else if (choice.kind === 'temper') {
    if (!creature.partIds.includes(choice.partId)) throw new Error('只能强化身上的部件');
    const part = requirePart(next, choice.partId);
    if (part.level >= 3) throw new Error('这件部件的印记已经满了');
    part.level += 1;
    exp.hp = Math.min(maxHp(creatureParts(next, creature)), exp.hp + 2);
  } else {
    const guard = GUARDS[Math.min(exp.depth, GUARDS.length - 1)];
    if (!exp.scouted.includes(guard.id)) exp.scouted.push(guard.id);
  }
  exp.spring = false;
  next.revision += 1;
  return next;
}

export function applyAction(save: GameSave, action: PlayerAction): { save: GameSave; events: BattleEvent[]; battle: BattleState } {
  const exp = save.expedition;
  if (!exp?.battle) throw new Error('没有进行中的战斗');
  const { state, events } = step(exp.battle, action);
  const perfect = events.some(e => e.type === 'perfect');
  const next = structuredClone(save);
  next.expedition = { ...exp, battle: state, hp: state.hp, streak: perfect ? exp.streak + 1 : action.kind === 'burst' ? exp.streak : 0 };
  next.revision += 1;
  return { save: next, events, battle: state };
}

/** 守卫部件的缴获记录：带着守卫的来历，能力来自守卫模型最像的关键词。 */
export function capturedPart(guard: GuardDef, slot: Slot, now: number): PartRecord {
  const set = GUARD_SETS[guard.modelSet];
  const pool = MODEL_POOL.find(p => p.set === set && p.slot === slot)!;
  const name = guard.parts[slot].name;
  const source = `${guard.name}的${name}`;
  return {
    id: uid(),
    slot,
    name,
    description: `从${guard.name}身上缴获。${guard.catchphrase}。`,
    source,
    trait: { keywords: [pool.keyword], cost: null, reasons: [{ keyword: pool.keyword, quote: name, why: `它还带着${guard.name}的脾气` }] },
    model: { kind: 'preset', url: pool.url, rotation: [0, 0, 0] },
    origin: { kind: 'captured', guardId: guard.id, guardSlot: slot },
    level: 0,
    history: [],
    createdAt: now,
  };
}

function logHistory(save: GameSave, creature: CreatureRecord, guardId: string, result: 'win' | 'loss' | 'retreat', broke: Slot[], now: number) {
  for (const id of creature.partIds) {
    const part = requirePart(save, id);
    part.history.push({ guardId, result, broke, at: now });
    if (part.history.length > 200) part.history.shift();
  }
}

/** 胜利结算：记录履历、解锁传说、把选中的缴获部件放进库存（可选择立刻换上）。 */
export function settleWin(save: GameSave, pick: Slot | null, equip: boolean, now = Date.now()): GameSave {
  const next = structuredClone(save);
  const exp = next.expedition;
  const battle = exp?.battle;
  if (!exp || !battle || battle.result !== 'win') throw new Error('没有可以结算的胜利');
  const creature = findCreature(next, exp.creatureId)!;
  const guard = guardById(battle.guardId);
  logHistory(next, creature, guard.id, 'win', battle.captured, now);
  creature.wins += 1;
  creature.deepest = Math.max(creature.deepest, guard.depth + 1);
  next.guardDefeats[guard.id] = (next.guardDefeats[guard.id] ?? 0) + 1;
  if (!next.loreUnlocked.includes(guard.id)) next.loreUnlocked.push(guard.id);
  if (guard.tutorial) next.tutorial.done = true;
  if (pick && battle.captured.includes(pick)) {
    const part = capturedPart(guard, pick, now);
    next.parts.push(part);
    if (equip) creature.partIds[SLOTS.indexOf(pick)] = part.id;
  }
  exp.beaten.push(guard.id);
  exp.depth = guard.depth + 1;
  // 换上缴获部件可能改变生命上限（比如换掉了「膨胀」），当前生命不能超过新上限。
  exp.hp = Math.min(battle.hp, maxHp(creatureParts(next, creature)));
  exp.spring = guard.depth + 1 < GUARDS.length;
  exp.battle = null;
  next.revision += 1;
  return next;
}

/** 撤退：带着战利品回港口，造物还活着，下次从第 1 位守卫重新出发。 */
export function retreat(save: GameSave, now = Date.now()): GameSave {
  const next = structuredClone(save);
  const exp = next.expedition;
  if (!exp) return save;
  const creature = findCreature(next, exp.creatureId);
  if (creature) {
    if (exp.battle) logHistory(next, creature, exp.battle.guardId, 'retreat', exp.battle.captured, now);
    creature.expeditions += 1;
  }
  next.expedition = null;
  next.revision += 1;
  return next;
}

/** 死亡：造物长眠，写下墓志铭；选一件部件留给下一代。 */
export function settleDeath(save: GameSave, heirPartId: string, epitaph: string, now = Date.now()): GameSave {
  const next = structuredClone(save);
  const exp = next.expedition;
  const battle = exp?.battle;
  if (!exp || !battle || battle.result !== 'loss') throw new Error('没有可以结算的战败');
  const creature = findCreature(next, exp.creatureId)!;
  if (!creature.partIds.includes(heirPartId)) throw new Error('只能传承它身上的部件');
  logHistory(next, creature, battle.guardId, 'loss', battle.captured, now);
  creature.status = 'fallen';
  creature.epitaph = [...epitaph].slice(0, 80).join('');
  creature.fallenAt = now;
  creature.expeditions += 1;
  const heir = requirePart(next, heirPartId);
  heir.level = Math.min(3, heir.level + 1);
  next.heir = { partId: heirPartId, fromCreatureId: creature.id };
  next.expedition = null;
  next.activeCreatureId = null;
  next.revision += 1;
  return next;
}

/** 墓志铭兜底（DeepSeek 不可用时）。 */
export function fallbackEpitaph(creature: CreatureRecord, quote: string, guard: { name: string }, beaten: number): string {
  const seas = ['一片', '两片', '三片', '四片', '五片', '六片', '七片'][Math.max(0, Math.min(6, beaten - 1))];
  return beaten > 0
    ? `它带着「${quote}」走过${seas}海域，最后停在了${guard.name}面前。`
    : `它带着「${quote}」第一次下潜，就在${guard.name}面前睡着了。`;
}

export function guardForDepth(depth: number): GuardDef {
  return GUARDS[Math.min(depth, GUARDS.length - 1)];
}

/* ------------------------------------------------------------------ */
/* 写字对决（新的核心玩法样板：铜甲斥候）                                */
/* ------------------------------------------------------------------ */

/** 名册：最多同时养 5 只活着的造物；长眠的造物进档案库，不占名额。 */
export const ROSTER_MAX = 5;

export function roster(save: GameSave): CreatureRecord[] {
  return save.creatures.filter(c => c.status === 'alive').sort((a, b) => a.createdAt - b.createdAt);
}

export function canForge(save: GameSave): boolean {
  return roster(save).length < ROSTER_MAX;
}

/** 删除港口里的活着造物并释放名额。战斗/远征中的造物不能被删除。 */
export function deleteCreature(save: GameSave, creatureId: string): GameSave {
  if (save.expedition) throw new Error('远征途中不能删除造物');
  const target = findCreature(save, creatureId);
  if (!target || target.status !== 'alive') throw new Error('只能删除港口里的活着造物');
  const next = structuredClone(save);
  const removedPartIds = new Set(target.partIds);
  next.creatures = next.creatures.filter(c => c.id !== creatureId);
  const stillUsed = new Set(next.creatures.flatMap(c => c.partIds));
  next.parts = next.parts.filter(part => {
    if (!removedPartIds.has(part.id) || stillUsed.has(part.id)) return true;
    return !(part.origin.kind === 'forged' && part.origin.creatureId === creatureId);
  });
  if (next.heir && !next.parts.some(part => part.id === next.heir!.partId)) next.heir = null;
  next.activeCreatureId = roster(next)[0]?.id ?? null;
  next.revision += 1;
  return next;
}

export function selectCreature(save: GameSave, id: string): GameSave {
  const c = findCreature(save, id);
  if (!c || c.status !== 'alive') throw new Error('只能选择活着的造物');
  if (save.expedition) throw new Error('远征途中不能换造物');
  return { ...save, activeCreatureId: id, revision: save.revision + 1 };
}

export function duelSetupFor(save: GameSave, creature: CreatureRecord, guard: DuelGuardDef) {
  const parts = creatureParts(save, creature);
  return {
    guard,
    tier: guard.kind === 'preset' ? Math.min(3, save.guardDefeats[guard.id] ?? 0) : 0,
    origin: creature.origin,
    reasons: parts.flatMap(p => p.trait.reasons.map(r => ({ slot: p.slot, keyword: r.keyword, quote: r.quote, level: p.level, inherited: p.id === creature.inheritedPartId }))),
    marks: parts.reduce((n, p) => n + p.level, 0),
    generation: creature.generation,
  };
}

/**
 * 守卫的三件部件不能和出战的造物撞款：亡者守卫（比如上一代）和你共用的部件，
 * 换成部件库里另一件谁都没在用的。
 */
export function distinctFrom(guard: DuelGuardDef, playerUrls: (string | null)[]): DuelGuardDef {
  const mine = new Set(playerUrls.filter(Boolean) as string[]);
  if (!guard.models.some(u => u && mine.has(u))) return guard;
  const g = structuredClone(guard);
  const avoid = [...mine, ...(g.models.filter(Boolean) as string[])];
  SLOTS.forEach((slot, i) => {
    const u = g.models[i];
    if (!u || !mine.has(u)) return;
    const alt = pickPoolPart(slot, g.name, [], [], { avoidUrls: avoid, salt: i });
    g.models[i] = alt.url;
    avoid.push(alt.url);
    if (g.rotations) g.rotations[i] = [0, 0, 0];
    if (g.tints) g.tints[i] = null;
  });
  return g;
}

export function startDuel(save: GameSave, guardId?: string): GameSave {
  const creature = findCreature(save, save.activeCreatureId);
  if (!creature || creature.status !== 'alive') throw new Error('没有可以出征的造物');
  if (save.expedition?.duel && !save.expedition.duel.result && save.expedition.creatureId === creature.id) return save;
  const guard = distinctFrom((guardId ? findDuelGuard(save, guardId) : undefined) ?? nextDuelGuard(save, creature), creatureParts(save, creature).map(p => p.model.url));
  const next = structuredClone(save);
  const duel = createDuel(duelSetupFor(save, creature, guard));
  next.expedition = { creatureId: creature.id, depth: 0, battle: null, streak: 0, beaten: [], hp: duel.hp, spring: false, scouted: [], duel };
  next.revision += 1;
  return next;
}

export function applyDuel(save: GameSave, action: DuelAction): { save: GameSave; events: DuelEvent[]; duel: DuelState } {
  const d = save.expedition?.duel;
  if (!d) throw new Error('没有进行中的对决');
  const { state, events } = stepDuel(d, action);
  const next = structuredClone(save);
  next.expedition = { ...next.expedition!, duel: state, hp: state.hp };
  next.revision += 1;
  return { save: next, events, duel: state };
}

function mergeRiddles(save: GameSave, duel: DuelState) {
  const known = new Set(save.riddles[duel.guardId] ?? []);
  for (const r of duel.solved) known.add(r);
  save.riddles[duel.guardId] = [...known];
}

/** 印记上限：每道印记 = 生命 +2、这件部件的话效果 +1。 */
export const MARK_MAX = 5;

/** 胜利结算：可以选一件部件长出一道印记（成长）。 */
export function settleDuelWin(save: GameSave, now = Date.now(), growPartId?: string | null): GameSave {
  const next = structuredClone(save);
  const duel = next.expedition?.duel;
  if (!duel || duel.result !== 'win') throw new Error('没有可以结算的胜利');
  const creature = findCreature(next, next.expedition!.creatureId)!;
  logHistory(next, creature, duel.guardId, 'win', [], now);
  creature.wins += 1;
  creature.expeditions += 1;
  if (!creature.defeated.includes(duel.guardId)) creature.defeated.push(duel.guardId);
  if (growPartId && creature.partIds.includes(growPartId)) {
    const part = requirePart(next, growPartId);
    part.level = Math.min(MARK_MAX, part.level + 1);
  }
  const ladder = PRESET_GUARDS.findIndex(g => g.id === duel.guardId);
  if (ladder >= 0) creature.deepest = Math.max(creature.deepest, ladder + 2);
  next.guardDefeats[duel.guardId] = (next.guardDefeats[duel.guardId] ?? 0) + 1;
  if (!next.loreUnlocked.includes(duel.guardId)) next.loreUnlocked.push(duel.guardId);
  next.tutorial.done = true;
  mergeRiddles(next, duel);
  next.expedition = null;
  next.revision += 1;
  return next;
}

/** 长眠：可以选一件部件留给下一代（heirPartId），也可以什么都不留（null），直接空出名额。 */
export function settleDuelLoss(save: GameSave, heirPartId: string | null, epitaph: string, now = Date.now()): GameSave {
  const next = structuredClone(save);
  const duel = next.expedition?.duel;
  if (!duel || duel.result !== 'loss') throw new Error('没有可以结算的战败');
  const creature = findCreature(next, next.expedition!.creatureId)!;
  if (heirPartId && !creature.partIds.includes(heirPartId)) throw new Error('只能传承它身上的部件');
  logHistory(next, creature, duel.guardId, 'loss', [], now);
  creature.status = 'fallen';
  creature.epitaph = [...epitaph].slice(0, 80).join('');
  creature.fallenAt = now;
  creature.expeditions += 1;
  if (heirPartId) {
    const heir = requirePart(next, heirPartId);
    heir.level = Math.min(MARK_MAX, heir.level + 1);
    next.heir = { partId: heirPartId, fromCreatureId: creature.id };
  }
  mergeRiddles(next, duel);
  next.expedition = null;
  // 名册里还有别的活着的造物时，自动选中最早的那只。
  next.activeCreatureId = roster(next)[0]?.id ?? null;
  next.revision += 1;
  return next;
}

export function retreatDuel(save: GameSave, now = Date.now()): GameSave {
  const next = structuredClone(save);
  const duel = next.expedition?.duel;
  if (!duel) return save;
  const creature = findCreature(next, next.expedition!.creatureId);
  if (creature) {
    logHistory(next, creature, duel.guardId, 'retreat', [], now);
    creature.expeditions += 1;
  }
  mergeRiddles(next, duel);
  next.expedition = null;
  next.revision += 1;
  return next;
}
