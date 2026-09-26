import { describe, expect, test } from 'vitest';
import { createDuel, currentMove, readPhrase, stepDuel, type DuelAction, type DuelState } from '@/domain/duel';
import { mapCreatureTraits, SLOTS } from '@/domain/keywords';
import { PRESET_GUARDS, presetGuard, ghostGuard, nextDuelGuard, guardPool } from '@/domain/duel-guards';

const setup = (origin: string) => {
  const traits = mapCreatureTraits(origin);
  const reasons = SLOTS.flatMap(slot => traits[slot].reasons.map(r => ({ slot, keyword: r.keyword, quote: r.quote })));
  return createDuel({ guard: presetGuard('scout')!, origin, reasons });
};
const card = (s: DuelState, kw: string) => s.cards.find(c => c.keyword === kw && !c.used);

describe('写字对决', () => {
  test('原话里读懂的词变成话语卡，每张只能用一次', () => {
    const s = setup('会喷火、背着硬壳、跑得飞快的螃蟹');
    expect(s.cards.map(c => c.keyword)).toEqual(expect.arrayContaining(['灼烧', '坚壳', '迅捷']));
    const c = card(s, '灼烧')!;
    const { state } = stepDuel(s, { kind: 'card', cardId: c.id });
    expect(() => stepDuel(state, { kind: 'card', cardId: c.id })).toThrow();
  });

  test('读懂临场一句：取最先出现的词，没读懂就落空', () => {
    expect(readPhrase('绕到它背后咬一口')?.keyword).toBe('潜行');
    expect(readPhrase('泼它一身滚烫的开水')?.keyword).toBe('灼烧');
    expect(readPhrase('大吼一声打断它')?.keyword).toBe('震慑');
    expect(readPhrase('你好呀')).toBeNull();
    const s = setup('一只普通的小东西');
    const { state, events } = stepDuel(s, { kind: 'write', text: '你好呀' });
    expect(events.some(e => e.type === 'fizzle')).toBe(true);
    expect(state.guardHp).toBe(s.guardHp - 1);
    expect(state.ink).toBe(2);
  });

  test('弱点谜语：写「滚烫」伤害翻倍并解开', () => {
    const s = setup('一只普通的小东西');
    const { state, events } = stepDuel(s, { kind: 'write', text: '泼它滚烫的水' });
    expect(events.find(e => e.type === 'hit' && e.target === 'guard')).toMatchObject({ amount: 8, weak: true });
    expect(state.solved).toContain('weak');
  });

  test('蓄力可以被打断：下一回合它发愣，不会放出重击', () => {
    let s = setup('会吼叫的小狮子');
    s = stepDuel(s, { kind: 'basic' }).state; // 直刺
    expect(currentMove(s)).toBe('charge');
    const r = stepDuel(s, { kind: 'card', cardId: card(s, '震慑')!.id });
    expect(r.events.some(e => e.type === 'interrupt')).toBe(true);
    expect(currentMove(r.state)).toBe('stunned');
  });

  test('没打断就会吃到重击；合甲会弹开普通打击，但挡不住灼烧', () => {
    let s = setup('一只普通的小东西');
    s = stepDuel(s, { kind: 'basic' }).state;
    s = stepDuel(s, { kind: 'basic' }).state; // 上弦
    expect(currentMove(s)).toBe('unleash');
    const hit = stepDuel(s, { kind: 'basic' });
    expect(hit.events.find(e => e.type === 'hit' && e.target === 'player')).toMatchObject({ amount: presetGuard('scout')!.unleash });
    s = hit.state;
    expect(currentMove(s)).toBe('fortify');
    expect(stepDuel(s, { kind: 'basic' }).events.some(e => e.type === 'bounce')).toBe(true);
    const fire = stepDuel(s, { kind: 'write', text: '喷火' });
    expect(fire.events.some(e => e.type === 'bounce')).toBe(false);
  });

  test('秘密谜语：原话里有「锈」，一上场铜甲就生锈', () => {
    const s = setup('浑身长满铜锈的老螃蟹');
    expect(s.rusted).toBe(true);
    expect(s.solved).toContain('secret');
    expect(s.guardHp).toBe(s.guardMax - 3);
    const w = stepDuel(setup('一只普通的小东西'), { kind: 'write', text: '让它泡水生锈' });
    expect(w.events.some(e => e.type === 'rust')).toBe(true);
  });

  test('会读意图、会解谜的玩法能赢；只会乱扑的会输', () => {
    const smart = (s: DuelState): DuelAction => {
      const m = currentMove(s);
      const pick = (...kws: string[]) => kws.map(k => card(s, k)).find(Boolean);
      if (m === 'charge') { const c = pick('震慑', '跃击'); if (c) return { kind: 'card', cardId: c.id }; if (s.ink) return { kind: 'write', text: '大吼一声' }; }
      if (m === 'unleash' || m === 'strike') { const c = pick('迅捷', '潜行', '坚壳'); if (c) return { kind: 'card', cardId: c.id }; }
      const atk = pick('灼烧', '穿刺', '连击', '回旋');
      if (atk) return { kind: 'card', cardId: atk.id };
      if (s.ink) return { kind: 'write', text: '喷一口火' };
      return { kind: 'basic' };
    };
    const run = (origin: string, policy: (s: DuelState) => DuelAction) => {
      let s = setup(origin);
      for (let i = 0; i < 40 && !s.result; i++) s = stepDuel(s, policy(s)).state;
      return s;
    };
    const good = run('会喷火、背着硬壳、跑得飞快、爱大吼的螃蟹', smart);
    expect(good.result).toBe('win');
    expect(good.turn).toBeLessThanOrEqual(8);
    const bad = run('会喷火、背着硬壳、跑得飞快、爱大吼的螃蟹', () => ({ kind: 'basic' }));
    expect(bad.result).toBe('loss');
    // 什么词都没写的造物，靠临场写字也能赢下来。
    const plain = run('一只普通的小东西', smart);
    expect(plain.result).not.toBe(null);
  });
});

