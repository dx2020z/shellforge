import { PARTS } from './catalog';
import { mapTraits } from './keywords';
import { createTactical, step, seeded, type Action } from './tactical';
import { ENEMIES, findPart, STARTING_PART_IDS } from './catalog';
import { makeCreature, simulateBattle } from './engine';
import type { GameSave, GeneratedPart, Slot } from './types';

function copy(save:GameSave):GameSave { return structuredClone(save); }

export function newGame():GameSave { const traits=Object.fromEntries(PARTS.map(p=>[p.id,mapTraits(p.name+p.tags.join(' '),p.slot)]));return { schemaVersion:1, version:2, lineage:[], expeditionWins:0,totalWins:0, traits, presetTraits:structuredClone(traits), generatedParts:[], retiredGeneratedPartIds:[], equippedGenerated:[null,null,null], revision:1, unlocked:[...STARTING_PART_IDS], equipped:['h01','b02','l01'], inheritPartId:null, generation:1, enemyIndex:0, activeBattle:null, history:[], settledBattleIds:[] }; }

const slotIndex=(slot:Slot)=>slot==='head'?0:slot==='body'?1:2;
export function registerGeneratedParts(save:GameSave,parts:GeneratedPart[]):GameSave {
  const next=copy(save);next.generatedParts??=[];
  for(const part of parts){if(next.retiredGeneratedPartIds?.includes(part.id))throw new Error('这件自创部件已在战败后失去，不能从旧任务重新领取');if(!next.unlocked.includes(part.blueprintId)||!part.id||part.id.split(':')[1]!==findPart(part.blueprintId).slot)throw new Error('自创部件蓝图无效');const index=next.generatedParts.findIndex(p=>p.id===part.id);if(index<0)next.generatedParts.push(part);else next.generatedParts[index]=part;}
  next.revision++;return next;
}
export function updateGeneratedPart(save:GameSave,id:string,patch:Pick<GeneratedPart,'appearance'|'status'>):GameSave {
  const next=copy(save),part=next.generatedParts?.find(p=>p.id===id);if(!part)return save;
  part.appearance=patch.appearance;part.status=patch.status;next.revision++;return next;
}
export function equipGeneratedPart(save:GameSave,id:string):GameSave {
  if(save.activeBattle)throw new Error('本场战斗结算后才能换装');
  const next=copy(save),part=next.generatedParts?.find(p=>p.id===id);if(!part)throw new Error('自创部件已不存在');
  const index=slotIndex(findPart(part.blueprintId).slot);next.equipped[index]=part.blueprintId;(next.equippedGenerated??=[null,null,null])[index]=id;(next.traits??={})[part.blueprintId]=structuredClone(part.trait);next.revision++;return next;
}
export function equipGeneratedCreature(save:GameSave,projectId:string,name:string,lore:string):GameSave {
  let next=save;for(const slot of ['head','body','legs'] as const){const part=next.generatedParts?.find(p=>p.projectId===projectId&&findPart(p.blueprintId).slot===slot);if(!part)throw new Error('这只造物的三件部件尚未登记');next=equipGeneratedPart(next,part.id);}
  next={...next,creatureName:name,lore,revision:next.revision+1};return next;
}

export function equipPart(save:GameSave,id:string):GameSave {
  if (save.activeBattle) throw new Error('本场战斗结算后才能换装');
  const next = copy(save); const part = findPart(id); if (!next.unlocked.includes(id)) throw new Error(`Part is locked: ${id}`);
  const index = slotIndex(part.slot); next.equipped[index] = id;(next.equippedGenerated??=[null,null,null])[index]=null;(next.traits??={})[id]=structuredClone(next.presetTraits?.[id]||mapTraits(part.name+part.tags.join(' '),part.slot));next.revision += 1; return next;
}

export function beginBattle(save:GameSave,seed:number,id:string):GameSave {
  if (save.activeBattle) return save; const next = copy(save); const opponent = ENEMIES[next.enemyIndex % ENEMIES.length];
  const player = makeCreature(next.equipped,next.inheritPartId,next.generation,next.creatureName, next.traits); const enemy = makeCreature(opponent.parts,null,1,opponent.name);
  const tactical=createTactical(player,next.enemyIndex);player.stats={hp:tactical.maxHp[0],atk:6,def:6,speed:0};enemy.stats={hp:tactical.maxHp[1],atk:0,def:0,speed:0};
  next.activeBattle = {id,seed,fighters:[player,enemy],first:0,enemyIndex:next.enemyIndex,tactical,generatedPartIds:[...(next.equippedGenerated||[null,null,null])] as [string|null,string|null,string|null]}; next.revision += 1; return next;
}

