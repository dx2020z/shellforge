import type { Keyword } from './keywords';
import { guardModelUrls } from './model-pool';
import { creatureParts, findCreature, partTints } from './creature';
import type { CreatureRecord, GameSave } from './types';
import type { DuelGuardDef, DuelMove, PatternMove } from './duel';

/**
 * 守卫库：6 位属性各不相同的预设守卫，加上玩家每一只死去的造物变成的「亡者守卫」。
 * 玩家死得越多，海沟里的守卫就越多——而且它们用的，是你当初写下的话。
 */

const STUNNED = { word: '发愣', line: '它被打断了，愣在原地。现在是机会。' };

function preset(
  def: Omit<DuelGuardDef, 'kind' | 'models' | 'moves' | 'heal' | 'resistLine'> & {
    modelSet: number;
    heal?: number;
    resistLine?: string;
    moves: Omit<Record<DuelMove, { word: string; line: string }>, 'stunned' | 'heal'> & { heal?: { word: string; line: string } };
  },
): DuelGuardDef {
  const u = guardModelUrls(def.modelSet, def.id);
  const { modelSet: _m, ...rest } = def;
  void _m;
  return {
    ...rest,
    kind: 'preset',
    models: [u.head, u.body, u.legs],
    heal: def.heal ?? 3,
    resistLine: def.resistLine ?? '这一下对它没什么用。',
    moves: { heal: { word: '愈合', line: '它身上的裂缝在慢慢合拢。打断它，它就长不回来。' }, ...def.moves, stunned: STUNNED },
  };
}

