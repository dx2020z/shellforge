import { COSTS, SLOTS, isCost, isKeyword, isSlotKeyword, type Secret, type Slot, type Trait } from './keywords';
import { STARTING_PRESET_IDS, makePresetPart } from './presets';
import type { CreatureRecord, GameSave, PartModel, PartRecord } from './types';
import type { BattleState } from './battle';
import { guardById } from './guards';
import type { DuelGuardDef, DuelState } from './duel';

export const SAVE_KEY = 'shellforge.v2.save';
export const DEMO_SAVE_KEY = 'shellforge.v2.demo';

export function newGame(now = Date.now()): GameSave {
  return {
    version: 2,
    revision: 1,
    createdAt: now,
    nextSpecimen: 1,
    creatures: [],
    parts: STARTING_PRESET_IDS.map(id => makePresetPart(id, now)),
    activeCreatureId: null,
    expedition: null,
    heir: null,
    loreUnlocked: [],
    riddles: {},
    guardDefeats: {},
    settledBattleIds: [],
    tutorial: { done: false, seen: [] },
    settings: { muted: false, motion: 'system' },
  };
}

/* ------------------------------------------------------------------ */
/* 校验：逐字段检查，出错时给出路径，便于排查。                          */
/* ------------------------------------------------------------------ */

export class SaveError extends Error {}

type Obj = Record<string, unknown>;
const fail = (path: string, what: string): never => {
  throw new SaveError(`${path}：${what}`);
};
const obj = (v: unknown, path: string): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : fail(path, '不是对象'));
const arr = (v: unknown, path: string, max: number): unknown[] => {
  if (!Array.isArray(v)) return fail(path, '不是数组');
  if (v.length > max) fail(path, `超过 ${max} 项`);
  return v;
};
const str = (v: unknown, path: string, max: number, min = 0): string => {
  if (typeof v !== 'string') return fail(path, '不是字符串');
  const length = [...v].length;
  if (length < min || length > max) fail(path, `长度应在 ${min}–${max}`);
  return v;
};
const int = (v: unknown, path: string, min: number, max = Number.MAX_SAFE_INTEGER): number => {
  if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) fail(path, `应为 ${min}–${max} 的整数`);
  return v as number;
};
const num = (v: unknown, path: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(path, '不是有限数字'));
const oneOf = <T extends string>(v: unknown, path: string, options: readonly T[]): T =>
  (options as readonly unknown[]).includes(v) ? (v as T) : fail(path, `应为 ${options.join('/')} 之一`);
const optional = <T>(v: unknown, check: (v: unknown) => T): T | undefined => (v === undefined ? undefined : check(v));

const MODEL_URL = /^(\/assets\/gen\/[a-z0-9-]+\/(head|body|legs)\.glb|\/assets\/parts\/[a-z0-9_-]+\/model\.glb|\/assets\/creatures\/[a-z0-9-]+\/(head|body|legs)\.glb|\/api\/models\/[a-f0-9-]{36}|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[\w./-]+\.glb)$/i;

export function isModelUrl(value: unknown): value is string {
  return typeof value === 'string' && MODEL_URL.test(value) && !value.includes('..');
}

function checkTrait(v: unknown, path: string, slot: Slot): Trait {
  const t = obj(v, path);
  const keywords = arr(t.keywords, path + '.keywords', 2);
  if (!keywords.length) fail(path + '.keywords', '至少一个关键词');
  keywords.forEach((k, i) => isSlotKeyword(k, slot) || fail(`${path}.keywords[${i}]`, `不属于${slot}槽位`));
  const cost = t.cost === null ? null : oneOf(t.cost, path + '.cost', COSTS);
  const reasons = arr(t.reasons, path + '.reasons', 6).map((r, i) => {
    const reason = obj(r, `${path}.reasons[${i}]`);
    if (!isKeyword(reason.keyword) && !isCost(reason.keyword)) fail(`${path}.reasons[${i}].keyword`, '未知关键词');
    return {
      keyword: reason.keyword as Trait['reasons'][number]['keyword'],
      quote: str(reason.quote, `${path}.reasons[${i}].quote`, 60, 1),
      why: str(reason.why, `${path}.reasons[${i}].why`, 80, 1),
    };
  });
  return { keywords: keywords as Trait['keywords'], cost, reasons };
}

