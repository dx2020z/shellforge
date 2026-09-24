import { providerUrl, type Env } from '../config';
import type { Slot } from '../../domain/types';

const partPromptTemplates:Record<Slot,string>={
  head:'a single detached creature head only, {features}, bust shape cut off at the neck, no body, no torso, no legs, no wings, flat cut at the bottom',
  body:'a headless creature torso only, {features}, no head, no neck, no legs, no feet, flat cut on top and bottom, like a character body part for assembly',
  legs:'only the lower limbs of a creature, {features}, a pair of legs attached to a small hip block, no torso, no head, no wings, flat cut on top'
};
const negativePrompts:Record<Slot,string>={head:'full body, torso, legs',body:'head, face, eyes, beak, legs',legs:'head, torso, full body, animal'};
const styleSuffix='stylized, cartoon, hand-painted texture, soft colors, single object, centered, front view, no base';

export function buildTripoPartPrompt(slot:Slot,visualFeatures:string):string {
  const template=partPromptTemplates[slot];
  const fixedLength=template.replace('{features}','').length+2+styleSuffix.length;
  const maxFeatures=Math.max(0,1024-fixedLength);
  const features=visualFeatures.trim().replace(/[;\n]+/g,', ').slice(0,maxFeatures);
  return template.replace('{features}',features)+', '+styleSuffix;
}
export function negativePromptForSlot(slot:Slot):string { return negativePrompts[slot]; }
export function parseTripoTask(raw: unknown) {
  const r=raw as {code?:unknown;data?:{task_id?:unknown;status?:unknown;progress?:unknown;output?:{model_url?:unknown}}};
  if (!r || r.code !== 0 || !r.data || typeof r.data.task_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(r.data.task_id)) throw new Error('Tripo 响应格式或状态码不正确');
  const d=r.data;
  const states = {queued:'queued',running:'processing',success:'succeeded',failed:'failed',cancelled:'failed'} as const;
  if (typeof d.status !== 'string' || !(d.status in states)) throw new Error('未知 Tripo 任务状态');
  const status=states[d.status as keyof typeof states];
  if (status === 'succeeded' && typeof d.output?.model_url !== 'string') throw new Error('Tripo 未返回模型地址');
  return {taskId:d.task_id as string,status,progress:typeof d.progress === 'number' && Number.isFinite(d.progress) ? Math.min(100,Math.max(0,d.progress)):0,modelUrl:typeof d.output?.model_url === 'string'?d.output.model_url:null};
}
export function tripoGenerationOptions(env:Env=process.env,negativePrompt?:string){return {model:env.TRIPO_MODEL,face_limit:15000,texture:true,pbr:true,...(negativePrompt?{negative_prompt:negativePrompt}:{})};}
export async function submitTripo(prompt: string, env: Env=process.env, http: typeof fetch=fetch, negativePrompt?:string): Promise<string> {
  if(!env.TRIPO_API_KEY || !env.TRIPO_MODEL) throw new Error('未配置 Tripo');
  const response=await http(providerUrl(env.TRIPO_BASE_URL,'https://openapi.tripo3d.ai/v3')+'/generation/text-to-model',{
    method:'POST',headers:{Authorization:'Bearer '+env.TRIPO_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
    body:JSON.stringify({prompt,...tripoGenerationOptions(env,negativePrompt)})
  });
  if(!response.ok) throw new Error('Tripo HTTP '+response.status);
  const json=await response.json();
  if(json.code!==0 || typeof json.data?.task_id!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(json.data.task_id)) throw new Error('Tripo 创建任务失败');
  return json.data.task_id;
}
export async function queryTripo(taskId: string, env: Env=process.env, http: typeof fetch=fetch) {
  const response=await http(providerUrl(env.TRIPO_BASE_URL,'https://openapi.tripo3d.ai/v3')+'/tasks/'+encodeURIComponent(taskId),{
    headers:{Authorization:'Bearer '+env.TRIPO_API_KEY},signal:AbortSignal.timeout(15000),cache:'no-store'
  });
  if(!response.ok) throw new Error('Tripo 查询失败');
  return parseTripoTask(await response.json());
}
