import type { BattleEvent, Creature } from './types';
import type { Keyword, Cost, Trait } from './keywords';
export type Action='attack'|'guard'|'move';
export type Intent='attack'|'sweep'|'break'|'charge'|'fortify'|'heal';
export const ACTIONS:Action[]=['attack','guard','move'];
export const INTENT_NAMES:Record<Intent,string>={attack:'攻击',sweep:'横扫',break:'破甲',charge:'蓄力',fortify:'固守',heal:'回复'};
export const GUARDS:{hp:number;damage:number;enrageAfter:number;weakAttack:number;resistAttack:number;pattern:Intent[];weak:Keyword;resist:Keyword;hint:string}[]=[
 {hp:43,damage:7,enrageAfter:8,weakAttack:1,resistAttack:1,pattern:['sweep','break','heal'],weak:'灼烧',resist:'潜行',hint:'铜甲留不住滚烫的潮水。'},
 {hp:34,damage:9,enrageAfter:7,weakAttack:1.2,resistAttack:.9,pattern:['charge','attack','sweep','sweep'],weak:'穿刺',resist:'吞噬',hint:'厚甲闭合时，一根针也能找到缝隙。'},
 {hp:44,damage:9,enrageAfter:7,weakAttack:1.2,resistAttack:.9,pattern:['charge','attack','sweep','heal','sweep'],weak:'跃击',resist:'灼烧',hint:'它盯着地面，却从不抬头。'},
 {hp:46,damage:7,enrageAfter:6,weakAttack:1.2,resistAttack:.9,pattern:['fortify','charge','sweep','attack','heal'],weak:'震慑',resist:'蓄能',hint:'咆哮会让它忘记正在积攒的力量。'},
 {hp:54,damage:7,enrageAfter:6,weakAttack:1.2,resistAttack:.9,pattern:['sweep','heal','break'],weak:'反射',resist:'灼烧',hint:'送出的锋芒，它从未准备好接住。'},
 {hp:60,damage:9,enrageAfter:5,weakAttack:1.2,resistAttack:.9,pattern:['charge','attack','break','sweep','heal'],weak:'吞噬',resist:'穿刺',hint:'从它身上夺走的生命，再也要不回来。'}];
