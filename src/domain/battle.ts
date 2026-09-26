import { SLOTS, type Cost, type Keyword, type Slot, type Trait } from './keywords';
import { guardById, type GuardDef, type Intent, type ResolvedIntent } from './guards';

/**
 * 战斗 v2：纯函数、无随机，同样的状态和行动永远得到同样的结果。
 * 设计目标：读对意图 = 活下来 **并且** 离胜利更近。
 *
 * - 守卫由头、躯、足三个可破坏部位组成；击碎躯即胜利，击碎头/足会削弱守卫并缴获蓝图。
 * - 完美应对：横扫→守护（挡下全部并反击）、破甲→机动（闪开并暴击）、蓄力→机动或震慑攻击（打断）。
 * - 每次完美应对 +1 潮能，攒满 3 点可释放原话爆发。
 * - 潮位每回合上涨一格，涨满后守卫狂暴，伤害 ×1.5。
 */

export type ActionKind = 'attack' | 'guard' | 'move' | 'burst';
export interface PlayerAction {
  kind: ActionKind;
  /** 攻击或爆发的目标部位，默认躯。 */
  target?: Slot;
}

export const ENERGY_MAX = 3;
export const BASE_ATTACK = 6;
export const BASE_BLOCK = 6;

export interface TurnLog {
  turn: number;
  intent: ResolvedIntent;
  action: ActionKind;
  target?: Slot;
  taken: number;
  dealt: number;
  perfect: boolean;
  /** 本回合被强制休息（贪食）。 */
  rested?: boolean;
}

export interface BattleState {
  v: 1;
  guardId: string;
  /** 本场挑战时守卫的强度档位（被击败次数，最多 +3）。 */
  tier: number;
  turn: number;
  tide: number;
  hp: number;
  maxHp: number;
  guardHp: Record<Slot, number>;
  guardMax: Record<Slot, number>;
  energy: number;
  /** 各部位身上的灼烧层数。 */
  burn: Record<Slot, number>;
  patternIndex: number;
  /** 上回合守卫蓄力成功，本回合释放。 */
  charged: boolean;
  /** 上回合守卫被打断，本回合发愣。 */
  stunned: boolean;
  /** 下一次攻击暴击（完美机动的奖励）。 */
  crit: boolean;
  /** 潜行：下一次攻击 +50%。 */
  stealth: boolean;
  /** 蓄能：下一次攻击额外伤害。 */
  stored: number;
  last: ActionKind | null;
  keywords: Keyword[];
  costs: Cost[];
  /** 爆发招式名取自的原话片段。 */
  burstQuote: string;
  captured: Slot[];
  log: TurnLog[];
  result: 'win' | 'loss' | null;
}

export type BattleEvent =
  | { type: 'hit'; by: 'player' | 'guard'; target: 'player' | Slot; amount: number; crit?: boolean; note?: string }
  | { type: 'block'; amount: number }
  | { type: 'dodge' }
  | { type: 'perfect'; text: string }
  | { type: 'interrupt' }
  | { type: 'heal'; who: 'player' | 'guard'; amount: number; note?: string }
  | { type: 'break'; slot: Slot }
  | { type: 'burn'; slot: Slot; amount: number }
  | { type: 'burst'; name: string }
  | { type: 'rest' }
  | { type: 'enrage' }
  | { type: 'tide'; level: number }
  | { type: 'stunned' };

export interface BattleSetup {
  guardId: string;
  traits: Trait[];
  maxHp: number;
  /** 爆发用的原话片段，通常取头部的第一条理由。 */
  burstQuote: string;
  tier?: number;
  /** 远征中上一场留下的生命值；不传则满血。 */
  startHp?: number;
}

const clone = <T>(v: T): T => structuredClone(v);

export function createBattle(setup: BattleSetup): BattleState {
  const guard = guardById(setup.guardId);
  const tier = Math.max(0, Math.min(3, setup.tier ?? 0));
  const scale = 1 + tier * 0.15;
  const guardMax = Object.fromEntries(SLOTS.map(s => [s, Math.round(guard.parts[s].hp * scale)])) as Record<Slot, number>;
  const keywords = [...new Set(setup.traits.flatMap(t => t.keywords))];
  const costs = [...new Set(setup.traits.map(t => t.cost).filter((c): c is Cost => Boolean(c)))];
  return {
    v: 1,
    guardId: guard.id,
    tier,
    turn: 1,
    tide: 0,
    hp: Math.max(1, Math.min(setup.maxHp, Math.round(setup.startHp ?? setup.maxHp))),
    maxHp: setup.maxHp,
    guardHp: { ...guardMax },
    guardMax,
    energy: 0,
    burn: { head: 0, body: 0, legs: 0 },
    patternIndex: 0,
    charged: false,
    stunned: false,
    crit: false,
    stealth: false,
    stored: 0,
    last: null,
    keywords,
    costs,
    burstQuote: setup.burstQuote,
    captured: [],
    log: [],
    result: null,
  };
}

