export function assertLocalRequest(request: Request): void {
  const url=new URL(request.url);
  const host=request.headers.get('host') || url.host;
  if(!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) throw new Error('生成接口仅开放给本机');
  const origin=request.headers.get('origin');
  if(origin && new URL(origin).host !== host) throw new Error('不允许跨站生成请求');
}
export async function readJson(request: Request): Promise<Record<string,unknown>> {
  const text=await request.text();
  if(text.length>6000) throw new Error('请求过长');
  const value=JSON.parse(text);
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('无效 JSON');
  return value;
}
