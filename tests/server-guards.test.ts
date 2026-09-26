import { describe, expect, test } from 'vitest';
import { assertSameOrigin, clientIp, readJson } from '@/server/http';
import { checkLimit } from '@/server/rate-limit';
import { MemoryKV } from '@/server/store/kv';
import { providerUrl, getIntegrationStatus } from '@/server/config';
import { generateEpitaph, generateTaunt } from '@/server/providers/lines';

const req = (headers: Record<string, string>, method = 'POST', body = '{}') =>
  new Request('https://shellforge.vercel.app/api/forge', { method, headers, body: method === 'GET' ? undefined : body });

describe('公网接口保护', () => {
  test('同源请求放行，跨站与无来源的 POST 拒绝', () => {
    expect(() => assertSameOrigin(req({ host: 'shellforge.vercel.app', origin: 'https://shellforge.vercel.app' }))).not.toThrow();
    expect(() => assertSameOrigin(req({ host: 'shellforge.vercel.app', origin: 'https://evil.test' }))).toThrow();
    expect(() => assertSameOrigin(req({ host: 'shellforge.vercel.app' }))).toThrow();
    expect(() => assertSameOrigin(req({ host: 'shellforge.vercel.app', 'sec-fetch-site': 'same-origin' }))).not.toThrow();
    expect(() => assertSameOrigin(req({ host: 'shellforge.vercel.app' }, 'GET'))).not.toThrow();
  });

  test('请求体过大或不是对象时拒绝', async () => {
    await expect(readJson(req({}, 'POST', JSON.stringify({ a: 'x'.repeat(7000) })))).rejects.toThrow(/过长/);
    await expect(readJson(req({}, 'POST', '[1,2]'))).rejects.toThrow();
  });

  test('取 x-forwarded-for 的第一段作为客户端地址', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });

  test('按 IP 每小时限流，并有全站每日上限', async () => {
    const kv = new MemoryKV();
    for (let i = 0; i < 20; i++) expect((await checkLimit(kv, 'forge', '1.1.1.1', {}, 0)).ok).toBe(true);
    const blocked = await checkLimit(kv, 'forge', '1.1.1.1', {}, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/锻炉/);
    expect((await checkLimit(kv, 'forge', '1.1.1.1', {}, 3_600_000)).ok).toBe(true);
    const tiny = new MemoryKV();
    expect((await checkLimit(tiny, 'forge', 'a', { SHELLFORGE_DAILY_FORGE_LIMIT: '1' }, 0)).ok).toBe(true);
    expect((await checkLimit(tiny, 'forge', 'b', { SHELLFORGE_DAILY_FORGE_LIMIT: '1' }, 0)).ok).toBe(false);
  });

  test('Tripo 专属部件有全站每日上限，超过后不再提交', async () => {
    const kv = new MemoryKV();
    const env = { SHELLFORGE_DAILY_MODEL_LIMIT: '3' };
    for (const ip of ['a', 'b', 'c']) expect((await checkLimit(kv, 'model', ip, env, 0)).ok).toBe(true);
    const blocked = await checkLimit(kv, 'model', 'd', env, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/能力不变/);
    expect((await checkLimit(kv, 'model', 'd', env, 86_400_000)).ok).toBe(true);
  });

  test('服务地址必须是无凭据 HTTPS', () => {
    expect(() => providerUrl('http://api.deepseek.com', 'https://x')).toThrow();
    expect(() => providerUrl('https://u:p@api.deepseek.com', 'https://x')).toThrow();
    expect(providerUrl(undefined, 'https://api.deepseek.com/')).toBe('https://api.deepseek.com');
    expect(getIntegrationStatus({}).deepseekConfigured).toBe(false);
  });
});

describe('守卫台词与墓志铭', () => {
  const env = { DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'm' };
  const reply = (value: unknown) => async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
  const taunt = { guard: '铜甲斥候', catchphrase: '嘎吱嘎吱', creature: '熔岩蟹', origin: '会喷火的螃蟹', keywords: ['灼烧'] };

  test('合格台词原样返回，引号统一', async () => {
    expect(await generateTaunt(taunt, env, reply({ taunt: '嘎吱嘎吱，“烤螃蟹”来了？' }))).toBe('嘎吱嘎吱，「烤螃蟹」来了？');
  });
  test('过长、换行、失败或未配置时返回 null，不阻塞', async () => {
    expect(await generateTaunt(taunt, env, reply({ taunt: '太长'.repeat(30) }))).toBeNull();
    expect(await generateTaunt(taunt, env, reply({ taunt: '第一行\n第二行' }))).toBeNull();
    expect(await generateTaunt(taunt, env, async () => { throw new Error('x'); })).toBeNull();
    let calls = 0;
    expect(await generateTaunt(taunt, {}, async () => { calls++; return new Response(''); })).toBeNull();
    expect(calls).toBe(0);
  });
  test('墓志铭', async () => {
    const epitaph = await generateEpitaph({ creature: '钟楼鲸', origin: '背着珊瑚钟楼的深海鲸', guardsBeaten: ['潮汐学徒'], killedBy: '铜甲斥候', generation: 2 }, env, reply({ epitaph: '它背着钟楼走过两片海域，最后一声钟响留给了铜甲斥候' }));
    expect(epitaph).toMatch(/钟楼/);
  });
});

describe('线上没有持久存储时不启用 Tripo', () => {
  test('本地有密钥就能用；Vercel 上必须同时有 Blob 和 Redis', async () => {
    const { getIntegrationStatus } = await import('@/server/config');
    const keys = { TRIPO_API_KEY: 'k', TRIPO_MODEL: 'm' };
    expect(getIntegrationStatus(keys).tripoUsable).toBe(true);
    expect(getIntegrationStatus({ ...keys, VERCEL: '1' }).tripoUsable).toBe(false);
    expect(getIntegrationStatus({ ...keys, VERCEL: '1', BLOB_READ_WRITE_TOKEN: 'b', UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't' }).tripoUsable).toBe(true);
    // Vercel 市场连接 Upstash 自动生成的变量名也要认。
    const market = getIntegrationStatus({ ...keys, VERCEL: '1', BLOB_READ_WRITE_TOKEN: 'b', KV_REST_API_URL: 'https://u', KV_REST_API_TOKEN: 't' });
    expect(market.durableStorage).toBe(true);
    expect(market.tripoUsable).toBe(true);
  });
});