function checkModel(v: unknown, path: string): PartModel {
  const m = obj(v, path);
  const kind = oneOf(m.kind, path + '.kind', ['preset', 'generated', 'procedural'] as const);
  const url = m.url === null ? null : isModelUrl(m.url) ? m.url : fail(path + '.url', '模型地址不合法');
  const rotation = arr(m.rotation, path + '.rotation', 3).map((n, i) => {
    const value = num(n, `${path}.rotation[${i}]`);
    return Math.abs(value) <= 360 ? value : fail(`${path}.rotation[${i}]`, '超出 ±360');
  });
  if (rotation.length !== 3) fail(path + '.rotation', '需要三个角度');
  const taskId = optional(m.taskId, x => (typeof x === 'string' && /^[a-f0-9-]{36}$/.test(x) ? x : fail(path + '.taskId', '任务编号不合法')));
  return { kind, url, rotation: rotation as PartModel['rotation'], ...(taskId ? { taskId } : {}) };
}

function checkPart(v: unknown, path: string): PartRecord {
  const p = obj(v, path);
  const slot = oneOf(p.slot, path + '.slot', SLOTS);
  const origin = obj(p.origin, path + '.origin');
  const originKind = oneOf(origin.kind, path + '.origin.kind', ['preset', 'forged', 'captured', 'inherited'] as const);
  const history = arr(p.history, path + '.history', 200).map((h, i) => {
    const log = obj(h, `${path}.history[${i}]`);
    return {
      guardId: str(log.guardId, `${path}.history[${i}].guardId`, 80, 1),
      result: oneOf(log.result, `${path}.history[${i}].result`, ['win', 'loss', 'retreat'] as const),
      broke: arr(log.broke, `${path}.history[${i}].broke`, 3).map((s, j) => oneOf(s, `${path}.history[${i}].broke[${j}]`, SLOTS)),
      at: num(log.at, `${path}.history[${i}].at`),
    };
  });
  let partOrigin: PartRecord['origin'];
  if (originKind === 'preset') partOrigin = { kind: 'preset' };
  else if (originKind === 'forged') partOrigin = { kind: 'forged', creatureId: str(origin.creatureId, path + '.origin.creatureId', 64, 1) };
  else if (originKind === 'captured') {
    partOrigin = {
      kind: 'captured',
      guardId: str(origin.guardId, path + '.origin.guardId', 32, 1),
      guardSlot: oneOf(origin.guardSlot, path + '.origin.guardSlot', SLOTS),
    };
  } else partOrigin = { kind: 'inherited', fromCreatureId: str(origin.fromCreatureId, path + '.origin.fromCreatureId', 64, 1) };
  return {
    id: str(p.id, path + '.id', 64, 1),
    slot,
    name: str(p.name, path + '.name', 24, 1),
    description: str(p.description, path + '.description', 160),
    source: str(p.source, path + '.source', 120, 1),
    trait: checkTrait(p.trait, path + '.trait', slot),
    model: checkModel(p.model, path + '.model'),
    visualPrompt: optional(p.visualPrompt, x => str(x, path + '.visualPrompt', 850)),
    origin: partOrigin,
    level: int(p.level, path + '.level', 0, 5),
    history,
    createdAt: num(p.createdAt, path + '.createdAt'),
  };
}

const SECRETS: readonly Secret[] = ['bubbles', 'cat-stretch', 'invincible'];