import { applyDuel, canForge, deleteCreature, forgeFromDraft, retreatDuel, roster, ROSTER_MAX, selectCreature, settleDuelLoss, settleDuelWin, startDuel, type ForgeDraft } from '@/game/logic';
import { localCreatureDraft } from '@/server/providers/creature';
import { encodeSave, newGame, parseSave } from '@/domain/save';
import { findCreature } from '@/domain/creature';

describe('对决流程', () => {
  const forged = (origin: string) => forgeFromDraft(newGame(1), localCreatureDraft(origin) as ForgeDraft, 1);

  test('对决写进存档，刷新后原样恢复；赢了记下谜语', () => {
    let s = startDuel(forged('会喷火的螃蟹'));
    s = applyDuel(s, { kind: 'write', text: '喷一口火' }).save;
    expect(parseSave(encodeSave(s))).toEqual(s);
    while (!s.expedition!.duel!.result) s = applyDuel(s, s.expedition!.duel!.ink ? { kind: 'write', text: '喷火' } : { kind: 'basic' }).save;
    if (s.expedition!.duel!.result === 'win') {
      s = settleDuelWin(s, 2);
      expect(s.riddles.scout).toContain('weak');
      expect(findCreature(s, s.activeCreatureId)!.wins).toBe(1);
      expect(s.guardDefeats.scout).toBe(1);
    }
  });

  test('输了：长眠、传承，解开的谜语留给下一代', () => {
    let s = startDuel(forged('一只普通的小东西'));
    s = applyDuel(s, { kind: 'write', text: '滚烫的开水' }).save;
    while (!s.expedition!.duel!.result) s = applyDuel(s, { kind: 'basic' }).save;
    expect(s.expedition!.duel!.result).toBe('loss');
    const dead = findCreature(s, s.expedition!.creatureId)!;
    s = settleDuelLoss(s, dead.partIds[0], '它倒在铜甲前。', 3);
    expect(findCreature(s, dead.id)!.status).toBe('fallen');
    expect(s.riddles.scout).toContain('weak');
    expect(s.heir?.partId).toBe(dead.partIds[0]);
  });

  test('撤退：活着回港', () => {
    let s = startDuel(forged('会喷火的螃蟹'));
    s = retreatDuel(s);
    expect(s.expedition).toBeNull();
    expect(findCreature(s, s.activeCreatureId)!.status).toBe('alive');
  });
});

