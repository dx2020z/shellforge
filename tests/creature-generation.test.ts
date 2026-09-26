import { describe, expect, test } from 'vitest';
import { generateCreatureDraft, localCreatureDraft, parseCreatureDraft, validateOrigin } from '@/server/providers/creature';

type Reason = { keyword: string; quote: string; why: string };
type PartRaw = { title: string; description: string; visualPrompt: string; keywords: string[]; cost: string | null; reasons: Reason[] };
type Draft = { name: string; lore: string; parts: { head: PartRaw; body: PartRaw; legs: PartRaw } };

const origin = '一只毛茸茸、很乖、从不还嘴的健身牛';
const good = (): Draft => ({
  name: '绒默牛来',
  lore: '它从不还嘴，只用肌肉说话。',
  parts: {
    head: { title: '绒默首', description: '低着头的温顺牛首', visualPrompt: 'gentle bull head with fluffy fur', keywords: ['震慑'], cost: null, reasons: [{ keyword: '震慑', quote: '很乖、从不还嘴', why: '低头的样子反而能震住对手' }] },
    body: { title: '牛来之躯', description: '健身练出的厚实胸膛', visualPrompt: 'muscular torso', keywords: ['坚壳'], cost: null, reasons: [{ keyword: '坚壳', quote: '健身', why: '紧绷的肌肉能硬抗冲击' }] },
    legs: { title: '绒默足', description: '毛茸茸的短腿', visualPrompt: 'fluffy short legs', keywords: ['潜行'], cost: null, reasons: [{ keyword: '潜行', quote: '毛茸茸', why: '软软的短腿落地无声' }] },
  },
});
const json = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
const env = { DEEPSEEK_API_KEY: 'secret-key', DEEPSEEK_MODEL: 'test-model' };

describe('一句话造物', () => {
  test('空输入与乱码返回幽默回应而不是报错文案', () => {
    expect(() => validateOrigin('   ')).toThrow(/贝壳|海水|潮汐/);
    expect(() => validateOrigin('qwrtpsdfgh')).toThrow(/章鱼|字符|咒语/);
    expect(validateOrigin('  会喷火的  螃蟹 ')).toBe('会喷火的 螃蟹');
  });

  test('合格回复原样保留名字、理由和引用', () => {
    const draft = parseCreatureDraft(good(), origin);
    expect(draft.source).toBe('deepseek');
    expect(draft.parts.head.trait.reasons[0]).toEqual({ keyword: '震慑', quote: '很乖、从不还嘴', why: '低头的样子反而能震住对手' });
  });

  test('引用必须逐字出现在原话里', () => {
    const bad = good();
    bad.parts.body.reasons[0].quote = '健美';
    expect(() => parseCreatureDraft(bad, origin)).toThrow(/连续片段/);
  });

  test('模板句理由与重复前缀被就地修复，而不是原样展示', () => {
    const bad = good();
    bad.parts.body.reasons[0].why = '「健身」对应坚壳能力';
    bad.parts.legs.reasons[0].why = '因为你写了「毛茸茸」，软软的短腿落地无声。';
    const draft = parseCreatureDraft(bad, origin);
    expect(draft.parts.body.trait.reasons[0].why).not.toMatch(/对应|能力|「/);
    expect(draft.parts.legs.trait.reasons[0].why).toBe('软软的短腿落地无声');
  });

  test('跨槽技能被过滤，全部无效时拒绝', () => {
    const bad = good();
    bad.parts.legs.keywords = ['灼烧'];
    bad.parts.legs.reasons[0].keyword = '灼烧';
    expect(() => parseCreatureDraft(bad, origin)).toThrow();
  });

  test('夸张描述必须附带代价，且全身只能有一个代价', () => {
    const boast = '无敌的神明螃蟹';
    const value = good();
    for (const slot of ['head', 'body', 'legs'] as const) value.parts[slot].reasons[0].quote = '螃蟹';
    expect(() => parseCreatureDraft(value, boast)).toThrow(/代价/);
    const withCost = structuredClone(value);
    withCost.parts.head.cost = '骄傲';
    withCost.parts.head.reasons.push({ keyword: '骄傲', quote: '无敌', why: '神明嫌同一招不够有排面，偏不连用' });
    expect(parseCreatureDraft(withCost, boast).parts.head.trait.cost).toBe('骄傲');
    const twoCosts = structuredClone(withCost);
    twoCosts.parts.body.cost = '脆壳';
    twoCosts.parts.body.reasons.push({ keyword: '脆壳', quote: '螃蟹', why: '壳薄得一碰就裂' });
    expect(() => parseCreatureDraft(twoCosts, boast)).toThrow(/一个/);
  });

  test('没有密钥时不发请求，直接本地锻造', async () => {
    let calls = 0;
    const result = await generateCreatureDraft(origin, {}, async () => { calls++; return new Response(''); });
    expect(calls).toBe(0);
    expect(result.draft.source).toBe('local');
    expect(result.note).toBeUndefined();
  });

  test('上游失败时回退本地，文案不泄露密钥与技术细节', async () => {
    const result = await generateCreatureDraft(origin, env, async () => { throw new Error('secret-key leaked?'); });
    expect(result.draft.source).toBe('local');
    expect(result.note).not.toMatch(/secret|HTTP|DeepSeek/);
  });

  test('上游第一次不合格、第二次合格时使用第二次', async () => {
    let calls = 0;
    const result = await generateCreatureDraft(origin, env, async () => (++calls === 1 ? json({ name: 'x' }) : json(good())));
    expect(calls).toBe(2);
    expect(result.draft.source).toBe('deepseek');
  });

  test('本地锻造：三件都有引用自原话的理由，代价只出现一次', () => {
    const draft = localCreatureDraft('慢吞吞但会喷火的巨大乌龟');
    for (const slot of ['head', 'body', 'legs'] as const) {
      for (const reason of draft.parts[slot].trait.reasons) expect(draft.origin.includes(reason.quote)).toBe(true);
    }
    const costs = (['head', 'body', 'legs'] as const).map(s => draft.parts[s].trait.cost).filter(Boolean);
    expect(costs).toEqual(['迟缓']);
    expect(draft.parts.head.trait.keywords).toContain('灼烧');
  });
});