function checkCreature(v: unknown, path: string, partIds: Map<string, PartRecord>): CreatureRecord {
  const c = obj(v, path);
  const triple = (value: unknown, where: string) => {
    const ids = arr(value, where, 3);
    if (ids.length !== 3) fail(where, '需要头、躯、足三件');
    return ids.map((id, i) => {
      const part = partIds.get(id as string);
      if (!part) return fail(`${where}[${i}]`, '部件不存在');
      if (part.slot !== SLOTS[i]) fail(`${where}[${i}]`, '槽位不匹配');
      return part.id;
    }) as CreatureRecord['partIds'];
  };
  const status = oneOf(c.status, path + '.status', ['alive', 'fallen'] as const);
  return {
    id: str(c.id, path + '.id', 64, 1),
    specimen: int(c.specimen, path + '.specimen', 1),
    name: str(c.name, path + '.name', 24, 1),
    lore: str(c.lore, path + '.lore', 160),
    origin: str(c.origin, path + '.origin', 120, 1),
    partIds: triple(c.partIds, path + '.partIds'),
    bornPartIds: triple(c.bornPartIds, path + '.bornPartIds'),
    generation: int(c.generation, path + '.generation', 1),
    lineageId: str(c.lineageId, path + '.lineageId', 64, 1),
    parentId: c.parentId === null ? null : str(c.parentId, path + '.parentId', 64, 1),
    inheritedPartId: c.inheritedPartId === null ? null : str(c.inheritedPartId, path + '.inheritedPartId', 64, 1),
    secrets: arr(c.secrets, path + '.secrets', 8).map((s, i) => oneOf(s, `${path}.secrets[${i}]`, SECRETS)),
    createdAt: num(c.createdAt, path + '.createdAt'),
    status,
    epitaph: optional(c.epitaph, x => str(x, path + '.epitaph', 80)),
    fallenAt: optional(c.fallenAt, x => num(x, path + '.fallenAt')),
    wins: int(c.wins, path + '.wins', 0),
    deepest: int(c.deepest, path + '.deepest', 0, 99),
    expeditions: int(c.expeditions, path + '.expeditions', 0),
    defeated: arr(c.defeated ?? [], path + '.defeated', 500).map((id, i) => str(id, `${path}.defeated[${i}]`, 80, 1)),
  };
}

function checkExpedition(v: unknown, creatureIds: Set<string>): GameSave['expedition'] {
  if (v === null || v === undefined) return null;
  const e = obj(v, 'save.expedition');
  const creatureId = str(e.creatureId, 'save.expedition.creatureId', 64, 1);
  if (!creatureIds.has(creatureId)) fail('save.expedition.creatureId', '造物不存在');
  let battle: BattleState | null = null;
  if (e.battle !== null && e.battle !== undefined) {
    const b = obj(e.battle, 'save.expedition.battle');
    if (b.v !== 1) fail('save.expedition.battle', '战斗版本不兼容');
    try {
      guardById(str(b.guardId, 'save.expedition.battle.guardId', 32, 1));
    } catch {
      fail('save.expedition.battle.guardId', '未知守卫');
    }
    for (const key of ['turn', 'tide', 'hp', 'maxHp', 'energy', 'patternIndex', 'tier']) int(b[key], `save.expedition.battle.${key}`, 0, 10_000);
    battle = b as unknown as BattleState;
  }
  return {
    creatureId,
    depth: int(e.depth, 'save.expedition.depth', 0, 99),
    battle,
    streak: int(e.streak ?? 0, 'save.expedition.streak', 0, 999),
    beaten: arr(e.beaten ?? [], 'save.expedition.beaten', 32).map((id, i) => str(id, `save.expedition.beaten[${i}]`, 32, 1)),
    hp: int(e.hp ?? 1, 'save.expedition.hp', 0, 999),
    spring: e.spring === true,
    scouted: arr(e.scouted ?? [], 'save.expedition.scouted', 32).map((id, i) => str(id, `save.expedition.scouted[${i}]`, 32, 1)),
    ...(e.duel ? { duel: checkDuel(e.duel) } : {}),
  };
}

function checkDuelGuard(v: unknown, path: string): DuelGuardDef {
  const g = obj(v, path);
  str(g.id, path + '.id', 80, 1);
  oneOf(g.kind, path + '.kind', ['preset', 'ghost'] as const);
  for (const key of ['name', 'title', 'intro', 'farewell', 'victory', 'lore', 'bounce', 'fizzle', 'resistLine']) str(g[key], `${path}.${key}`, 400);
  if (g.enrage !== undefined) str(g.enrage, `${path}.enrage`, 400);
  for (const key of ['hp', 'strike', 'unleash', 'heal']) int(g[key], `${path}.${key}`, 0, 999);
  const models = arr(g.models, path + '.models', 3);
  if (models.length !== 3) fail(path + '.models', '需要三件模型');
  models.forEach((m, i) => {
    if (m !== null && !isModelUrl(m)) fail(`${path}.models[${i}]`, '模型地址不合法');
  });
  arr(g.pattern, path + '.pattern', 16).forEach((m, i) => oneOf(m, `${path}.pattern[${i}]`, ['strike', 'charge', 'fortify', 'heal'] as const));
  for (const key of ['weak', 'resist', 'blind']) arr(g[key], `${path}.${key}`, 8).forEach((k, i) => (isKeyword(k) ? k : fail(`${path}.${key}[${i}]`, '不是关键词')));
  const secret = obj(g.secret, path + '.secret');
  arr(secret.words, path + '.secret.words', 40).forEach((w, i) => str(w, `${path}.secret.words[${i}]`, 40, 1));
  oneOf(secret.effect, path + '.secret.effect', ['rust', 'stun', 'noheal', 'nocharge'] as const);
  const riddles = arr(g.riddles, path + '.riddles', 3);
  if (riddles.length !== 3) fail(path + '.riddles', '需要三道谜语');
  obj(g.moves, path + '.moves');
  return g as unknown as DuelGuardDef;
}

