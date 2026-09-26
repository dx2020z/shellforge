/**
 * 关键词是「文字即血肉」的最小单位：玩家原话里的词，被映射成槽位能力。
 * 这里定义词表、颜色、本地（离线）映射规则，以及本地映射时使用的理由文案。
 *
 * 理由文案约定：一律能直接接在「因为你写了「{原话片段}」，」后面读通，
 * 不复述关键词名，不使用任何引号。全游戏引号统一用「」。
 */

export type Slot = 'head' | 'body' | 'legs';
export const SLOTS: readonly Slot[] = ['head', 'body', 'legs'];
export const SLOT_NAMES: Record<Slot, string> = { head: '首', body: '躯', legs: '足' };
export const SLOT_LONG_NAMES: Record<Slot, string> = { head: '头部', body: '躯干', legs: '腿足' };

export const KEYWORDS = {
  head: ['灼烧', '穿刺', '连击', '震慑', '吞噬'],
  body: ['坚壳', '反射', '再生', '膨胀', '蓄能'],
  legs: ['迅捷', '潜行', '跃击', '吸附', '回旋'],
} as const;
export type Keyword = (typeof KEYWORDS)[Slot][number];
export const ALL_KEYWORDS: readonly Keyword[] = [...KEYWORDS.head, ...KEYWORDS.body, ...KEYWORDS.legs];

export const COSTS = ['迟缓', '易燃', '骄傲', '脆壳', '贪食'] as const;
export type Cost = (typeof COSTS)[number];

export interface Reason {
  keyword: Keyword | Cost;
  /** 玩家原话里的连续片段，必须能在原话中逐字找到。 */
  quote: string;
  /** 接在「因为你写了「quote」，」之后的半句话。 */
  why: string;
}
export interface Trait {
  keywords: Keyword[];
  cost: Cost | null;
  reasons: Reason[];
}

export function isKeyword(value: unknown): value is Keyword {
  return typeof value === 'string' && (ALL_KEYWORDS as readonly string[]).includes(value);
}
export function isCost(value: unknown): value is Cost {
  return typeof value === 'string' && (COSTS as readonly string[]).includes(value);
}
export function keywordSlot(keyword: Keyword): Slot {
  return (KEYWORDS.head as readonly string[]).includes(keyword)
    ? 'head'
    : (KEYWORDS.body as readonly string[]).includes(keyword)
      ? 'body'
      : 'legs';
}
export function isSlotKeyword(value: unknown, slot: Slot): value is Keyword {
  return typeof value === 'string' && (KEYWORDS[slot] as readonly string[]).includes(value);
}

/** 关键词固定配色：头＝暖色系，躯＝薄荷系，足＝淡紫系；代价统一用熔岩橙描边。 */
export const KEYWORD_COLORS: Record<Keyword, string> = {
  灼烧: '#F2784B',
  穿刺: '#F2B544',
  连击: '#F79C7C',
  震慑: '#FFD98A',
  吞噬: '#EF7F9C',
  坚壳: '#9FF0D8',
  反射: '#8FE3F2',
  再生: '#B6EE9F',
  膨胀: '#6FD8B6',
  蓄能: '#D3F6C8',
  迅捷: '#C9B8FF',
  潜行: '#9C92EA',
  跃击: '#E2B9FF',
  吸附: '#B3A9DB',
  回旋: '#DCCEFF',
};
export const COST_COLOR = '#EE9A45';

export function keywordColor(keyword: Keyword | Cost): string {
  return isKeyword(keyword) ? KEYWORD_COLORS[keyword] : COST_COLOR;
}

/**
 * 关键词的一句话说明。战斗 v2 的最终数值在 P2 定稿，这里只写玩家能读懂的方向。
 */
export const KEYWORD_BLURBS: Record<Keyword, string> = {
  灼烧: '攻击会点燃目标，火焰在之后几回合持续灼痛。',
  穿刺: '攻击能钻进守卫固守时的甲缝。',
  连击: '攻击分成两下，更容易击碎受伤的部位。',
  震慑: '攻击能打断守卫的蓄力。',
  吞噬: '造成伤害时，吞下一部分化作生命。',
  坚壳: '守护时挡下更多伤害。',
  反射: '守护时，把挡下的力道送还一部分。',
  再生: '每回合缓缓愈合。',
  膨胀: '体型更大，生命上限更高。',
  蓄能: '守护后，下一次攻击更重。',
  迅捷: '总是抢在守卫之前行动。',
  潜行: '机动后，下一次攻击更致命。',
  跃击: '机动时顺势踢出一击。',
  吸附: '破甲也掀不开你的守护。',
  回旋: '机动时回复少量生命。',
};
export const COST_BLURBS: Record<Cost, string> = {
  迟缓: '总是比守卫慢一步。',
  易燃: '受到的灼烧加倍。',
  骄傲: '不肯连续两回合用同一招。',
  脆壳: '守护效果减半。',
  贪食: '每第四回合要停下来吃点东西。',
};

