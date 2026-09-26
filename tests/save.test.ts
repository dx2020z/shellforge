import { describe, expect, test } from 'vitest';
import { forgeCreature, equipPart, maxHp, creatureParts } from '@/domain/creature';
import { makePresetPart, PRESET_DEFS } from '@/domain/presets';
import { encodeSave, loadSave, newGame, parseSave, writeSave, type StorageLike } from '@/domain/save';
import { mapCreatureTraits } from '@/domain/keywords';

const ids = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
};
const design = (origin: string) => {
  const t = mapCreatureTraits(origin);
  return {
    name: '熔岩巨蟹', lore: '火山熄灭以前，它已把火种藏进壳里。', origin,
    parts: {
      head: { name: '焰钳首', description: '喷火的钳嘴', trait: t.head },
      body: { name: '岩壳躯', description: '熔岩岩壳', trait: t.body },
      legs: { name: '弹簧足', description: '弹簧跳跃', trait: t.legs },
    },
  };
};
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('存档 v2', () => {
  test('新存档可以原样往返', () => {
    const save = newGame(1);
    expect(parseSave(encodeSave(save))).toEqual(save);
  });

  test('预置部件的能力都能在它自己的原话里找到出处', () => {
    for (const def of PRESET_DEFS) {
      const part = makePresetPart(def.id);
      expect(part.trait.keywords.length).toBeGreaterThan(0);
      for (const r of part.trait.reasons) expect(def.source.includes(r.quote)).toBe(true);
    }
  });

  test('每只造物保存自己的原话、部件与编号（造物卡不会再串号）', () => {
    const id = ids();
    let save = forgeCreature(newGame(1), design('会喷火、披着岩壳、用弹簧腿跳跃的熔岩巨蟹'), { id, now: 2 });
    save = forgeCreature(save, { ...design('棉花糖一样软的兔子'), name: '棉花糖兔' }, { id, now: 3 });
    const [a, b] = save.creatures;
    expect(a.specimen).toBe(1);
    expect(b.specimen).toBe(2);
    expect(a.origin).not.toBe(b.origin);
    expect(creatureParts(save, a).map(p => p.id)).not.toEqual(creatureParts(save, b).map(p => p.id));
    expect(parseSave(encodeSave(save))).toEqual(save);
  });

  test('下一代继承前代的一件部件，代数与血脉延续', () => {
    const id = ids();
    let save = forgeCreature(newGame(1), design('会喷火的螃蟹'), { id, now: 2 });
    const parent = save.creatures[0];
    save.creatures[0].status = 'fallen';
    const heirloom = parent.partIds[1];
    save = forgeCreature(save, design('长着吸盘的章鱼'), { id, now: 3, parentId: parent.id, inheritedPartId: heirloom });
    const child = save.creatures[1];
    expect(child.generation).toBe(2);
    expect(child.lineageId).toBe(parent.lineageId);
    expect(child.partIds[1]).toBe(heirloom);
    expect(save.parts.find(p => p.id === heirloom)!.origin).toEqual({ kind: 'inherited', fromCreatureId: parent.id });
    expect(parseSave(encodeSave(save)).creatures).toHaveLength(2);
  });

  test('缴获或库存部件可以替换到当前造物身上，但槽位必须一致', () => {
    const id = ids();
    let save = forgeCreature(newGame(1), design('会喷火的螃蟹'), { id, now: 2 });
    const creature = save.creatures[0];
    save = equipPart(save, creature.id, 'l01');
    expect(save.creatures[0].partIds[2]).toBe('l01');
    expect(save.creatures[0].bornPartIds[2]).not.toBe('l01');
  });

  test('生命只由膨胀与印记决定', () => {
    const plain = [makePresetPart('h01'), makePresetPart('b01'), makePresetPart('l01')];
    expect(maxHp(plain)).toBe(30);
    const swollen = [...plain];
    swollen[1] = { ...plain[1], trait: { keywords: ['膨胀'], cost: null, reasons: [] }, level: 2 };
    expect(maxHp(swollen)).toBe(44);
  });

  test('非法存档被拒：跨槽关键词、错槽部件、重复标本、危险模型地址', () => {
    const id = ids();
    const base = forgeCreature(newGame(1), design('会喷火的螃蟹'), { id, now: 2 });
    const mutate = (fn: (s: ReturnType<typeof structuredClone<typeof base>>) => void) => {
      const s = structuredClone(base);
      fn(s);
      return () => parseSave(JSON.stringify(s));
    };
    expect(mutate(s => { s.parts[0].trait.keywords = ['坚壳']; })).toThrow(/槽位/);
    expect(mutate(s => { s.creatures[0].partIds = [s.creatures[0].partIds[1], s.creatures[0].partIds[0], s.creatures[0].partIds[2]]; })).toThrow(/槽位/);
    expect(mutate(s => { s.creatures.push({ ...s.creatures[0], id: 'x' }); })).toThrow(/标本/);
    expect(mutate(s => { s.parts[0].model.url = 'https://evil.test/a.glb'; })).toThrow(/模型地址/);
    expect(mutate(s => { (s as { version: number }).version = 1; })).toThrow(/v2/);
  });

  test('主存档损坏时从备份恢复，并使用世界观文案', () => {
    const storage = new MemoryStorage();
    const save = newGame(1);
    expect(writeSave(storage, save)).toBe(true);
    expect(writeSave(storage, { ...save, revision: 2 })).toBe(true);
    storage.setItem('shellforge.v2.save', '{broken');
    const result = loadSave(storage);
    expect(result.status).toBe('restored');
    if (result.status === 'restored') {
      expect(result.save.revision).toBe(1);
      expect(result.note).not.toMatch(/存档|JSON|错误/);
    }
    expect(loadSave(new MemoryStorage()).status).toBe('empty');
    expect(loadSave(null).status).toBe('unreadable');
  });
});
