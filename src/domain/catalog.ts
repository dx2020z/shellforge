import type { Part } from './types';
import { PART_ASSETS } from '../assets/manifest';

export const PARTS: Part[] = [
  { id:'h01', slot:'head', name:'焰喙头', stats:{hp:12,atk:11,def:2,speed:2}, abilityId:'flame', tags:['机械','火焰'], description:'每次攻击追加2点火焰伤害。', imagePath:PART_ASSETS.h01.previewPath, modelPath:PART_ASSETS.h01.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'h02', slot:'head', name:'盾壳头', stats:{hp:18,atk:9,def:4,speed:0}, abilityId:'guard', tags:['甲壳','防御'], description:'前两次受到攻击时，普通伤害各减4。', imagePath:PART_ASSETS.h02.previewPath, modelPath:PART_ASSETS.h02.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'h03', slot:'head', name:'钻角头', stats:{hp:14,atk:10,def:3,speed:1}, abilityId:'pierce', tags:['机械','贯穿'], description:'第3、6、9次攻击计算时忽略防御。', imagePath:PART_ASSETS.h03.previewPath, modelPath:PART_ASSETS.h03.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'b01', slot:'body', name:'岩甲身', stats:{hp:40,atk:4,def:9,speed:1}, abilityId:'basic', tags:['岩石','防御'], description:'高防御身体。', imagePath:PART_ASSETS.b01.previewPath, modelPath:PART_ASSETS.b01.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'b02', slot:'body', name:'兽骨身', stats:{hp:28,atk:9,def:4,speed:3}, abilityId:'basic', tags:['骨骼','攻击'], description:'高攻击身体。', imagePath:PART_ASSETS.b02.previewPath, modelPath:PART_ASSETS.b02.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'b03', slot:'body', name:'苔藓身', stats:{hp:34,atk:6,def:6,speed:2}, abilityId:'basic', tags:['植物','均衡'], description:'均衡身体。', imagePath:PART_ASSETS.b03.previewPath, modelPath:PART_ASSETS.b03.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'l01', slot:'legs', name:'疾行足', stats:{hp:10,atk:3,def:3,speed:9}, abilityId:'basic', tags:['速度','轻盈'], description:'高速度腿部。', imagePath:PART_ASSETS.l01.previewPath, modelPath:PART_ASSETS.l01.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'l02', slot:'legs', name:'重载足', stats:{hp:15,atk:4,def:5,speed:4}, abilityId:'basic', tags:['承重','稳定'], description:'高生命和防御腿部。', imagePath:PART_ASSETS.l02.previewPath, modelPath:PART_ASSETS.l02.modelPath, assetSource:'placeholder', rulesSource:'preset' },
  { id:'l03', slot:'legs', name:'跃击足', stats:{hp:8,atk:8,def:2,speed:7}, abilityId:'basic', tags:['跳跃','攻击'], description:'高攻击腿部。', imagePath:PART_ASSETS.l03.previewPath, modelPath:PART_ASSETS.l03.modelPath, assetSource:'placeholder', rulesSource:'preset' },
];

export const ENEMIES: { name:string; parts:[string,string,string] }[] = [
  { name:'钻角斥候', parts:['h03','b02','l01'] },
  { name:'深海甲卫', parts:['h02','b03','l03'] },
  { name:'岩甲钻兽', parts:['h03','b01','l02'] },
  { name:'沉壳守卫', parts:['h02','b01','l02'] },
  { name:'焰苔跃兽', parts:['h01','b03','l03'] },
  { name:'苔原钻兽', parts:['h03','b03','l02'] },
];

export const STARTING_PART_IDS = ['h01','b01','b02','l01','l02'] as const;

export function findPart(id:string): Part {
  const part = PARTS.find(item => item.id === id);
  if (!part) throw new Error(`Unknown part: ${id}`);
  return part;
}
