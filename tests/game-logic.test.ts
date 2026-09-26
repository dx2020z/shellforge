import { describe, expect, test } from 'vitest';
import { applyAction, forgeFromDraft, retreat, settleDeath, settleWin, startBattle, startExpedition, applySpring, type ForgeDraft } from '@/game/logic';
import { maxHp, creatureParts } from '@/domain/creature';
import { localCreatureDraft } from '@/server/providers/creature';
import { encodeSave, newGame, parseSave } from '@/domain/save';
import { findCreature } from '@/domain/creature';
import { pickPoolPart } from '@/domain/model-pool';
import type { GameSave } from '@/domain/types';

const forge = (save: GameSave, origin: string) => forgeFromDraft(save, localCreatureDraft(origin) as ForgeDraft, 1);
const winBattle = (save: GameSave) => {
  let s = save;
  s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, guardHp: { ...s.expedition!.battle!.guardHp, body: 1, head: 1 } } } };
  s = applyAction(s, { kind: 'attack', target: 'head' }).save;
  if (!s.expedition!.battle!.result) s = applyAction(s, { kind: 'attack', target: 'body' }).save;
  return s;
};

describe('游戏流程', () => {
  test('锻造 → 出征 → 胜利缴获并换上 → 存档可往返', () => {
    let s = forge(newGame(1), '一只毛茸茸、很乖、从不还嘴的健身牛');
    s = startBattle(s, 0);
    s = winBattle(s);
    expect(s.expedition!.battle!.result).toBe('win');
    const before = findCreature(s, s.activeCreatureId)!.partIds[0];
    s = settleWin(s, 'head', true, 2);
    const creature = findCreature(s, s.activeCreatureId)!;
    expect(creature.partIds[0]).not.toBe(before);
    expect(s.parts.find(p => p.id === creature.partIds[0])!.origin.kind).toBe('captured');
    expect(s.tutorial.done).toBe(true);
    expect(s.loreUnlocked).toContain('apprentice');
    expect(s.expedition!.depth).toBe(1);
    expect(parseSave(encodeSave(s))).toEqual(s);
  });

  test('进行中的战斗写进存档，刷新后原样恢复（无法靠刷新逃避）', () => {
    let s = startBattle(forge(newGame(1), '会喷火的螃蟹'), 1);
    s = applyAction(s, { kind: 'guard' }).save;
    const restored = parseSave(encodeSave(s));
    expect(restored.expedition!.battle!.turn).toBe(2);
    expect(restored.expedition!.battle!.hp).toBe(s.expedition!.battle!.hp);
  });

  test('撤退：造物活着回港，下次重新出发', () => {
    let s = startBattle(forge(newGame(1), '会喷火的螃蟹'), 1);
    s = retreat(s);
    expect(s.expedition).toBeNull();
    expect(findCreature(s, s.activeCreatureId)!.status).toBe('alive');
  });

  test('死亡：长眠、墓志铭、一件部件留给下一代，下一代代数 +1 并带着它', () => {
    let s = startBattle(forge(newGame(1), '会喷火的螃蟹'), 1);
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, hp: 1 } } };
    while (!s.expedition!.battle!.result) s = applyAction(s, { kind: 'guard' }).save;
    expect(s.expedition!.battle!.result).toBe('loss');
    const dead = findCreature(s, s.expedition!.creatureId)!;
    s = settleDeath(s, dead.partIds[1], '它带着「喷火」第一次下潜。', 3);
    expect(findCreature(s, dead.id)!.status).toBe('fallen');
    expect(s.heir?.partId).toBe(dead.partIds[1]);
    s = forge(s, '长着吸盘的章鱼');
    const child = findCreature(s, s.activeCreatureId)!;
    expect(child.generation).toBe(2);
    expect(child.partIds[1]).toBe(dead.partIds[1]);
    expect(s.heir).toBeNull();
    expect(parseSave(encodeSave(s)).creatures).toHaveLength(2);
  });

  test('离线部件库按原话挑选，同一句话结果稳定', () => {
    const a = pickPoolPart('head', '毛茸茸的小绒球', ['震慑']);
    expect(a.set).toBe('fluffy');
    expect(pickPoolPart('head', '毛茸茸的小绒球', ['震慑']).id).toBe(a.id);
    expect(pickPoolPart('body', '健身练出一身肌肉的牛', ['蓄能']).set).toBe('bull');
  });

  test('远征：生命值跨场延续，胜利后进入潮汐泉，三选一后回到地图', () => {
    let s = forge(newGame(1), '一只毛茸茸、很乖、从不还嘴的健身牛');
    s = startExpedition(s);
    const c = findCreature(s, s.activeCreatureId)!;
    const max = maxHp(creatureParts(s, c));
    expect(s.expedition!.hp).toBe(max);
    expect(s.expedition!.depth).toBe(0);
    s = startBattle(s);
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, hp: 10 } } };
    s = winBattle(s);
    s = settleWin(s, null, false, 2);
    expect(s.expedition!.spring).toBe(true);
    const hp = s.expedition!.hp;
    expect(hp).toBeLessThanOrEqual(10);
    expect(() => startBattle(applySpring(s, { kind: 'heal' }))).not.toThrow();
    const healed = applySpring(s, { kind: 'heal' });
    expect(healed.expedition!.hp).toBe(Math.min(max, hp + Math.ceil(max / 2)));
    expect(healed.expedition!.spring).toBe(false);
    expect(() => applySpring(healed, { kind: 'heal' })).toThrow();
    const partId = findCreature(s, s.activeCreatureId)!.partIds[1];
    const tempered = applySpring(s, { kind: 'temper', partId });
    expect(tempered.parts.find(p => p.id === partId)!.level).toBe(1);
    const scouted = applySpring(s, { kind: 'scout' });
    expect(scouted.expedition!.scouted).toContain('scout');
    // 下一场以延续的生命值开始。
    const next = startBattle(healed);
    expect(next.expedition!.battle!.hp).toBe(healed.expedition!.hp);
    expect(parseSave(encodeSave(next))).toEqual(next);
  });
});
