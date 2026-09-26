import { assertSameOrigin, clientIp, errorResponse, readJson, RequestError } from '@/server/http';
import { checkLimit } from '@/server/rate-limit';
import { getKV } from '@/server/store/kv';
import { generateCreatureDraft, validateOrigin } from '@/server/providers/creature';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request, 2000);
    let origin: string;
    try {
      origin = validateOrigin(body.description);
    } catch (error) {
      // 空输入、乱码：返回幽默回应，前端原样展示。
      return Response.json({ reply: error instanceof Error ? error.message : '写点什么吧。' }, { status: 422 });
    }
    const limit = await checkLimit(await getKV(), 'forge', clientIp(request));
    if (!limit.ok) throw new RequestError(limit.message!, 429);
    return Response.json(await generateCreatureDraft(origin));
  } catch (error) {
    return errorResponse(error, '锻炉没能读懂这次请求，请回到工坊重新写下你的造物。');
  }
}
