import {makeCreature} from '../src/domain/engine';
import {KEYWORDS,type Keyword,type Trait} from '../src/domain/keywords';
import {GUARDS,createTactical,greedy,legalActions,seeded,step,type Action} from '../src/domain/tactical';

type Category='counter'|'neutral'|'resisted';
const ranges:Record<Category,[number,number]>={counter:[90,100],neutral:[65,85],resisted:[35,60]};
const categories:Category[]=['counter','neutral','resisted'];
const builds=[...KEYWORDS.head].flatMap(head=>[...KEYWORDS.body].flatMap(body=>[...KEYWORDS.legs].map(legs=>[head,body,legs] as [Keyword,Keyword,Keyword])));
const make=(skills:[Keyword,Keyword,Keyword])=>{
 const [head,body,legs]=skills;
 const trait=(keyword:Keyword):Trait=>({keywords:[keyword],cost:null,reasons:[]});
 return makeCreature(['h01','b01','l01'],null,1,'模拟造物',{h01:trait(head),b01:trait(body),l01:trait(legs)});
};
function category(skills:Keyword[],weak:Keyword,resist:Keyword):Category|null {
 if(skills.includes(weak))return skills.includes(resist)?null:'counter';
 return skills.includes(resist)?'resisted':'neutral';
}
function run(guard:number,skills:[Keyword,Keyword,Keyword],policy:'greedy'|'random',seed:number){
 let state=createTactical(make(skills),guard);const rng=seeded(seed);
 while(!state.result){const legal=legalActions(state);const action:Action=policy==='greedy'?greedy(state):legal[Math.floor(rng()*legal.length)];state=step(state,action,rng).state;}
 return state.result==='win';
}
let pass=true;
console.log('守卫 | 克制型 贪心/随机 | 中性型 贪心/随机 | 被克型 贪心/随机');
for(let guard=0;guard<GUARDS.length;guard++){
 const row=categories.map(kind=>{
  const selected=builds.filter(skills=>category(skills,GUARDS[guard].weak,GUARDS[guard].resist)===kind);
  const wins=selected.filter(skills=>run(guard,skills,'greedy',1)).length;
  let randomWins=0;for(const skills of selected)for(let seed=1;seed<=24;seed++)randomWins+=Number(run(guard,skills,'random',guard*1000+seed));
  const greedyRate=100*wins/selected.length,randomRate=100*randomWins/(selected.length*24);
  const good=greedyRate>=ranges[kind][0]&&greedyRate<=ranges[kind][1]&&randomRate<=35;
  pass&&=good;
  return `${greedyRate.toFixed(1)}% / ${randomRate.toFixed(1)}%${good?'':' ⚠'}`;
 });
 console.log(`${guard+1} ${row.join(' | ')}`);
}
if(!pass)process.exitCode=1;
