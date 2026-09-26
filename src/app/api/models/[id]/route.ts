import { getModelStore } from '@/server/store/models';

export const runtime = 'nodejs';

/** 本地开发时提供 .runtime/models 里的 GLB；线上模型直接走 Blob 地址，不经过这里。 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const store = getModelStore();
    if (!store.read) throw new Error('not local');
    const data = await store.read((await context.params).id);
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return Response.json({ error: '这枚贝壳还没有孵化，或已经沉入海底。' }, { status: 404 });
  }
}
