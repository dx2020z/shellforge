import { SLOTS, detectSecrets, keywordColor, type Slot, type Trait } from './keywords';
import type { CreatureRecord, GameSave, PartModel, PartRecord, Triple } from './types';

/** 锻造一只新造物所需的三件部件设定（来自 DeepSeek 或本地映射）。 */
export interface PartDesign {
  name: string;
  description: string;
  trait: Trait;
  visualPrompt?: string;
  model?: PartModel;
}
export interface CreatureDesign {
  name: string;
  lore: string;
  origin: string;
  parts: Record<Slot, PartDesign>;
}

export interface ForgeOptions {
  /** 由调用方提供，方便测试时得到稳定结果。 */
  id: () => string;
  now: number;
  /** 上一代传承下来的部件；会替换同槽位的新部件。 */
  inheritedPartId?: string | null;
  /** 上一代造物（死亡后传承时）。 */
  parentId?: string | null;
}

const PROCEDURAL: PartModel = { kind: 'procedural', url: null, rotation: [0, 0, 0] };

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function findCreature(save: GameSave, id: string | null | undefined): CreatureRecord | undefined {
  return id ? save.creatures.find(creature => creature.id === id) : undefined;
}
export function findPart(save: GameSave, id: string): PartRecord | undefined {
  return save.parts.find(part => part.id === id);
}
export function requirePart(save: GameSave, id: string): PartRecord {
  const part = findPart(save, id);
  if (!part) throw new Error(`部件不存在：${id}`);
  return part;
}
export function creatureParts(save: GameSave, creature: CreatureRecord): Triple<PartRecord> {
  return creature.partIds.map(id => requirePart(save, id)) as Triple<PartRecord>;
}

/** 活着的造物只能有一只在远征；图鉴里其余的都已长眠或在港口休整。 */
export function activeCreature(save: GameSave): CreatureRecord | undefined {
  const creature = findCreature(save, save.activeCreatureId);
  return creature?.status === 'alive' ? creature : undefined;
}

export function forgeCreature(save: GameSave, design: CreatureDesign, options: ForgeOptions): GameSave {
  const next = clone(save);
  const creatureId = options.id();
  const parent = findCreature(next, options.parentId ?? null);
  const inherited = options.inheritedPartId ? requirePart(next, options.inheritedPartId) : undefined;

  const partIds = SLOTS.map(slot => {
    if (inherited && inherited.slot === slot) return inherited.id;
    const design_ = design.parts[slot];
    const part: PartRecord = {
      id: options.id(),
      slot,
      name: design_.name,
      description: design_.description,
      source: design.origin,
      trait: clone(design_.trait),
      model: design_.model ? clone(design_.model) : { ...PROCEDURAL },
      visualPrompt: design_.visualPrompt,
      origin: { kind: 'forged', creatureId },
      level: 0,
      history: [],
      createdAt: options.now,
    };
    next.parts.push(part);
    return part.id;
  }) as Triple<string>;

  if (inherited && parent) {
    const record = requirePart(next, inherited.id);
    record.origin = { kind: 'inherited', fromCreatureId: parent.id };
  }

  const creature: CreatureRecord = {
    id: creatureId,
    specimen: next.nextSpecimen,
    name: design.name,
    lore: design.lore,
    origin: design.origin,
    partIds,
    bornPartIds: [...partIds] as Triple<string>,
    generation: parent ? parent.generation + 1 : 1,
    lineageId: parent ? parent.lineageId : creatureId,
    parentId: parent?.id ?? null,
    inheritedPartId: inherited?.id ?? null,
    secrets: detectSecrets(design.origin),
    createdAt: options.now,
    status: 'alive',
    wins: 0,
    defeated: [],
    deepest: 0,
    expeditions: 0,
  };
  next.creatures.push(creature);
  next.nextSpecimen += 1;
  next.activeCreatureId = creature.id;
  next.revision += 1;
  return next;
}

/** 把一件部件（缴获或库存）装到造物身上，替换同槽位的部件。远征战斗中不可换装。 */
export function equipPart(save: GameSave, creatureId: string, partId: string): GameSave {
  const next = clone(save);
  const creature = findCreature(next, creatureId);
  if (!creature || creature.status !== 'alive') throw new Error('只有活着的造物可以换装');
  const part = requirePart(next, partId);
  if (next.creatures.some(other => other.id !== creatureId && other.status === 'alive' && other.partIds.includes(partId))) {
    throw new Error('这件部件正装在另一只造物身上');
  }
  creature.partIds[SLOTS.indexOf(part.slot)] = part.id;
  next.revision += 1;
  return next;
}

/** 替换部件的外观（例如 Tripo 模型生成完成后热替换）。 */
export function updatePartModel(save: GameSave, partId: string, model: PartModel): GameSave {
  const next = clone(save);
  requirePart(next, partId).model = clone(model);
  next.revision += 1;
  return next;
}

/** 生命上限：基础值，加上「膨胀」与传承印记。四维属性已取消，其余差异全部来自关键词。 */
/** 离线部件按能力关键词轻轻染色；Tripo 生成的专属外形保留原色。 */
export function partTints(parts: readonly PartRecord[]): [string | null, string | null, string | null] {
  return parts.map(p => (p.model.kind === 'generated' || p.model.url?.startsWith('/assets/gen/') || !p.trait.keywords[0] ? null : keywordColor(p.trait.keywords[0]))) as [string | null, string | null, string | null];
}

export const BASE_HP = 30;
export function maxHp(parts: readonly PartRecord[]): number {
  const swell = parts.some(part => part.trait.keywords.includes('膨胀')) ? 10 : 0;
  const marks = parts.reduce((sum, part) => sum + part.level * 2, 0);
  return BASE_HP + swell + marks;
}
