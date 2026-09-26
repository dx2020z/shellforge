import { describe, expect, test } from 'vitest';
import {
  ALL_KEYWORDS, KEYWORD_COLORS, KEYWORDS, detectSecrets, judgeInput, keywordSlot, mapCreatureTraits, mapSlotTraits, normalizeQuotes,
} from '@/domain/keywords';

describe('关键词', () => {
  test('每个槽位 5 个，颜色互不相同', () => {
    expect(ALL_KEYWORDS).toHaveLength(15);
    expect(new Set(Object.values(KEYWORD_COLORS)).size).toBe(15);
    for (const k of KEYWORDS.body) expect(keywordSlot(k)).toBe('body');
  });

  test('本地映射的引用都来自原话，理由不是模板句、不含引号', () => {
    const text = '会喷火、披着岩壳、用弹簧腿跳跃的熔岩巨蟹';
    const traits = mapCreatureTraits(text);
    expect(traits.head.keywords).toContain('灼烧');
    expect(traits.body.keywords).toContain('坚壳');
    expect(traits.legs.keywords).toContain('跃击');
    for (const trait of Object.values(traits)) {
      for (const r of trait.reasons) {
        expect(text.includes(r.quote)).toBe(true);
        expect(r.why).not.toMatch(/对应|能力|「|」|“|”|『|』/);
      }
    }
  });

  test('同一句话每次得到同样的理由', () => {
    expect(mapSlotTraits('长满苔藓的石头', 'body')).toEqual(mapSlotTraits('长满苔藓的石头', 'body'));
  });

  test('没有命中时给出默认能力，引用仍是原话片段', () => {
    const trait = mapSlotTraits('一个安静的朋友', 'legs');
    expect(trait.keywords).toHaveLength(1);
    expect('一个安静的朋友'.includes(trait.reasons[0].quote)).toBe(true);
  });

  test('夸张描述带上骄傲；代价全身只结算一次', () => {
    const traits = mapCreatureTraits('无敌的神明，慢吞吞');
    const costs = Object.values(traits).map(t => t.cost).filter(Boolean);
    expect(costs).toEqual(['骄傲']);
    expect(traits.head.reasons.at(-1)).toMatchObject({ keyword: '骄傲', quote: '无敌' });
  });

  test('彩蛋：肥皂冒泡泡、猫会伸懒腰、无敌会被罚', () => {
    expect(detectSecrets('肥皂做的猫')).toEqual(['bubbles', 'cat-stretch']);
    expect(detectSecrets('无敌螃蟹')).toEqual(['invincible']);
  });

  test('空输入、乱码、过长给出世界观回应', () => {
    expect(judgeInput('')).toMatchObject({ ok: false, kind: 'empty' });
    expect(judgeInput('asdfghjkl')).toMatchObject({ ok: false, kind: 'gibberish' });
    expect(judgeInput('哈哈哈哈哈哈')).toMatchObject({ ok: false, kind: 'gibberish' });
    expect(judgeInput('!!!???')).toMatchObject({ ok: false, kind: 'gibberish' });
    expect(judgeInput('猫'.repeat(61))).toMatchObject({ ok: false, kind: 'too-long' });
    expect(judgeInput('a cute banana crab')).toMatchObject({ ok: true });
    expect(judgeInput(' 会发光的水母 ')).toEqual({ ok: true, text: '会发光的水母' });
  });

  test('引号统一为「」', () => {
    expect(normalizeQuotes('他说『焰』和“火”还有"水"')).toBe('他说「焰」和「火」还有「水」');
  });
});