const has = (s: BattleState, k: Keyword) => s.keywords.includes(k);
const paying = (s: BattleState, c: Cost) => s.costs.includes(c);
export const broken = (s: BattleState, slot: Slot) => s.guardHp[slot] <= 0;
export const enraged = (s: BattleState, guard = guardById(s.guardId)) => s.tide >= guard.tideMax;

/** 本回合守卫的意图（头被击碎后不能蓄力、破甲；足被击碎后不能固守）。 */
export function currentIntent(s: BattleState): ResolvedIntent {
  if (s.stunned) return 'stunned';
  if (s.charged) return 'unleash';
  const guard = guardById(s.guardId);
  let intent: Intent = guard.pattern[s.patternIndex % guard.pattern.length];
  if (broken(s, 'head') && (intent === 'charge' || intent === 'break')) intent = 'strike';
  if (broken(s, 'legs') && intent === 'fortify') intent = 'strike';
  return intent;
}

/** 接下来 n 回合的意图序列（潮汐泉「侦察」用；假设玩家不打断）。 */
export function upcomingIntents(s: BattleState, n: number): ResolvedIntent[] {
  const out: ResolvedIntent[] = [];
  let probe = clone(s);
  for (let i = 0; i < n; i++) {
    const intent = currentIntent(probe);
    out.push(intent);
    probe = { ...probe, stunned: false, charged: intent === 'charge', patternIndex: intent === 'unleash' || intent === 'stunned' ? probe.patternIndex : probe.patternIndex + 1 };
  }
  return out;
}

export function guardDamage(s: BattleState, intent: ResolvedIntent): number {
  const guard = guardById(s.guardId);
  const base = guard.damage * (1 + s.tier * 0.12) * (enraged(s, guard) ? 1.5 : 1);
  const mult: Record<ResolvedIntent, number> = { strike: 1, sweep: 1.25, break: 1.6, unleash: 2.5, charge: 0, fortify: 0, heal: 0, stunned: 0 };
  return Math.round(base * mult[intent]);
}

/** 这次攻击是否属于完美应对。 */
export function perfectFor(intent: ResolvedIntent, action: ActionKind, s: BattleState): string | null {
  if (intent === 'sweep' && action === 'guard') return '挡下全部，反击一半';
  if (intent === 'break' && action === 'move') return '闪开破甲，下一击暴击';
  if (intent === 'charge' && action === 'move') return '打断蓄力，守卫下回合发愣';
  if (intent === 'charge' && action === 'attack' && has(s, '震慑')) return '震慑打断蓄力';
  return null;
}

/** 每种意图推荐的应对（新手引导与「新手」模拟策略都用它）。 */
export function recommendedAction(s: BattleState): ActionKind {
  if (s.energy >= ENERGY_MAX) return 'burst';
  const intent = currentIntent(s);
  switch (intent) {
    case 'sweep':
    case 'unleash':
    case 'fortify':
      return 'guard';
    case 'break':
    case 'charge':
      return has(s, '震慑') && intent === 'charge' ? 'attack' : 'move';
    default:
      return 'attack';
  }
}

export interface LegalCheck {
  ok: boolean;
  reason?: string;
}

export function checkAction(s: BattleState, action: PlayerAction): LegalCheck {
  if (s.result) return { ok: false, reason: '战斗已经结束' };
  if (action.kind === 'burst' && s.energy < ENERGY_MAX) return { ok: false, reason: '潮能还没有攒满' };
  if (paying(s, '骄傲') && action.kind !== 'burst' && action.kind === s.last) return { ok: false, reason: '骄傲：不肯连续两回合用同一招' };
  const target = action.target ?? 'body';
  if ((action.kind === 'attack' || action.kind === 'burst') && broken(s, target)) return { ok: false, reason: '这个部位已经碎了' };
  return { ok: true };
}

