/**
 * 公网接口的第一道门：只接受本站页面发起的请求（同源），限制请求体大小。
 * 旧版的「仅本机」限制已替换为「同源 + 限流」，手机和电脑都能访问。
 */

export class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function assertSameOrigin(request: Request): void {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const origin = request.headers.get('origin');
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new RequestError('来源无效', 403);
    }
    if (originHost !== host) throw new RequestError('不允许跨站请求', 403);
    return;
  }
  // 没有 Origin 的 POST（例如 curl）必须至少带同站的 Sec-Fetch-Site。
  if (request.method !== 'GET') {
    const site = request.headers.get('sec-fetch-site');
    if (site !== 'same-origin') throw new RequestError('不允许跨站请求', 403);
  }
}

export async function readJson(request: Request, maxBytes = 6000): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new RequestError('请求过长', 413);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RequestError('无效 JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError('无效 JSON');
  return value as Record<string, unknown>;
}

/** Vercel 会把真实客户端地址放在 x-forwarded-for 的第一段。 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local';
}

export function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: fallback }, { status: 400 });
}
