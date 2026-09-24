import { mapTraits, type Traits } from './keywords';
import { findPart } from './catalog';
import type { Battle, BattleEvent, Creature } from './types';

function assertPartIds(ids:string[]): asserts ids is [string,string,string] {
  if (ids.length !== 3 || new Set(ids).size !== 3) throw new Error('A creature needs three different parts');
  const slots = ids.map(id => findPart(id).slot);
  if (new Set(slots).size !== 3 || !slots.includes('head') || !slots.includes('body') || !slots.includes('legs')) throw new Error('A creature needs one head, one body and one pair of legs');
}

export function makeCreature(ids:string[], inheritId:null|string=null, generation=1, name='我的造物', traits?:Traits):Creature {
  assertPartIds(ids);
  const parts = ids.map(findPart);
  const abilityPart = parts.find(part => part.slot === 'head')!;
  const stats = parts.reduce((sum, part) => ({
    hp:sum.hp + part.stats.hp, atk:sum.atk + part.stats.atk, def:sum.def + part.stats.def, speed:sum.speed + part.stats.speed,
  }), {hp:0,atk:0,def:0,speed:0});
  if (inheritId && ids.includes(inheritId)) stats.hp += 5;
  return { id:`creature-${ids.join('-')}-${generation}`, name, traits:parts.map(p=>traits?.[p.id] || mapTraits(p.name+p.tags.join(' '),p.slot)), partIds:ids, stats, abilityId:abilityPart.abilityId, generation, inheritPartId:inheritId && ids.includes(inheritId) ? inheritId : null };
}

function nextRandom(seed:number):() => number {
  let value = (seed >>> 0) || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000; };
}

export function simulateBattle(player:Creature, enemy:Creature, seed:number, id:string, enemyIndex=0):Battle {
  const fighters = [player, enemy] as [Creature,Creature];
  const hp = [player.stats.hp, enemy.stats.hp]; const attackCount = [0,0]; const receivedCount = [0,0]; const events:BattleEvent[] = [];
  const random = nextRandom(seed); const first:0|1 = player.stats.speed > enemy.stats.speed ? 0 : player.stats.speed < enemy.stats.speed ? 1 : (random() < 0.5 ? 0 : 1);
  for (let round=1; round<=15; round++) {
    const order:[0|1,0|1] = [first, (1-first) as 0|1];
    for (const actor of order) {
      const target = (1-actor) as 0|1; if (hp[target] <= 0) continue;
      attackCount[actor] += 1; const attacker = fighters[actor]; const defender = fighters[target]; const triggered:string[] = [];
      let defense = defender.stats.def;
      if (attacker.abilityId === 'pierce' && attackCount[actor] % 3 === 0) { defense = 0; triggered.push('pierce'); }
      let ordinary = Math.max(1, attacker.stats.atk - Math.floor(0.6 * defense));
      receivedCount[target] += 1;
      if (defender.abilityId === 'guard' && receivedCount[target] <= 2) { ordinary = Math.max(1, ordinary - 4); triggered.push('guard'); }
      const bonus = attacker.abilityId === 'flame' ? 2 : 0; if (bonus) triggered.push('flame');
      hp[target] = Math.max(0, hp[target] - ordinary - bonus);
      events.push({ index:events.length, round, actor, target, damage:ordinary + bonus, hp:[hp[0],hp[1]], triggered });
      if (hp[target] === 0) return { id, seed, fighters, first, events, result:actor === 0 ? 'win' : 'loss', enemyIndex };
    }
  }
  const playerRatio = hp[0] / player.stats.hp; const enemyRatio = hp[1] / enemy.stats.hp;
  return { id, seed, fighters, first, events, result:playerRatio === enemyRatio ? 'draw' : playerRatio > enemyRatio ? 'win' : 'loss', enemyIndex };
}
