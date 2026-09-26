import pkg from '../../package.json';

export type Env = Record<string, string | undefined>;

export function getIntegrationStatus(env: Env = process.env) {
  return {
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY?.trim() && env.DEEPSEEK_MODEL?.trim()),
    tripoConfigured: Boolean(env.TRIPO_API_KEY?.trim() && env.TRIPO_MODEL?.trim()),
    /** 线上是否有持久存储。没有时生成的模型只在当前实例的临时目录里。 */
    durableStorage: Boolean(env.BLOB_READ_WRITE_TOKEN?.trim() && env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim()),
    /**
     * Tripo 真正可用：配置了密钥，并且（本地运行，或线上开通了 Blob + Redis）。
     * 线上没有持久存储时，生成好的模型和任务记录会随函数实例消失——既白花钱，玩家刷新后外形也会丢，所以直接不启用。
     */
    tripoUsable:
      Boolean(env.TRIPO_API_KEY?.trim() && env.TRIPO_MODEL?.trim()) &&
      (!env.VERCEL || Boolean(env.BLOB_READ_WRITE_TOKEN?.trim() && env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim())),
    version: pkg.version,
  };
}

/** 服务地址必须是不带凭据、查询串和锚点的 HTTPS 地址。 */
export function providerUrl(value: string | undefined, fallback: string): string {
  const url = new URL(value?.trim() || fallback);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('服务地址须为无凭据的 HTTPS 地址');
  }
  return url.href.replace(/\/$/, '');
}

export function intEnv(value: string | undefined, fallback: number, min = 0, max = 1_000_000): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
