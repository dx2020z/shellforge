import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssetEntry, readAppearances } from '../src/assets/schema';
import { generateDraft, parseDeepSeekDraft } from '../src/server/providers/deepseek';
import { parseTripoTask } from '../src/server/providers/tripo';

test('美术只接受本地模型和有限的缩放、位移',()=>{
 const base={modelPath:'/assets/parts/h01/model.glb',scale:1,rotation:[0,90,0],offset:[0,0,0]};
 assert.equal(parseAssetEntry(base).scale,1);
 for(const modelPath of ['https://evil.test/a.glb','/assets/parts/../../a.glb','javascript:alert(1)']) assert.throws(()=>parseAssetEntry({...base,modelPath}));
 assert.throws(()=>parseAssetEntry({...base,scale:NaN}));
 assert.deepEqual(readAppearances('{"h01":{"name":"a","description":"b","modelPath":"https://evil.test/a.glb"}}'),{});
});
test('DeepSeek 只能改外观描述，不能注入属性或未知部件',()=>{
 const result=parseDeepSeekDraft({name:'铜焰鸟首',description:'铜制火焰喙',visualPrompt:'A brass bird head',stats:{hp:9999},partId:'h99'},'h01','铜鸟');
 assert.equal(result.partId,'h01');assert.equal(result.stats.hp,12);assert.equal(result.source,'deepseek');
 assert.throws(()=>parseDeepSeekDraft({name:'x'},'h01','x'));
});
test('没有密钥或上游失败时返回明确的本地结果',async()=>{
 let calls=0;const http:typeof fetch=async()=>{calls++;throw new Error('Do not leak secret');};
 const local=await generateDraft('h01','铜鸟',{},http);
 assert.equal(calls,0);assert.equal(local.draft.source,'local');assert.ok(local.warning);
 const fallback=await generateDraft('h01','铜鸟',{DEEPSEEK_API_KEY:'secret',DEEPSEEK_MODEL:'test-model'},http);
 assert.equal(calls,1);assert.equal(fallback.draft.source,'local');assert.ok(!fallback.warning?.includes('secret'));
});
test('Tripo 只接受数字成功码，并区分排队、失败与完成',()=>{
 assert.throws(()=>parseTripoTask({code:'0',data:{task_id:'task_1',status:'success'}}));
 assert.equal(parseTripoTask({code:0,data:{task_id:'task_1',status:'queued',progress:0}}).status,'queued');
 assert.equal(parseTripoTask({code:0,data:{task_id:'task_1',status:'failed'}}).status,'failed');
 assert.throws(()=>parseTripoTask({code:0,data:{task_id:'task_1',status:'success',output:{}}}));
 assert.equal(parseTripoTask({code:0,data:{task_id:'task_1',status:'success',output:{model_url:'https://cdn.tripo3d.ai/a.glb'}}}).status,'succeeded');
});
