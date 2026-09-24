import test from 'node:test';import assert from 'node:assert/strict';
import {newGame,beginBattle,takeAction,settleBattle,equipPart,equipGeneratedPart,registerGeneratedParts} from '../src/domain/game';import {decodeSave,encodeSave} from '../src/domain/storage';import {makeCreature,simulateBattle} from '../src/domain/engine';import {step,createTactical,greedy,seeded,GUARDS,effects} from '../src/domain/tactical';import {mapTraits} from '../src/domain/keywords';
const fighter=()=>makeCreature(['h01','b01','l03'],null,1,'test',{h01:mapTraits('火','head'),b01:mapTraits('岩反光','body'),l03:mapTraits('跃','legs')});
test('新战斗只使用回合制结果；仅玩家行动后推进且不能提前结算',()=>{let s=beginBattle(newGame(),1,'a');assert.equal(Object.hasOwn(s.activeBattle!,'events'),false);assert.equal(Object.hasOwn(s.activeBattle!,'result'),false);assert.throws(()=>settleBattle(s,'a','h03'));const next=takeAction(s,'attack');assert.equal(next.activeBattle!.tactical!.turn,2);assert.equal(s.activeBattle!.tactical!.turn,1);assert.throws(()=>equipPart(s,'b01'));});
test('公开意图克制：横扫不能闪，破甲绕过守护',()=>{const s=createTactical(fighter(),0);assert.ok(step(s,'guard',()=>.5).state.hp[0]>step(s,'move',()=>.5).state.hp[0]);s.turn=2;assert.ok(step(s,'move',()=>.5).state.hp[0]>step(s,'guard',()=>.5).state.hp[0]);});
test('震慑打断蓄力，骄傲禁止重复，贪食跳过第四回合',()=>{const p=fighter();p.traits![0]=mapTraits('雷无敌','head');let s=createTactical(p,1);s=step(s,'attack',()=>.5).state;assert.equal(s.charged,false);assert.throws(()=>step(s,'attack',()=>.5));s.traits[0].cost='贪食';s.turn=4;const out=step(s,'attack',()=>.5);assert.ok(out.events.some(e=>e.triggered.includes('贪食：休息一回合')));});
test('固定状态和行动可复现，输入不变',()=>{const s=createTactical(fighter(),0),raw=JSON.stringify(s);assert.deepEqual(step(s,'guard',seeded(42)),step(s,'guard',seeded(42)));assert.equal(JSON.stringify(s),raw);});
test('六位守卫按回合狂暴，狂暴后同一意图的攻击伤害提高 50%',()=>{assert.deepEqual(GUARDS.map(g=>g.enrageAfter),[8,7,7,6,6,5]);for(let index=0;index<GUARDS.length;index++){const s=createTactical(fighter(),index),guard=GUARDS[index];const actionIndex=guard.pattern.findIndex(i=>['attack','sweep','break'].includes(i));assert.ok(actionIndex>=0);s.turn=actionIndex+1;const normal=effects(s).incoming;assert.ok(normal>0);s.turn+=Math.ceil((guard.enrageAfter+1-s.turn)/guard.pattern.length)*guard.pattern.length;assert.ok(s.turn>guard.enrageAfter);assert.equal(effects(s).incoming,Math.round(normal*1.5));}});
test('战术存档剔除旧字段并可续玩；旧引擎战斗按失效处理',()=>{let s=beginBattle(newGame(),2,'a');s=takeAction(s,'guard');const stale=structuredClone(s);stale.activeBattle!.events=[];stale.activeBattle!.result='draw';const repaired=decodeSave(encodeSave(stale));assert.equal(Object.hasOwn(repaired.activeBattle!,'events'),false);assert.equal(Object.hasOwn(repaired.activeBattle!,'result'),false);assert.deepEqual(decodeSave(encodeSave(s)),s);const old=newGame();delete old.version;delete old.traits;old.activeBattle=simulateBattle(makeCreature(old.equipped),makeCreature(['h03','b02','l01'],null,1,'钻角斥候'),1,'old');old.activeBattle.fighters.forEach(f=>delete f.traits);const migrated=decodeSave(encodeSave(old));assert.equal(migrated.version,2);assert.equal(migrated.activeBattle,null);assert.ok(migrated.traits!.h01.keywords.length);});
test('结算幂等，胜利仅领取一次蓝图',()=>{let s=newGame();s.equipped=['h01','b01','l01'];s.traits={h01:mapTraits('火','head'),b01:mapTraits('岩反光','body'),l01:mapTraits('跃','legs')};s=beginBattle(s,2,'win');while(!s.activeBattle!.tactical!.result)s=takeAction(s,greedy(s.activeBattle!.tactical!));assert.equal(s.activeBattle!.tactical!.result,'win');s=settleBattle(s,'win','h03');assert.ok(s.unlocked.includes('h03'));assert.deepEqual(settleBattle(s,'win','h03'),s);});
test('非法版本、锁定部件、未知关键词被拒绝',()=>{const s=newGame();s.equipped[0]='h02';assert.throws(()=>decodeSave(encodeSave(s)));const k=newGame();(k.traits!.h01.keywords as string[])[0]='无敌';assert.throws(()=>decodeSave(encodeSave(k)));assert.throws(()=>decodeSave('{"schemaVersion":8}'));});