/* ------------------------------------------------------------------ */
/* 本地映射：没有 DeepSeek 时，用正则从原话里找词。                     */
/* ------------------------------------------------------------------ */

const KEYWORD_RULES: Record<Slot, [RegExp, Keyword][]> = {
  head: [
    [/喷火|火焰|熔岩|岩浆|火星|火|炎|焰|辣椒|烫/, '灼烧'],
    [/鸭嘴|鸟喙|喙|钻头|钻|尖角|独角|角|刺|针|钳|螯|獠牙|犀|牛/, '穿刺'],
    [/双头|多头|连环|连|快嘴|翅|拍打|啄/, '连击'],
    [/雷|吼|咆哮|震|叫|鸣|钟|铃|唱|很乖|乖|不还嘴|瞪|威风/, '震慑'],
    [/大嘴|牙|吞|咬|吃|嚼|泡泡|肥皂|鲸/, '吞噬'],
  ],
  body: [
    [/壳|甲|岩|石|恐龙|龙|龟|鳞|盔|铁/, '坚壳'],
    [/镜|反光|水晶|玻璃|珍珠|银/, '反射'],
    [/植物|苔|藓|糖|软|棉花|海绵|珊瑚|蘑菇|花/, '再生'],
    [/巨|胖|肥|大|圆滚滚|圆|毛茸茸|绒|泡沫|泡泡|肥皂|岛/, '膨胀'],
    [/电|雷|能|齿轮|发条|电池|发热|健身|肌肉/, '蓄能'],
  ],
  legs: [
    [/翼|风|快|疾|飞|兔|猴|豹|马|奔跑|跑|滑/, '迅捷'],
    [/影|暗|隐身|隐|雾|夜|猫|狐|毛茸茸|软绵绵|悄悄|轻/, '潜行'],
    [/跳|跃|弹簧|弹|蛙|踢/, '跃击'],
    [/吸盘|吸|黏|粘|章鱼|重|稳|锚/, '吸附'],
    [/旋|转|舞|尾巴|尾鳍|鱼尾|摆尾|浪/, '回旋'],
  ],
};

const COST_RULES: [RegExp, Cost, Slot][] = [
  [/无敌|神明|最强|无限|全能|宇宙第一/, '骄傲', 'head'],
  [/慢吞吞|懒洋洋|懒|笨重|慢/, '迟缓', 'legs'],
  [/纸|干草|稻草|木头|蜡/, '易燃', 'body'],
  [/易碎|薄薄|脆/, '脆壳', 'body'],
  [/贪吃|饿|馋|吃货/, '贪食', 'head'],
];