function checkDuel(v: unknown): DuelState | null {
  if (v === null || v === undefined) return null;
  const d = obj(v, 'save.expedition.duel');
  // 旧版本的对决没有守卫快照：直接丢掉，回到港口重新出发。
  if (!d.g) return null;
  const g = checkDuelGuard(d.g, 'save.expedition.duel.g');
  str(d.guardId, 'save.expedition.duel.guardId', 80, 1);
  for (const key of ['tier', 'turn', 'hp', 'maxHp', 'shield', 'guardHp', 'guardMax', 'ink', 'patternIndex', 'boost']) int(d[key], `save.expedition.duel.${key}`, 0, 10_000);
  const cards = arr(d.cards, 'save.expedition.duel.cards', 40).map((c, i) => {
    const o = obj(c, `save.expedition.duel.cards[${i}]`);
    str(o.id, `save.expedition.duel.cards[${i}].id`, 16, 1);
    str(o.text, `save.expedition.duel.cards[${i}].text`, 40, 1);
    if (!isKeyword(o.keyword)) fail(`save.expedition.duel.cards[${i}].keyword`, '不是关键词');
    if (typeof o.used !== 'boolean') fail(`save.expedition.duel.cards[${i}].used`, '不是布尔值');
    o.rest = int(o.rest ?? 0, `save.expedition.duel.cards[${i}].rest`, 0, 9);
    return o;
  });
  arr(d.solved, 'save.expedition.duel.solved', 3);
  arr(d.log, 'save.expedition.duel.log', 500);
  if (d.result !== null && d.result !== 'win' && d.result !== 'loss') fail('save.expedition.duel.result', '结果不合法');
  const chain = Array.isArray(d.chain) ? d.chain.filter((x): x is 'head' | 'body' | 'legs' => x === 'head' || x === 'body' || x === 'legs').slice(-2) : [];
  return { ...(d as unknown as DuelState), g, cards: cards as unknown as DuelState['cards'], chain, enraged: d.enraged === true };
}

/** 严格解析存档。任何字段不合法都会抛出 SaveError。 */
export function parseSave(raw: string): GameSave {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new SaveError('存档不是有效 JSON');
  }
  const s = obj(value, 'save');
  if (s.version !== 2) fail('save.version', '不是 v2 存档');

  const parts = arr(s.parts, 'save.parts', 600).map((p, i) => checkPart(p, `save.parts[${i}]`));
  const partMap = new Map(parts.map(p => [p.id, p]));
  if (partMap.size !== parts.length) fail('save.parts', '部件编号重复');

  const creatures = arr(s.creatures, 'save.creatures', 300).map((c, i) => checkCreature(c, `save.creatures[${i}]`, partMap));
  const creatureIds = new Set(creatures.map(c => c.id));
  if (creatureIds.size !== creatures.length) fail('save.creatures', '造物编号重复');
  if (new Set(creatures.map(c => c.specimen)).size !== creatures.length) fail('save.creatures', '标本编号重复');

  const activeCreatureId = s.activeCreatureId === null ? null : str(s.activeCreatureId, 'save.activeCreatureId', 64, 1);
  if (activeCreatureId && !creatureIds.has(activeCreatureId)) fail('save.activeCreatureId', '造物不存在');

  const tutorial = obj(s.tutorial, 'save.tutorial');
  const settings = obj(s.settings, 'save.settings');
  const defeats = obj(s.guardDefeats, 'save.guardDefeats');
  const guardDefeats = Object.fromEntries(Object.entries(defeats).map(([k, v]) => [k, int(v, `save.guardDefeats.${k}`, 0, 9999)]));
  const nextSpecimen = int(s.nextSpecimen, 'save.nextSpecimen', 1);
  if (creatures.some(c => c.specimen >= nextSpecimen)) fail('save.nextSpecimen', '小于已有标本编号');

  return {
    version: 2,
    revision: int(s.revision, 'save.revision', 1),
    createdAt: num(s.createdAt, 'save.createdAt'),
    nextSpecimen,
    creatures,
    parts,
    activeCreatureId,
    expedition: checkExpedition(s.expedition, creatureIds),
    heir: s.heir === null || s.heir === undefined ? null : (() => {
      const h = obj(s.heir, 'save.heir');
      const partId = str(h.partId, 'save.heir.partId', 64, 1);
      if (!partMap.has(partId)) fail('save.heir.partId', '部件不存在');
      return { partId, fromCreatureId: str(h.fromCreatureId, 'save.heir.fromCreatureId', 64, 1) };
    })(),
    loreUnlocked: arr(s.loreUnlocked, 'save.loreUnlocked', 500).map((id, i) => str(id, `save.loreUnlocked[${i}]`, 80, 1)),
    riddles: Object.fromEntries(
      Object.entries(obj(s.riddles ?? {}, 'save.riddles')).map(([k, v]) => [k.slice(0, 80), arr(v, `save.riddles.${k}`, 3).map((id, i) => oneOf(id, `save.riddles.${k}[${i}]`, ['weak', 'blind', 'secret'] as const))]),
    ),
    guardDefeats,
    settledBattleIds: arr(s.settledBattleIds, 'save.settledBattleIds', 5000).map((id, i) => str(id, `save.settledBattleIds[${i}]`, 64, 1)),
    tutorial: {
      done: typeof tutorial.done === 'boolean' ? tutorial.done : fail('save.tutorial.done', '不是布尔值'),
      seen: arr(tutorial.seen, 'save.tutorial.seen', 64).map((id, i) => str(id, `save.tutorial.seen[${i}]`, 32, 1)),
    },
    settings: {
      muted: typeof settings.muted === 'boolean' ? settings.muted : fail('save.settings.muted', '不是布尔值'),
      motion: oneOf(settings.motion, 'save.settings.motion', ['system', 'reduced', 'full'] as const),
    },
  };
}