export const PRESET_GUARDS: DuelGuardDef[] = [
  preset({
    id: 'scout',
    enrage: '嘎……嘎吱！齿轮全部转起来了——你惹火我了。',
    name: '铜甲斥候',
    title: '海沟第一守卫',
    intro: '嘎吱嘎吱。又一个想往下走的。',
    farewell: '嘎吱……你的火，把我的锈都烧掉了。',
    victory: '嘎吱嘎吱。回去吧，这里不欢迎软壳。',
    lore: '铜甲斥候原本是一艘沉船上的风向标。它在海底醒来时，只记得「看守」这一个词，于是在海沟入口站了三百年，谁也没放过去。',
    modelSet: 1,
    hp: 16,
    strike: 4,
    unleash: 8,
    pattern: ['strike', 'charge', 'fortify', 'strike', 'fortify', 'charge'],
    weak: ['灼烧'],
    resist: [],
    blind: ['潜行', '跃击'],
    secret: { words: ['锈', '绿斑', '铜绿', '潮湿', '泡水', '发霉'], damage: 3, effect: 'rust', fromOrigin: true },
    riddles: [
      { id: 'weak', text: '铜甲留不住滚烫的东西。', solved: '嘶——铜甲被烫红了！原来它怕热。' },
      { id: 'blind', text: '它的眼睛只盯着正前方。', solved: '它扭不过头来！背后是它的死角。' },
      { id: 'secret', text: '三百年的铜，最怕长出绿斑。', solved: '绿斑爬满了铜甲——它生锈了，再也合不拢了！' },
    ],
    moves: {
      strike: { word: '直刺', line: '铜喙对准了你的正面，要扎过来了。' },
      charge: { word: '上弦', line: '齿轮咔咔上紧。下一下会很重——除非有人打断它。' },
      unleash: { word: '穿心', line: '上满弦的铜喙冲过来了！硬挡只能挡住一半。' },
      fortify: { word: '合甲', line: '它把铜甲合拢缩成一团，普通的打击会被弹开。' },
    },
    reactions: { 灼烧: '嘎——烫！烫！', 穿刺: '嘎吱！甲缝被扎穿了。', 震慑: '嘎？！', 吞噬: '别、别咬我的铜！', 回旋: '嘎吱嘎吱，转晕了……', 连击: '嘎、嘎吱！' },
    bounce: '铛！弹开了。',
    fizzle: '嘎吱？它歪着头，没听懂你在说什么。',
  }),
  preset({
    id: 'lava-crab',
    enrage: '咔咔咔！壳底下的岩浆翻上来了，烫死你！',
    name: '熔岩蟹卫',
    title: '沸泉之钳',
    intro: '咔咔。想过去？先让我烫一烫。',
    farewell: '咔……原来我的火，照在别人身上是这个样子。',
    victory: '咔咔。熟了。',
    lore: '熔岩蟹卫住在海底沸泉的出口。它的壳每一百年换一次，旧壳留在泉边，成了其他小生物的房子。',
    modelSet: 8,
    hp: 14,
    strike: 3,
    unleash: 8,
    pattern: ['charge', 'strike', 'fortify', 'strike', 'strike', 'heal'],
    weak: ['反射', '吸附'],
    heal: 2,
    resist: ['灼烧'],
    resistLine: '咔咔！火？我就是火做的。',
    blind: ['跃击'],
    secret: { words: ['冰', '雪', '冷', '冻', '凉'], damage: 4, effect: 'nocharge', fromOrigin: true },
    riddles: [
      { id: 'weak', text: '它的钳子能烫穿一切，却从没见过自己的倒影。', solved: '它的火被照了回去——它第一次被自己烫到！' },
      { id: 'blind', text: '钳子只会往前夹，头顶是空的。', solved: '从头顶落下来的那一脚，它根本夹不到！' },
      { id: 'secret', text: '沸泉的主人，最怕一口冷气。', solved: '冷气灌进了沸泉——它再也攒不起火了！' },
    ],
    moves: {
      strike: { word: '烫钳', line: '滚烫的钳子夹过来了。' },
      charge: { word: '沸腾', line: '泉水在它身下沸腾起来。下一下会烫穿一切——除非打断它。' },
      unleash: { word: '熔流', line: '整股熔岩泼了过来！硬挡只能挡住一半。' },
      fortify: { word: '缩壳', line: '它把自己缩进岩壳，普通的打击会被弹开。' },
      heal: { word: '泡泉', line: '它钻进沸泉，壳上的裂缝在冒泡愈合。打断它！' },
    },
    reactions: { 反射: '咔！好烫……是我自己的火？', 吸附: '咔咔！钳子被缠住了！', 穿刺: '咔！壳裂了一道！' },
    bounce: '咔咔，岩壳硬着呢。',
    fizzle: '咔？泡泡太多，它没听清。',
  }),
  preset({
    id: 'kelp-deer',
    enrage: '沙沙沙沙——整片森林都醒了，它不会再客气。',
    name: '海草齿轮鹿',
    title: '森林的看门人',
    intro: '沙沙……森林不喜欢陌生的脚步。',
    farewell: '沙沙……你带走的那一截，会长成新的海草吧。',
    victory: '沙沙。森林会记住你的形状。',
    lore: '海草齿轮鹿是一片海底森林的心脏。它的齿轮每转一圈，森林就长高一寸。',
    modelSet: 10,
    hp: 16,
    strike: 3,
    unleash: 7,
    pattern: ['strike', 'heal', 'charge', 'strike', 'heal', 'fortify'],
    weak: ['灼烧', '吞噬'],
    resist: ['穿刺'],
    resistLine: '沙沙，海草软软的，扎不透。',
    blind: ['潜行'],
    secret: { words: ['镰', '刀', '剪', '割', '砍'], damage: 3, effect: 'noheal', fromOrigin: true },
    riddles: [
      { id: 'weak', text: '海草长得再快，也快不过一把火、一张饿嘴。', solved: '海草烧焦了——它长回来的速度赶不上了！' },
      { id: 'blind', text: '长长的角只顾着往前顶。', solved: '它转不过身来，身后全是破绽！' },
      { id: 'secret', text: '森林最怕的，是一把磨快的镰刀。', solved: '海草被齐根割断——它再也长不回来了！' },
    ],
    moves: {
      strike: { word: '顶角', line: '齿轮角低了下来，要顶过来了。' },
      charge: { word: '转轮', line: '齿轮越转越快。下一下会很重——除非打断它。' },
      unleash: { word: '冲撞', line: '整头鹿冲了过来！硬挡只能挡住一半。' },
      fortify: { word: '盘根', line: '海草缠成一团护住身体，普通的打击会被弹开。' },
      heal: { word: '生长', line: '海草从它身上重新长出来。打断它，它就长不回来。' },
    },
    reactions: { 灼烧: '沙沙沙！海草着火了！', 吞噬: '沙……别啃我的叶子！' },
    bounce: '沙沙，海草把力气都吸走了。',
    fizzle: '沙沙……它听着像风吹过海草。',
  }),
  preset({
    id: 'mantis',
    enrage: '啪啪啪！拳头快得看不见了。',
    name: '螳螂虾刃卫',
    title: '最快的拳头',
    intro: '啪！你慢了。',
    farewell: '啪……原来被缠住，是这种感觉。',
    victory: '啪。下一个。',
    lore: '螳螂虾刃卫出拳的速度比子弹还快，拳风会让海水沸腾。它一生都在找一块打不碎的壳。',
    modelSet: 7,
    hp: 15,
    strike: 3,
    unleash: 8,
    pattern: ['strike', 'strike', 'charge', 'strike', 'fortify', 'strike'],
    weak: ['吸附', '震慑'],
    resist: ['迅捷'],
    resistLine: '啪！比快？你还差得远。',
    blind: ['跃击'],
    secret: { words: ['祈祷', '合十', '拜', '许愿'], damage: 3, effect: 'stun', fromOrigin: true },
    riddles: [
      { id: 'weak', text: '拳头再快，被缠住了也挥不出去；一声大吼，它就会眨眼。', solved: '它的拳头被牢牢缠住——再快也没用了！' },
      { id: 'blind', text: '它的复眼看得见四周，就是看不见头顶。', solved: '从头顶落下的一脚，它的复眼没看到！' },
      { id: 'secret', text: '双手合十的时候，它以为自己在祈祷。', solved: '它不由自主地合起了双拳——愣在原地一动不动！' },
    ],
    moves: {
      strike: { word: '快拳', line: '它的拳头已经在路上了。想跑？它比你快。' },
      charge: { word: '蓄拳', line: '它把拳头收到身后。下一拳会打碎贝壳——除非打断它。' },
      unleash: { word: '碎壳', line: '一拳打碎一切！硬挡只能挡住一半。' },
      fortify: { word: '收刃', line: '它把刃足护在身前，普通的打击会被弹开。' },
    },
    reactions: { 吸附: '啪？！放、放开！', 震慑: '啪！吓我一跳！' },
    bounce: '啪，刃足挡住了。',
    fizzle: '啪？它忙着出拳，没空听你说话。',
  }),
  preset({
    id: 'lizard',
    enrage: '嘶嘶——熔炉的门被踢开了，火直往外冒。',
    name: '火山蜥蜴',
    title: '熔炉的守夜人',
    intro: '嘶——熔炉很久没有客人了。',
    farewell: '嘶……天黑了，我也该睡了。',
    victory: '嘶——添进熔炉里吧。',
    lore: '火山蜥蜴守着海底最后一座活火山。它积攒力气的时候会屏住呼吸，任何一声巨响都会让它破功。',
    modelSet: 18,
    hp: 20,
    strike: 4,
    unleash: 8,
    pattern: ['fortify', 'strike', 'fortify', 'charge', 'strike', 'heal'],
    weak: ['穿刺', '回旋'],
    resist: ['灼烧', '连击'],
    resistLine: '嘶……挠痒痒吗？',
    blind: ['潜行'],
    secret: { words: ['阴', '影', '云', '夜', '月亮', '天黑'], damage: 4, effect: 'rust', fromOrigin: true },
    riddles: [
      { id: 'weak', text: '熔岩鳞片挡得住火和拳头，挡不住一根针、一阵旋风。', solved: '针扎进了鳞片的缝——它的熔鳞裂开了！' },
      { id: 'blind', text: '它晒太阳的时候，从不看身后。', solved: '它还在晒太阳，根本没发现你绕到了背后！' },
      { id: 'secret', text: '太阳一落山，它的鳞片就会变冷。', solved: '天色暗了下来——它的鳞片冷得合不拢了！' },
    ],
    moves: {
      strike: { word: '甩尾', line: '滚烫的尾巴甩了过来。' },
      charge: { word: '屏息', line: '它屏住呼吸，火光在喉咙里越积越亮——除非打断它。' },
      unleash: { word: '喷焰', line: '一整口火喷了过来！硬挡只能挡住一半。' },
      fortify: { word: '伏鳞', line: '它把熔鳞一片片竖起来，普通的打击会被弹开。' },
      heal: { word: '泡熔岩', line: '它钻进熔岩，鳞片又变得通红。打断它！' },
    },
    reactions: { 穿刺: '嘶！鳞片缝里好疼！', 回旋: '嘶嘶，头晕……' },
    bounce: '嘶，熔鳞挡住了。',
    fizzle: '嘶？太热了，它听不清。',
  }),
  preset({
    id: 'old-dino',
    enrage: '呵……好久没人把我逼到这一步了。认真一点吧。',
    name: '帽檐古龙',
    title: '海沟最深处',
    intro: '呵呵。走了这么远，就为了见我这个老家伙？',
    farewell: '呵呵……海沟的尽头，终于有新的故事了。',
    victory: '呵呵。再长大一点，再来吧。',
    lore: '帽檐古龙比海沟还老。它的帽子是从海面上漂下来的，它戴上以后就再也没摘过，说是要留着见第一个走到这里的访客。',
    modelSet: 12,
    hp: 22,
    strike: 5,
    unleash: 9,
    pattern: ['charge', 'strike', 'fortify', 'heal', 'charge', 'strike'],
    weak: ['震慑', '穿刺'],
    resist: ['坚壳'],
    resistLine: '呵呵，这壳挡不住我这把老骨头。',
    blind: ['跃击'],
    secret: { words: ['帽', '化石', '博物馆', '骨头'], damage: 5, effect: 'stun', fromOrigin: true },
    riddles: [
      { id: 'weak', text: '它耳朵不好，最怕突然一声大吼；帽檐挡得住阳光，挡不住一根针。', solved: '那一声吼把它吓了一跳——老家伙的破绽露出来了！' },
      { id: 'blind', text: '帽檐太宽，它看不见头顶。', solved: '它压低帽檐，根本没看见你从头顶落下来！' },
      { id: 'secret', text: '别碰它的帽子，也别提「化石」这两个字。', solved: '它愣住了，扶着帽子想了很久很久……' },
    ],
    moves: {
      strike: { word: '踩', line: '它抬起古爪，慢慢踩下来。' },
      charge: { word: '回忆', line: '它闭上眼，在回忆年轻的时候。下一下会很重——除非打断它。' },
      unleash: { word: '远古', line: '一整座海沟的重量压了下来！硬挡只能挡住一半。' },
      fortify: { word: '压帽', line: '它压低帽檐缩起身子，普通的打击会被弹开。' },
      heal: { word: '打盹', line: '它打了个盹，身上的伤慢慢合拢。叫醒它！' },
    },
    reactions: { 震慑: '呵！吓我一跳……', 穿刺: '呵呵，好久没这么疼了。' },
    bounce: '呵呵，苔甲厚着呢。',
    fizzle: '呵？年纪大了，没听清。',
  }),
];

