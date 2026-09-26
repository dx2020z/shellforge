import { createHash } from 'node:crypto';
import { SLOTS, type Slot } from '@/domain/keywords';
import { getIntegrationStatus, type Env } from './config';
import { buildTripoPartPrompt, negativePromptForSlot, queryTripo, submitTripo, tripoGenerationOptions } from './providers/tripo';
import { assertModelId, getModelStore, type ModelStore } from './store/models';
import { getKV, type KV } from './store/kv';

/**
 * Tripo 生成任务。核心原则（付费接口）：
 * 1. 同一任务编号只提交一次；
 * 2. 提交结果不明时绝不自动重试，只有调用方明确要求 retry 才新建；
 * 3. 规范化后的相同提示词复用已有任务和模型，避免重复付费。
 */
export type TaskStatus = 'submitting' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown';
export interface ModelTask {
  id: string;
  slot: Slot;
  prompt: string;
  taskId?: string;
  status: TaskStatus;
  progress: number;
  modelUrl: string | null;
  /** 给玩家看的世界观文案。 */
  message?: string;
  startedAt: number;
  updatedAt: number;
  nextPollAt: number;
}

export const POLL_INTERVAL_MS = 5000;
const SUBMIT_STALE_MS = 45000;
const TASK_TTL = 60 * 60 * 24 * 30;
const MAX_GLB = 40 * 1024 * 1024;

export function validateTaskId(id: string): string {
  return assertModelId(id);
}
export function validateSlot(slot: unknown): Slot {
  if (!SLOTS.includes(slot as Slot)) throw new Error('无效槽位');
  return slot as Slot;
}

interface Deps {
  kv?: KV;
  store?: ModelStore;
  env?: Env;
  submit?: typeof submitTripo;
  query?: typeof queryTripo;
  download?: (url: string, env: Env) => Promise<Buffer>;
  now?: () => number;
}

const taskKey = (id: string) => `task:${validateTaskId(id)}`;

async function load(kv: KV, id: string, now: number): Promise<ModelTask | null> {
  const task = await kv.get<ModelTask>(taskKey(id));
  if (task && task.status === 'submitting' && now - task.updatedAt > SUBMIT_STALE_MS) {
    task.status = 'unknown';
    task.message = '孵化中途被海流打断了，结果不明。请稍后再看一眼，不要急着重来。';
  }
  return task;
}

export async function readTask(id: string, deps: Deps = {}): Promise<ModelTask | null> {
  return load(deps.kv ?? (await getKV()), id, (deps.now ?? Date.now)());
}

export function promptCacheKey(slot: Slot, features: string, env: Env = process.env): string {
  const prompt = buildTripoPartPrompt(slot, features);
  const normalized = prompt.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return createHash('sha256').update(JSON.stringify({ prompt: normalized, options: tripoGenerationOptions(env, negativePromptForSlot(slot)) })).digest('hex');
}

export async function createTask(input: { id: string; slot: Slot; prompt: string }, options: Deps & { retry?: boolean } = {}): Promise<ModelTask> {
  validateTaskId(input.id);
  const slot = validateSlot(input.slot);
  const features = input.prompt.trim();
  if (!features || features.length > 600) throw new Error('外观描述超出范围');
  const env = options.env ?? process.env;
  const kv = options.kv ?? (await getKV(env));
  const now = options.now ?? Date.now;
  const cacheKey = `prompt:${promptCacheKey(slot, features, env)}`;
  const lockKey = `lock:${cacheKey.slice(7, 40)}`;

  // 同一提示词的并发请求排队，拿不到锁就让调用方稍后查询。
  let locked = false;
  for (let attempt = 0; attempt < 40 && !locked; attempt++) {
    locked = await kv.setIfAbsent(lockKey, input.id, 30);
    if (!locked) await new Promise(r => setTimeout(r, 100));
  }
  if (!locked) throw new Error('相同的造物正在孵化，请稍后查询原任务');

  let task: ModelTask;
  try {
    const cachedId = await kv.get<string>(cacheKey);
    const cached = cachedId ? await load(kv, cachedId, now()) : null;
    if (cached) {
      const reusable = ['succeeded', 'queued', 'processing', 'submitting'].includes(cached.status);
      if (reusable || !options.retry) return cached;
    }
    const existing = await load(kv, input.id, now());
    if (existing) {
      if (existing.prompt !== features || existing.slot !== slot) throw new Error('此任务编号已用于另一项生成');
      return existing;
    }
    task = { id: input.id, slot, prompt: features, status: 'submitting', progress: 0, modelUrl: null, startedAt: now(), updatedAt: now(), nextPollAt: now() + POLL_INTERVAL_MS };
    if (!(await kv.setIfAbsent(taskKey(input.id), task, TASK_TTL))) {
      const raced = await load(kv, input.id, now());
      if (raced) return raced;
    }
    await kv.set(cacheKey, input.id, TASK_TTL);
  } finally {
    await kv.del(lockKey);
  }

  const configured = getIntegrationStatus(env).tripoConfigured;
  if (!configured) {
    task.status = 'failed';
    task.message = '今天的孵化池没有开放，先用港口里的外壳出发吧。';
  } else {
    try {
      task.taskId = await (options.submit ?? submitTripo)(buildTripoPartPrompt(slot, features), env, undefined, negativePromptForSlot(slot));
      task.status = 'queued';
      task.message = '贝壳已经放进孵化池。';
    } catch {
      task.status = 'unknown';
      task.message = '孵化池没有回音，结果不明。稍后再看一眼，不要急着重来。';
    }
  }
  task.updatedAt = now();
  await kv.set(taskKey(input.id), task, TASK_TTL);
  return task;
}