function attackMultiplier(s: BattleState): number {
  const guard = guardById(s.guardId);
  if (has(s, guard.weak)) return 1.5;
  if (guard.resist && has(s, guard.resist)) return 0.6;
  return 1;
}

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}

export function step(input: BattleState, action: PlayerAction): StepResult {
  const legal = checkAction(input, action);
  if (!legal.ok) throw new Error(legal.reason);
  const s = clone(input);
  const guard: GuardDef = guardById(s.guardId);
  const events: BattleEvent[] = [];
  const intent = currentIntent(s);
  const target: Slot = action.target ?? 'body';
  const rested = paying(s, '贪食') && s.turn % 4 === 0 && action.kind !== 'burst';
  const kind: ActionKind | 'rest' = rested ? 'rest' : action.kind;
  const perfect = kind === 'rest' ? null : perfectFor(intent, kind, s);
  const hpBefore = s.hp;
  const guardBefore = SLOTS.reduce((n, slot) => n + s.guardHp[slot], 0);
  let interrupted = false;
  let guardCancelled = false;

  const damagePart = (slot: Slot, amount: number, by: 'player', crit = false, note?: string) => {
    if (s.result || amount <= 0) return 0;
    const live = broken(s, slot) ? 'body' : slot;
    const dealt = Math.min(s.guardHp[live], Math.round(amount));
    if (dealt <= 0) return 0;
    s.guardHp[live] -= dealt;
    events.push({ type: 'hit', by, target: live, amount: dealt, crit, note });
    if (s.guardHp[live] <= 0) {
      events.push({ type: 'break', slot: live });
      if (!s.captured.includes(live)) s.captured.push(live);
      if (live === 'body') s.result = 'win';
    }
    return dealt;
  };
  const healPlayer = (amount: number, note: string) => {
    const value = Math.min(s.maxHp - s.hp, Math.round(amount));
    if (value > 0) {
      s.hp += value;
      events.push({ type: 'heal', who: 'player', amount: value, note });
    }
  };
  const hurtPlayer = (amount: number, note?: string) => {
    const value = Math.min(s.hp, Math.max(0, Math.round(amount)));
    if (value <= 0) return;
    s.hp -= value;
    events.push({ type: 'hit', by: 'guard', target: 'player', amount: value, note });
    if (s.hp <= 0) s.result = 'loss';
  };

  /** 普通攻击与爆发共用的命中效果。 */
  const strikeGuard = (base: number, opts: { burst?: boolean }) => {
    let amount = base + s.stored;
    amount *= attackMultiplier(s);
    if (s.stealth) amount *= 1.5;
    const crit = s.crit;
    if (crit) amount *= 1.5;
    if (intent === 'fortify' && !opts.burst && !has(s, '穿刺')) amount *= 0.5;
    let dealt = 0;
    if (has(s, '连击') && !opts.burst) {
      dealt += damagePart(target, amount * 0.6, 'player', crit, '连击');
      dealt += damagePart(target, amount * 0.6, 'player', false, '连击');
    } else {
      dealt += damagePart(target, amount, 'player', crit, opts.burst ? '原话爆发' : undefined);
    }
    if (has(s, '灼烧') && !s.result) s.burn[broken(s, target) ? 'body' : target] += opts.burst ? 3 : 2;
    if (has(s, '吞噬')) healPlayer(dealt * 0.5, '吞噬');
    s.stored = 0;
    s.stealth = false;
    s.crit = false;
    return dealt;
  };

  const playerAct = () => {
    if (s.result) return;
    if (kind === 'rest') {
      events.push({ type: 'rest' });
      return;
    }
    if (kind === 'attack') {
      if (intent === 'charge' && has(s, '震慑')) interrupted = true;
      strikeGuard(BASE_ATTACK, {});
    } else if (kind === 'burst') {
      events.push({ type: 'burst', name: `「${s.burstQuote}」爆发` });
      const base = 12 + 3 * s.keywords.length;
      strikeGuard(base, { burst: true });
      if (has(s, '再生')) healPlayer(4, '再生');
      if (has(s, '坚壳') || has(s, '膨胀')) healPlayer(3, '爆发护体');
      s.energy = 0;
      guardCancelled = true;
    } else if (kind === 'guard') {
      if (has(s, '蓄能')) s.stored = 4;
      if (intent === 'fortify') healPlayer(3, '趁它缩壳喘口气');
    } else if (kind === 'move') {
      if (intent === 'charge') interrupted = true;
      if (has(s, '跃击')) damagePart(target, 3, 'player', false, '跃击');
      if (has(s, '潜行')) s.stealth = true;
      if (has(s, '回旋')) healPlayer(2, '回旋');
    }
  };

  const guardAct = () => {
    if (s.result) return;
    if (guardCancelled) {
      events.push({ type: 'stunned' });
      return;
    }
    switch (intent) {
      case 'stunned':
        events.push({ type: 'stunned' });
        return;
      case 'charge':
        if (interrupted) {
          events.push({ type: 'interrupt' });
        } else s.charged = true;
        return;
      case 'fortify':
        return;
      case 'heal': {
        const value = Math.min(guard.damage, s.guardMax.body - s.guardHp.body);
        if (value > 0) {
          s.guardHp.body += value;
          events.push({ type: 'heal', who: 'guard', amount: value });
        }
        return;
      }
    }
    const raw = guardDamage(s, intent);
    if (kind === 'move' && (intent === 'strike' || intent === 'break')) {
      events.push({ type: 'dodge' });
      if (intent === 'break') s.crit = true;
      return;
    }
    if (kind === 'guard' && !(intent === 'break' && !has(s, '吸附'))) {
      if (intent === 'sweep') {
        events.push({ type: 'block', amount: raw });
        damagePart('body', raw * (has(s, '反射') ? 1 : 0.5), 'player', false, '反击');
        return;
      }
      let block = BASE_BLOCK + (has(s, '坚壳') ? 4 : 0);
      if (paying(s, '脆壳')) block = Math.floor(block / 2);
      const blocked = Math.min(raw, block);
      events.push({ type: 'block', amount: blocked });
      hurtPlayer(raw - blocked, intent === 'unleash' ? '蓄满一击' : undefined);
      if (has(s, '反射') && blocked > 0) damagePart('body', blocked * 0.5, 'player', false, '反射');
      return;
    }
    const label = intent === 'break' && kind === 'guard' ? '守护被击穿' : intent === 'sweep' && kind === 'move' ? '横扫躲不开' : undefined;
    hurtPlayer(raw, label);
  };

  const playerFirst = kind === 'burst' || ((has(s, '迅捷') || broken(s, 'legs')) && !paying(s, '迟缓'));
  if (playerFirst) {
    playerAct();
    guardAct();
  } else {
    guardAct();
    playerAct();
  }

  if (perfect && !s.result) {
    events.push({ type: 'perfect', text: perfect });
    s.energy = Math.min(ENERGY_MAX, s.energy + 1);
  } else if (perfect) {
    s.energy = Math.min(ENERGY_MAX, s.energy + 1);
  }

  // 回合末：灼烧、再生、潮位。
  if (!s.result) {
    for (const slot of SLOTS) {
      if (s.burn[slot] <= 0 || s.result) continue;
      const live = broken(s, slot) ? 'body' : slot;
      const amount = Math.min(s.guardHp[live], s.burn[slot]);
      if (amount > 0) {
        s.guardHp[live] -= amount;
        events.push({ type: 'burn', slot: live, amount });
        if (s.guardHp[live] <= 0) {
          events.push({ type: 'break', slot: live });
          if (!s.captured.includes(live)) s.captured.push(live);
          if (live === 'body') s.result = 'win';
        }
      }
      s.burn[slot] = Math.max(0, s.burn[slot] - 1);
    }
  }
  if (!s.result && has(s, '再生')) healPlayer(2, '再生');
  if (!s.result) {
    const wasEnraged = enraged(s, guard);
    s.tide = Math.min(guard.tideMax, s.tide + 1);
    events.push({ type: 'tide', level: s.tide });
    if (!wasEnraged && enraged(s, guard)) events.push({ type: 'enrage' });
  }

  // 意图推进。
  if (intent === 'stunned') s.stunned = false;
  else if (intent === 'unleash') s.charged = false;
  else {
    s.patternIndex += 1;
    if (intent === 'charge' && interrupted) s.stunned = true;
  }
  if (guardCancelled && intent === 'charge') {
    s.charged = false;
    s.stunned = false;
  }
  if (guardCancelled && intent === 'unleash') s.charged = false;

  const guardAfter = SLOTS.reduce((n, slot) => n + s.guardHp[slot], 0);
  s.log.push({ turn: s.turn, intent, action: action.kind, target: action.kind === 'attack' || action.kind === 'burst' ? target : undefined, taken: Math.max(0, hpBefore - s.hp), dealt: Math.max(0, guardBefore - guardAfter), perfect: Boolean(perfect), ...(rested ? { rested: true } : {}) });
  s.last = action.kind;
  if (!s.result && s.turn >= 40) s.result = 'loss';
  s.turn += 1;
  return { state: s, events };
}

