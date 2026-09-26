import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config';

/**
 * 小型键值存储：生成任务、提示词缓存索引、锁、限流计数都放这里。
 * 本地开发写 .runtime/kv；线上用 Upstash Redis（Vercel 函数没有持久磁盘）。
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  /** 只有键不存在时才写入，返回是否写入成功。用于锁和「同一编号只提交一次」。 */
  setIfAbsent(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<void>;
  /** 计数器加一并返回新值；第一次创建时设置过期时间。 */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

const SAFE_KEY = /^[a-z0-9:_-]{1,200}$/i;
function assertKey(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error('非法存储键');
}

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

export class MemoryKV implements KV {
  private data = new Map<string, Entry>();
  constructor(private now: () => number = Date.now) {}
  private live(key: string): Entry | undefined {
    const entry = this.data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }
  async get<T>(key: string) {
    assertKey(key);
    const entry = this.live(key);
    return entry ? (structuredClone(entry.value) as T) : null;
  }
  async set(key: string, value: unknown, ttl?: number) {
    assertKey(key);
    this.data.set(key, { value: structuredClone(value), expiresAt: ttl ? this.now() + ttl * 1000 : null });
  }
  async setIfAbsent(key: string, value: unknown, ttl?: number) {
    assertKey(key);
    if (this.live(key)) return false;
    await this.set(key, value, ttl);
    return true;
  }
  async del(key: string) {
    assertKey(key);
    this.data.delete(key);
  }
  async incr(key: string, ttl: number) {
    assertKey(key);
    const entry = this.live(key);
    const next = (typeof entry?.value === 'number' ? entry.value : 0) + 1;
    this.data.set(key, { value: next, expiresAt: entry?.expiresAt ?? this.now() + ttl * 1000 });
    return next;
  }
}

/** 本地文件实现：每个键一个 JSON 文件，写入走「临时文件 + 改名」保证原子性。 */
export class FileKV implements KV {
  constructor(private root: string, private now: () => number = Date.now) {}
  private path(key: string) {
    assertKey(key);
    return join(this.root, key.replace(/:/g, '__') + '.json');
  }
  private async read(key: string): Promise<Entry | null> {
    try {
      const entry = JSON.parse(await readFile(this.path(key), 'utf8')) as Entry;
      if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
        await unlink(this.path(key)).catch(() => {});
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }
  async get<T>(key: string) {
    return ((await this.read(key))?.value as T) ?? null;
  }
  async set(key: string, value: unknown, ttl?: number) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify({ value, expiresAt: ttl ? this.now() + ttl * 1000 : null } satisfies Entry));
    await rename(temp, path);
  }
  async setIfAbsent(key: string, value: unknown, ttl?: number) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    if (await this.read(key)) return false;
    try {
      const handle = await open(path, 'wx');
      await handle.writeFile(JSON.stringify({ value, expiresAt: ttl ? this.now() + ttl * 1000 : null } satisfies Entry));
      await handle.close();
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
  }
  async del(key: string) {
    await unlink(this.path(key)).catch(() => {});
  }
  async incr(key: string, ttl: number) {
    const entry = await this.read(key);
    const next = (typeof entry?.value === 'number' ? entry.value : 0) + 1;
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ value: next, expiresAt: entry?.expiresAt ?? this.now() + ttl * 1000 } satisfies Entry));
    return next;
  }
}

/** Upstash Redis 的 REST 实现（Vercel 市场一键开通）。 */
export class RedisKV implements KV {
  constructor(private redis: import('@upstash/redis').Redis, private prefix = 'sf:') {}
  private k(key: string) {
    assertKey(key);
    return this.prefix + key;
  }
  async get<T>(key: string) {
    return ((await this.redis.get<T>(this.k(key))) ?? null) as T | null;
  }
  async set(key: string, value: unknown, ttl?: number) {
    if (ttl) await this.redis.set(this.k(key), value, { ex: ttl });
    else await this.redis.set(this.k(key), value);
  }
  async setIfAbsent(key: string, value: unknown, ttl?: number) {
    const result = ttl
      ? await this.redis.set(this.k(key), value, { nx: true, ex: ttl })
      : await this.redis.set(this.k(key), value, { nx: true });
    return result === 'OK';
  }
  async del(key: string) {
    await this.redis.del(this.k(key));
  }
  async incr(key: string, ttl: number) {
    const value = await this.redis.incr(this.k(key));
    if (value === 1) await this.redis.expire(this.k(key), ttl);
    return value;
  }
}

let shared: KV | null = null;

export async function getKV(env: Env = process.env): Promise<KV> {
  if (shared) return shared;
  if (env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    const { Redis } = await import('@upstash/redis');
    shared = new RedisKV(new Redis({ url: env.UPSTASH_REDIS_REST_URL.trim(), token: env.UPSTASH_REDIS_REST_TOKEN.trim() }));
  } else {
    // Vercel 上没有持久磁盘时退到 /tmp：同一实例内可用，重启即丢。
    const root = process.env.VERCEL ? '/tmp/shellforge-kv' : join(process.cwd(), '.runtime', 'kv');
    shared = new FileKV(root);
  }
  return shared;
}

export function setKVForTests(kv: KV | null) {
  shared = kv;
}