export function encodeSave(save: GameSave): string {
  return JSON.stringify(save);
}

/* ------------------------------------------------------------------ */
/* 浏览器存储：写入前保留上一份有效存档作为备份。                        */
/* ------------------------------------------------------------------ */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; save: GameSave }
  | { status: 'restored'; save: GameSave; note: string; detail?: string }
  | { status: 'unreadable'; note: string };

export function loadSave(storage: StorageLike | null, key = SAVE_KEY): LoadResult {
  if (!storage) return { status: 'unreadable', note: '这台设备不允许保存进度，本次远征结束后不会留下记录。' };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: 'unreadable', note: '这台设备不允许保存进度，本次远征结束后不会留下记录。' };
  }
  if (!raw) return { status: 'empty' };
  try {
    const save = parseSave(raw);
    // 以前因为规则太严没读出来的存档，如果现在能读、而且更新，就把它救回来。
    try {
      const broken = storage.getItem(`${key}.broken`);
      if (broken) {
        const rescued = parseSave(broken);
        storage.removeItem(`${key}.broken`);
        if (rescued.revision > save.revision) return { status: 'restored', save: rescued, note: '找回了上次没读出来的航海日志。' };
      }
    } catch {
      /* 还是读不出来，继续留着。 */
    }
    return { status: 'ok', save };
  } catch (error) {
    // 读不出来的存档原样留一份，方便以后修好规则再救回来，不会被下一次保存覆盖。
    try {
      storage.setItem(`${key}.broken`, raw);
    } catch {
      /* 存不下就算了。 */
    }
    const why = error instanceof Error ? error.message : String(error);
    try {
      const backup = storage.getItem(key + '.backup');
      if (backup) return { status: 'restored', save: parseSave(backup), note: '最近一次记录被海水泡坏了，已从上一页航海日志恢复。', detail: why };
    } catch {
      /* 两份都坏了就保留原样，留给排查。 */
    }
    return { status: 'unreadable', note: '航海日志已经看不清了，只能重新起航。旧记录仍保留在这台设备上。' };
  }
}

export function writeSave(storage: StorageLike | null, save: GameSave, key = SAVE_KEY): boolean {
  if (!storage) return false;
  try {
    const previous = storage.getItem(key);
    if (previous) {
      try {
        parseSave(previous);
        storage.setItem(key + '.backup', previous);
      } catch {
        /* 不用坏档覆盖好的备份。 */
      }
    }
    storage.setItem(key, encodeSave(save));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