export interface Preview {
  taken: number;
  dealt: number;
  perfect: string | null;
  note?: string;
  legal: LegalCheck;
}

/** 按钮上的后果预览：直接模拟这一步，保证和真实结算一致。 */
export function preview(s: BattleState, action: PlayerAction): Preview {
  const legal = checkAction(s, action);
  if (!legal.ok) return { taken: 0, dealt: 0, perfect: null, legal };
  const { state, events } = step(s, action);
  const intent = currentIntent(s);
  const taken = Math.max(0, s.hp - state.hp + events.filter(e => e.type === 'heal' && e.who === 'player').reduce((n, e) => n + (e as { amount: number }).amount, 0));
  const dealt = SLOTS.reduce((n, slot) => n + (s.guardHp[slot] - state.guardHp[slot]), 0) + events.filter(e => e.type === 'heal' && e.who === 'guard').reduce((n, e) => n + (e as { amount: number }).amount, 0);
  const perfect = perfectFor(intent, action.kind, s);
  let note: string | undefined;
  if (events.some(e => e.type === 'rest')) note = '贪食：这回合要停下来吃东西';
  else if (perfect) note = perfect;
  else if (action.kind === 'move' && intent === 'sweep') note = '横扫躲不开';
  else if (action.kind === 'guard' && intent === 'break' && !has(s, '吸附')) note = '破甲会击穿守护';
  else if (action.kind === 'move' && intent === 'strike') note = '完全躲开';
  else if (action.kind === 'guard' && intent === 'unleash') note = '硬接蓄满一击';
  else if (state.result === 'win') note = '这一击能击碎躯干';
  return { taken, dealt: Math.max(0, dealt), perfect, note, legal };
}

