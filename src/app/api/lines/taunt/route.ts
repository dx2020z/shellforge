import { assertSameOrigin, clientIp, readJson } from '@/server/http';
import { checkLimit } from '@/server/rate-limit';
import { getKV } from '@/server/store/kv';
import { generateTaunt } from '@/server/providers/lines';

export const runtime = 'nodejs';

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && [...v].length <= max ? v.trim() : null);

/** 失败一律返回 { line: null }，前端使用守卫的预设台词。 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request, 2000);
    const guard = str(body.guard, 16), catchphrase = str(body.catchphrase, 16), creature = str(body.creature, 12), origin = str(body.origin, 60);
    const keywords = Array.isArray(body.keywords) ? body.keywords.filter((k): k is string => typeof k === 'string' && k.length <= 4).slice(0, 6) : [];
    if (!guard || !catchphrase || !creature || !origin) return Response.json({ line: null });
    if (!(await checkLimit(await getKV(), 'line', clientIp(request))).ok) return Response.json({ line: null });
    return Response.json({ line: await generateTaunt({ guard, catchphrase, creature, origin, keywords }) });
  } catch {
    return Response.json({ line: null });
  }
}
