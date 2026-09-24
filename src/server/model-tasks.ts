import { mkdir, open, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { findPart } from '../domain/catalog';
import { getIntegrationStatus } from './config';
import { buildTripoPartPrompt, negativePromptForSlot, submitTripo, queryTripo, tripoGenerationOptions } from './providers/tripo';
import type { ModelTask } from './providers/types';

const root = join(process.cwd(), '.runtime', 'models');
const pollIntervalMs=5000;
export function validateTaskId(id: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error('无效任务编号');
  return id;
}
async function atomicJson(path: string, value: unknown) {
  const temp=path+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(value));
  await rename(temp,path);
}
export async function readTask(id: string, directory=root): Promise<ModelTask> {
  const task: ModelTask=JSON.parse(await readFile(join(directory,validateTaskId(id)+'.json'),'utf8'));
  if(task.status==='submitting' && Date.now()-task.updatedAt>45000){task.status='unknown';task.message='提交过程曾中断，结果不明。请先核查 Tripo 控制台，再决定是否新建。';}
  return task;
}
export async function createTask(input: {id:string;partId:string;prompt:string}, options: {directory?:string;submit?:typeof submitTripo;configured?:boolean;retry?:boolean}={}) {
  validateTaskId(input.id);const part=findPart(input.partId);const generationPrompt=buildTripoPartPrompt(part.slot,input.prompt);const negativePrompt=negativePromptForSlot(part.slot);
  if(!input.prompt.trim() || input.prompt.length>1024) throw new Error('模型描述超出范围');
  const directory=options.directory || root;await mkdir(directory,{recursive:true});
  const normalized=generationPrompt.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
  const cacheKey=createHash('sha256').update(JSON.stringify({prompt:normalized,options:tripoGenerationOptions(undefined,negativePrompt)})).digest('hex');
  const cachePath=join(directory,'cache-'+cacheKey+'.json'),lockPath=cachePath+'.lock';let lock;
  for(let attempt=0;attempt<100;attempt++){
    try{lock=await open(lockPath,'wx');break;}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await new Promise(r=>setTimeout(r,100));}
  }
  if(!lock)throw new Error('相同造物正在准备，请稍后查询原任务。');
  let cached:ModelTask|undefined;let task:ModelTask;const path=join(directory,input.id+'.json');
  try{
    try{const entry=JSON.parse(await readFile(cachePath,'utf8')) as {id?:string};if(entry.id)cached=await readTask(entry.id,directory)}catch{/* No reusable cache entry. */}
    if(cached&&(['succeeded','queued','processing','submitting'].includes(cached.status)||(!options.retry&&['unknown','failed'].includes(cached.status))))return cached;
    if(cached&&!options.retry&&cached.status==='failed')return cached;
    task={...input,startedAt:Date.now(),status:'submitting',progress:0,modelPath:null,updatedAt:Date.now(),nextPollAt:Date.now()+pollIntervalMs};
    try{const handle=await open(path,'wx');await handle.writeFile(JSON.stringify(task));await handle.close();}
    catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const previous=await readTask(input.id,directory);if(previous.prompt!==input.prompt||previous.partId!==input.partId)throw new Error('此任务编号已用于另一项生成');return previous;}
    await atomicJson(cachePath,{id:input.id,cacheKey});
  }finally{await lock.close();await unlink(lockPath).catch(()=>{});}
  if(!(options.configured ?? getIntegrationStatus().tripoConfigured)){task!.status='failed';task!.message='尚未配置 Tripo；本地角色可照常使用。';}
  else try{task!.taskId=await(options.submit||submitTripo)(generationPrompt,undefined,undefined,negativePrompt);task!.status='queued';task!.message='已提交，正在等待 Tripo 生成。';}
  catch{task!.status='unknown';task!.message='提交结果不明。不要直接重试付费生成，请先在 Tripo 控制台核查是否已有任务。';}
  task!.updatedAt=Date.now();await atomicJson(path,task!);return task!;
}
export function trustedAssetUrl(value: string): URL {
  const url=new URL(value);
  const extra=(process.env.TRIPO_ASSET_HOSTS || '').split(',').map(x=>x.trim()).filter(Boolean);
  if(url.protocol!=='https:' || url.username || url.password || url.port || !(url.hostname==='tripo3d.ai' || url.hostname.endsWith('.tripo3d.ai') || url.hostname==='tripo3d.com' || url.hostname.endsWith('.tripo3d.com') || extra.includes(url.hostname))) throw new Error('模型下载域名尚未授权，请查看接入文档的 TRIPO_ASSET_HOSTS 配置');
  return url;
}
async function downloadModel(url: string, id: string) {
  const response=await fetch(trustedAssetUrl(url),{signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!response.ok || !response.body) throw new Error('模型下载失败');
  const limit=40*1024*1024;
  if(Number(response.headers.get('content-length'))>limit) throw new Error('模型超过 40 MB，请降低面数');
  const chunks:Uint8Array[]=[];let length=0;
  const reader=response.body.getReader();
  try {
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw new Error('模型超过 40 MB');chunks.push(value);}
  } finally { await reader.cancel().catch(()=>{}); }
  const data=Buffer.concat(chunks);
  if(data.length<20 || data.toString('ascii',0,4)!=='glTF' || data.readUInt32LE(4)!==2 || data.readUInt32LE(8)!==data.length) throw new Error('返回的文件不是有效 GLB 2.0');
  const temp=join(root,id+'.'+randomUUID()+'.tmp');
  await writeFile(temp,data);await rename(temp,join(root,id+'.glb'));
}
export async function pollTask(id: string): Promise<ModelTask> {
  const task=await readTask(id);
  if(!task.taskId || ['succeeded','failed','unknown'].includes(task.status) || Date.now()<task.nextPollAt) return task;
  // Persist the next polling window before contacting the provider.
  task.nextPollAt=Date.now()+pollIntervalMs;
  await atomicJson(join(root,id+'.json'),task);
  try {
    const result=await queryTripo(task.taskId);
    if(result.taskId!==task.taskId) throw new Error('任务编号不匹配');
    if(result.status==='succeeded'){
      await downloadModel(result.modelUrl!,id);task.modelPath='/api/models/'+id;task.status='succeeded';task.progress=100;task.message='模型已保存到本机，可以装配。';
    }else{
      task.status=result.status;task.progress=result.progress;
      task.message=result.status==='failed'?'Tripo 生成失败，请在服务控制台核查任务。':'模型正在生成，可继续本地战斗；稍后自动查询原任务。';
    }
  }catch(error){
    task.message=error instanceof Error && /域名|40 MB|GLB/.test(error.message) ? error.message : '查询或下载暂时失败，已保留任务；不会重新提交付费生成。';
    if(error instanceof Error && /40 MB|GLB/.test(error.message))task.status='failed';
  }
  task.updatedAt=Date.now();await atomicJson(join(root,id+'.json'),task);
  return task;
}
export async function getModel(id: string): Promise<Buffer> {
  const task=await readTask(id);
  if(task.status!=='succeeded') throw new Error('模型未完成');
  return readFile(join(root,validateTaskId(id)+'.glb'));
}
