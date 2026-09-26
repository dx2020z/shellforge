import { liveMatches, isKeyword, keywordSlot, type Keyword, type Slot } from './keywords';
import type { Vec3 } from './types';

/**
 * 写字对决：你写下的话就是你的招。
 *
 * - 造物诞生时那句话里被读懂的词，变成一张张「话语卡」，每张只能用一次。
 * - 墨水有限：可以临场再写一句（最多 12 个字），读懂了就是一招，没读懂就落空。
 * - 守卫每回合先亮出它要做的事（一个词 + 一句话），但不给数字、不给标准答案。
 * - 每位守卫藏着三道谜语：弱点、死角、秘密。谜语用写字来解，解开会有大效果。
 * - 守卫的定义随对决一起存进存档（纯数据），所以死去的造物也能变成守卫。
 *
 * 纯函数、确定性，方便测试和回放。
 */

export type DuelMove = 'strike' | 'charge' | 'unleash' | 'fortify' | 'heal' | 'stunned';
export type PatternMove = 'strike' | 'charge' | 'fortify' | 'heal';
export type RiddleKind = 'weak' | 'blind' | 'secret';
/** 秘密被解开后的效果：破甲（不能再合甲，伤害 +1）、发愣、不能回复、不能蓄力。 */
export type SecretEffect = 'rust' | 'stun' | 'noheal' | 'nocharge';

export interface DuelRiddle {
  id: RiddleKind;
  text: string;
  /** 解开时的旁白。 */
  solved: string;
}

export interface DuelGuardDef {
  id: string;
  kind: 'preset' | 'ghost';
  name: string;
  title: string;
  intro: string;
  farewell: string;
  victory: string;
  lore: string;
  /** 头、躯、足三件模型。 */
  models: [string | null, string | null, string | null];
  rotations?: [Vec3, Vec3, Vec3];
  tints?: [string | null, string | null, string | null];
  /** 亡者守卫：它原本是哪只造物。 */
  fromCreatureId?: string;
  hp: number;
  strike: number;
  unleash: number;
  heal: number;
  /** 不含 unleash：charge 之后自动接 unleash。 */
  pattern: PatternMove[];
  weak: Keyword[];
  resist: Keyword[];
  blind: Keyword[];
  secret: {
    /** 原话或临场一句里出现其中任何一个就触发。 */
    words: string[];
    damage: number;
    effect: SecretEffect;
    /** 造物原话里带着这些字时，一上场就触发。 */
    fromOrigin: boolean;
  };
  riddles: [DuelRiddle, DuelRiddle, DuelRiddle];
  moves: Record<DuelMove, { word: string; line: string }>;
  /** 被某类词打中时说的话。 */
  reactions: Partial<Record<Keyword, string>>;
  bounce: string;
  fizzle: string;
  resistLine: string;
  /** 狂暴时说的话。 */
  enrage?: string;
}

/** 每类词在对决里做什么（不写数字，只说效果）。 */
export const DUEL_EFFECTS: Record<Keyword, string> = {
  灼烧: '烧穿甲壳',
  穿刺: '扎穿合拢的甲',
  连击: '连打两下',
  震慑: '吓它一跳，能打断蓄力',
  吞噬: '咬一口，顺便回血',
  坚壳: '缩进壳里挡住这一下',
  反射: '挡住，再弹回去',
  再生: '让伤口长好',
  膨胀: '鼓起来多扛几下',
  蓄能: '憋一口气，下一招加倍',
  迅捷: '一闪而过，躲开这一下',
  潜行: '躲到它看不见的地方，下一招加倍',
  跃击: '跳起来踢一脚，能打断蓄力',
  吸附: '缠住它，让它这一下变轻',
  回旋: '甩一圈，掀开合拢的甲',
};

