import type { Slot } from './types';
export const KEYWORDS={head:['灼烧','穿刺','连击','震慑','吞噬'],body:['坚壳','反射','再生','膨胀','蓄能'],legs:['迅捷','潜行','跃击','吸附','回旋']} as const;
export type Keyword=typeof KEYWORDS[Slot][number];
export const COSTS=['迟缓','易燃','骄傲','脆壳','贪食'] as const;
export type Cost=typeof COSTS[number];
export interface Trait {keywords:Keyword[];cost:Cost|null;reasons:{keyword:Keyword|Cost;quote:string;why:string}[];level?:number}
export type Traits=Record<string,Trait>;
const rules:Record<Slot,[RegExp,Keyword][]>={
 head:[[/火焰|喷火|熔岩|火|炎|焰|辣椒/,'灼烧'],[/鸭|鸟|喙|嘴|角|钻|刺|钳|螯/,'穿刺'],[/双|多头|连|快|翅|拍打/,'连击'],[/雷|吼|震|叫|鸣/,'震慑'],[/牙|吞|咬|吃|泡沫|泡泡|肥皂|鱼/,'吞噬']],
 body:[[/壳|甲|岩|石|恐龙|龙|龟|骨骼|鳞/,'坚壳'],[/镜|反光|水晶|玻璃/,'反射'],[/植物|苔|糖|软|棉花|海绵/,'再生'],[/巨|胖|大|泡沫|泡泡|肥皂/,'膨胀'],[/电|能|骨|齿轮/,'蓄能']],
 legs:[[/翼|风|快|疾|兔|猴|奔跑|飞/,'迅捷'],[/影|暗|隐身/,'潜行'],[/跳|跃|弹簧|弹/,'跃击'],[/吸|黏|吸盘|重/,'吸附'],[/旋|舞|尾巴|尾鳍|鱼尾|摆尾/,'回旋']]
};
export function mapTraits(text:string,slot:Slot):Trait {
 const matches=rules[slot].flatMap(([pattern,keyword])=>{const m=text.match(pattern);return m?[{keyword,quote:m[0],why:`“${m[0]}”对应${keyword}能力`}]:[]}).slice(0,2);
 if(!matches.length)matches.push({keyword:KEYWORDS[slot][slot==='head'?2:slot==='body'?3:4],quote:text.slice(0,12),why:'AI 未响应，暂用基础能力'});
 const boast=text.match(/无敌|神|最强|无限/);const cost=boast?'骄傲':null;
 return {keywords:matches.map(m=>m.keyword),cost,reasons:[...matches,...(boast?[{keyword:'骄傲' as Cost,quote:boast[0],why:'神可不愿意连续表演同一招'}]:[])]};
}

export const KEYWORD_DESCRIPTIONS:Record<Keyword,string>={'灼烧':'攻击叠加2层灼烧，之后每层造成1点伤害并衰减。','穿刺':'攻击无视守卫固守的减伤。','连击':'攻击分成两次，每次造成约60%伤害。','震慑':'攻击可以打断守卫蓄力。','吞噬':'按本次实际伤害的一半恢复生命。','坚壳':'守护额外减免4点伤害。','反射':'守护时反弹被减免伤害的一半。','再生':'每回合恢复2点生命。','膨胀':'生命上限提高10点。','蓄能':'守护后，下次攻击增加3点伤害。','迅捷':'本回合先于守卫行动。','潜行':'机动后，下次攻击伤害提高50%。','跃击':'机动时顺带造成3点伤害。','吸附':'破甲不加倍伤害，守护仍可生效。','回旋':'机动时恢复2点生命。'};