export function presetGuard(id: string): DuelGuardDef | undefined {
  return PRESET_GUARDS.find(g => g.id === id);
}

/* ------------------------------------------------------------------ */
/* 亡者守卫：死去的造物用自己的话回到海沟里                               */
/* ------------------------------------------------------------------ */

/** 每类词最怕什么。 */
const COUNTER: Record<Keyword, Keyword> = {
  灼烧: '反射',
  穿刺: '回旋',
  连击: '震慑',
  震慑: '穿刺',
  吞噬: '灼烧',
  坚壳: '穿刺',
  反射: '吞噬',
  再生: '灼烧',
  膨胀: '穿刺',
  蓄能: '震慑',
  迅捷: '吸附',
  潜行: '回旋',
  跃击: '吸附',
  吸附: '跃击',
  回旋: '连击',
};
const FEAR: Record<Keyword, string> = {
  灼烧: '一把火',
  穿刺: '一针扎进去',
  连击: '连着打好几下',
  震慑: '冲它大吼一声',
  吞噬: '一口咬住',
  坚壳: '一层硬壳',
  反射: '被照回去的招',
  再生: '慢慢长好的伤',
  膨胀: '鼓起来的身体',
  蓄能: '憋着的一口气',
  迅捷: '比它更快的脚',
  潜行: '看不见的影子',
  跃击: '跳起来的一脚',
  吸附: '被牢牢缠住',
  回旋: '绕着它转圈',
};

