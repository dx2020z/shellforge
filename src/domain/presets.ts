import { mapSlotTraits, type Slot } from './keywords';
import type { PartRecord } from './types';

/**
 * 预置部件：没有密钥也能完整游玩的起点。
 * 每件都有一句「原话」，能力从这句话里映射，与玩家造物走同一条规则，
 * 这样高亮和理由在全游戏保持一致。
 */
interface PresetDef {
  id: string;
  slot: Slot;
  name: string;
  source: string;
  description: string;
}

export const PRESET_DEFS: PresetDef[] = [
  { id: 'h01', slot: 'head', name: '焰喙头', source: '喷着火星的铜喙', description: '铜铸的鸟喙，缝隙里总冒着火星。' },
  { id: 'h02', slot: 'head', name: '螺号头', source: '一吼就震碎浪花的螺号', description: '螺旋的号角，吹响时海面起皱。' },
  { id: 'h03', slot: 'head', name: '钻角头', source: '额前一根旋转的钻角', description: '额前那根钻角能找到任何缝隙。' },
  { id: 'b01', slot: 'body', name: '岩甲身', source: '裹着礁岩硬甲的躯干', description: '礁岩层层叠压而成的厚甲。' },
  { id: 'b02', slot: 'body', name: '发条身', source: '胸口转着齿轮发条', description: '胸口的发条越拧越紧，力气也越攒越多。' },
  { id: 'b03', slot: 'body', name: '苔藓身', source: '长满软苔藓的圆肚子', description: '柔软的苔藓会慢慢盖住伤口。' },
  { id: 'l01', slot: 'legs', name: '疾行足', source: '跑起来像风一样快的细腿', description: '细长轻盈，起步就是全速。' },
  { id: 'l02', slot: 'legs', name: '吸盘足', source: '长着吸盘的沉稳短腿', description: '吸盘扒住礁石，再大的浪也掀不动。' },
  { id: 'l03', slot: 'legs', name: '弹簧足', source: '弹簧一样会跳跃的后腿', description: '一压一弹，腾空时顺势踢出一脚。' },
];

export const PRESET_IDS = PRESET_DEFS.map(def => def.id);
/** 新存档一开始拥有的预置部件。 */
export const STARTING_PRESET_IDS = ['h01', 'h02', 'b01', 'b03', 'l01', 'l03'];

export function presetModelUrl(id: string): string {
  return `/assets/parts/${id}/model.glb`;
}

export function makePresetPart(id: string, now = 0): PartRecord {
  const def = PRESET_DEFS.find(item => item.id === id);
  if (!def) throw new Error(`未知的预置部件：${id}`);
  return {
    id: def.id,
    slot: def.slot,
    name: def.name,
    description: def.description,
    source: def.source,
    trait: mapSlotTraits(def.source, def.slot),
    model: { kind: 'preset', url: presetModelUrl(def.id), rotation: [0, 0, 0] },
    origin: { kind: 'preset' },
    level: 0,
    history: [],
    createdAt: now,
  };
}
