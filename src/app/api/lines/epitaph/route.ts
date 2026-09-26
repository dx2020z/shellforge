import { assertSameOrigin, clientIp, readJson } from '@/server/http';
import { checkLimit } from '@/server/rate-limit';
import { getKV } from '@/server/store/kv';
import { generateEpitaph } from '@/server/providers/lines';

export const runtime = 'nodejs';

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && [...v].length <= max ? v.trim() : null);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request, 2000);
    const creature = str(body.creature, 12), origin = str(body.origin, 60), killedBy = str(body.killedBy, 16);
    const guardsBeaten = Array.isArray(body.guardsBeaten) ? body.guardsBeaten.filter((g): g is string => typeof g === 'string' && g.length <= 16).slice(0, 12) : [];
    const generation = Number.isSafeInteger(body.generation) ? (body.generation as number) : 1;
    if (!creature || !origin || !killedBy) return Response.json({ line: null });
    if (!(await checkLimit(await getKV(), 'line', clientIp(request))).ok) return Response.json({ line: null });
    return Response.json({ line: await generateEpitaph({ creature, origin, killedBy, guardsBeaten, generation }) });
  } catch {
    return Response.json({ line: null });
  }
}