const BASE_DAMAGE: Partial<Record<Keyword, number>> = {
  灼烧: 3,
  穿刺: 3,
  连击: 4,
  震慑: 1,
  吞噬: 2,
  跃击: 3,
  回旋: 2,
  吸附: 2,
  迅捷: 1,
};
const PIERCE: Keyword[] = ['灼烧', '穿刺', '回旋'];
const INTERRUPT: Keyword[] = ['震慑', '跃击'];
const DODGE: Keyword[] = ['迅捷', '潜行'];
export const BASIC_WORD = '扑过去';
export const INK_MAX = 3;
/** 一句话说出口后，要歇几回合才能再说。 */
export const CARD_REST = 2;
/** 临场写一句的额外效果。 */
export const INK_BONUS = 1;
export const WRITE_MAX = 12;
/** 首、躯、足三件部件的话连着说完：额外造成的伤害。 */
export const COMBO_DAMAGE = 2;
/** 守卫狂暴后每一击多出的伤害。 */
export const ENRAGE_DAMAGE = 1;

/** 临场一句常用的动作词（原话规则偏形容词，写招式时大家更爱写动词）。 */
const ACTION_WORDS: [RegExp, Keyword][] = [
  [/烧|烫|火|热|沸|开水|熔/, '灼烧'],
  [/刺|戳|钻|扎|捅|啄/, '穿刺'],
  [/连打|两下|三下|乱打|狂揍|连环/, '连击'],
  [/吼|喊|吓|瞪|打断|拍手|敲|大叫/, '震慑'],
  [/咬|吞|啃|吸血|嚼/, '吞噬'],
  [/缩|挡|护住|躲进|抱头|硬/, '坚壳'],
  [/镜|反弹|弹回|照/, '反射'],
  [/治|疗|休息|愈|包扎|长好|喝水/, '再生'],
  [/鼓起|胀|变大|吹气/, '膨胀'],
  [/蓄|攒|憋|深呼吸|上弦|准备/, '蓄能'],
  [/闪|溜|冲|快跑|躲开/, '迅捷'],
  [/绕|背后|身后|偷偷|藏|潜|隐/, '潜行'],
  [/跳|踢|蹦|飞踹/, '跃击'],
  [/抓|抱住|缠|黏|吸住/, '吸附'],
  [/转|甩|旋|扫/, '回旋'],
];

/** 读懂一句临场写的话：取最先出现的那个词。 */
export function readPhrase(text: string): { keyword: Keyword; quote: string } | null {
  // 先找动作词（写招式时最常用），找不到再用造物原话的形容词规则。
  const pick = (hits: { keyword: Keyword; quote: string; at: number }[]) => {
    if (!hits.length) return null;
    hits.sort((a, b) => a.at - b.at || b.quote.length - a.quote.length);
    return { keyword: hits[0].keyword, quote: hits[0].quote };
  };
  const actions: { keyword: Keyword; quote: string; at: number }[] = [];
  for (const [pattern, keyword] of ACTION_WORDS) {
    const m = text.match(pattern);
    if (m && m.index !== undefined) actions.push({ keyword, quote: m[0], at: m.index });
  }
  const found = pick(actions);
  if (found) return found;
  const traits: { keyword: Keyword; quote: string; at: number }[] = [];
  for (const m of liveMatches(text)) {
    if (!isKeyword(m.keyword)) continue;
    traits.push({ keyword: m.keyword, quote: m.quote, at: text.indexOf(m.quote) });
  }
  return pick(traits);
}

export interface WordCard {
  id: string;
  text: string;
  keyword: Keyword;
  slot: Slot;
  /** 正在歇着（刚说过）。 */
  used: boolean;
  /** 还要歇几回合才能再说。 */
  rest: number;
  /** 这件部件的印记数：每道印记让这句话的效果 +1。 */
  power?: number;
  /** 上一代传下来的部件：它的话只歇一回合。 */
  inherited?: boolean;
}

export interface DuelLog {
  turn: number;
  move: DuelMove;
  word: string;
  keyword: Keyword | null;
  taken: number;
  dealt: number;
}

