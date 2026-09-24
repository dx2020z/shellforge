import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCreatureDrafts, parseCreatureDrafts, validateCreatureInputs } from '../src/server/providers/creature';
import {COSTS} from '../src/domain/keywords';

const inputs=validateCreatureInputs({
  head:{partId:'h01',prompt:'火焰机械鸟头'},
  body:{partId:'b02',prompt:'珊瑚装甲身体'},
  legs:{partId:'l01',prompt:'一双疾行足'}
});
const reply={name:'焰蟹',lore:'火中醒来',parts:{head:{title:'焰鸟头',description:'机械火焰鸟头',visualPrompt:'A brass fire bird head, head only',keywords:['灼烧'],cost:null,reasons:[{keyword:'灼烧',quote:'火焰',why:'滚烫'}]},body:{title:'珊瑚身',description:'珊瑚装甲身',visualPrompt:'A coral armored torso with arms only',keywords:['坚壳'],cost:null,reasons:[{keyword:'坚壳',quote:'珊瑚装甲身体',why:'坚硬'}]},legs:{title:'疾行足',description:'一对齿轮足',visualPrompt:'A pair of gear legs only',keywords:['迅捷'],cost:null,reasons:[{keyword:'迅捷',quote:'疾行足',why:'快速'}]}}};

test('一次造物输入严格绑定三个槽位和长度',()=>{
  assert.deepEqual(Object.keys(inputs),['head','body','legs']);
  assert.throws(()=>validateCreatureInputs({...inputs,head:{partId:'b02',prompt:'错位'}}));
  assert.throws(()=>validateCreatureInputs({...inputs,legs:{partId:'l01',prompt:' '}}));
  assert.throws(()=>validateCreatureInputs({...inputs,body:{partId:'b02',prompt:'x'.repeat(121)}}));
});

test('DeepSeek 一次返回三件，不能注入部件编号、属性或代码',async()=>{
  let calls=0;
  const http:typeof fetch=async (_url,init)=>{
    calls++;
    const sent=JSON.parse(String(init?.body));
    assert.equal(sent.model,'test-model');
    assert.equal(sent.thinking.type,'disabled');
    assert.equal(sent.messages[1].content.includes('珊瑚装甲身体'),true);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({...reply,parts:{...reply.parts,head:{...reply.parts.head,partId:'h03',stats:{atk:9999},abilityId:'pierce'}}})}}]}),{status:200});
  };
  const result=await generateCreatureDrafts(inputs,{DEEPSEEK_API_KEY:'test-secret',DEEPSEEK_MODEL:'test-model'},http);
  assert.equal(calls,1);
  assert.equal(result.drafts.head.partId,'h01');
  assert.equal(result.drafts.head.stats.atk,11);
  assert.equal(result.drafts.head.abilityId,'flame');
  assert.deepEqual(result.drafts.head.keywords,['灼烧']);
  assert.equal(result.drafts.name,'焰蟹');
  assert.equal(result.drafts.legs.source,'deepseek');
  assert.throws(()=>parseCreatureDrafts({...reply,parts:{...reply.parts,legs:{title:'x'}}},inputs));
});

