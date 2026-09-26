import { describe, expect, test } from 'vitest';
import { cardData, cleanQuote, lineages, nameSizeFor, reasonSentence } from '@/domain/card';
import { applyAction, forgeFromDraft, settleDeath, startBattle, type ForgeDraft } from '@/game/logic';
import { localCreatureDraft } from '@/server/providers/creature';
import { newGame } from '@/domain/save';
import { findCreature } from '@/domain/creature';
import type { GameSave } from '@/domain/types';

const forge = (save: GameSave, origin: string) => forgeFromDraft(save, localCreatureDraft(origin) as ForgeDraft, 1);

describe('造物卡', () => {
  test('理由统一写成「因为你写了「…」，…」，只用「」', () => {
    expect(reasonSentence('“喷火”', '所以它的头会烧起来。')).toBe('因为你写了「喷火」，所以它的头会烧起来。');
    expect(cleanQuote('『软』"')).toBe('软');
    const s = forge(newGame(1), '一只会喷火、背着硬壳、跑得飞快的螃蟹');
    const d = cardData(s, findCreature(s, s.activeCreatureId)!);
    for (const p of d.parts) {
      expect(p.reason.startsWith('因为你写了「')).toBe(true);
      expect(p.reason).not.toMatch(/[“”"『』]/);
    }
    expect(d.highlights.map(h => h.text).join('')).toBe(s.creatures[0].origin);
    expect(d.highlights.some(h => h.color)).toBe(true);
  });

  test('边界：初代、初次远征、长名字缩小', () => {
    const s = forge(newGame(1), '会喷火的螃蟹');
    const d = cardData(s, findCreature(s, s.activeCreatureId)!);
    expect(d.generation).toBe('初代造物');
    expect(d.record).toBe('初次远征');
    expect(d.specimen).toBe('No.0001');
    expect(d.fallen).toBe(false);
    expect(nameSizeFor('一二三四五六七八九十一二')).toBeLessThan(nameSizeFor('螃蟹'));
  });

  test('长眠的造物带墓志铭，下一代显示血脉；图鉴按血脉分组', () => {
    let s = startBattle(forge(newGame(1), '会喷火的螃蟹'), 1);
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, hp: 1 } } };
    while (!s.expedition!.battle!.result) s = applyAction(s, { kind: 'guard' }).save;
    const dead = findCreature(s, s.expedition!.creatureId)!;
    s = settleDeath(s, dead.partIds[0], '它带着「喷火」第一次下潜。', 3);
    const d = cardData(s, findCreature(s, dead.id)!);
    expect(d.fallen).toBe(true);
    expect(d.epitaph).toContain('喷火');
    s = forge(s, '长着吸盘的章鱼');
    const child = findCreature(s, s.activeCreatureId)!;
    const cd = cardData(s, child);
    expect(cd.generation).toBe('第 2 代');
    expect(cd.lineage).toMatch(/^继承自.+的「.+」$/);
    const groups = lineages(s);
    expect(groups).toHaveLength(1);
    expect(groups[0].creatures.map(c => c.generation)).toEqual([1, 2]);
  });
});