export interface DuelState {
  guardId: string;
  /** 这位守卫的完整定义（快照）。 */
  g: DuelGuardDef;
  tier: number;
  turn: number;
  hp: number;
  maxHp: number;
  shield: number;
  guardHp: number;
  guardMax: number;
  ink: number;
  /** 墨水上限：每多一代 +1，最多 5。 */
  inkMax?: number;
  cards: WordCard[];
  patternIndex: number;
  charged: boolean;
  stunned: boolean;
  /** 下一招的倍率（蓄能、潜行）。 */
  boost: number;
  /** 秘密已经被解开。 */
  rusted: boolean;
  /** 本场解开的谜语。 */
  solved: RiddleKind[];
  /** 最近连续用到的部件槽位（首、躯、足各说一句 = 三件连携）。 */
  chain?: Slot[];
  /** 守卫被打到一半以下，进入狂暴：出手更重。 */
  enraged?: boolean;
  result: 'win' | 'loss' | null;
  log: DuelLog[];
}

export type DuelAction = { kind: 'card'; cardId: string } | { kind: 'write'; text: string } | { kind: 'basic' };

export type DuelEvent =
  | { type: 'word'; text: string; keyword: Keyword | null; source: 'card' | 'ink' | 'basic' }
  | { type: 'fizzle'; text: string; line: string }
  | { type: 'hit'; target: 'guard' | 'player'; amount: number; crit?: boolean; weak?: boolean; line?: string }
  | { type: 'bounce'; line: string }
  | { type: 'resist'; line: string }
  | { type: 'guard-word'; move: DuelMove; word: string }
  | { type: 'guard-heal'; amount: number }
  | { type: 'dodge' }
  | { type: 'block'; amount: number; word: string }
  | { type: 'reflect'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'shield'; amount: number }
  | { type: 'boost' }
  | { type: 'interrupt' }
  | { type: 'solve'; riddle: RiddleKind; text: string; line: string }
  | { type: 'rust'; effect: SecretEffect }
  | { type: 'combo'; amount: number }
  | { type: 'enrage'; line: string }
  | { type: 'end'; result: 'win' | 'loss' };

export interface DuelSetup {
  guard: DuelGuardDef;
  tier?: number;
  /** 造物诞生时的那句话（检查秘密）。 */
  origin: string;
  /** 身上三件部件的理由：每条变成一张话语卡。 */
  reasons: { slot: Slot; keyword: string; quote: string; level?: number; inherited?: boolean }[];
  /** 印记总数：每道印记 +2 生命。 */
  marks?: number;
  /** 第几代：每多一代墨水上限 +1（最多 5）。 */
  generation?: number;
}

export function secretIn(g: DuelGuardDef, text: string): boolean {
  return g.secret.words.some(w => w && text.includes(w));
}

export function createDuel(setup: DuelSetup): DuelState {
  const g = setup.guard;
  const tier = Math.max(0, Math.min(3, setup.tier ?? 0));
  const cards: WordCard[] = [];
  for (const r of setup.reasons) {
    if (!isKeyword(r.keyword) || !r.quote) continue;
    if (cards.some(c => c.keyword === r.keyword && c.text === r.quote)) continue;
    cards.push({ id: `c${cards.length}`, text: r.quote, keyword: r.keyword, slot: r.slot, used: false, rest: 0, power: r.level ?? 0, inherited: r.inherited || undefined });
  }
  const maxHp = 14 + 2 * Math.max(0, setup.marks ?? 0);
  const guardMax = g.hp + tier;
  const inkMax = Math.min(5, INK_MAX + Math.max(0, (setup.generation ?? 1) - 1));
  const rusted = g.secret.fromOrigin && secretIn(g, setup.origin);
  const state: DuelState = {
    guardId: g.id,
    g,
    tier,
    turn: 1,
    hp: maxHp,
    maxHp,
    shield: 0,
    guardHp: guardMax,
    guardMax,
    ink: inkMax,
    inkMax,
    cards,
    patternIndex: 0,
    charged: false,
    stunned: false,
    boost: 1,
    rusted,
    solved: rusted ? ['secret'] : [],
    chain: [],
    enraged: false,
    result: null,
    log: [],
  };
  if (rusted) {
    state.guardHp = Math.max(1, guardMax - g.secret.damage);
    if (g.secret.effect === 'stun') state.stunned = true;
  }
  return state;
}

