import type { Keyword, Slot } from './keywords';

/**
 * 预生成模型目录：上线前用 scripts/pregen.ts 调 Tripo 一次性生成好的部件。
 * - 玩家套装：16 种完全不同的动物 / 植物。玩家锻造时先从这里挑最贴近原话的部件「秒出」，
 *   Tripo 按原话生成的专属外形好了再自动换上。
 * - 守卫套装：6 位预设守卫各自的新外形（玩家永远拿不到这些部件）。
 * 生成结果写在 public/assets/gen/<套装>/<槽位>.glb，清单在 generated-models.json。
 * 清单里还没有的套装会被忽略，游戏回落到旧的卡通部件，不会坏。
 */
export interface PregenPart {
  keyword: Keyword;
  /** 原话里出现这些字时优先选它。 */
  words: string[];
  /** 交给 Tripo 的英文外形描述（会套上 tripo.ts 里的部位模板）。 */
  features: string;
  /** 腿部槽位其实是底座（触手、花盆、根须），不要套「一对腿」的模板。 */
  base?: boolean;
}
export interface PregenSet {
  id: string;
  name: string;
  kind: 'player' | 'guard';
  parts: Record<Slot, PregenPart>;
}

const p = (keyword: Keyword, words: string[], features: string, base?: boolean): PregenPart => ({ keyword, words, features, ...(base ? { base } : {}) });