export function trustedAssetUrl(value: string, env: Env = process.env): URL {
  const url = new URL(value);
  const extra = (env.TRIPO_ASSET_HOSTS || '').split(',').map(x => x.trim()).filter(Boolean);
  const host = url.hostname;
  const tripo = host === 'tripo3d.ai' || host.endsWith('.tripo3d.ai') || host === 'tripo3d.com' || host.endsWith('.tripo3d.com');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(tripo || extra.includes(host))) {
    throw new Error('模型下载域名尚未授权');
  }
  return url;
}

export function assertGlb(data: Buffer): Buffer {
  if (data.length < 20 || data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) {
    throw new Error('返回的文件不是有效 GLB 2.0');
  }
  return data;
}

async function downloadModel(url: string, env: Env): Promise<Buffer> {
  const response = await fetch(trustedAssetUrl(url, env), { signal: AbortSignal.timeout(60000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error('模型下载失败');
  if (Number(response.headers.get('content-length')) > MAX_GLB) throw new Error('模型超过 40 MB');
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_GLB) throw new Error('模型超过 40 MB');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return assertGlb(Buffer.concat(chunks));
}

export async function pollTask(id: string, deps: Deps = {}): Promise<ModelTask | null> {
  const env = deps.env ?? process.env;
  const kv = deps.kv ?? (await getKV(env));
  const now = deps.now ?? Date.now;
  const task = await load(kv, id, now());
  if (!task || !task.taskId || ['succeeded', 'failed', 'unknown'].includes(task.status) || now() < task.nextPollAt) return task;

  // 先写下一次查询窗口，再联系供应商，避免多端同时轮询时重复查询。
  task.nextPollAt = now() + POLL_INTERVAL_MS;
  await kv.set(taskKey(id), task, TASK_TTL);
  try {
    const result = await (deps.query ?? queryTripo)(task.taskId, env);
    if (result.taskId !== task.taskId) throw new Error('任务编号不匹配');
    if (result.status === 'succeeded') {
      const data = await (deps.download ?? downloadModel)(result.modelUrl!, env);
      task.modelUrl = await (deps.store ?? getModelStore(env)).put(id, assertGlb(data));
      task.status = 'succeeded';
      task.progress = 100;
      task.message = '贝壳裂开了。';
    } else {
      task.status = result.status;
      task.progress = result.progress;
      task.message = result.status === 'failed' ? '这枚贝壳没能孵化。可以换一句描述再试。' : '贝壳在孵化池里轻轻晃动。';
    }
  } catch (error) {
    const fatal = error instanceof Error && /40 MB|GLB|域名/.test(error.message);
    if (fatal) {
      task.status = 'failed';
      task.message = '孵出来的东西不太对劲，已经放回海里了。';
    } else {
      task.message = '海流有点乱，稍后会再看一眼。不会重复孵化。';
    }
  }
  task.updatedAt = now();
  await kv.set(taskKey(id), task, TASK_TTL);
  return task;
}