describe('守卫库与名册', () => {
  const forged = (s0: ReturnType<typeof newGame>, origin: string) => forgeFromDraft(s0, localCreatureDraft(origin) as ForgeDraft, 1);
  const lose = (s: ReturnType<typeof newGame>) => {
    let x = startDuel(s);
    while (!x.expedition!.duel!.result) x = applyDuel(x, { kind: 'basic' }).save;
    return x;
  };

  test('六位预设守卫各不相同，每位都有三道谜语', () => {
    expect(PRESET_GUARDS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(PRESET_GUARDS.map(g => g.weak.join())).size).toBe(PRESET_GUARDS.length);
    for (const g of PRESET_GUARDS) {
      expect(g.riddles).toHaveLength(3);
      expect(g.models.every(Boolean)).toBe(true);
      expect(JSON.parse(JSON.stringify(g))).toEqual(g);
    }
  });

  test('打败一位守卫，下一位一定是新的', () => {
    let s = forged(newGame(1), '会喷火、背着硬壳、跑得飞快、爱大吼的螃蟹');
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      s = startDuel(s);
      const id = s.expedition!.duel!.guardId;
      expect(seen).not.toContain(id);
      seen.push(id);
      s = { ...s, expedition: { ...s.expedition!, duel: { ...s.expedition!.duel!, guardHp: 1 } } };
      s = applyDuel(s, { kind: 'basic' }).save;
      expect(s.expedition!.duel!.result).toBe('win');
      s = settleDuelWin(s, 2);
    }
  });

  test('死去的造物变成亡者守卫：用它自己的话出招，下一代会遇到它', () => {
    let s = forged(newGame(1), '会喷火、背着硬壳的螃蟹');
    s = lose(s);
    const dead = findCreature(s, s.expedition!.creatureId)!;
    s = settleDuelLoss(s, dead.partIds[0], '它倒在铜甲前。', 3);
    const ghost = ghostGuard(s, findCreature(s, dead.id)!);
    expect(ghost.kind).toBe('ghost');
    expect(ghost.moves.strike.line).toContain('「');
    expect(ghost.secret.words.length).toBeGreaterThan(0);
    s = forged(s, '长着吸盘的章鱼');
    expect(guardPool(s, findCreature(s, s.activeCreatureId)!).some(g => g.id === ghost.id)).toBe(true);
    // 第一场打预设守卫，赢了之后就轮到残影。
    let c = findCreature(s, s.activeCreatureId)!;
    expect(nextDuelGuard(s, c).kind).toBe('preset');
    s = startDuel(s);
    s = { ...s, expedition: { ...s.expedition!, duel: { ...s.expedition!.duel!, guardHp: 1 } } };
    s = settleDuelWin(applyDuel(s, { kind: 'basic' }).save, 4);
    c = findCreature(s, s.activeCreatureId)!;
    expect(nextDuelGuard(s, c).id).toBe(ghost.id);
    // 写出它原话里的字，就能解开它的秘密。
    s = startDuel(s);
    const r = applyDuel(s, { kind: 'write', text: '喷火' });
    expect(r.events.some(e => e.type === 'solve' && e.riddle === 'secret')).toBe(true);
    expect(parseSave(encodeSave(r.save))).toEqual(r.save);
  });

  test('名册最多 5 只活着的造物；不传承直接离开会空出名额', () => {
    let s = newGame(1);
    for (let i = 0; i < ROSTER_MAX; i++) s = forged(s, `第${i}只会喷火的螃蟹`);
    expect(roster(s)).toHaveLength(5);
    expect(canForge(s)).toBe(false);
    expect(() => forged(s, '再来一只')).toThrow();
    const first = roster(s)[0];
    s = selectCreature(s, first.id);
    s = lose(s);
    s = settleDuelLoss(s, null, '它安静地睡了。', 5);
    expect(s.heir).toBeNull();
    expect(roster(s)).toHaveLength(4);
    expect(canForge(s)).toBe(true);
    expect(s.activeCreatureId).toBe(roster(s)[0].id);
    expect(findCreature(s, first.id)!.status).toBe('fallen');
  });

  test('港口可以删除造物并释放名额，只清理它独有的自创部件', () => {
    let s = forged(newGame(1), '一只会喷火的螃蟹');
    const creature = roster(s)[0];
    const partIds = [...creature.partIds];
    const partCount = s.parts.length;
    s = deleteCreature(s, creature.id);
    expect(roster(s)).toHaveLength(0);
    expect(s.activeCreatureId).toBeNull();
    expect(s.parts.length).toBe(partCount - partIds.length);
    expect(canForge(s)).toBe(true);
  });

  test('远征中不能删除造物', () => {
    const s = startDuel(forged(newGame(1), '会喷火的螃蟹'));
    expect(() => deleteCreature(s, s.activeCreatureId!)).toThrow('远征途中');
  });
});