/** 每个关键词准备几句理由，按原话片段做稳定挑选，保证同一句话每次得到同样的理由。 */
const KEYWORD_WHYS: Record<Keyword, string[]> = {
  灼烧: ['它一开口就带着火星', '滚烫的气息能在铜甲上烙出印子', '这股热劲会一直烧到守卫心里'],
  穿刺: ['尖端总能找到甲片之间的缝', '它认准一个点就会一直钻下去', '再厚的壳也挡不住这一下'],
  连击: ['一下不够，它总要再补一下', '动作快得像两次心跳叠在一起', '一口气能啄出两道伤'],
  震慑: ['一声下去，守卫攒的力气就散了', '它的叫声能震得海水都在抖', '对手会先愣住半拍'],
  吞噬: ['咬下去的每一口都变成自己的力气', '它把对手的生命当成了点心', '吃到嘴里的就是赚到的'],
  坚壳: ['硬邦邦的外层能扛住正面冲撞', '它习惯把自己缩进最厚的那层里', '一身硬骨头，挨打也不吭声'],
  反射: ['撞上来的力道会被原样送回去', '光滑的表面让锋芒拐了个弯', '谁碰它，谁就先照见自己'],
  再生: ['伤口会像潮水退去一样慢慢合上', '柔软的身体总能自己长回来', '只要还活着，它就在悄悄愈合'],
  膨胀: ['庞大的身躯能多挨好几下', '它胖得连守卫都要多砍几刀', '体型本身就是一种护甲'],
  蓄能: ['挨过的每一击都被它攒成下一拳', '身体里一直有股劲在上弦', '越是忍耐，出手越重'],
  迅捷: ['守卫还没抬手，它已经动了', '它的第一步永远比别人快', '一眨眼就换了位置'],
  潜行: ['落地没有声音，出手才让人发现', '它总躲在对手看不见的那一侧', '藏起来的那一击最疼'],
  跃击: ['腾空的时候顺便就踢了出去', '每一次闪开都带着一脚', '弹起来的力道正好用来反击'],
  吸附: ['牢牢扒在地上，谁也掀不动', '重心低得像一块礁石', '破甲的冲击也没能把它拔起来'],
  回旋: ['转身的时候顺手把伤甩掉了', '绕着圈子躲开，还能喘口气', '一个回旋就把节奏拿了回来'],
};
const COST_WHYS: Record<Cost, string[]> = {
  骄傲: ['神明嫌同一招不够有排面，偏不连用', '太厉害的家伙不屑重复自己', '这么大的口气，总得付点代价'],
  迟缓: ['它做什么都要先慢慢想一想', '好脾气的代价是总比别人晚半拍'],
  易燃: ['干燥的身子一点就着', '火星溅上来就不好收拾了'],
  脆壳: ['好看的外壳经不起重击', '一碰就有裂纹，守护也打了折'],
  贪食: ['打着打着就要停下来找吃的', '肚子一饿，什么招式都忘了'],
};

function stableIndex(text: string, length: number): number {
  let hash = 2166136261;
  for (const ch of text) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return length ? hash % length : 0;
}

export function keywordWhy(keyword: Keyword, quote: string): string {
  const lines = KEYWORD_WHYS[keyword];
  return lines[stableIndex(quote + keyword, lines.length)];
}
export function costWhy(cost: Cost, quote: string): string {
  const lines = COST_WHYS[cost];
  return lines[stableIndex(quote + cost, lines.length)];
}

/** 用本地规则识别一个词（DeepSeek 返回同义词时也用它归一化）。 */
export function matchKeyword(text: string, slot: Slot): { keyword: Keyword; quote: string } | null {
  if (isSlotKeyword(text, slot)) return { keyword: text, quote: text };
  for (const [pattern, keyword] of KEYWORD_RULES[slot]) {
    const found = text.match(pattern);
    if (found) return { keyword, quote: found[0] };
  }
  return null;
}

const DEFAULT_KEYWORD: Record<Slot, Keyword> = { head: '连击', body: '膨胀', legs: '回旋' };
const DEFAULT_WHY: Record<Slot, string> = {
  head: '这股劲头化成了最朴素的本领：多打一下',
  body: '它把这句话整个装进了身体里',
  legs: '这份心意让它的步子轻快了一些',
};

/** 没有命中任何规则时，挑一个短片段作为引用：头取句首、躯取中段、足取句尾，三件不撞。 */
function fallbackQuote(text: string, slot: Slot): string {
  const clauses = text.split(/[，,。.！!？?、；;\s]+|的|但|又|还|和/).map(s => s.trim()).filter(Boolean);
  if (!clauses.length) return text.trim();
  const pick = slot === 'head' ? clauses[0] : slot === 'legs' ? clauses[clauses.length - 1] : clauses[Math.floor(clauses.length / 2)];
  const chars = [...pick];
  return chars.length <= 8 ? pick : chars.slice(-6).join('');
}

/** 单个槽位的本地映射。最多两个关键词；没有命中时给出一个默认能力，并如实标注来源。 */
export function mapSlotTraits(text: string, slot: Slot): Trait {
  const reasons: Reason[] = [];
  const keywords: Keyword[] = [];
  for (const [pattern, keyword] of KEYWORD_RULES[slot]) {
    if (keywords.length >= 2) break;
    const found = text.match(pattern);
    if (!found || keywords.includes(keyword)) continue;
    keywords.push(keyword);
    reasons.push({ keyword, quote: found[0], why: keywordWhy(keyword, found[0]) });
  }
  if (!keywords.length) {
    const keyword = DEFAULT_KEYWORD[slot];
    const quote = fallbackQuote(text, slot) || text;
    keywords.push(keyword);
    reasons.push({ keyword, quote, why: DEFAULT_WHY[slot] });
  }
  return { keywords, cost: null, reasons };
}

/**
 * 一句话造物的本地映射：三个槽位共用同一句话，但代价只结算一次，
 * 落在最合适的槽位上（骄傲、贪食在头，易燃、脆壳在躯，迟缓在足）。
 */
