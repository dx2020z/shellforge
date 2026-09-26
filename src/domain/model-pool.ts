import type { Keyword, Slot } from './keywords';
import { genUrl, PREGEN_GUARD_FOR, PREGEN_SETS } from './pregen-catalog';
import generated from './generated-models.json';

/**
 * 离线部件库：没有 Tripo（或生成还没完成）时，从这里挑最贴近原话的部件先顶上。
 * 模型来自旧项目已经生成过的卡通造物，经 scripts/optimize-models.ts 压缩。
 */
export interface PoolPart {
  id: string;
  set: string;
  slot: Slot;
  url: string;
  /** 这件部件最像的关键词。 */
  keyword: Keyword;
  /** 原话里出现这些字时优先选它。 */
  words: string[];
}

const url = (set: string, slot: Slot) => `/assets/creatures/${set}/${slot}.glb`;
const part = (set: string, slot: Slot, keyword: Keyword, words: string[]): PoolPart => ({ id: `${set}:${slot}`, set, slot, url: url(set, slot), keyword, words });
const preset = (id: string, slot: Slot, keyword: Keyword, words: string[]): PoolPart => ({ id: `preset-${id}:${slot}`, set: `preset-${id}`, slot, url: `/assets/parts/${id}/model.glb`, keyword, words });

export const MODEL_POOL: PoolPart[] = [
  part('iron-heron', 'head', '穿刺', ['鹭', '鸟', '喙', '尖', '铁', '嘴']),
  part('iron-heron', 'body', '坚壳', ['羽', '铁', '甲', '鸟', '硬']),
  part('iron-heron', 'legs', '迅捷', ['长腿', '细', '鸟', '鹭', '快']),
  part('silver-duck', 'head', '连击', ['鸭', '水晶', '银', '红', '啄']),
  part('silver-duck', 'body', '反射', ['水晶', '银', '镜', '光', '恐龙', '骨']),
  part('silver-duck', 'legs', '迅捷', ['猴', '跑', '灵活', '快', '光']),
  part('coral', 'head', '震慑', ['珊瑚', '瞌睡', '困', '粉', '花']),
  part('coral', 'body', '再生', ['珊瑚', '苔', '软', '长', '花', '海']),
  part('coral', 'legs', '吸附', ['珊瑚', '吸盘', '慢', '枝', '章鱼']),
  part('moon-fish', 'head', '吞噬', ['鱼', '笑', '月', '圆', '嘴', '吃']),
  part('moon-fish', 'body', '反射', ['鳞', '闪', '鱼', '亮', '银']),
  part('moon-fish', 'legs', '回旋', ['鳍', '尾', '游', '鱼', '浪', '摆']),
  part('fluffy', 'head', '震慑', ['毛', '绒', '乖', '软', '棉', '萌', '猫', '狗']),
  part('fluffy', 'body', '膨胀', ['毛', '绒', '胖', '圆', '棉', '软', '大']),
  part('fluffy', 'legs', '潜行', ['毛', '绒', '软', '轻', '猫', '小']),
  part('bull', 'head', '穿刺', ['牛', '角', '犀', '倔', '撞']),
  part('bull', 'body', '蓄能', ['牛', '肌肉', '健身', '壮', '力']),
  part('bull', 'legs', '迅捷', ['牛', '蹄', '跑', '冲']),
  part('hat-dino', 'head', '震慑', ['恐龙', '帽', '龙', '吼']),
  part('hat-dino', 'body', '坚壳', ['恐龙', '鳞', '龙', '甲', '壳']),
  part('hat-dino', 'legs', '跃击', ['恐龙', '爪', '龙', '踩', '跳']),
  part('lava-crab', 'head', '灼烧', ['火', '熔岩', '岩浆', '蟹', '烫', '焰']),
  part('lava-crab', 'body', '坚壳', ['岩', '壳', '蟹', '石', '熔岩']),
  part('lava-crab', 'legs', '跃击', ['弹簧', '跳', '蟹', '钳']),
  part('lizard', 'head', '灼烧', ['火山', '蜥蜴', '火', '岩']),
  part('lizard', 'body', '坚壳', ['熔岩', '鳞', '岩', '石', '火山']),
  part('lizard', 'legs', '跃击', ['弹簧', '跳', '蜥蜴']),
  part('blue-seahorse', 'head', '灼烧', ['海马', '蓝', '火焰', '焰', '火']),
  part('blue-seahorse', 'body', '蓄能', ['海马', '蓝', '火', '焰']),
  part('blue-seahorse', 'legs', '回旋', ['海马', '尾', '卷', '游']),
  // 早期的机械风预置部件：和卡通部件混搭，让同一句话的躯干和腿也有变化。
  preset('h01', 'head', '灼烧', ['机械', '机器', '铜', '钢铁']),
  preset('h02', 'head', '震慑', ['机械', '机器', '螺号', '铁']),
  preset('h03', 'head', '穿刺', ['机械', '钻头', '独角']),
  preset('b01', 'body', '坚壳', ['机械', '机器', '铁甲', '礁岩', '盔甲']),
  preset('b02', 'body', '蓄能', ['机械', '发条', '齿轮', '骷髅']),
  preset('b03', 'body', '再生', ['苔', '藓', '青苔', '机械']),
  preset('l01', 'legs', '迅捷', ['机械', '机器', '钢铁']),
  preset('l02', 'legs', '吸附', ['机械', '机器', '铁']),
  preset('l03', 'legs', '跃击', ['机械', '弹簧']),
  ...generatedParts(),
];