describe('外观不撞款', () => {
  const forged = (s0: ReturnType<typeof newGame>, origin: string) => forgeFromDraft(s0, localCreatureDraft(origin) as ForgeDraft, 1);
  test('不同的话，躯干和腿也会换；名册里的造物尽量不撞款', () => {
    let s = newGame(1);
    const origins = ['会喷火的螃蟹', '会唱歌的蘑菇', '一只普通的小东西', '爱睡觉的石头', '长着翅膀的鱼'];
    for (const o of origins) s = forged(s, o);
    const urls = (slot: number) => s.creatures.map(c => s.parts.find(p => p.id === c.partIds[slot])!.model.url);
    expect(new Set(urls(1)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(urls(2)).size).toBeGreaterThanOrEqual(4);
  });

  test('守卫的部件和出战造物没有一件相同（包括上一代的残影）', () => {
    let s = forged(newGame(1), '会喷火、背着硬壳的螃蟹');
    s = startDuel(s);
    while (!s.expedition!.duel!.result) s = applyDuel(s, { kind: 'basic' }).save;
    const dead = findCreature(s, s.expedition!.creatureId)!;
    s = settleDuelLoss(s, dead.partIds[1], '它睡了。', 3);
    s = forged(s, '会喷火、背着硬壳的螃蟹');
    // 让它先赢一场，下一场就会遇到上一代的残影。
    s = startDuel(s);
    s = { ...s, expedition: { ...s.expedition!, duel: { ...s.expedition!.duel!, guardHp: 1 } } };
    s = settleDuelWin(applyDuel(s, { kind: 'basic' }).save, 4);
    s = startDuel(s);
    const d = s.expedition!.duel!;
    expect(d.g.kind).toBe('ghost');
    const mine = findCreature(s, s.activeCreatureId)!.partIds.map(id => s.parts.find(p => p.id === id)!.model.url);
    for (const u of d.g.models) expect(mine).not.toContain(u);
  });
});

describe('成长与传承', () => {
  const forged = (s0: ReturnType<typeof newGame>, origin: string) => forgeFromDraft(s0, localCreatureDraft(origin) as ForgeDraft, 1);
  test('六位预设守卫的头、身体、脚全都不同，也不会出现在玩家的部件库里', async () => {
    const { playerPool } = await import('@/domain/model-pool');
    const urls = PRESET_GUARDS.flatMap(g => g.models);
    expect(new Set(urls).size).toBe(urls.length);
    const player = new Set((['head', 'body', 'legs'] as const).flatMap(s => playerPool(s).map(p => p.url)));
    for (const u of urls) expect(player.has(u!)).toBe(false);
  });

  test('赢了可以让一件部件长出印记：生命 +2，它的话效果 +1', () => {
    let s = forged(newGame(1), '会喷火、背着硬壳的螃蟹');
    const c0 = findCreature(s, s.activeCreatureId)!;
    s = startDuel(s);
    const hp0 = s.expedition!.duel!.maxHp;
    s = { ...s, expedition: { ...s.expedition!, duel: { ...s.expedition!.duel!, guardHp: 1 } } };
    s = settleDuelWin(applyDuel(s, { kind: 'basic' }).save, 2, c0.partIds[0]);
    expect(s.parts.find(p => p.id === c0.partIds[0])!.level).toBe(1);
    s = startDuel(s);
    const d = s.expedition!.duel!;
    expect(d.maxHp).toBe(hp0 + 2);
    expect(d.cards.find(c => c.slot === 'head')!.power).toBe(1);
  });

  test('传承一定有加成：下一代墨水更多，传下来的话更有力、只歇一回合', () => {
    let s = forged(newGame(1), '会喷火、背着硬壳的螃蟹');
    s = startDuel(s);
    while (!s.expedition!.duel!.result) s = applyDuel(s, { kind: 'basic' }).save;
    const dead = findCreature(s, s.expedition!.creatureId)!;
    s = settleDuelLoss(s, dead.partIds[0], '它睡了。', 3);
    s = forged(s, '长着吸盘的章鱼');
    s = startDuel(s);
    const d = s.expedition!.duel!;
    expect(d.inkMax).toBe(4);
    expect(d.maxHp).toBe(16);
    const heirCard = d.cards.find(c => c.inherited)!;
    expect(heirCard.power).toBe(1);
    const after = applyDuel(s, { kind: 'card', cardId: heirCard.id }).save.expedition!.duel!;
    expect(after.cards.find(c => c.id === heirCard.id)!.rest).toBe(1);
  });
});

describe('存档：打过亡者守卫之后刷新也能读回来', () => {
  test('亡者守卫的编号很长，履历、传说解锁都要存得下', () => {
    const forged = (s0: ReturnType<typeof newGame>, origin: string) => forgeFromDraft(s0, localCreatureDraft(origin) as ForgeDraft, 1);
    let s = forged(newGame(1), '会喷火、背着硬壳的螃蟹');
    s = startDuel(s);
    while (!s.expedition!.duel!.result) s = applyDuel(s, { kind: 'basic' }).save;
    s = settleDuelLoss(s, null, '它睡了。', 3);
    s = forged(s, '长着吸盘的章鱼');
    s = startDuel(s);
    s = { ...s, expedition: { ...s.expedition!, duel: { ...s.expedition!.duel!, guardHp: 1 } } };
    s = settleDuelWin(applyDuel(s, { kind: 'basic' }).save, 4);
    s = startDuel(s);
    expect(s.expedition!.duel!.g.kind).toBe('ghost');
    s = { ...s, expedition: { ...s.expedition!, duel: { ...s.expedition!.duel!, guardHp: 1 } } };
    s = settleDuelWin(applyDuel(s, { kind: 'basic' }).save, 5);
    expect(parseSave(encodeSave(s))).toEqual(s);
  });
});

describe('存档压力测试：长时间乱玩，每一步都能存进去再读出来', () => {
  test('锻造、对决、胜负、传承、离开、切换造物，全部可往返', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const lines = ['会喷火、背着硬壳的螃蟹', '长着蘑菇伞的小狐狸', '会唱歌的蘑菇', '浑身铜锈的老螃蟹', '长着吸盘、会吐墨的章鱼', '背上开满花的乌龟'];
    let s = newGame(1);
    for (let step = 0; step < 120; step++) {
      if (!s.expedition) {
        if (canForge(s) && (roster(s).length === 0 || rand() < 0.3)) s = forgeFromDraft(s, localCreatureDraft(lines[step % lines.length]) as ForgeDraft, step);
        else {
          const r = roster(s);
          s = selectCreature(s, r[Math.floor(rand() * r.length)].id);
          s = startDuel(s);
        }
      } else {
        const d = s.expedition.duel!;
        if (d.result === 'win') s = settleDuelWin(s, step, rand() < 0.7 ? findCreature(s, s.expedition.creatureId)!.partIds[Math.floor(rand() * 3)] : null);
        else if (d.result === 'loss') {
          const c = findCreature(s, s.expedition.creatureId)!;
          s = settleDuelLoss(s, rand() < 0.5 ? c.partIds[Math.floor(rand() * 3)] : null, '它在海底睡着了。', step);
        } else {
          const open = d.cards.filter(c => !c.used);
          const roll = rand();
          const action = roll < 0.5 && open.length ? { kind: 'card' as const, cardId: open[0].id } : roll < 0.7 && d.ink ? { kind: 'write' as const, text: '喷一口火' } : { kind: 'basic' as const };
          s = applyDuel(s, action).save;
        }
      }
      expect(parseSave(encodeSave(s))).toEqual(s);
    }
    expect(s.creatures.some(c => c.status === 'fallen')).toBe(true);
  });
});