export function currentMove(s: DuelState): DuelMove {
  if (s.stunned) return 'stunned';
  if (s.charged) return 'unleash';
  const g = s.g;
  const m = g.pattern[s.patternIndex % g.pattern.length];
  if (s.rusted) {
    if (m === 'fortify' && g.secret.effect === 'rust') return 'strike';
    if (m === 'heal' && g.secret.effect === 'noheal') return 'strike';
    if (m === 'charge' && g.secret.effect === 'nocharge') return 'strike';
  }
  return m;
}

export function checkDuelAction(s: DuelState, a: DuelAction): { ok: true } | { ok: false; reason: string } {
  if (s.result) return { ok: false, reason: '对决已经结束了' };
  if (a.kind === 'card') {
    const c = s.cards.find(x => x.id === a.cardId);
    if (!c) return { ok: false, reason: '没有这张话语卡' };
    if (c.used) return { ok: false, reason: '这句话刚说过，要缓一缓' };
  }
  if (a.kind === 'write') {
    if (s.ink <= 0) return { ok: false, reason: '墨水用完了' };
    const t = a.text.trim();
    if (!t) return { ok: false, reason: '先写点什么' };
    if ([...t].length > WRITE_MAX) return { ok: false, reason: `最多 ${WRITE_MAX} 个字` };
  }
  return { ok: true };
}

function solve(s: DuelState, id: RiddleKind, events: DuelEvent[]) {
  if (s.solved.includes(id)) return;
  s.solved.push(id);
  // 解开谜语，灵感涌上来：墨水 +1。
  s.ink = Math.min(s.inkMax ?? INK_MAX, s.ink + 1);
  const r = s.g.riddles.find(x => x.id === id)!;
  events.push({ type: 'solve', riddle: id, text: r.text, line: r.solved });
}

