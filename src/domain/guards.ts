import type { Keyword, Slot } from './keywords';

/**
 * 守卫的意图。charge（蓄力）之后的下一回合会自动变成 unleash（蓄满一击）；
 * 被打断的守卫下一回合是 stunned（发愣）。
 */
export type Intent = 'strike' | 'sweep' | 'break' | 'charge' | 'fortify' | 'heal';
export type ResolvedIntent = Intent | 'unleash' | 'stunned';

export interface GuardPartDef {
  name: string;
  hp: number;
}

export interface GuardDef {
  id: string;
  /** 0 是教学守卫，1–6 沿海沟往深处排列。 */
  depth: number;
  name: string;
  /** 称号，显示在名字上方。 */
  title: string;
  /** 口癖：嘲讽和台词都会带上它。 */
  catchphrase: string;
  parts: Record<Slot, GuardPartDef>;
  /** 普通攻击的基础伤害。 */
  damage: number;
  /** 潮位涨满需要的回合数，涨满后狂暴，伤害 ×1.5。 */
  tideMax: number;
  pattern: Intent[];
  /** 弱点：造物带有这个关键词时，攻击 ×1.5。 */
  weak: Keyword;
  /** 抗性：造物带有这个关键词时，攻击 ×0.6。 */
  resist: Keyword | null;
  /** 暗示弱点的谜语，显示在工坊输入框下方。 */
  riddle: string;
  /** 出场白。 */
  intro: string;
  /** 部位被击碎时说的话。 */
  broke: Record<Slot, string>;
  /** 击败玩家时。 */
  victory: string;
  /** 被击败时的谢幕台词。 */
  farewell: string;
  /** 第一次被击败后解锁的完整传说。 */
  lore: string;
  /** 每种意图的一句话，显示在意图气泡里。 */
  intentLines: Partial<Record<ResolvedIntent, string>>;
  /** 使用的模型套装（assets-src/legacy-models/index.json 的 set 编号）。 */
  modelSet: number;
  tutorial?: boolean;
}

const DEFAULT_LINES: Record<ResolvedIntent, string> = {
  strike: '它抬起前肢，直直地砸下来。',
  sweep: '它要横扫整片擂台，躲不开。',
  break: '它在找你甲壳的缝。守护会被击穿。',
  charge: '它在积攒力气。下一击会很重。',
  fortify: '它缩进壳里。这回合打它只剩一半。',
  heal: '潮水在它的裂缝里慢慢合拢。',
  unleash: '蓄满的一击，覆盖整片擂台。',
  stunned: '它被打断了，正在发愣。',
};

export function intentLine(guard: GuardDef, intent: ResolvedIntent): string {
  return guard.intentLines[intent] ?? DEFAULT_LINES[intent];
}