export interface TacticalState {version:2;turn:number;hp:[number,number];maxHp:[number,number];enemyIndex:number;traits:Trait[];burn:[number,number];charged:boolean;energy:number;stealth:boolean;last:Action|null;result:'win'|'loss'|'draw'|null;actions:Action[]}
export function seeded(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}}
export function createTactical(player:Creature,enemyIndex:number):TacticalState {
 const traits=player.traits || [];const hp=30+(traits.some(t=>t.keywords.includes('膨胀'))?10:0)+(player.inheritPartId?5:0);
 return {version:2,turn:1,hp:[hp,GUARDS[enemyIndex].hp],maxHp:[hp,GUARDS[enemyIndex].hp],enemyIndex,traits,burn:[0,0],charged:false,energy:0,stealth:false,last:null,result:null,actions:[]};
}
const has=(s:TacticalState,k:Keyword)=>s.traits.some(t=>t.keywords.includes(k));
const cost=(s:TacticalState,c:Cost)=>s.traits.some(t=>t.cost===c);
export function multiplier(s:TacticalState,k:Keyword){const g=GUARDS[s.enemyIndex],level=Math.max(0,...s.traits.filter(t=>t.keywords.includes(k)).map(t=>t.level||0));return (g.weak===k?1.5:g.resist===k?.5:1)*(1+Math.min(3,level)*.25)}
export function intent(s:TacticalState){const g=GUARDS[s.enemyIndex];return g.pattern[(s.turn-1)%g.pattern.length]}
export function legalActions(s:TacticalState){return ACTIONS.filter(a=>!cost(s,'骄傲') || a!==s.last)}
export function effects(s:TacticalState){
 const i=intent(s),g=GUARDS[s.enemyIndex];
 // A guard's listed weakness and resistance affect every direct attack, including plain attacks.
 const matchup=has(s,g.weak)?g.weakAttack:has(s,g.resist)?g.resistAttack:1;
 let attack=(6+s.energy)*(s.stealth?1.5*multiplier(s,'潜行'):1)*matchup;
 if(has(s,'连击'))attack*=1.2*multiplier(s,'连击');
 if(i==='fortify'&&!has(s,'穿刺'))attack*=.5;
 if(i==='fortify'&&has(s,'穿刺'))attack*=multiplier(s,'穿刺');
 const guard=(6+(has(s,'坚壳')?4*multiplier(s,'坚壳'):0))*(cost(s,'脆壳')?.5:1);
 const incoming=i==='charge'||i==='fortify'||i==='heal'?0:g.damage*(s.turn>g.enrageAfter?1.5:1)*(s.charged?2.5:i==='break'&&!has(s,'吸附')?2:1);
 return {attack:Math.round(attack),guard:Math.round(guard),incoming:Math.round(incoming),moveDamage:has(s,'跃击')?Math.round(3*multiplier(s,'跃击')):0};
}
export function step(input:TacticalState,action:Action,rng:()=>number):{state:TacticalState;events:BattleEvent[]} {
 if(input.result)throw new Error('战斗已结束');if(!legalActions(input).includes(action))throw new Error('骄傲：不能连续使用同一行动');
 const s=structuredClone(input),events:BattleEvent[]=[];const i=intent(s),fx=effects(s);let interrupted=false;const skipped=cost(s,'贪食')&&s.turn%4===0;
 const emit=(actor:0|1,target:0|1,damage:number,triggered:string[])=>{s.hp[target]=Math.max(0,Math.min(s.maxHp[target],s.hp[target]-damage));events.push({index:events.length,round:s.turn,actor,target,damage,hp:[...s.hp],triggered,action,...(actor===0?{slot:(action==='attack'?'head':action==='guard'?'body':'legs') as 'head'|'body'|'legs'}:{}),...(target===0&&damage>0?{targetSlot:'body' as const}:{})});};
 const heal=(n:number,label:string)=>{const value=Math.min(s.maxHp[0]-s.hp[0],Math.round(n));if(value>0)emit(0,0,-value,[label]);};
 const player=()=>{
  if(skipped){emit(0,0,0,['贪食：休息一回合']);return;}
  if(action==='attack'){
   const enemyHpBefore=s.hp[1];
   if(i==='charge'&&has(s,'震慑')){interrupted=true;s.charged=false;}
   if(has(s,'连击')){const base=fx.attack/(1.2*multiplier(s,'连击')),hit=Math.max(1,Math.round(base*.6*multiplier(s,'连击')));emit(0,1,hit,['连击']);if(s.hp[1]>0)emit(0,1,hit,['连击']);}else emit(0,1,fx.attack,interrupted?['打断！']:['攻击']);
   if(has(s,'灼烧'))s.burn[1]+=2*multiplier(s,'灼烧');
   if(has(s,'吞噬'))heal(Math.max(0,(enemyHpBefore-s.hp[1])*.5*multiplier(s,'吞噬')),'吞噬');s.energy=0;s.stealth=false;
  }else if(action==='guard'){
   emit(0,0,0,['守护']);if(has(s,'蓄能'))s.energy=Math.round(3*multiplier(s,'蓄能'));if(i==='fortify')heal(3,'固守间隙休整');
  }else{
   if(fx.moveDamage)emit(0,1,fx.moveDamage,['跃击']);else emit(0,0,0,['机动']);if(has(s,'潜行'))s.stealth=true;if(has(s,'回旋'))heal(2*multiplier(s,'回旋'),'回旋');
  }
 };
 const enemy=()=>{
  if(i==='charge'){s.charged=!interrupted;emit(1,1,0,[interrupted?'打断！':'下回合伤害 ×2.5']);return;}
  if(i==='heal'){emit(1,1,-Math.min(3,s.maxHp[1]-s.hp[1]),['回复']);s.charged=false;return;}
  if(i==='fortify'){emit(1,1,0,['固守']);s.charged=false;return;}
  let damage=fx.incoming;const labels:string[]=[INTENT_NAMES[i]];
  if(!skipped&&action==='move'&&i!=='sweep'){damage=0;labels.push('闪开！');}
  let blocked=0;if(!skipped&&action==='guard'&&(i!=='break'||has(s,'吸附'))){blocked=Math.min(damage,fx.guard);damage-=blocked;labels.push('格挡 '+blocked);}
  emit(1,0,damage,labels);s.charged=false;
  if(blocked&&has(s,'反射'))emit(0,1,Math.round(blocked*.5*multiplier(s,'反射')),['反射']);
 };
 // Intent and defenses are selected before initiative; slowing never disables a chosen defense.
 const first=has(s,'迅捷')&&!cost(s,'迟缓');
 if(first){player();if(s.hp[1]>0)enemy();}else{enemy();if(s.hp[0]>0)player();}
 if(s.hp[0]>0&&s.hp[1]>0){
  for(const target of [0,1] as const){if(s.burn[target]>0){emit(target===0?1:0,target,Math.ceil(s.burn[target]*(target===0&&cost(s,'易燃')?2:1)),['灼烧']);s.burn[target]=Math.max(0,s.burn[target]-1);}}
  if(s.hp[0]>0&&has(s,'再生'))heal(2*multiplier(s,'再生'),'再生');
 }
 s.last=action;s.actions.push(action);s.result=s.hp[0]<=0?'loss':s.hp[1]<=0?'win':s.turn>=30?'draw':null;s.turn++;
 void rng;return {state:s,events};
}
export function greedy(s:TacticalState):Action {
 const choices=legalActions(s);const scores=choices.map(action=>{const {state}=step(s,action,()=>.5);return {action,score:(s.hp[1]-state.hp[1])*1.4-(s.hp[0]-state.hp[0])*2+state.energy*.55+(state.stealth?2:0)+(state.result==='win'?100:state.result==='loss'?-100:0)};});
 return scores.sort((a,b)=>b.score-a.score)[0].action;
}
