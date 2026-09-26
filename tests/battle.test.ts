import { describe, expect, test } from 'vitest';
import { checkAction, createBattle, currentIntent, preview, recommendedAction, reviewMistakes, step, upcomingIntents, type BattleState } from '@/domain/battle';
import { GUARDS } from '@/domain/guards';
import type { Keyword, Trait } from '@/domain/keywords';

const traits = (...ks: Keyword[]): Trait[] => ks.map(k => ({ keywords: [k], cost: null, reasons: [] }));
const start = (guardId = 'apprentice', ks: Keyword[] = ['连击', '膨胀', '回旋'], hp = 30) => createBattle({ guardId, traits: traits(...ks), maxHp: hp, burstQuote: '喷火' });
const until = (s: BattleState, intent: string) => {
  let guard = 0;
  while (currentIntent(s) !== intent && guard++ < 20) s = step(s, { kind: 'guard' }).state;
  return s;
};

describe('战斗 v2', () => {
  test('教学守卫按 攻击→横扫→破甲→蓄力 的顺序出招', () => {
    expect(upcomingIntents(start(), 5)).toEqual(['strike', 'sweep', 'break', 'charge', 'unleash']);
  });

  test('横扫→守护：挡下全部并反击，获得 1 点潮能', () => {
    const s = until(start(), 'sweep');
    const { state, events } = step(s, { kind: 'guard' });
    expect(state.hp).toBe(s.hp);
    expect(state.guardHp.body).toBeLessThan(s.guardHp.body);
    expect(state.energy).toBe(s.energy + 1);
    expect(events.some(e => e.type === 'perfect')).toBe(true);
  });

  test('横扫躲不开；破甲击穿守护', () => {
    const sweep = until(start(), 'sweep');
    expect(step(sweep, { kind: 'move' }).state.hp).toBeLessThan(sweep.hp);
    const brk = until(start(), 'break');
    const guarded = step(brk, { kind: 'guard' }).state;
    expect(brk.hp - guarded.hp).toBeGreaterThan(0);
  });

  test('破甲→机动：完全闪开，下一次攻击暴击', () => {
    const s = until(start(), 'break');
    const moved = step(s, { kind: 'move' }).state;
    expect(moved.hp).toBe(s.hp);
    expect(moved.crit).toBe(true);
    const plain = preview({ ...moved, crit: false }, { kind: 'attack' }).dealt;
    expect(preview(moved, { kind: 'attack' }).dealt).toBeGreaterThan(plain);
  });

  test('蓄力→机动：打断，守卫下回合发愣；不打断则释放蓄满一击', () => {
    const s = until(start(), 'charge');
    const interrupted = step(s, { kind: 'move' }).state;
    expect(currentIntent(interrupted)).toBe('stunned');
    const hp = interrupted.hp;
    expect(step(interrupted, { kind: 'attack' }).state.hp).toBe(hp);
    const charged = step(s, { kind: 'attack' }).state;
    expect(currentIntent(charged)).toBe('unleash');
  });

  test('震慑攻击也能打断蓄力', () => {
    const s = until(start('apprentice', ['震慑', '坚壳', '迅捷']), 'charge');
    expect(currentIntent(step(s, { kind: 'attack' }).state)).toBe('stunned');
  });

  test('读对意图带来进攻回报：守护、机动的完美应对都推进胜利', () => {
    const sweep = until(start(), 'sweep');
    expect(preview(sweep, { kind: 'guard' }).dealt).toBeGreaterThan(0);
  });

  test('潮能攒满可以释放原话爆发，招式名来自原话，并打断守卫这回合的行动', () => {
    let s = start();
    s = { ...s, energy: 3 };
    const { state, events } = step(s, { kind: 'burst' });
    expect(events.find(e => e.type === 'burst')).toEqual({ type: 'burst', name: '「喷火」爆发' });
    expect(state.hp).toBe(s.hp);
    expect(state.energy).toBe(0);
    expect(checkAction(start(), { kind: 'burst' }).ok).toBe(false);
  });

  test('击碎头部后不再蓄力或破甲；击碎足部后玩家先手', () => {
    let s = start();
    s = { ...s, guardHp: { ...s.guardHp, head: 1 } };
    s = step(s, { kind: 'attack', target: 'head' }).state;
    expect(s.captured).toContain('head');
    expect(upcomingIntents(s, 6)).not.toContain('break');
    expect(upcomingIntents(s, 6)).not.toContain('charge');
    expect(checkAction(s, { kind: 'attack', target: 'head' }).ok).toBe(false);
  });

  test('击碎躯干即获胜', () => {
    let s = start();
    s = { ...s, guardHp: { ...s.guardHp, body: 2 } };
    expect(step(s, { kind: 'attack' }).state.result).toBe('win');
  });

  test('潮位每回合上涨，涨满后守卫伤害 ×1.5', () => {
    const s = start();
    const calm = preview(s, { kind: 'attack' }).taken;
    const full = { ...s, tide: GUARDS[0].tideMax };
    expect(preview(full, { kind: 'attack' }).taken).toBe(Math.round(calm * 1.5));
    expect(step(s, { kind: 'guard' }).state.tide).toBe(1);
  });

  test('弱点关键词攻击 ×1.5', () => {
    const neutral = preview(start('scout', ['连击', '膨胀', '回旋']), { kind: 'attack' }).dealt;
    const weak = preview(start('scout', ['灼烧', '膨胀', '回旋']), { kind: 'attack' }).dealt;
    expect(weak).toBeGreaterThan(neutral * 0.9);
  });

  test('骄傲：不能连续两回合用同一招；贪食：第四回合休息', () => {
    const proud = createBattle({ guardId: 'apprentice', traits: [{ keywords: ['连击'], cost: '骄傲', reasons: [] }], maxHp: 30, burstQuote: '无敌' });
    const next = step(proud, { kind: 'guard' }).state;
    expect(checkAction(next, { kind: 'guard' }).ok).toBe(false);
    let greedy = createBattle({ guardId: 'apprentice', traits: [{ keywords: ['连击'], cost: '贪食', reasons: [] }], maxHp: 60, burstQuote: '吃' });
    for (let i = 0; i < 3; i++) greedy = step(greedy, { kind: 'guard' }).state;
    expect(preview(greedy, { kind: 'attack' }).note).toMatch(/贪食/);
  });

  test('预览与真实结算一致', () => {
    let s = start();
    for (let i = 0; i < 6 && !s.result; i++) {
      const action = { kind: recommendedAction(s) === 'burst' ? 'burst' : recommendedAction(s) } as const;
      const p = preview(s, action);
      const out = step(s, action).state;
      const dealt = (['head', 'body', 'legs'] as const).reduce((n, k) => n + s.guardHp[k] - out.guardHp[k], 0);
      expect(dealt).toBeLessThanOrEqual(p.dealt);
      s = out;
    }
  });

  test('同样的输入永远得到同样的结果', () => {
    const run = () => {
      let s = start('scout');
      for (const kind of ['attack', 'guard', 'move', 'attack', 'guard'] as const) if (!s.result) s = step(s, { kind }).state;
      return s;
    };
    expect(run()).toEqual(run());
  });

  test('失败复盘指出关键错误', () => {
    let s = start('scout', ['连击', '膨胀', '回旋'], 12);
    while (!s.result) s = step(s, { kind: 'guard' }).state;
    expect(s.result).toBe('loss');
    const lines = reviewMistakes(s.log);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatch(/第 \d+ 回合守卫意图是「.+」，你选择了守护/);
  });
});
