export type Env = Record<string, string|undefined>;
export function getIntegrationStatus(env: Env = process.env) {
  return {
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY?.trim() && env.DEEPSEEK_MODEL?.trim()),
    tripoConfigured: Boolean(env.TRIPO_API_KEY?.trim() && env.TRIPO_MODEL?.trim()),
    verification: '配置存在不代表已联通；以实际生成结果为准',
    version: '0.2.0'
  };
}
export function providerUrl(value: string|undefined, fallback: string): string {
  const url = new URL(value || fallback);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('服务地址须为无凭据的 HTTPS 地址');
  return url.href.replace(/\/$/, '');
}