/** 清单里三个槽位都生成好了的预生成套装。 */
export function generatedReady(set: string): boolean {
  const entry = (generated.sets as Record<string, Partial<Record<Slot, unknown>>>)[set];
  return Boolean(entry?.head && entry.body && entry.legs);
}

function generatedParts(): PoolPart[] {
  const out: PoolPart[] = [];
  for (const s of PREGEN_SETS) {
    if (s.kind !== 'player' || !generatedReady(s.id)) continue;
    for (const slot of ['head', 'body', 'legs'] as const) {
      const d = s.parts[slot];
      out.push({ id: `gen-${s.id}:${slot}`, set: `gen-${s.id}`, slot, url: genUrl(s.id, slot), keyword: d.keyword, words: d.words });
    }
  }
  return out;
}

/** 守卫专用的模型（不进入玩家的离线部件库，避免撞款）。 */
export const GUARD_SETS: Record<number, string> = {
  19: 'blue-seahorse',
  1: 'brass-bird',
  8: 'lava-crab',
  10: 'kelp-deer',
  7: 'mantis',
  18: 'lizard',
  12: 'hat-dino',
};
/** 写字对决里预设守卫用的套装：玩家的造物永远不会拿到这些部件。 */
const GUARD_ONLY = new Set(['brass-bird', 'lava-crab', 'kelp-deer', 'mantis', 'lizard', 'hat-dino']);

export function guardModelUrls(modelSet: number, guardId?: string): Record<Slot, string> {
  const gen = guardId ? PREGEN_GUARD_FOR[guardId] : undefined;
  if (gen && generatedReady(gen)) return { head: genUrl(gen, 'head'), body: genUrl(gen, 'body'), legs: genUrl(gen, 'legs') };
  const set = GUARD_SETS[modelSet];
  return { head: url(set, 'head'), body: url(set, 'body'), legs: url(set, 'legs') };
}

function hash(text: string) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h;
}

/**
 * 为一个槽位挑选离线部件：
 * - 原话里真的写到了这个关键词 +3（兜底能力只 +1），原话里每出现一个特征字 +2；
 * - 名册里其他造物、海沟里的守卫已经在用的部件 -4（尽量不撞款）；同一只造物的另一个槽位同套装 -1.5（鼓励混搭）；
 * - 同分时按原话和 salt 做稳定挑选。
 */
export function pickPoolPart(
  slot: Slot,
  origin: string,
  keywords: readonly Keyword[],
  avoidSets: readonly string[] = [],
  options: { avoidUrls?: readonly string[]; weak?: boolean; salt?: string | number } = {},
): PoolPart {
  const candidates = MODEL_POOL.filter(p => p.slot === slot && !GUARD_ONLY.has(p.set));
  const avoidUrls = new Set(options.avoidUrls ?? []);
  const scored = candidates.map(p => {
    let score = keywords.includes(p.keyword) ? (options.weak ? 1 : 3) : 0;
    let named = 0;
    for (const w of p.words) if (origin.includes(w)) named += 2;
    score += named;
    // 鼓励混搭；但原话点名了这种动物（写了「章鱼」就该是章鱼的腿），就不扣分。
    if (avoidSets.includes(p.set) && !named) score -= 1.5;
    if (avoidUrls.has(p.url)) score -= 4;
    // 机械风的早期部件和卡通部件放在一起有点跳：只有写到机械、苔藓之类才优先选它们。
    if (p.set.startsWith('preset-') && !p.words.some(w => origin.includes(w))) score -= 2;
    // 预生成的新部件画风统一、面孔清楚：同分时优先它们。
    if (p.set.startsWith('gen-')) score += 0.5;
    return { p, score };
  });
  const best = Math.max(...scored.map(s => s.score));
  const top = scored.filter(s => s.score === best).map(s => s.p);
  return top[hash(origin + slot + String(options.salt ?? '')) % top.length];
}

/** 所有玩家可用的部件（不含守卫专用套装）。 */
export function playerPool(slot: Slot): PoolPart[] {
  return MODEL_POOL.filter(p => p.slot === slot && !GUARD_ONLY.has(p.set));
}