export function mapCreatureTraits(text: string): Record<Slot, Trait> {
  const result = {
    head: mapSlotTraits(text, 'head'),
    body: mapSlotTraits(text, 'body'),
    legs: mapSlotTraits(text, 'legs'),
  };
  for (const [pattern, cost, slot] of COST_RULES) {
    const found = text.match(pattern);
    if (!found) continue;
    result[slot].cost = cost;
    result[slot].reasons.push({ keyword: cost, quote: found[0], why: costWhy(cost, found[0]) });
    break;
  }
  return result;
}

/** 夸张描述：必须附带代价（DeepSeek 返回也按此校验）。 */
export const BOAST_PATTERN = /无敌|神明|最强|无限|全能|宇宙第一/;

/* ------------------------------------------------------------------ */
/* 彩蛋：特殊描述触发的隐藏效果。                                       */
/* ------------------------------------------------------------------ */

export type Secret = 'bubbles' | 'cat-stretch' | 'invincible';
const SECRET_RULES: [RegExp, Secret][] = [
  [/肥皂|泡泡/, 'bubbles'],
  [/猫/, 'cat-stretch'],
  [/无敌/, 'invincible'],
];
export function detectSecrets(text: string): Secret[] {
  return SECRET_RULES.filter(([pattern]) => pattern.test(text)).map(([, secret]) => secret);
}

/* ------------------------------------------------------------------ */
/* 工坊的幽默回应：空输入、乱码。                                       */
/* ------------------------------------------------------------------ */

export type InputVerdict =
  | { ok: true; text: string }
  | { ok: false; kind: 'empty' | 'gibberish' | 'too-long'; reply: string };

const EMPTY_REPLIES = [
  '海水等了一会儿，什么也没等到。写点什么吧，一个字也行。',
  '空白的贝壳孵不出东西。',
  '潮汐把你的沉默卷走了。再试一次？',
];
const GIBBERISH_REPLIES = [
  '海底的老螺号听了半天，说这像是章鱼踩过键盘。',
  '这串字符在水里冒了几个泡，然后沉下去了。换一句人话试试？',
  '锻炉闻了闻这句咒语，打了个喷嚏。',
];

export function judgeInput(raw: string, maxLength = 60): InputVerdict {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, kind: 'empty', reply: EMPTY_REPLIES[stableIndex(raw, EMPTY_REPLIES.length)] };
  if ([...text].length > maxLength) {
    return { ok: false, kind: 'too-long', reply: `锻炉只装得下 ${maxLength} 个字。挑最要紧的那几句留下吧。` };
  }
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const letters = text.match(/[a-z]/gi)?.length ?? 0;
  const vowelRatio = letters ? (text.match(/[aeiou]/gi)?.length ?? 0) / letters : 1;
  const repeated = /(.)\1{4,}/u.test(text);
  const noSense = han === 0 && (letters === 0 || vowelRatio < 0.15 || /^[\p{P}\p{S}\d\s]+$/u.test(text));
  if (repeated || noSense) {
    return { ok: false, kind: 'gibberish', reply: GIBBERISH_REPLIES[stableIndex(text, GIBBERISH_REPLIES.length)] };
  }
  return { ok: true, text };
}

/** 统一引号：把「」以外的中文引号全部换成「」，避免混用。 */
export function normalizeQuotes(text: string): string {
  let open = true;
  return text
    .replace(/[『“]/g, '「')
    .replace(/[』”]/g, '」')
    .replace(/"/g, () => {
      const mark = open ? '「' : '」';
      open = !open;
      return mark;
    });
}

/** 输入时的实时预览：只列出真正命中规则的词（不含兜底能力）。 */
export function liveMatches(text: string): { slot: Slot; keyword: Keyword | Cost; quote: string }[] {
  const out: { slot: Slot; keyword: Keyword | Cost; quote: string }[] = [];
  if (!text.trim()) return out;
  for (const slot of SLOTS) {
    let n = 0;
    for (const [pattern, keyword] of KEYWORD_RULES[slot]) {
      if (n >= 2) break;
      const found = text.match(pattern);
      if (!found || out.some(o => o.keyword === keyword)) continue;
      out.push({ slot, keyword, quote: found[0] });
      n++;
    }
  }
  for (const [pattern, cost, slot] of COST_RULES) {
    const found = text.match(pattern);
    if (!found) continue;
    out.push({ slot, keyword: cost, quote: found[0] });
    break;
  }
  return out;
}
