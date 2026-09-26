import { assertSameOrigin, clientIp, errorResponse, readJson, RequestError } from '@/server/http';
import { checkLimit } from '@/server/rate-limit';
import { getKV } from '@/server/store/kv';
import { createTask, validateSlot } from '@/server/model-tasks';
import { getIntegrationStatus } from '@/server/config';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!getIntegrationStatus().tripoUsable) throw new RequestError('专属外形暂时不可用，先用部件库的样子', 503);
    const body = await readJson(request);
    if (typeof body.id !== 'string' || typeof body.prompt !== 'string') throw new RequestError('请求缺少字段');
    const slot = validateSlot(body.slot);
    const kv = await getKV();
    const limit = await checkLimit(kv, 'model', clientIp(request));
    if (!limit.ok) throw new RequestError(limit.message!, 429);
    const task = await createTask({ id: body.id, slot, prompt: body.prompt }, { kv, retry: body.retry === true });
    return Response.json({ task });
  } catch (error) {
    return errorResponse(error, '孵化池没有接住这枚贝壳。若刚才已经提交过，请先查询原任务，避免重复孵化。');
  }
}