describe('三件连携与狂暴', () => {
  const duelWith = () =>
    createDuel({
      guard: { ...presetGuard('old-dino')!, hp: 40 },
      origin: '一只普通的小东西',
      reasons: [
        { slot: 'head', keyword: '穿刺', quote: '尖尖的角' },
        { slot: 'body', keyword: '再生', quote: '会长回来' },
        { slot: 'legs', keyword: '吸附', quote: '吸得很牢' },
      ],
    });

  test('连着说首、躯、足三句话，额外打出一击；中间扑一下就断了', () => {
    let s = duelWith();
    const events: string[] = [];
    for (const id of ['c0', 'c1', 'c2']) {
      const out = stepDuel(s, { kind: 'card', cardId: id });
      events.push(...out.events.map(e => e.type));
      s = out.state;
    }
    expect(events.filter(t => t === 'combo')).toHaveLength(1);
    expect(s.chain).toEqual([]);

    let t = duelWith();
    t = stepDuel(t, { kind: 'card', cardId: 'c0' }).state;
    t = stepDuel(t, { kind: 'basic' }).state;
    expect(t.chain).toEqual([]);
    t = stepDuel(t, { kind: 'card', cardId: 'c1' }).state;
    const out = stepDuel(t, { kind: 'card', cardId: 'c2' });
    expect(out.events.some(e => e.type === 'combo')).toBe(false);
  });

  test('守卫掉到一半生命时狂暴，只宣告一次，之后每一击 +1', () => {
    let s = duelWith();
    s = { ...s, guardHp: Math.floor(s.guardMax / 2) + 1 };
    const out = stepDuel(s, { kind: 'basic' });
    expect(out.events.filter(e => e.type === 'enrage')).toHaveLength(1);
    expect(out.state.enraged).toBe(true);
    const again = stepDuel(out.state, { kind: 'basic' });
    expect(again.events.some(e => e.type === 'enrage')).toBe(false);
  });
});