export function abandonBattle(save:GameSave):GameSave {
  if(!save.activeBattle)return save;
  const next=copy(save);next.activeBattle=null;next.revision+=1;return next;
}

export function settleBattle(save:GameSave,battleId:string,partId:string|null):GameSave {
  if (!save.activeBattle && save.settledBattleIds.includes(battleId)) return save;
  const battle = save.activeBattle; if (!battle || battle.id !== battleId) throw new Error('Battle is not active'); const next = copy(save);
  const result=battle.tactical?.result ?? battle.result;
  if(battle.tactical && !battle.tactical.result)throw new Error('战斗尚未结束');
  if(!result)throw new Error('战斗结果无效');
  if (result === 'win') {
    const candidates = battle.fighters[1].partIds.filter(id=>!next.unlocked.includes(id));
    if (!partId && candidates.length) throw new Error('Choose an enemy part as loot');
    if (partId && !battle.fighters[1].partIds.includes(partId)) throw new Error('Choose an enemy part as loot');
    if (partId && next.unlocked.includes(partId)) throw new Error('Loot is already unlocked');
    if (partId) next.unlocked.push(partId); next.expeditionWins=(next.expeditionWins||0)+1;next.totalWins=(next.totalWins||0)+1; next.enemyIndex = (next.enemyIndex + 1) % ENEMIES.length;
  } else if (result === 'loss') {
    const generatedIndex=battle.generatedPartIds?.indexOf(partId||'')??-1;
    const inheritedId=generatedIndex>=0?battle.fighters[0].partIds[generatedIndex]:partId;
    if (!inheritedId || !battle.fighters[0].partIds.includes(inheritedId)) throw new Error('Choose one of your parts to inherit');
    next.inheritPartId = inheritedId; const trait=next.traits?.[inheritedId];if(trait)trait.level=Math.min(3,(trait.level||0)+1);
    if(generatedIndex>=0){const inherited=next.generatedParts?.find(p=>p.id===partId);if(inherited)inherited.trait.level=trait?.level||1;}
    const lost:string[]=[];
    for(const id of battle.generatedPartIds||[])if(id!==null&&id!==partId)lost.push(id);
    next.retiredGeneratedPartIds=[...new Set([...(next.retiredGeneratedPartIds||[]),...lost])];
    next.generatedParts=(next.generatedParts||[]).filter(p=>!lost.includes(p.id));
    for(let i=0;i<3;i++)if(lost.includes(next.equippedGenerated?.[i]||'')){next.equippedGenerated![i]=null;const base=next.equipped[i];next.traits![base]=structuredClone(next.presetTraits?.[base]||mapTraits(findPart(base).name+findPart(base).tags.join(' '),findPart(base).slot));}
    next.lineage=[{generation:next.generation,creatureName:battle.fighters[0].name,guardsBeaten:next.expeditionWins||0,inheritedPartId:inheritedId,partLevel:trait?.level||1},...(next.lineage||[])].slice(0,50);next.expeditionWins=0;next.generation += 1;
  } else if (partId !== null) throw new Error('A draw has no reward or inheritance');
  next.history.unshift({ battleId, opponent:battle.fighters[1].name, result, selectedPartId:result==='loss'&&partId?next.inheritPartId:partId, narration:result === 'win' ? `我战胜了${battle.fighters[1].name}。` : result === 'loss' ? `${battle.fighters[1].name}击碎了这副躯壳。` : '这一战没有分出胜负。' });
  next.history = next.history.slice(0,5); next.settledBattleIds.push(battleId); next.activeBattle = null; next.revision += 1; return next;
}

export function takeAction(save:GameSave,action:Action):GameSave { const next=copy(save),b=next.activeBattle;if(!b?.tactical)throw new Error('战斗状态无效');const out=step(b.tactical,action,seeded(b.seed+b.tactical.turn));b.tactical=out.state;delete b.events;delete b.result;next.revision++;return next;}