test('文字能力改变对同一守卫的策略结果',()=>{const lava=makeCreature(['h01','b01','l03'],null,1,'熔岩巨蟹',{h01:mapTraits('火焰','head'),b01:mapTraits('岩壳','body'),l03:mapTraits('弹簧跳跃','legs')});const shadow=makeCreature(['h01','b01','l03'],null,1,'暗影潜行兽',{h01:mapTraits('鸣叫','head'),b01:mapTraits('苔藓植物','body'),l03:mapTraits('暗影潜行','legs')});const rate=(creature:typeof lava)=>{let wins=0;for(let seed=1;seed<=100;seed++){let s=createTactical(creature,0);while(!s.result)s=step(s,greedy(s),seeded(seed+s.turn)).state;wins+=Number(s.result==='win')}return wins};assert.notDeepEqual(lava.traits?.map(t=>t.keywords),shadow.traits?.map(t=>t.keywords));assert.ok(Math.abs(rate(lava)-rate(shadow))>=30);});

test('失败传承升级部件印记并记录家谱和远征战绩',()=>{let s=newGame();s.unlocked.push('h03','b03');s.equipped=['h03','b03','l01'];s.traits!.h03=mapTraits('钻刺','head');s.traits!.b03=mapTraits('苔藓植物','body');s.traits!.l01=mapTraits('疾行','legs');s=beginBattle(s,44,'loss');while(!s.activeBattle!.tactical!.result)s=takeAction(s,'guard');assert.equal(s.activeBattle!.tactical!.result,'loss');s=settleBattle(s,'loss','h03');assert.equal(s.traits!.h03.level,1);assert.equal(s.lineage?.[0].generation,1);assert.equal(s.lineage?.[0].creatureName,'我的造物');assert.equal(s.lineage?.[0].partLevel,1);assert.equal(s.generation,2);assert.equal(s.expeditionWins,0);const raw=decodeSave(encodeSave(s));assert.deepEqual(raw.lineage,s.lineage);});

test('战败只移除当前未传承的两个自创实例，其他造物和蓝图保留',()=>{
  const project='12345678-1234-1234-1234-123456789abc';
  const other='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  let s=newGame();
  const build=(p:string,slot:'head'|'body'|'legs',base:string)=>({id:p+':'+slot,projectId:p,blueprintId:base,name:'肥皂鱼'+slot,description:'肥皂鱼的'+slot,trait:mapTraits('肥皂泡泡',slot),appearance:{name:'肥皂鱼'+slot,description:'肥皂鱼的'+slot,modelPath:null,rotation:[0,0,0] as [number,number,number]},createdAt:Date.now(),status:'design' as const});
  s=registerGeneratedParts(s,[build(project,'head','h01'),build(project,'body','b02'),build(project,'legs','l01'),build(other,'head','h01')]);
  for(const slot of ['head','body','legs'])s=equipGeneratedPart(s,project+':'+slot);
  s=beginBattle(s,44,'generated-loss');
  while(!s.activeBattle!.tactical!.result)s=takeAction(s,'guard');
  assert.equal(s.activeBattle!.tactical!.result,'loss');
  s=settleBattle(s,'generated-loss',project+':body');
  assert.deepEqual(s.generatedParts!.map(p=>p.id).sort(),[project+':body',other+':head'].sort());
  assert.deepEqual(s.equippedGenerated,[null,project+':body',null]);
  assert.deepEqual(s.retiredGeneratedPartIds,[project+':head',project+':legs']);
  assert.throws(()=>registerGeneratedParts(s,[build(project,'head','h01')]));
  assert.ok(s.unlocked.includes('h01')&&s.unlocked.includes('b02')&&s.unlocked.includes('l01'));
  assert.equal(s.inheritPartId,'b02');
  assert.deepEqual(decodeSave(encodeSave(s)).generatedParts,s.generatedParts);
});

test('同一造物项目重新生成时更新旧草稿，而不是保留旧蓝图名称',()=>{
  const project='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const base={id:project+':head',projectId:project,blueprintId:'h01',name:'焰喙头',description:'每次攻击追加火焰伤害。',trait:mapTraits('火','head'),appearance:{name:'焰喙头',description:'每次攻击追加火焰伤害。',modelPath:null,rotation:[0,0,0] as [number,number,number]},createdAt:Date.now(),status:'design' as const,source:'local' as const,fallbackReason:'DeepSeek 格式校验失败：缺少 keywords'};
  let save=registerGeneratedParts(newGame(),[base]);
  save=registerGeneratedParts(save,[{...base,name:'鸭嘴泡沫头',description:'扁平鸭嘴会吹出肥皂泡。',source:'deepseek',fallbackReason:undefined}]);
  assert.equal(save.generatedParts?.length,1);assert.equal(save.generatedParts?.[0].name,'鸭嘴泡沫头');assert.equal(save.generatedParts?.[0].source,'deepseek');assert.equal(save.generatedParts?.[0].fallbackReason,undefined);
});
