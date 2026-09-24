import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTask, trustedAssetUrl, validateTaskId } from '../src/server/model-tasks';
test('重复提交同一模型任务只调用一次收费接口；超时结果不明也不能重发',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'shellforge-test-'));
 let calls=0;const submit=async()=>{calls++;throw new Error('timeout');};
 const input={id:randomUUID(),partId:'h01',prompt:'brass bird head'};
 const first=await createTask(input,{directory,submit,configured:true});
 assert.equal(first.status,'unknown');
 const second=await createTask(input,{directory,submit,configured:true});
 assert.equal(second.status,'unknown');assert.equal(calls,1);
 await assert.rejects(()=>createTask({...input,prompt:'changed'},{directory,submit,configured:true}));
});
test('明确确认状态不明后才能用新编号重新提交',async()=>{const directory=await mkdtemp(join(tmpdir(),'shellforge-retry-'));let calls=0;const input={id:randomUUID(),partId:'h01',prompt:'possibly submitted'};const uncertain=await createTask(input,{directory,configured:true,submit:async()=>{calls++;throw Error('timeout')}});assert.equal(uncertain.status,'unknown');const retry=await createTask({...input,id:randomUUID()},{directory,configured:true,retry:true,submit:async()=>{calls++;return 'new-provider-task'}});assert.notEqual(retry.id,uncertain.id);assert.equal(retry.status,'queued');assert.equal(calls,2)});
test('规范化提示词与同一生成参数复用缓存模型并避免重复付费',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'shellforge-cache-'));const previous=process.env.TRIPO_MODEL;process.env.TRIPO_MODEL='model-cache-test';let calls=0;const submit=async()=>{calls++;return 'provider-task'};
 try{const a=await createTask({id:randomUUID(),partId:'h01',prompt:' Brass   Bird Head '},{directory,submit,configured:true});const b=await createTask({id:randomUUID(),partId:'h02',prompt:'brass bird head'},{directory,submit,configured:true});assert.equal(a.id,b.id);assert.equal(calls,1);process.env.TRIPO_MODEL='other-model';const c=await createTask({id:randomUUID(),partId:'h01',prompt:'brass bird head'},{directory,submit,configured:true});assert.notEqual(c.id,a.id);assert.equal(calls,2)}finally{if(previous===undefined)delete process.env.TRIPO_MODEL;else process.env.TRIPO_MODEL=previous}
});
test('服务端提交 Tripo 前按部件槽位包裹提示词并附带反向提示词',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'shellforge-part-prompt-'));let submitted='';let negative='';
 const task=await createTask({id:randomUUID(),partId:'h01',prompt:'iron-beaked egret appearance'},{directory,configured:true,submit:async(prompt,_env,_http,negativePrompt)=>{submitted=prompt;negative=negativePrompt||'';return 'provider-task';}});
 assert.equal(task.status,'queued');assert.match(submitted,/a single detached creature head only/);assert.match(submitted,/no body, no torso, no legs/);assert.equal(negative,'full body, torso, legs');
});
test('模型下载拒绝内网、非 HTTPS 和目录穿越',()=>{
 for(const url of ['http://cdn.tripo3d.ai/a.glb','https://127.0.0.1/a','https://tripo3d.ai.evil.test/a']) assert.throws(()=>trustedAssetUrl(url));
 assert.equal(trustedAssetUrl('https://cdn.tripo3d.ai/a.glb').hostname,'cdn.tripo3d.ai');
 assert.equal(trustedAssetUrl('https://tripo-data.rg1.data.tripo3d.com/a.glb').hostname,'tripo-data.rg1.data.tripo3d.com');
 assert.throws(()=>trustedAssetUrl('https://tripo3d.com.evil.test/a.glb'));
 assert.throws(()=>validateTaskId('../../config'));
});