test('将模型同义关键词映射到合法技能，但保留它生成的名称、描述、理由和原文',()=>{
  const inputs=validateCreatureInputs({head:{partId:'h01',prompt:'鸭子的头'},body:{partId:'b02',prompt:'恐龙的身体'},legs:{partId:'l01',prompt:'猴子的尾巴'}});
  const semantic={name:'鸭龙猴尾兽',lore:'鸭嘴、恐龙躯干和猴尾组合而成。',parts:{
    head:{title:'鸭嘴泡沫头',description:'扁平鸭嘴会吹出肥皂泡。',visualPrompt:'duck head',keywords:['鸭嘴','泡沫'],cost:null,reasons:[{keyword:'鸭嘴',quote:'鸭子的头',why:'宽扁鸭嘴能刺穿薄弱处'},{keyword:'泡沫',quote:'鸭子的头',why:'泡沫会吞没小型猎物'}]},
    body:{title:'恐龙岩骨身',description:'厚重的恐龙岩骨躯干。',visualPrompt:'dinosaur body',keywords:['恐龙骨架'],cost:null,reasons:[{keyword:'恐龙骨架',quote:'恐龙的身体',why:'厚实骨骼形成坚固防护'}]},
    legs:{title:'猴尾回旋足',description:'猴尾灵活摆动并辅助转向。',visualPrompt:'monkey tail',keywords:['猴尾','尾巴'],cost:null,reasons:[{keyword:'猴尾',quote:'猴子的尾巴',why:'猴的灵活性带来快速机动'},{keyword:'尾巴',quote:'猴子的尾巴',why:'尾巴摆动能改变方向'}]},
  }};
  const result=parseCreatureDrafts(semantic,inputs);
  assert.equal(result.name,'鸭龙猴尾兽');assert.equal(result.head.name,'鸭嘴泡沫头');assert.equal(result.head.description,'扁平鸭嘴会吹出肥皂泡。');
  assert.deepEqual(result.head.keywords,['穿刺','吞噬']);assert.deepEqual(result.body.keywords,['坚壳']);assert.deepEqual(result.legs.keywords,['迅捷','回旋']);
  assert.equal(result.legs.reasons[1].why,'尾巴摆动能改变方向');assert.equal(result.legs.source,'deepseek');
});

test('无效的原文引用或跨槽技能拒绝整份回复',()=>{assert.throws(()=>parseCreatureDrafts({...reply,parts:{...reply.parts,head:{...reply.parts.head,reasons:[{keyword:'灼烧',quote:'不存在',why:'x'}]}}},inputs));assert.throws(()=>parseCreatureDrafts({...reply,parts:{...reply.parts,legs:{...reply.parts.legs,keywords:['坚壳']}}},inputs));});

test('单句模式校验并拆成三件',()=>{const value=validateCreatureInputs({description:'熔岩蟹',partIds:['h01','b02','l01']});assert.equal(value.head.prompt,'熔岩蟹');assert.equal(value.description,'熔岩蟹');});
test('所有代价词均可校验；夸张描述必须有原文支持的代价理由',()=>{
 for(const cost of COSTS){const priced={...reply,parts:{...reply.parts,head:{...reply.parts.head,cost,reasons:[...reply.parts.head.reasons,{keyword:cost,quote:'火焰',why:'这副力量也会付出代价'}]}}};assert.equal(parseCreatureDrafts(priced,inputs).head.cost,cost);}
 const bold=validateCreatureInputs({description:'无敌的神明',partIds:['h01','b01','l01']});
 const boldReply={...reply,parts:Object.fromEntries(Object.entries(reply.parts).map(([slot,part])=>[slot,{...part,reasons:part.reasons.map(reason=>({...reason,quote:'神明'}))}]))};
 assert.throws(()=>parseCreatureDrafts(boldReply,bold),/夸张描述必须附带代价/);
 const priced={...boldReply,parts:{...boldReply.parts,head:{...boldReply.parts.head,cost:'骄傲',reasons:[...boldReply.parts.head.reasons,{keyword:'骄傲',quote:'无敌',why:'神明嫌同一招不够有排面，偏不连用'}]}}};
 assert.equal(parseCreatureDrafts(priced,bold).head.cost,'骄傲');
 assert.throws(()=>parseCreatureDrafts({...boldReply,parts:{...boldReply.parts,head:{...boldReply.parts.head,cost:'骄傲'}}},bold),/代价「骄傲」缺少可核验理由/);
});

test('上游不可用时三件均有明确本地草案',async()=>{
  let calls=0;
  const http:typeof fetch=async()=>{calls++;throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET',message:'private error'}});};
  const result=await generateCreatureDrafts(inputs,{DEEPSEEK_API_KEY:'test-secret',DEEPSEEK_MODEL:'test-model'},http);
  assert.equal(calls,2);
  assert.equal(result.drafts.body.partId,'b02');
  assert.equal(result.drafts.head.source,'local');
  assert.ok(result.warning && !result.warning.includes('private error'));
  assert.match(result.warning!,/网络连接失败/);
  assert.match(result.drafts.head.fallbackReason!,/网络连接失败/);
});
