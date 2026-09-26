import type { Secret, Slot, Trait } from './keywords';

export type Vec3 = [number, number, number];
export type Triple<T> = [T, T, T];

/** 部件的 3D 外观来源。 */
export interface PartModel {
  /** preset：随游戏发布的 GLB；generated：Tripo 生成；procedural：离线兜底造型。 */
  kind: 'preset' | 'generated' | 'procedural';
  /** 可加载的 GLB 地址；生成中或离线时为 null。 */
  url: string | null;
  /** 对应的生成任务编号（kind=generated 时）。 */
  taskId?: string;
  /** 绕 X/Y/Z 的校准角度（度）。 */
  rotation: Vec3;
}

/** 部件经历过的一场战斗。 */
export interface PartBattleLog {
  guardId: string;
  result: 'win' | 'loss' | 'retreat';
  /** 这场战斗里由它参与击碎的守卫部位。 */
  broke: Slot[];
  at: number;
}

export type PartOrigin =
  | { kind: 'preset' }
  | { kind: 'forged'; creatureId: string }
  | { kind: 'captured'; guardId: string; guardSlot: Slot }
  | { kind: 'inherited'; fromCreatureId: string };

/** 一件部件是独立实体：自带槽位、能力、外观和履历，可以被装配、缴获、传承。 */
export interface PartRecord {
  id: string;
  slot: Slot;
  name: string;
  description: string;
  /** 这件部件的能力来自哪一句原话（用于高亮与理由引用）。 */
  source: string;
  trait: Trait;
  model: PartModel;
  /** Tripo 生成用的英文外观提示词（仅生成件）。 */
  visualPrompt?: string;
  origin: PartOrigin;
  /** 传承印记等级 0–3。 */
  level: number;
  history: PartBattleLog[];
  createdAt: number;
}

/** 一只造物的档案：生死都留在图鉴里。 */
export interface CreatureRecord {
  id: string;
  /** 标本编号，从 1 开始全局递增。 */
  specimen: number;
  name: string;
  lore: string;
  /** 玩家写下的原话。 */
  origin: string;
  /** 当前装配的三件部件（头、躯、足）。 */
  partIds: Triple<string>;
  /** 诞生时的三件部件，用于造物卡「它诞生于这句话」的高亮对照。 */
  bornPartIds: Triple<string>;
  generation: number;
  lineageId: string;
  parentId: string | null;
  inheritedPartId: string | null;
  secrets: Secret[];
  createdAt: number;
  status: 'alive' | 'fallen';
  epitaph?: string;
  fallenAt?: number;
  /** 击败守卫的总场数。 */
  wins: number;
  /** 这只造物击败过的守卫（预设守卫编号或 ghost:造物编号）。 */
  defeated: string[];
  /** 到达过的最深守卫序号（0 表示还没出发）。 */
  deepest: number;
  expeditions: number;
}

export interface Settings {
  muted: boolean;
  /** system：跟随系统「减少动态效果」设置。 */
  motion: 'system' | 'reduced' | 'full';
}

export interface TutorialState {
  /** 教学战斗是否完成。 */
  done: boolean;
  /** 已经展示过的一次性提示编号。 */
  seen: string[];
}

export interface Expedition {
  creatureId: string;
  /** 当前挑战的守卫序号（0 为教学守卫）。 */
  depth: number;
  /** 进行中的战斗；null 表示在两场之间。 */
  battle: import('./battle').BattleState | null;
  /** 连续完美应对次数（背景鱼群）。 */
  streak: number;
  /** 本次远征击败的守卫。 */
  beaten: string[];
  /** 生命值在一次远征中延续，只有潮汐泉能回复。 */
  hp: number;
  /** 刚打完一场，等待在潮汐泉三选一。 */
  spring: boolean;
  /** 已经侦察过完整意图序列的守卫。 */
  scouted: string[];
  /** 进行中的写字对决。 */
  duel?: import('./duel').DuelState | null;
}

export interface GameSave {
  version: 2;
  revision: number;
  createdAt: number;
  nextSpecimen: number;
  creatures: CreatureRecord[];
  parts: PartRecord[];
  activeCreatureId: string | null;
  /** 远征进行中的状态；null 表示在港口。刷新页面也会回到这里，无法逃避死亡。 */
  expedition: Expedition | null;
  /** 上一代留下、等待新造物继承的部件。 */
  heir: { partId: string; fromCreatureId: string } | null;
  /** 已解锁完整传说的守卫。 */
  loreUnlocked: string[];
  /** 每位守卫已经解开的谜语（跨造物保留：知识是你的）。 */
  riddles: Record<string, string[]>;
  /** 每位守卫被击败的次数（决定再次挑战时的强度档位）。 */
  guardDefeats: Record<string, number>;
  settledBattleIds: string[];
  tutorial: TutorialState;
  settings: Settings;
}
