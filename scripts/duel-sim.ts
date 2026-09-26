/**
 * 写字对决平衡模拟：每位预设守卫 × 几种典型造物 × 三种玩家。
 *   naive  —— 按顺序点话语卡，不看意图
 *   smart  —— 看意图出招（打断蓄力 / 躲重击 / 用弱点打合甲），会用墨水写弱点词
 *   expert —— 再加上一开场就写出守卫的秘密
 * 用法：npx tsx scripts/duel-sim.ts
 */
import { createDuel, currentMove, stepDuel, type DuelAction, type DuelState } from '@/domain/duel';
import { PRESET_GUARDS } from '@/domain/duel-guards';
import { mapCreatureTraits, SLOTS } from '@/domain/keywords';

const WORD: Record<string, string> = { 灼烧: '喷火', 穿刺: '一针扎进去', 回旋: '绕着它转', 震慑: '大吼一声', 吞噬: '咬一口', 吸附: '缠住它', 反射: '用镜子照', 跃击: '跳起来踢', 潜行: '绕到背后', 连击: '连打两下' };
const ORIGINS = ['会喷火、背着硬壳、跑得飞快的螃蟹', '一只毛茸茸、很乖、从不还嘴的健身牛', '会唱歌的蘑菇', '像棉花糖一样软但跑得飞快的兔子', '长着吸盘、会吐墨的章鱼'];
type Mode = 'naive' | 'smart' | 'expert';

function play(guardIndex: number, origin: string, mode: Mode, levels: Record<string, number> = {}, tier = 0) {
  const g = PRESET_GUARDS[guardIndex];
  const t = mapCreatureTraits(origin);
  const marks = Object.values(levels).reduce((a, b) => a + b, 0);
  let s: DuelState = createDuel({ guard: g, origin, tier, marks, reasons: SLOTS.flatMap(slot => t[slot].reasons.map(r => ({ slot, keyword: r.keyword, quote: r.quote, level: levels[slot] ?? 0 }))) });
  const card = (kw: string) => s.cards.find(c => c.keyword === kw && !c.used);
  const pick = (...k: string[]) => k.filter(x => !g.resist.includes(x as never)).map(card).find(Boolean);
  for (let i = 0; i < 40 && !s.result; i++) {
    let a: DuelAction = { kind: 'basic' };
    const m = currentMove(s);
    if (mode === 'naive') {
      const c = s.cards.find(c => !c.used);
      if (c) a = { kind: 'card', cardId: c.id };
    } else if (mode === 'expert' && !s.rusted && s.ink) {
      a = { kind: 'write', text: g.secret.words[0] };
    } else if (m === 'charge' || m === 'heal') {
      const c = pick('震慑', '跃击');
      a = c ? { kind: 'card', cardId: c.id } : s.ink ? { kind: 'write', text: '大吼一声' } : a;
    } else if (m === 'unleash' || m === 'strike') {
      const c = pick('迅捷', '潜行', '坚壳', '反射');
      if (c) a = { kind: 'card', cardId: c.id };
      else if (s.ink && m === 'unleash') a = { kind: 'write', text: g.resist.includes('潜行') ? '缩进壳里' : '绕到背后' };
      else {
        const at = pick(...g.weak, '灼烧', '穿刺', '连击', '回旋', '吞噬', '吸附');
        if (at) a = { kind: 'card', cardId: at.id };
      }
    } else {
      const at = pick(...g.weak, '穿刺', '回旋', '灼烧');
      a = at ? { kind: 'card', cardId: at.id } : s.ink ? { kind: 'write', text: WORD[g.weak[0]] ?? '喷火' } : a;
    }
    s = stepDuel(s, a).state;
  }
  return s;
}

for (const [i, g] of PRESET_GUARDS.entries()) {
  const stats: Record<Mode, { wins: number; turns: number[] }> = { naive: { wins: 0, turns: [] }, smart: { wins: 0, turns: [] }, expert: { wins: 0, turns: [] } };
  for (const o of ORIGINS)
    for (const mode of ['naive', 'smart', 'expert'] as Mode[]) {
      const s = play(i, o, mode);
      if (s.result === 'win') stats[mode].wins++;
      stats[mode].turns.push(s.turn - 1);
    }
  const f = (m: Mode) => `${m} ${stats[m].wins}/${ORIGINS.length}胜 平均${(stats[m].turns.reduce((a, b) => a + b, 0) / ORIGINS.length).toFixed(1)}回合`;
  console.log(`${String(i + 1)}. ${g.name.padEnd(6, '　')} ${f('naive')} · ${f('smart')} · ${f('expert')}`);
}

console.log('\n连战（每赢一场给头部加一道印记，看会读意图的玩家能走多远）：');
for (const o of ORIGINS) {
  const levels: Record<string, number> = {};
  let reached = 0;
  for (let i = 0; i < PRESET_GUARDS.length; i++) {
    const s = play(i, o, 'smart', levels);
    if (s.result !== 'win') break;
    reached++;
    const slot = SLOTS[i % 3];
    levels[slot] = Math.min(5, (levels[slot] ?? 0) + 1);
  }
  console.log(`  ${o.slice(0, 10).padEnd(10, '　')} 连胜 ${reached} / ${PRESET_GUARDS.length}`);
}