export const PREGEN_SETS: PregenSet[] = [
  {
    id: 'fox', name: '狐狸', kind: 'player',
    parts: {
      head: p('吞噬', ['狐', '狐狸', '尖耳', '狡猾', '橙'], 'orange fox head with big pointed ears, white cheeks, sly smile showing small fangs'),
      body: p('膨胀', ['狐', '狐狸', '毛', '橙', '蓬'], 'fluffy orange fox torso with a white chest ruff and a huge bushy tail curling from the back'),
      legs: p('潜行', ['狐', '狐狸', '轻', '悄', '爪'], 'slim orange fox legs with black socks and soft padded paws, tiptoe sneaking pose'),
    },
  },
  {
    id: 'cat', name: '猫', kind: 'player',
    parts: {
      head: p('震慑', ['猫', '喵', '胡须', '瞪', '凶'], 'grey tabby cat head with wide glowing yellow eyes, long whiskers, round ears, grumpy stare'),
      body: p('膨胀', ['猫', '喵', '胖', '圆', '懒'], 'round chubby grey tabby cat belly with stripes and a curled tail'),
      legs: p('潜行', ['猫', '喵', '肉垫', '轻', '悄'], 'short grey tabby cat legs with pink toe beans, soft quiet paws'),
    },
  },
  {
    id: 'rabbit', name: '兔子', kind: 'player',
    parts: {
      head: p('连击', ['兔', '长耳', '门牙', '胡萝卜', '白'], 'white rabbit head with very long upright ears, two big front teeth, pink nose, rosy cheeks'),
      body: p('再生', ['兔', '白', '软', '绒', '萝卜'], 'soft white rabbit torso with a fluffy cotton ball tail and a small carrot patch on the belly'),
      legs: p('跃击', ['兔', '跳', '蹦', '弹', '后腿'], 'powerful white rabbit hind legs with big long feet, ready to hop'),
    },
  },
  {
    id: 'frog', name: '青蛙', kind: 'player',
    parts: {
      head: p('吞噬', ['蛙', '青蛙', '舌', '呱', '绿'], 'green frog head with huge bulging eyes on top and a very wide grinning mouth, pink tongue tip'),
      body: p('再生', ['蛙', '青蛙', '滑', '湿', '绿', '荷叶'], 'plump green frog torso with a pale yellow belly, shiny wet skin and a tiny lily pad on the back'),
      legs: p('跃击', ['蛙', '青蛙', '跳', '蹼', '蹦'], 'bent green frog legs with long webbed toes, spring loaded crouch'),
    },
  },
  {
    id: 'owl', name: '猫头鹰', kind: 'player',
    parts: {
      head: p('震慑', ['猫头鹰', '鹰', '夜', '眼睛', '羽'], 'brown owl head with enormous round amber eyes, feather ear tufts and a small hooked beak'),
      body: p('膨胀', ['猫头鹰', '羽', '胖', '圆', '夜'], 'round puffed up brown owl torso with a speckled cream chest and folded wings'),
      legs: p('吸附', ['猫头鹰', '爪', '抓', '枝', '鹰'], 'feathered owl legs with strong curved talons gripping a short branch'),
    },
  },
  {
    id: 'penguin', name: '企鹅', kind: 'player',
    parts: {
      head: p('穿刺', ['企鹅', '冰', '南极', '黑白', '喙'], 'black and white penguin head with a sharp orange beak and cheerful eyes'),
      body: p('膨胀', ['企鹅', '冰', '胖', '圆', '雪'], 'round black penguin torso with a big white belly and little flippers at the sides'),
      legs: p('回旋', ['企鹅', '滑', '冰', '摇', '转'], 'short orange penguin feet with webbed toes on a small ice disc, waddling'),
    },
  },
  {
    id: 'octopus', name: '章鱼', kind: 'player',
    parts: {
      head: p('吞噬', ['章鱼', '墨', '触手', '紫', '软'], 'purple octopus head with a big round dome, sleepy eyes and a small puckered mouth'),
      body: p('再生', ['章鱼', '软', '紫', '墨', '海'], 'soft purple octopus mantle torso with pale spots and a small ink sac'),
      legs: p('吸附', ['章鱼', '触手', '吸盘', '爬', '粘'], 'a skirt of eight short curled purple octopus tentacles with rows of suction cups', true),
    },
  },
  {
    id: 'cactus', name: '仙人掌', kind: 'player',
    parts: {
      head: p('穿刺', ['仙人掌', '刺', '沙漠', '花', '尖'], 'round green cactus head covered in tiny spines, a pink cactus flower on top and cute eyes'),
      body: p('坚壳', ['仙人掌', '刺', '沙漠', '硬', '绿'], 'barrel shaped green cactus torso with ribs and small white spines'),
      legs: p('吸附', ['仙人掌', '根', '盆', '扎', '沙'], 'a small terracotta flower pot base with short roots gripping the ground', true),
    },
  },
  {
    id: 'mushroom', name: '蘑菇', kind: 'player',
    parts: {
      head: p('震慑', ['蘑菇', '菇', '孢子', '伞', '毒'], 'cute mushroom creature head, red cap with white dots sitting high above a clearly visible friendly face'),
      body: p('再生', ['蘑菇', '菇', '苔', '孢子', '森林'], 'chubby pale mushroom stem torso with moss patches and tiny baby mushrooms growing on it'),
      legs: p('吸附', ['蘑菇', '菇', '根', '菌丝', '土'], 'stubby mushroom root legs spreading like mycelium', true),
    },
  },
  {
    id: 'sunflower', name: '向日葵', kind: 'player',
    parts: {
      head: p('灼烧', ['向日葵', '葵', '太阳', '花', '阳光'], 'sunflower head with bright yellow petals around a smiling brown seed face'),
      body: p('再生', ['向日葵', '叶', '花', '绿', '阳光'], 'green plant stem torso wrapped in big broad leaves'),
      legs: p('吸附', ['向日葵', '根', '花', '土', '扎根'], 'short green stem legs ending in tangled roots on a small clump of soil', true),
    },
  },
  {
    id: 'dragon', name: '小龙', kind: 'player',
    parts: {
      head: p('灼烧', ['龙', '喷火', '火', '鳞', '角'], 'little red dragon head with two small horns, a snout puffing a tiny flame and big friendly eyes'),
      body: p('坚壳', ['龙', '鳞', '翅膀', '红', '甲'], 'chubby red dragon torso with golden belly scales and two tiny folded wings'),
      legs: p('跃击', ['龙', '爪', '跳', '尾巴', '红'], 'stout red dragon legs with three clawed toes and a short spiked tail'),
    },
  },
  {
    id: 'turtle', name: '海龟', kind: 'player',
    parts: {
      head: p('穿刺', ['龟', '海龟', '乌龟', '喙', '老'], 'green sea turtle head with a small beak mouth and calm wise eyes'),
      body: p('坚壳', ['龟', '海龟', '乌龟', '壳', '硬'], 'round turtle torso with a thick domed hexagon patterned shell'),
      legs: p('吸附', ['龟', '海龟', '慢', '鳍', '稳'], 'four short sturdy turtle flipper feet planted wide'),
    },
  },
  {
    id: 'bee', name: '蜜蜂', kind: 'player',
    parts: {
      head: p('穿刺', ['蜂', '蜜蜂', '触角', '蜜', '黄'], 'yellow and black bee head with two curly antennae, big shiny eyes and a tiny smile'),
      body: p('蓄能', ['蜂', '蜜蜂', '蜜', '条纹', '翅'], 'fuzzy striped yellow and black bee torso with small translucent wings and a stinger'),
      legs: p('迅捷', ['蜂', '蜜蜂', '飞', '快', '嗡'], 'thin black bee legs with little pollen baskets, light and quick'),
    },
  },
  {
    id: 'jellyfish', name: '水母', kind: 'player',
    parts: {
      head: p('震慑', ['水母', '透明', '发光', '电', '软'], 'a round pink jellyfish dome head, slightly translucent with glowing edges, big cute eyes and a small smile on the front, a few frilly spots on top'),
      body: p('反射', ['水母', '透明', '发光', '光', '亮'], 'translucent jelly torso with a glowing bioluminescent core'),
      legs: p('回旋', ['水母', '触须', '飘', '游', '转'], 'a bunch of wavy ribbon jellyfish tentacles swirling in a spiral', true),
    },
  },
  {
    id: 'bear', name: '熊', kind: 'player',
    parts: {
      head: p('吞噬', ['熊', '熊猫', '蜂蜜', '棕', '吼'], 'brown bear head with small round ears, a big snout and honey dripping from the grinning mouth'),
      body: p('膨胀', ['熊', '胖', '毛', '壮', '棕'], 'huge round brown bear belly torso with a lighter tummy patch'),
      legs: p('跃击', ['熊', '掌', '踩', '重', '跺'], 'thick brown bear legs with heavy padded paws, stomping'),
    },
  },
  {
    id: 'crystal', name: '水晶', kind: 'player',
    parts: {
      head: p('穿刺', ['水晶', '晶', '宝石', '矿', '石头'], 'cute creature head made of faceted blue crystal with sharp crystal spikes on top and glowing eyes'),
      body: p('反射', ['水晶', '晶', '宝石', '镜', '闪'], 'stone torso studded with clusters of shiny blue and purple crystals'),
      legs: p('吸附', ['水晶', '晶', '石', '矿', '岩'], 'short rocky stone legs with small crystal shards at the feet'),
    },
  },
  // ---- 守卫：比玩家的更威风一点，但同一种卡通画风 ----
  {
    id: 'g-scout', name: '铜甲斥候', kind: 'guard',
    parts: {
      head: p('穿刺', [], 'a brass mechanical seabird head with a long sharp copper beak, rivets, glowing green lens eyes and a weathervane crest'),
      body: p('坚壳', [], 'a brass armored bird torso with overlapping copper plates, rivets, small gears and a few green patina spots'),
      legs: p('迅捷', [], 'long thin shiny brass metal bird legs with visible piston joints, rivets and three clawed copper toes, mechanical robot style'),
    },
  },
  {
    id: 'g-crab', name: '熔岩蟹卫', kind: 'guard',
    parts: {
      head: p('灼烧', [], 'a lava crab head with eyes on stalks, dark volcanic rock shell with glowing orange lava cracks and steam'),
      body: p('坚壳', [], 'a wide crab carapace torso of black volcanic rock with glowing lava seams and two big pincers at the sides'),
      legs: p('跃击', [], 'six short jointed crab legs of dark rock with glowing orange tips'),
    },
  },
  {
    id: 'g-deer', name: '海草齿轮鹿', kind: 'guard',
    parts: {
      head: p('震慑', [], 'a gentle deer head with branching antlers made of green kelp and small bronze gears, calm eyes'),
      body: p('再生', [], 'a round green deer body with long ribbons of kelp draped over the back, a few small bronze cogs on the side, soft fur'),
      legs: p('迅捷', [], 'slender deer legs wrapped in kelp with small bronze hooves'),
    },
  },
  {
    id: 'g-mantis', name: '螳螂虾刃卫', kind: 'guard',
    parts: {
      head: p('连击', [], 'a mantis shrimp head with rainbow colored stalk eyes, green and red shell and a fierce look'),
      body: p('蓄能', [], 'a segmented mantis shrimp torso in bright green orange and blue with two folded club fists'),
      legs: p('迅捷', [], 'many small fast mantis shrimp legs and a fan tail, colorful', true),
    },
  },
  {
    id: 'g-lizard', name: '火山蜥蜴', kind: 'guard',
    parts: {
      head: p('灼烧', [], 'a volcano lizard head with a frill of obsidian spikes, ember eyes and smoke from its nostrils'),
      body: p('坚壳', [], 'a lizard torso with charcoal black scales and glowing magma stripes along the back'),
      legs: p('跃击', [], 'crouched lizard legs with black scales, orange claws and a thick tail'),
    },
  },
  {
    id: 'g-dino', name: '帽檐古龙', kind: 'guard',
    parts: {
      head: p('震慑', [], 'an old wise dinosaur head wearing a small wide brim explorer hat, long white beard, kind wrinkled eyes'),
      body: p('坚壳', [], 'a big old dinosaur torso with mossy stone scales and barnacles, a round belly'),
      legs: p('跃击', [], 'two huge sturdy dinosaur legs with round toes, ancient and mossy'),
    },
  },
];

export const PREGEN_GUARD_FOR: Record<string, string> = {
  scout: 'g-scout',
  'lava-crab': 'g-crab',
  'kelp-deer': 'g-deer',
  mantis: 'g-mantis',
  lizard: 'g-lizard',
  'old-dino': 'g-dino',
};

export const genUrl = (set: string, slot: Slot) => `/assets/gen/${set}/${slot}.glb`;
