import { SLOT_NAMES, keywordColor, COST_COLOR, type Cost, type Keyword, type Slot } from './keywords';
import { creatureParts, findCreature, findPart } from './creature';
import { GUARDS } from './guards';
import type { CreatureRecord, GameSave } from './types';

/**
 * 造物卡的文字内容（纯函数，方便测试）。所有引号统一成「」；
 * 理由一律写成「因为你写了「原话」，……」。
 */

export interface CardPart {
  slot: Slot;
  glyph: string;
  name: string;
  keywords: { text: Keyword; color: string }[];
  cost: { text: Cost; color: string } | null;
  /** 「因为你写了「…」，…」 */
  reason: string;
  level: number;
  origin: 'forged' | 'captured' | 'inherited' | 'preset';
}

export interface CardData {
  specimen: string;
  date: string;
  name: string;
  /** 名字字号（按长度缩小）。 */
  nameSize: number;
  generation: string;
  lineage: string | null;
  origin: string;
  /** 原话里被引用的片段及其颜色，按出现顺序。 */
  highlights: { text: string; color: string | null }[];
  lore: string;
  parts: CardPart[];
  record: string;
  fallen: boolean;
  epitaph: string | null;
}

const DEPTH_METRES = [20, 90, 180, 290, 420, 580, 760];

/** 去掉引用片段里多余的引号，保证只出现一层「」。 */
export function cleanQuote(text: string): string {
  return text.replace(/[「」『』“”"'‘’]/g, '').trim();
}

export function reasonSentence(quote: string, why: string): string {
  const q = cleanQuote(quote);
  const w = why.replace(/[“”"]/g, '').replace(/^[，,。\s]+/, '').replace(/[。.]*$/, '');
  return `因为你写了「${q}」，${w}。`;
}

export function nameSizeFor(name: string): number {
  const n = [...name].length;
  if (n <= 4) return 132;
  if (n <= 6) return 112;
  if (n <= 8) return 92;
  if (n <= 10) return 76;
  return 64;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export function segmentHighlights(origin: string, quotes: { text: string; color: string }[]): CardData['highlights'] {
  const hits: { start: number; end: number; color: string }[] = [];
  for (const q of [...quotes].sort((a, b) => b.text.length - a.text.length)) {
    if (!q.text) continue;
    let from = 0;
    while (from <= origin.length) {
      const start = origin.indexOf(q.text, from);
      if (start < 0) break;
      const end = start + q.text.length;
      if (!hits.some(h => start < h.end && end > h.start)) {
        hits.push({ start, end, color: q.color });
        break;
      }
      from = start + 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: CardData['highlights'] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) out.push({ text: origin.slice(cursor, h.start), color: null });
    out.push({ text: origin.slice(h.start, h.end), color: h.color });
    cursor = h.end;
  }
  if (cursor < origin.length) out.push({ text: origin.slice(cursor), color: null });
  return out;
}

export function cardData(save: GameSave, creature: CreatureRecord): CardData {
  const parts = creatureParts(save, creature);
  const cardParts: CardPart[] = parts.map(p => {
    const main = p.trait.reasons.find(r => r.keyword === p.trait.keywords[0]) ?? p.trait.reasons[0];
    const reason =
      p.origin.kind === 'captured'
        ? `从${p.source.split('的')[0]}身上缴获，${main?.why ?? '它还带着原主人的脾气'}。`.replace(/。。$/, '。')
        : main
          ? reasonSentence(main.quote, main.why)
          : `因为你写了「${cleanQuote(creature.origin).slice(0, 8)}」，它长成了这样。`;
    return {
      slot: p.slot,
      glyph: SLOT_NAMES[p.slot],
      name: p.name,
      keywords: p.trait.keywords.map(k => ({ text: k, color: keywordColor(k) })),
      cost: p.trait.cost ? { text: p.trait.cost, color: COST_COLOR } : null,
      reason,
      level: p.level,
      origin: p.origin.kind,
    };
  });

  // 原话高亮用诞生时的部件（后来换上的缴获件不在原话里）。
  const born = creature.bornPartIds.map(id => findPart(save, id)).filter(Boolean);
  const quotes = born.flatMap(p => p!.trait.reasons.map(r => ({ text: cleanQuote(r.quote), color: keywordColor(r.keyword) })));

  const parent = creature.parentId ? findCreature(save, creature.parentId) : undefined;
  const inherited = creature.inheritedPartId ? findPart(save, creature.inheritedPartId) : undefined;
  const lineage = parent ? `继承自${parent.name}的「${cleanQuote(inherited?.name ?? '一件部件')}」` : null;

  const deepest = creature.deepest > 0 ? `最深 −${DEPTH_METRES[Math.min(creature.deepest - 1, DEPTH_METRES.length - 1)]}m` : null;
  const record =
    creature.wins === 0
      ? creature.expeditions === 0 && creature.status === 'alive'
        ? '初次远征'
        : '初次远征 · 还没有击败过守卫'
      : [`击败守卫 ${creature.wins} 次`, deepest, creature.deepest >= GUARDS.length ? '抵达海沟尽头' : null].filter(Boolean).join(' · ');

  return {
    specimen: `No.${String(creature.specimen).padStart(4, '0')}`,
    date: formatDate(creature.fallenAt ?? creature.createdAt),
    name: creature.name,
    nameSize: nameSizeFor(creature.name),
    generation: creature.generation <= 1 ? '初代造物' : `第 ${creature.generation} 代`,
    lineage,
    origin: creature.origin,
    highlights: segmentHighlights(creature.origin, quotes),
    lore: creature.lore.replace(/[“”"]/g, ''),
    parts: cardParts,
    record,
    fallen: creature.status === 'fallen',
    epitaph: creature.status === 'fallen' ? (creature.epitaph ?? null) : null,
  };
}

/** 图鉴：按血脉分组，每组从初代排到最新一代。 */
export function lineages(save: GameSave): { id: string; creatures: CreatureRecord[] }[] {
  const groups = new Map<string, CreatureRecord[]>();
  for (const c of save.creatures) {
    const list = groups.get(c.lineageId) ?? [];
    list.push(c);
    groups.set(c.lineageId, list);
  }
  return [...groups.entries()]
    .map(([id, list]) => ({ id, creatures: list.sort((a, b) => a.generation - b.generation || a.createdAt - b.createdAt) }))
    .sort((a, b) => Math.max(...b.creatures.map(c => c.createdAt)) - Math.max(...a.creatures.map(c => c.createdAt)));
}