export const GHOST_PREFIX = 'ghost:';

export function ghostId(creatureId: string) {
  return GHOST_PREFIX + creatureId;
}

function short(text: string, n = 4) {
  const chars = [...text.replace(/[「」“”"'，。、！？\s]/g, '')];
  return chars.slice(0, n).join('') || '……';
}

/** 把一只长眠的造物变成守卫：它的招式是你写过的话，谜语藏在它的原话里。 */
export function ghostGuard(save: GameSave, creature: CreatureRecord): DuelGuardDef {
  const parts = creatureParts(save, creature);
  const kw = (i: number) => parts[i].trait.keywords[0];
  const quote = (i: number) => parts[i].trait.reasons.find(r => r.keyword === kw(i))?.quote ?? parts[i].name;
  const all = parts.flatMap(p => p.trait.keywords);
  const pattern: PatternMove[] = ['strike', 'charge', 'fortify', 'strike'];
  if (all.some(k => k === '再生' || k === '吞噬')) pattern.push('heal');
  if (all.some(k => k === '坚壳' || k === '膨胀')) pattern.push('fortify');
  if (all.some(k => k === '迅捷' || k === '连击')) pattern.push('strike');
  if (all.includes('蓄能')) pattern.push('charge');
  const weak = [...new Set([COUNTER[kw(0)], COUNTER[kw(1)]])];
  const legsKw = kw(2);
  const blind: Keyword[] = legsKw === '潜行' ? ['回旋', '吸附'] : ['潜行', '跃击'];
  const words = [...new Set(parts.flatMap(p => p.trait.reasons.map(r => r.quote)).filter(q => [...q].length >= 2 && creature.origin.includes(q)))];
  if ([...creature.name].length >= 2) words.push(creature.name);
  const marks = parts.reduce((n, p) => n + p.level, 0);
  const epitaph = creature.epitaph ?? '它安静地睡在海沟里。';
  return {
    id: ghostId(creature.id),
    kind: 'ghost',
    fromCreatureId: creature.id,
    name: `${creature.name}的残影`,
    title: `第 ${creature.generation} 代 · 已长眠`,
    intro: epitaph,
    farewell: '……谢谢你，还记得我是从哪句话里出生的。',
    victory: '你也会变成我这样的。',
    lore: `它诞生于「${creature.origin}」。${epitaph}`,
    models: parts.map(p => p.model.url) as DuelGuardDef['models'],
    rotations: parts.map(p => p.model.rotation) as DuelGuardDef['rotations'],
    tints: partTints(parts),
    hp: 14 + Math.min(4, creature.wins) + marks,
    strike: 3 + Math.min(2, Math.floor(creature.wins / 2)),
    unleash: 7 + Math.min(2, Math.floor(creature.wins / 2)),
    heal: 3,
    pattern,
    weak,
    resist: [kw(0)],
    blind,
    secret: { words, damage: 4, effect: 'stun', fromOrigin: false },
    riddles: [
      { id: 'weak', text: `它靠「${quote(0)}」活着，却最怕${FEAR[weak[0]]}。`, solved: `它生前没想到的破绽，被你找到了。` },
      {
        id: 'blind',
        text: legsKw === '潜行' ? '它自己就擅长躲，最怕被人绕着转、被缠住。' : '它生前只顾着往前冲，从不回头。',
        solved: '它回不过头来——就像它倒下的那一天。',
      },
      { id: 'secret', text: '它还记得自己出生时的那句话。', solved: '你念出了它原话里的字——它愣住了，好像想起了什么。' },
    ],
    moves: {
      strike: { word: short(quote(0)), line: `它用你当初写下的「${quote(0)}」扑了过来。` },
      charge: { word: '回想', line: '它在回想自己的那句话……下一下会很重，除非打断它。' },
      unleash: { word: short(quote(1)), line: `「${quote(1)}」——它把整句话砸了过来！硬挡只能挡住一半。` },
      fortify: { word: '蜷缩', line: `它蜷成一团，用「${quote(1)}」护住自己。普通的打击会被弹开。` },
      heal: { word: '愈合', line: '它身上的裂缝在慢慢合拢。打断它，它就长不回来。' },
      stunned: STUNNED,
    },
    reactions: {},
    bounce: '它不肯松开……普通的打击被弹开了。',
    fizzle: '它看着你，好像认得你，又好像不认得。',
    enrage: '它的影子晃得更厉害了，像是想起了什么很痛的事。',
    resistLine: `「${quote(0)}」是它自己的招，对它没用。`,
  };
}

/** 这只造物可能遇到的所有守卫：预设守卫 + 所有长眠造物的残影（不含它自己）。 */
export function guardPool(save: GameSave, creature?: CreatureRecord): DuelGuardDef[] {
  const ghosts = save.creatures
    .filter(c => c.status === 'fallen' && c.id !== creature?.id)
    .sort((a, b) => (b.fallenAt ?? 0) - (a.fallenAt ?? 0))
    .map(c => ghostGuard(save, c));
  return [...PRESET_GUARDS, ...ghosts];
}

/**
 * 下一位守卫：沿着预设守卫一位一位往下打；每赢一场之后，
 * 如果海沟里有还没打过的亡者守卫，就轮到它登场。全部打过之后，挑被击败次数最少的再战（它会更强）。
 */
export function nextDuelGuard(save: GameSave, creature: CreatureRecord): DuelGuardDef {
  const defeated = new Set(creature.defeated ?? []);
  const ghosts = guardPool(save, creature).filter(g => g.kind === 'ghost' && !defeated.has(g.id));
  const preset = PRESET_GUARDS.find(g => !defeated.has(g.id));
  if (ghosts.length && creature.wins % 2 === 1) return ghosts[0];
  if (preset) return preset;
  if (ghosts.length) return ghosts[0];
  return [...PRESET_GUARDS].sort((a, b) => (save.guardDefeats[a.id] ?? 0) - (save.guardDefeats[b.id] ?? 0))[0];
}

/** 根据编号找回一位守卫（预设或残影）。 */
export function findDuelGuard(save: GameSave, id: string): DuelGuardDef | undefined {
  const p = presetGuard(id);
  if (p) return p;
  if (!id.startsWith(GHOST_PREFIX)) return undefined;
  const c = findCreature(save, id.slice(GHOST_PREFIX.length));
  return c && c.status === 'fallen' ? ghostGuard(save, c) : undefined;
}