export function stepDuel(prev: DuelState, action: DuelAction): { state: DuelState; events: DuelEvent[] } {
  const check = checkDuelAction(prev, action);
  if (!check.ok) throw new Error(check.reason);
  const s: DuelState = structuredClone(prev);
  const g = s.g;
  const events: DuelEvent[] = [];
  const move = currentMove(s);
  const hpBefore = s.hp;
  const guardBefore = s.guardHp;

  // 1. 你说出的这句话
  let keyword: Keyword | null = null;
  let word = BASIC_WORD;
  let cardPower = 0;
  let secretNow = false;
  if (action.kind === 'card') {
    const c = s.cards.find(x => x.id === action.cardId)!;
    c.used = true;
    c.rest = (c.inherited ? 1 : CARD_REST) + 1;
    cardPower = c.power ?? 0;
    keyword = c.keyword;
    word = c.text;
    events.push({ type: 'word', text: word, keyword, source: 'card' });
  } else if (action.kind === 'write') {
    s.ink -= 1;
    word = action.text.trim();
    const read = readPhrase(word);
    keyword = read?.keyword ?? null;
    events.push({ type: 'word', text: word, keyword, source: 'ink' });
    if (secretIn(g, word) && !s.rusted) {
      secretNow = true;
      s.rusted = true;
      events.push({ type: 'rust', effect: g.secret.effect });
      solve(s, 'secret', events);
      s.guardHp = Math.max(0, s.guardHp - g.secret.damage);
      events.push({ type: 'hit', target: 'guard', amount: g.secret.damage, crit: true });
    } else if (!keyword) {
      // 没读懂也不白写：你干脆扑了上去。
      events.push({ type: 'fizzle', text: word, line: g.fizzle });
    }
  } else {
    events.push({ type: 'word', text: word, keyword: null, source: 'basic' });
  }
  const resisted = keyword !== null && g.resist.includes(keyword);

  // 2. 结算你的招
  const fortified = move === 'fortify' && !(keyword && keyword === '回旋');
  const pounce = action.kind === 'basic' || (action.kind === 'write' && !keyword && !secretNow);
  // 临场写出来的话比说过的更有力：效果 +1。
  const bonus = (action.kind === 'write' && keyword ? INK_BONUS : 0) + cardPower;
  let dealt = pounce ? 1 : keyword ? (BASE_DAMAGE[keyword] ?? 0) : 0;
  if (dealt > 0) dealt += bonus;
  if (keyword && g.blind.includes(keyword)) {
    dealt = Math.max(dealt, 3);
    solve(s, 'blind', events);
  }
  let crit = false;
  let weak = false;
  if (dealt > 0) {
    if (s.boost > 1) {
      dealt *= s.boost;
      crit = true;
      s.boost = 1;
    }
    if (keyword && g.weak.includes(keyword)) {
      dealt *= 2;
      weak = true;
    }
    if (resisted) {
      dealt = Math.max(1, Math.floor(dealt / 2));
      events.push({ type: 'resist', line: g.resistLine });
    }
    if (fortified && !(keyword && PIERCE.includes(keyword))) {
      dealt = Math.floor(dealt / 2);
      events.push({ type: 'bounce', line: g.bounce });
    }
    if (s.rusted && g.secret.effect === 'rust' && dealt > 0) dealt += 1;
  }
  if (dealt > 0) {
    s.guardHp = Math.max(0, s.guardHp - dealt);
    events.push({ type: 'hit', target: 'guard', amount: dealt, crit, weak, line: keyword ? g.reactions[keyword] : undefined });
    if (weak) solve(s, 'weak', events);
  }
  // 三件连携：连续三回合分别说了首、躯、足的话（卡或临场写的都算）。
  const slotNow: Slot | null = keyword ? keywordSlot(keyword) : null;
  const chain = slotNow ? [...(s.chain ?? []), slotNow].slice(-3) : [];
  if (chain.length === 3 && new Set(chain).size === 3) {
    s.guardHp = Math.max(0, s.guardHp - COMBO_DAMAGE);
    events.push({ type: 'combo', amount: COMBO_DAMAGE });
    s.chain = [];
  } else s.chain = chain.slice(-2);
  if (keyword === '吞噬') {
    const heal = Math.min(2 + bonus, s.maxHp - s.hp);
    if (heal > 0) {
      s.hp += heal;
      events.push({ type: 'heal', amount: heal });
    }
  }
  if (keyword === '再生') {
    const heal = Math.min(4 + bonus, s.maxHp - s.hp);
    s.hp += heal;
    events.push({ type: 'heal', amount: heal });
  }
  if (keyword === '膨胀') {
    s.shield += 4 + bonus;
    events.push({ type: 'shield', amount: 4 + bonus });
  }
  if (keyword === '蓄能' || keyword === '潜行') {
    s.boost = 2;
    events.push({ type: 'boost' });
  }

  if (s.guardHp <= 0) {
    s.result = 'win';
    events.push({ type: 'end', result: 'win' });
    s.log.push({ turn: s.turn, move, word, keyword, taken: 0, dealt: guardBefore - s.guardHp });
    return { state: s, events };
  }

  if (!s.enraged && s.guardHp * 2 <= s.guardMax) {
    s.enraged = true;
    events.push({ type: 'enrage', line: g.enrage ?? '它被逼急了：接下来每一击都更重。' });
  }

  // 3. 守卫出手（刚被说中秘密、效果是发愣时，它这回合什么也做不了）
  const stunNow = secretNow && g.secret.effect === 'stun';
  const effective: DuelMove = stunNow ? 'stunned' : move;
  const interrupted = (move === 'charge' || move === 'heal') && keyword !== null && INTERRUPT.includes(keyword) && !resisted;
  events.push({ type: 'guard-word', move: effective, word: g.moves[effective].word });
  if (move === 'charge') {
    if (interrupted || stunNow) {
      s.stunned = true;
      if (interrupted) events.push({ type: 'interrupt' });
    } else s.charged = true;
    s.patternIndex += 1;
  } else if (move === 'unleash') {
    s.charged = false;
  } else if (move === 'stunned') {
    s.stunned = false;
  } else {
    s.patternIndex += 1;
    if (stunNow) s.stunned = false;
  }

  if (move === 'heal' && !stunNow) {
    if (interrupted) {
      events.push({ type: 'interrupt' });
    } else {
      const amount = Math.min(g.heal, s.guardMax - s.guardHp);
      if (amount > 0) {
        s.guardHp += amount;
        events.push({ type: 'guard-heal', amount });
      }
    }
  }

  if ((move === 'strike' || move === 'unleash') && !stunNow) {
    let dmg = (move === 'strike' ? g.strike : g.unleash) + Math.floor(s.tier / 2) + (s.enraged ? ENRAGE_DAMAGE : 0);
    if (keyword === '坚壳' || keyword === '反射') dmg = Math.max(0, dmg - bonus);
    if (keyword && DODGE.includes(keyword) && !resisted) {
      dmg = 0;
      events.push({ type: 'dodge' });
    } else {
      if (keyword && DODGE.includes(keyword)) events.push({ type: 'resist', line: g.resistLine });
      if (keyword === '吸附') dmg = Math.ceil(dmg / 2);
      if (keyword === '坚壳' || keyword === '反射') {
        let blocked = move === 'strike' ? dmg : Math.floor(dmg / 2);
        if (resisted) blocked = Math.floor(blocked / 2);
        dmg -= blocked;
        events.push({ type: 'block', amount: blocked, word });
        if (keyword === '反射' && blocked > 0) {
          const back = g.weak.includes('反射') ? blocked * 2 : blocked;
          s.guardHp = Math.max(0, s.guardHp - back);
          events.push({ type: 'reflect', amount: back });
          if (g.weak.includes('反射')) solve(s, 'weak', events);
        }
      }
      if (dmg > 0 && s.shield > 0) {
        const absorbed = Math.min(s.shield, dmg);
        s.shield -= absorbed;
        dmg -= absorbed;
        events.push({ type: 'block', amount: absorbed, word: '鼓起的身体' });
      }
      if (dmg > 0) {
        s.hp = Math.max(0, s.hp - dmg);
        events.push({ type: 'hit', target: 'player', amount: dmg, crit: move === 'unleash' });
      }
    }
  }

  s.log.push({ turn: s.turn, move, word, keyword, taken: hpBefore - s.hp, dealt: Math.max(0, guardBefore - s.guardHp) });
  for (const c of s.cards) {
    if (c.rest > 0) c.rest -= 1;
    c.used = c.rest > 0;
  }
  if (s.guardHp <= 0) {
    s.result = 'win';
    events.push({ type: 'end', result: 'win' });
  } else if (s.hp <= 0) {
    s.result = 'loss';
    events.push({ type: 'end', result: 'loss' });
  }
  s.turn += 1;
  return { state: s, events };
}

/** 输了之后的复盘：挑最疼的两次，告诉你当时可以写什么。 */
export function reviewDuel(s: DuelState): string[] {
  const g = s.g;
  const out: string[] = [];
  for (const l of [...s.log].sort((a, b) => b.taken - a.taken)) {
    if (l.taken <= 0 || out.length >= 2) continue;
    const w = g.moves[l.move].word;
    if (l.move === 'unleash') out.push(`第 ${l.turn} 回合它「${w}」，你受了 ${l.taken} 点伤。它蓄力的时候，吓它一跳或者跳起来踢一脚就能打断。`);
    else out.push(`第 ${l.turn} 回合它「${w}」，你受了 ${l.taken} 点伤。缩进壳里、闪开或者躲到它背后，都能躲过这一下。`);
  }
  const unsolved = g.riddles.filter(r => !s.solved.includes(r.id));
  if (unsolved.length) out.push(`还有 ${unsolved.length} 道谜语没解开：「${unsolved[0].text}」`);
  return out;
}
