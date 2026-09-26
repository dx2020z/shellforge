import { intEnv, type Env } from './config';
import type { KV } from './store/kv';

/**
 * 限流：接口对公网开放后，防止链接被刷。按 IP 的小时窗口 + 全站每日上限。
 * 计数放在 KV 里（线上是 Redis），多实例共享。
 */
export type LimitScope = 'forge' | 'model' | 'line';

const PER_IP_HOURLY: Record<LimitScope, number> = { forge: 20, model: 60, line: 120 };

export interface LimitResult {
  ok: boolean;
  /** 给玩家看的世界观文案。 */
  message?: string;
}

function hourBucket(now: number) {
  return Math.floor(now / 3_600_000);
}
function dayBucket(now: number) {
  return Math.floor(now / 86_400_000);
}
function safeIp(ip: string) {
  return ip.replace(/[^a-z0-9]/gi, '_').slice(0, 64) || 'unknown';
}

export async function checkLimit(kv: KV, scope: LimitScope, ip: string, env: Env = process.env, now = Date.now()): Promise<LimitResult> {
  const perIp = await kv.incr(`rl:${scope}:${safeIp(ip)}:${hourBucket(now)}`, 3600);
  if (perIp > PER_IP_HOURLY[scope]) {
    return { ok: false, message: '锻炉烧得太烫了，歇一会儿再来。一小时后潮水会退凉。' };
  }
  if (scope === 'forge') {
    const daily = await kv.incr(`rl:forge-day:${dayBucket(now)}`, 86_400);
    if (daily > intEnv(env.SHELLFORGE_DAILY_FORGE_LIMIT, 400, 1)) {
      return { ok: false, message: '今天海里的造物已经太多了。明天潮起时再来，或者先用港口里的部件出发。' };
    }
  }
  if (scope === 'model') {
    // Tripo 按次收费：全站每天最多生成这么多件专属部件，超过后造物先穿部件库里的外壳。
    const daily = await kv.incr(`rl:model-day:${dayBucket(now)}`, 86_400);
    if (daily > intEnv(env.SHELLFORGE_DAILY_MODEL_LIMIT, 300, 1)) {
      return { ok: false, message: '今天的专属外形已经孵完了，它先穿着部件库里的外壳，能力不变。' };
    }
  }
  return { ok: true };
}