describe('预生成模型清单', () => {
  test('清单为空时守卫回落到旧模型，玩家部件库不含预生成套装', async () => {
    const { MODEL_POOL, generatedReady } = await import('@/domain/model-pool');
    const { PREGEN_SETS } = await import('@/domain/pregen-catalog');
    for (const set of PREGEN_SETS) {
      if (generatedReady(set.id)) continue;
      expect(MODEL_POOL.some(p => p.set === `gen-${set.id}`)).toBe(false);
    }
    for (const g of PRESET_GUARDS) expect(g.models.every(Boolean)).toBe(true);
  });
  test('预生成目录：16 套玩家 + 6 套守卫，套装名不重复，每位预设守卫都有对应外形', async () => {
    const { PREGEN_SETS, PREGEN_GUARD_FOR } = await import('@/domain/pregen-catalog');
    expect(PREGEN_SETS.filter(s => s.kind === 'player').length).toBeGreaterThanOrEqual(10);
    expect(new Set(PREGEN_SETS.map(s => s.id)).size).toBe(PREGEN_SETS.length);
    for (const g of PRESET_GUARDS) expect(PREGEN_SETS.some(s => s.id === PREGEN_GUARD_FOR[g.id] && s.kind === 'guard')).toBe(true);
  });
});

describe('所有模型地址都能进存档', () => {
  test('部件库和守卫用到的每个地址都通过存档校验', async () => {
    const { MODEL_POOL } = await import('@/domain/model-pool');
    const { isModelUrl } = await import('@/domain/save');
    for (const p of MODEL_POOL) expect(isModelUrl(p.url), p.url).toBe(true);
    for (const g of PRESET_GUARDS) for (const u of g.models) expect(isModelUrl(u), String(u)).toBe(true);
    expect(MODEL_POOL.some(p => p.set.startsWith('gen-'))).toBe(true);
  });
});