/* ------------------------------------------------------------------ */
/* 失败复盘：挑出最关键的 1–2 个错误。                                  */
/* ------------------------------------------------------------------ */

const INTENT_NAME: Record<ResolvedIntent, string> = {
  strike: '攻击', sweep: '横扫', break: '破甲', charge: '蓄力', fortify: '固守', heal: '回复', unleash: '蓄满一击', stunned: '发愣',
};
const ACTION_NAME: Record<ActionKind, string> = { attack: '攻击', guard: '守护', move: '机动', burst: '原话爆发' };
export const intentName = (i: ResolvedIntent) => INTENT_NAME[i];
export const actionName = (a: ActionKind) => ACTION_NAME[a];

const BETTER: Partial<Record<ResolvedIntent, { action: ActionKind; why: string }>> = {
  sweep: { action: 'guard', why: '横扫躲不开，守护能挡下全部还能反击' },
  break: { action: 'move', why: '破甲会击穿守护，机动能闪开还能换来一次暴击' },
  charge: { action: 'move', why: '蓄力时机动能打断它，它下回合会发愣' },
  unleash: { action: 'guard', why: '蓄满一击躲不开，只能守护硬接' },
};

export function reviewMistakes(log: TurnLog[], limit = 2): string[] {
  return log
    .filter(entry => {
      const better = BETTER[entry.intent];
      return better && better.action !== entry.action && !entry.perfect && (entry.taken > 0 || entry.intent === 'charge');
    })
    .sort((a, b) => b.taken - a.taken)
    .slice(0, limit)
    .sort((a, b) => a.turn - b.turn)
    .map(entry => {
      const better = BETTER[entry.intent]!;
      const hurt = entry.taken > 0 ? `，受到 ${entry.taken} 伤害` : '，让它把力气攒满了';
      const verb = entry.intent === 'break' && entry.action === 'guard' ? '，守护被击穿' : '';
      return `第 ${entry.turn} 回合守卫意图是「${INTENT_NAME[entry.intent]}」，你选择了${ACTION_NAME[entry.action]}${verb}${hurt}。下次可以选${ACTION_NAME[better.action]}：${better.why}。`;
    });
}