export const GUARDS: GuardDef[] = [
  {
    id: 'apprentice',
    depth: 0,
    name: '潮汐学徒',
    title: '教学守卫',
    catchphrase: '咕噜咕噜',
    parts: { head: { name: '焰冠', hp: 6 }, body: { name: '鳞腹', hp: 14 }, legs: { name: '焰尾', hp: 6 } },
    damage: 4,
    tideMax: 10,
    pattern: ['strike', 'sweep', 'break', 'charge', 'strike', 'sweep'],
    weak: '灼烧',
    resist: null,
    riddle: '它的火是凉的，真正的火会让它慌张。',
    intro: '咕噜咕噜……师父说，第一个来的客人要好好招待。',
    broke: { head: '咕噜！我的焰冠！', body: '咕噜……', legs: '尾巴、尾巴灭了！' },
    victory: '咕噜……对不起，我下手重了。',
    farewell: '咕噜咕噜，你比师父说的还厉害。往下走吧。',
    lore: '潮汐学徒是海沟门口的小守卫。它的蓝焰是师父用月光点的，只会照亮，不会烫伤任何东西。每个新来的造物，都会先在它这里学会看懂意图。',
    intentLines: {
      strike: '它甩了甩焰尾，准备撞过来。',
      sweep: '它鼓起腮帮，要把水流横扫过来。',
      break: '它盯着你的甲壳，想找缝隙。',
      charge: '它在憋气，蓝焰越来越亮。',
    },
    modelSet: 19,
    tutorial: true,
  },
  {
    id: 'scout',
    depth: 1,
    name: '铜甲斥候',
    title: '海沟第一守卫',
    catchphrase: '嘎吱嘎吱',
    parts: { head: { name: '铜喙', hp: 9 }, body: { name: '铜甲胸', hp: 18 }, legs: { name: '齿轮足', hp: 9 } },
    damage: 6,
    tideMax: 9,
    pattern: ['strike', 'sweep', 'strike', 'break', 'charge', 'fortify'],
    weak: '灼烧',
    resist: '潜行',
    riddle: '铜甲留不住滚烫的潮水。',
    intro: '嘎吱嘎吱。又一个想往下走的。',
    broke: { head: '嘎吱——喙歪了！', body: '嘎……吱……', legs: '齿轮卡住了，嘎吱！' },
    victory: '嘎吱嘎吱。回去吧，这里不欢迎软壳。',
    farewell: '嘎吱……你的火，把我的锈都烧掉了。',
    lore: '铜甲斥候原本是一艘沉船上的风向标。它在海底醒来时，只记得「看守」这一个词，于是在海沟入口站了三百年，谁也没放过去。',
    intentLines: { fortify: '它把铜甲合拢，缩成一团。' },
    modelSet: 1,
  },
  {
    id: 'lava-crab',
    depth: 2,
    name: '熔岩蟹卫',
    title: '沸泉之钳',
    catchphrase: '咔咔',
    parts: { head: { name: '熔眼', hp: 10 }, body: { name: '岩壳', hp: 20 }, legs: { name: '弹簧钳足', hp: 10 } },
    damage: 7,
    tideMax: 9,
    pattern: ['charge', 'strike', 'sweep', 'break', 'heal'],
    weak: '反射',
    resist: '灼烧',
    riddle: '它的钳子能烫穿一切，却从没见过自己的倒影。',
    intro: '咔咔。想过去？先让我烫一烫。',
    broke: { head: '咔！看不见了！', body: '咔……壳裂了……', legs: '跳、跳不起来了，咔咔！' },
    victory: '咔咔。熟了。',
    farewell: '咔……原来我的火，照在别人身上是这个样子。',
    lore: '熔岩蟹卫住在海底沸泉的出口。它的壳每一百年换一次，旧壳留在泉边，成了其他小生物的房子。',
    intentLines: { heal: '它钻进沸泉，壳上的裂缝在冒泡愈合。' },
    modelSet: 8,
  },
  {
    id: 'kelp-deer',
    depth: 3,
    name: '海草齿轮鹿',
    title: '森林的看门人',
    catchphrase: '沙沙',
    parts: { head: { name: '齿轮角', hp: 11 }, body: { name: '海草躯', hp: 22 }, legs: { name: '弹簧蹄', hp: 11 } },
    damage: 7,
    tideMax: 8,
    pattern: ['strike', 'heal', 'sweep', 'charge', 'break', 'heal'],
    weak: '吞噬',
    resist: '穿刺',
    riddle: '海草长得再快，也快不过一张饿嘴。',
    intro: '沙沙……森林不喜欢陌生的脚步。',
    broke: { head: '沙……角上的齿轮停了。', body: '沙沙沙……', legs: '蹄子……松了。' },
    victory: '沙沙。森林会记住你的形状。',
    farewell: '沙沙……你把我吃掉的那部分，会长成新的海草吧。',
    lore: '海草齿轮鹿是一片海底森林的心脏。它的齿轮每转一圈，森林就长高一寸。',
    intentLines: { heal: '海草从它身上重新长出来。' },
    modelSet: 10,
  },
  {
    id: 'mantis',
    depth: 4,
    name: '螳螂虾刃卫',
    title: '最快的拳头',
    catchphrase: '啪！',
    parts: { head: { name: '复眼', hp: 11 }, body: { name: '刃甲', hp: 24 }, legs: { name: '回旋刃足', hp: 11 } },
    damage: 8,
    tideMax: 8,
    pattern: ['strike', 'strike', 'break', 'sweep', 'charge', 'break'],
    weak: '坚壳',
    resist: '迅捷',
    riddle: '它的拳头能打碎贝壳——除非那壳足够厚。',
    intro: '啪！你慢了。',
    broke: { head: '啪？看、看不清了！', body: '啪……', legs: '刃足断了，啪！' },
    victory: '啪。下一个。',
    farewell: '啪……这么硬的壳，我还是第一次打不碎。',
    lore: '螳螂虾刃卫出拳的速度比子弹还快，拳风会让海水沸腾。它一生都在找一块打不碎的壳。',
    intentLines: { strike: '它的拳头已经在路上了。' },
    modelSet: 7,
  },
  {
    id: 'lizard',
    depth: 5,
    name: '火山蜥蜴',
    title: '熔炉的守夜人',
    catchphrase: '嘶——',
    parts: { head: { name: '岩冠', hp: 12 }, body: { name: '熔鳞躯', hp: 26 }, legs: { name: '弹跳后腿', hp: 12 } },
    damage: 8,
    tideMax: 7,
    pattern: ['fortify', 'charge', 'sweep', 'strike', 'heal', 'break'],
    weak: '震慑',
    resist: '灼烧',
    riddle: '咆哮会让它忘记正在积攒的力量。',
    intro: '嘶——熔炉很久没有客人了。',
    broke: { head: '嘶！', body: '嘶……鳞片凉了……', legs: '嘶——跳不动了。' },
    victory: '嘶——添进熔炉里吧。',
    farewell: '嘶……那一声吼，让我想起火山第一次喷发。',
    lore: '火山蜥蜴守着海底最后一座活火山。它积攒力气的时候会屏住呼吸，任何一声巨响都会让它破功。',
    intentLines: {},
    modelSet: 18,
  },
  {
    id: 'old-dino',
    depth: 6,
    name: '帽檐古龙',
    title: '海沟最深处',
    catchphrase: '呵呵',
    parts: { head: { name: '宽檐帽', hp: 13 }, body: { name: '苔甲', hp: 28 }, legs: { name: '古爪', hp: 13 } },
    damage: 9,
    tideMax: 7,
    pattern: ['charge', 'strike', 'break', 'sweep', 'heal', 'fortify'],
    weak: '穿刺',
    resist: '坚壳',
    riddle: '帽檐挡得住阳光，挡不住一根针。',
    intro: '呵呵。走了这么远，就为了见我这个老家伙？',
    broke: { head: '呵……帽子，我的帽子。', body: '呵呵……好久没这么疼了。', legs: '呵，腿脚不中用了。' },
    victory: '呵呵。再长大一点，再来吧。',
    farewell: '呵呵……海沟的尽头，终于有新的故事了。',
    lore: '帽檐古龙比海沟还老。它的帽子是从海面上漂下来的，它戴上以后就再也没摘过，说是要留着见第一个走到这里的访客。',
    intentLines: {},
    modelSet: 12,
  },
];

export function guardById(id: string): GuardDef {
  const guard = GUARDS.find(g => g.id === id);
  if (!guard) throw new Error(`未知守卫：${id}`);
  return guard;
}

export const TUTORIAL_GUARD = GUARDS[0];
