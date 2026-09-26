import { providerUrl, type Env } from '../config';
import type { Slot } from '@/domain/keywords';

/**
 * Tripo 提示词必须按部位使用模板，只生成该部位，避免「三只动物叠在一起」。
 * 统一追加卡通、手绘贴图风格词，让预置件和生成件是同一种画风。
 */
const PART_TEMPLATES: Record<Slot, string> = {
  head: 'a single cute creature head only, {features}, the animal face is the main subject: large expressive eyes looking forward, face fully visible and not covered, any hat or plant stays small on top, bust cut off at the neck with a flat bottom, no body, no torso, no legs, no wings',
  body: 'a headless chubby creature torso only, {features}, compact and rounded like a bean, a little wider than it is tall, small shoulders and hips, no head, no neck, no arms, no legs, no feet, flat cut on top and bottom, like a toy body part for assembly',
  legs: 'only the lower limbs of a creature, {features}, a pair of short sturdy legs standing on the ground attached to a small rounded hip block, no torso, no head, no wings, flat cut on top',
};
const NEGATIVE: Record<Slot, string> = {
  head: 'full body, torso, legs, arms, base, pedestal, text, covered face, faceless, tiny face',
  body: 'head, face, eyes, beak, legs, feet, base, pedestal, text, vase, bottle, tall cylinder',
  legs: 'head, torso, full body, animal, base, pedestal, text',
};
export const STYLE_SUFFIX =
  'stylized cartoon sea creature part, hand-painted texture, soft rounded shapes, warm and mint color palette, matte finish, single object, centered, front view, no base, no text';

const MAX_PROMPT = 1024;

export function buildTripoPartPrompt(slot: Slot, features: string): string {
  const template = PART_TEMPLATES[slot];
  const fixed = template.replace('{features}', '').length + 2 + STYLE_SUFFIX.length;
  const clean = features.trim().replace(/[;\n]+/g, ', ').replace(/\s+/g, ' ').slice(0, Math.max(0, MAX_PROMPT - fixed));
  return template.replace('{features}', clean) + ', ' + STYLE_SUFFIX;
}
export function negativePromptForSlot(slot: Slot): string {
  return NEGATIVE[slot];
}

export function tripoGenerationOptions(env: Env = process.env, negativePrompt?: string) {
  return {
    model: env.TRIPO_MODEL?.trim(),
    face_limit: 12000,
    texture: true,
    pbr: false,
    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
  };
}

export type TripoStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

export function parseTripoTask(raw: unknown) {
  const r = raw as { code?: unknown; data?: { task_id?: unknown; status?: unknown; progress?: unknown; output?: { model_url?: unknown; model?: unknown } } };
  if (!r || r.code !== 0 || !r.data || typeof r.data.task_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(r.data.task_id)) {
    throw new Error('Tripo 响应格式或状态码不正确');
  }
  const d = r.data;
  const states: Record<string, TripoStatus> = { queued: 'queued', running: 'processing', success: 'succeeded', failed: 'failed', cancelled: 'failed', banned: 'failed', expired: 'failed' };
  if (typeof d.status !== 'string' || !(d.status in states)) throw new Error('未知 Tripo 任务状态');
  const status = states[d.status];
  const modelUrl = typeof d.output?.model_url === 'string' ? d.output.model_url : typeof d.output?.model === 'string' ? d.output.model : null;
  if (status === 'succeeded' && !modelUrl) throw new Error('Tripo 未返回模型地址');
  const progress = typeof d.progress === 'number' && Number.isFinite(d.progress) ? Math.min(100, Math.max(0, d.progress)) : 0;
  return { taskId: d.task_id, status, progress, modelUrl };
}

export async function submitTripo(prompt: string, env: Env = process.env, http: typeof fetch = fetch, negativePrompt?: string): Promise<string> {
  if (!env.TRIPO_API_KEY?.trim() || !env.TRIPO_MODEL?.trim()) throw new Error('未配置 Tripo');
  const response = await http(providerUrl(env.TRIPO_BASE_URL, 'https://openapi.tripo3d.ai/v3') + '/generation/text-to-model', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.TRIPO_API_KEY.trim(), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ prompt, ...tripoGenerationOptions(env, negativePrompt) }),
  });
  if (!response.ok) throw new Error('Tripo HTTP ' + response.status);
  const json = await response.json();
  if (json.code !== 0 || typeof json.data?.task_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(json.data.task_id)) {
    throw new Error('Tripo 创建任务失败');
  }
  return json.data.task_id;
}

export async function queryTripo(taskId: string, env: Env = process.env, http: typeof fetch = fetch) {
  const response = await http(providerUrl(env.TRIPO_BASE_URL, 'https://openapi.tripo3d.ai/v3') + '/tasks/' + encodeURIComponent(taskId), {
    headers: { Authorization: 'Bearer ' + (env.TRIPO_API_KEY?.trim() ?? '') },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Tripo 查询失败');
  return parseTripoTask(await response.json());
}
