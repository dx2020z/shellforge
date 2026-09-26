import { errorResponse, RequestError } from '@/server/http';
import { pollTask } from '@/server/model-tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const task = await pollTask((await context.params).id);
    if (!task) throw new RequestError('找不到这枚贝壳', 404);
    return Response.json({ task }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error, '暂时看不清孵化池，请稍后再试。');
  }
}
