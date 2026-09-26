/**
 * 战斗平衡模拟：按第 4 节的验收目标输出结果表。
 * 策略：随机、贪心（每回合试遍所有行动，选即时收益最高的）、新手（70% 选推荐应对，30% 随机）。
 * 造物：每个槽位 1 个关键词，共 125 种组合，按对该守卫的克制关系分为克制型 / 中性 / 被克型。
 */
import { KEYWORDS, SLOTS, type Keyword, type Trait } from '../src/domain/keywords';
import { GUARDS } from '../src/domain/guards';
import { checkAction, createBattle, preview, recommendedAction, step, type BattleState, type PlayerAction } from '../src/domain/battle';

type Kind = 'counter' | 'neutral' | 'resisted';
type Policy = 'random' | 'greedy' | 'novice';

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const builds = KEYWORDS.head.flatMap(h => KEYWORDS.body.flatMap(b => KEYWORDS.legs.map(l => [h, b, l] as Keyword[])));
const traitsOf = (ks: Keyword[]): Trait[] => ks.map(k => ({ keywords: [k], cost: null, reasons: [] }));
const kindOf = (ks: Keyword[], weak: Keyword, resist: Keyword | null): Kind | null => {
  if (ks.includes(weak)) return resist && ks.includes(resist) ? null : 'counter';
  return resist && ks.includes(resist) ? 'resisted' : 'neutral';
};

function candidates(s: BattleState): PlayerAction[] {
  const all: PlayerAction[] = [{ kind: 'guard' }, { kind: 'move' }, ...SLOTS.map(t => ({ kind: 'attack' as const, target: t })), ...SLOTS.map(t => ({ kind: 'burst' as const, target: t }))];
  return all.filter(a => checkAction(s, a).ok);
}

function choose(s: BattleState, policy: Policy, r: () => number): PlayerAction {
  const legal = candidates(s);
  if (policy === 'random') return legal[Math.floor(r() * legal.length)];
  if (policy === 'novice') {
    if (r() < 0.7) {
      const kind = recommendedAction(s);
      const action: PlayerAction = { kind, target: 'body' };
      if (checkAction(s, action).ok) return action;
    }
    return legal[Math.floor(r() * legal.length)];
  }
  let best = legal[0], score = -Infinity;
  for (const a of legal) {
    const p = preview(s, a);
    const v = p.dealt * 1.3 - p.taken * 1.6 + (p.perfect ? 4 : 0) + (a.target === 'body' ? 0.5 : 0);
    if (v > score) { score = v; best = a; }
  }
  return best;
}

function play(guardId: string, ks: Keyword[], policy: Policy, seed: number) {
  const hp = 30 + (ks.includes('膨胀') ? 10 : 0);
  let s = createBattle({ guardId, traits: traitsOf(ks), maxHp: hp, burstQuote: ks[0] });
  const r = rng(seed);
  while (!s.result) s = step(s, choose(s, policy, r)).state;
  return { win: s.result === 'win', turns: s.turn - 1 };
}

const TARGETS: Record<string, Partial<Record<Policy, [number, number]>>> = {
  tutorial: { novice: [100, 100] },
  early: { novice: [70, 85], greedy: [90, 100] },
  late: { novice: [35, 55], greedy: [70, 85] },
};
const band = (depth: number) => (depth === 0 ? 'tutorial' : depth <= 2 ? 'early' : depth >= 5 ? 'late' : null);

const pct = (n: number) => `${n.toFixed(0).padStart(3)}%`;
let failures = 0;
const turnsAll: number[] = [];
console.log('守卫            | 中性 新手/贪心/随机 | 克制 新手/贪心 | 被克 新手/贪心 | 克制-被克(新手) | 平均回合');
for (const g of GUARDS) {
  const res: Record<Kind, Record<Policy, number>> = { counter: { random: 0, greedy: 0, novice: 0 }, neutral: { random: 0, greedy: 0, novice: 0 }, resisted: { random: 0, greedy: 0, novice: 0 } };
  const counts: Record<Kind, number> = { counter: 0, neutral: 0, resisted: 0 };
  const turns: number[] = [];
  for (const ks of builds) {
    const kind = kindOf(ks, g.weak, g.resist);
    if (!kind) continue;
    counts[kind]++;
    for (const policy of ['random', 'greedy', 'novice'] as Policy[]) {
      const seeds = policy === 'greedy' ? 1 : 8;
      let wins = 0;
      for (let i = 0; i < seeds; i++) {
        const out = play(g.id, ks, policy, g.depth * 1000 + i * 7 + 1);
        wins += Number(out.win);
        if (policy === 'novice') turns.push(out.turns);
      }
      res[kind][policy] += wins / seeds;
    }
  }
  const rate = (k: Kind, p: Policy) => (counts[k] ? (100 * res[k][p]) / counts[k] : NaN);
  const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
  turnsAll.push(avg);
  const gap = rate('counter', 'novice') - (counts.resisted ? rate('resisted', 'novice') : rate('neutral', 'novice'));
  const flags: string[] = [];
  const b = band(g.depth);
  if (b) for (const [p, [lo, hi]] of Object.entries(TARGETS[b]) as [Policy, [number, number]][]) {
    const v = rate('neutral', p);
    if (v < lo || v > hi) flags.push(`中性${p === 'novice' ? '新手' : '贪心'} ${v.toFixed(0)}% 不在 ${lo}–${hi}%`);
  }
  if (g.depth > 0 && gap < 30) flags.push(`克制差 ${gap.toFixed(0)} < 30`);
  if (g.depth > 0 && (avg < 5 || avg > 8)) flags.push(`平均回合 ${avg.toFixed(1)}`);
  failures += flags.length;
  const name = `${g.depth} ${g.name}`.padEnd(12, '　');
  const resisted = counts.resisted ? `${pct(rate('resisted', 'novice'))}/${pct(rate('resisted', 'greedy'))}` : '    —    ';
  console.log(`${name} | ${pct(rate('neutral', 'novice'))}/${pct(rate('neutral', 'greedy'))}/${pct(rate('neutral', 'random'))} | ${pct(rate('counter', 'novice'))}/${pct(rate('counter', 'greedy'))} | ${resisted} | ${gap.toFixed(0).padStart(4)} | ${avg.toFixed(1)}${flags.length ? '  ⚠ ' + flags.join('；') : ''}`);
}
console.log(failures ? `\n${failures} 项未达标` : '\n全部达标');
if (failures) process.exitCode = 1;
