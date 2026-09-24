import { createTactical, step, seeded } from './tactical';
import { mapTraits, KEYWORDS, COSTS } from './keywords';
import type { GameSave } from './types';
import { ENEMIES, PARTS } from './catalog';
import { isModelPath } from '../assets/schema';

const STORAGE_KEY = 'shellforge.save.v1';
export function encodeSave(save: GameSave): string { return JSON.stringify(save); }
export function decodeSaveResult(raw: string): {save:GameSave; battleWarning?:string; repaired:boolean} {
  const value = JSON.parse(raw) as GameSave;
  const invalid = () => { throw new Error('存档损坏或版本不兼容'); };
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) invalid();
  const known = new Map(PARTS.map(p => [p.id, p]));
  if (!Array.isArray(value.unlocked) || !value.unlocked.length || value.unlocked.some(id => !known.has(id)) || new Set(value.unlocked).size !== value.unlocked.length) invalid();
  if (!Array.isArray(value.equipped) || value.equipped.length !== 3 || value.equipped.some((id, i) => !value.unlocked.includes(id) || known.get(id)?.slot !== ['head','body','legs'][i])) invalid();
  const validTrait=(id:string,t:unknown)=>{const part=known.get(id),trait=t as import('./keywords').Trait|undefined;return Boolean(part&&trait&&Array.isArray(trait.keywords)&&trait.keywords.length>=1&&trait.keywords.length<=2&&trait.keywords.every(k=>(KEYWORDS[part.slot] as readonly string[]).includes(k))&&(trait.cost===null||COSTS.includes(trait.cost))&&Array.isArray(trait.reasons)&&Number.isInteger(trait.level??0)&&(trait.level??0)>=0&&(trait.level??0)<=3);};
  if(value.generatedParts===undefined)value.generatedParts=[];
  if(!Array.isArray(value.generatedParts)||value.generatedParts.length>300)invalid();
  const generatedIds=new Set<string>();
  for(const part of value.generatedParts){if(!part||typeof part.id!=='string'||!/^[a-f0-9-]{36}:(head|body|legs)$/.test(part.id)||generatedIds.has(part.id)||typeof part.projectId!=='string'||!part.id.startsWith(part.projectId+':')||!value.unlocked.includes(part.blueprintId)||known.get(part.blueprintId)?.slot!==part.id.split(':')[1]||typeof part.name!=='string'||part.name.length>24||typeof part.description!=='string'||part.description.length>160||!validTrait(part.blueprintId,part.trait)||!part.appearance||typeof part.appearance.name!=='string'||typeof part.appearance.description!=='string'||part.appearance.name.length>24||part.appearance.description.length>160||(part.appearance.modelPath!==null&&!isModelPath(part.appearance.modelPath))||!Number.isFinite(part.createdAt)||!['design','submitting','deferred','queued','processing','succeeded','failed','unknown'].includes(part.status)||(part.source!==undefined&&!['deepseek','local'].includes(part.source))||(part.fallbackReason!==undefined&&(typeof part.fallbackReason!=='string'||part.fallbackReason.length>200)))invalid();generatedIds.add(part.id);}
  value.retiredGeneratedPartIds??=[];
  if(!Array.isArray(value.retiredGeneratedPartIds)||value.retiredGeneratedPartIds.length>900||new Set(value.retiredGeneratedPartIds).size!==value.retiredGeneratedPartIds.length||value.retiredGeneratedPartIds.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}:(head|body|legs)$/.test(id)||generatedIds.has(id)))invalid();
  if(value.equippedGenerated===undefined)value.equippedGenerated=[null,null,null];
  if(!Array.isArray(value.equippedGenerated)||value.equippedGenerated.length!==3||value.equippedGenerated.some((id,i)=>id!==null&&(!generatedIds.has(id)||value.generatedParts?.find(p=>p.id===id)?.blueprintId!==value.equipped[i])))invalid();
  if (![value.revision, value.generation].every(n => Number.isSafeInteger(n) && n >= 1) || !Number.isInteger(value.enemyIndex) || value.enemyIndex < 0 || value.enemyIndex >= ENEMIES.length) invalid();
  if (value.inheritPartId !== null && !value.unlocked.includes(value.inheritPartId)) invalid();
  if (!Array.isArray(value.settledBattleIds) || value.settledBattleIds.some(id => typeof id !== 'string')) invalid();
  if (!Array.isArray(value.history) || value.history.length > 5 || value.history.some(h => !h || typeof h.battleId !== 'string' || typeof h.opponent !== 'string' || typeof h.narration !== 'string' || !['win','loss','draw'].includes(h.result) || (h.selectedPartId !== null && !known.has(h.selectedPartId)))) invalid();
  let repaired=false,battleWarning:string|undefined;
  if (value.activeBattle !== null) {
    const b = value.activeBattle;
    try {
      if (!b || typeof b.id !== 'string' || !b.id || !Number.isSafeInteger(b.seed) || b.seed<0 || !Array.isArray(b.fighters) || b.fighters.length!==2 || !Number.isInteger(b.enemyIndex) || b.enemyIndex<0 || b.enemyIndex>=ENEMIES.length || value.settledBattleIds.includes(b.id)) throw new Error('invalid battle envelope');
      if(!b.tactical)throw new Error('battle has no tactical state');
      let expected=createTactical(b.fighters[0],b.enemyIndex);
      if(!Array.isArray(b.tactical.actions)||b.tactical.actions.length>30)throw new Error('invalid tactical actions');
      for(const action of b.tactical.actions){const out=step(expected,action,seeded(b.seed+expected.turn));expected=out.state;}
      if(JSON.stringify(expected)!==JSON.stringify(b.tactical))throw new Error('tactical replay mismatch');
      if(b.generatedPartIds!==undefined&&(!Array.isArray(b.generatedPartIds)||b.generatedPartIds.length!==3||b.generatedPartIds.some((id,i)=>id!==null&&(!generatedIds.has(id)||value.generatedParts?.find(p=>p.id===id)?.blueprintId!==b.fighters[0].partIds[i]))))throw new Error('invalid generated battle snapshot');
      if('events' in b || 'result' in b){delete b.events;delete b.result;repaired=true;}
    } catch {
      value.activeBattle=null;repaired=true;battleWarning='上一场战斗已失效，已为你重置';
    }
  }
  if(value.version!==undefined && value.version!==2)invalid();
  value.lineage=value.lineage||[];value.expeditionWins=value.expeditionWins||0;value.totalWins=value.totalWins||0;if(!Array.isArray(value.lineage)||value.lineage.length>50||!Number.isSafeInteger(value.expeditionWins)||value.expeditionWins<0||value.expeditionWins>10000||!Number.isSafeInteger(value.totalWins)||value.totalWins<0||value.totalWins>1000000||value.lineage.some(x=>!x||!Number.isSafeInteger(x.generation)||x.generation<1||typeof x.creatureName!=='string'||x.creatureName.length>24||!Number.isSafeInteger(x.guardsBeaten)||x.guardsBeaten<0||!known.has(x.inheritedPartId)||!Number.isInteger(x.partLevel)||x.partLevel<1||x.partLevel>3))invalid();
  value.version=2;
  value.traits=value.traits || Object.fromEntries(PARTS.map(p=>[p.id,mapTraits(p.name+p.tags.join(' '),p.slot)]));
  value.presetTraits??=Object.fromEntries(PARTS.map(p=>[p.id,mapTraits(p.name+p.tags.join(' '),p.slot)]));
  for(const collection of [value.traits,value.presetTraits])for(const [id,t] of Object.entries(collection))if(!validTrait(id,t))invalid();
  return {save:value,battleWarning,repaired};
}
export function decodeSave(raw:string):GameSave{return decodeSaveResult(raw).save;}
export function loadBrowserSave(storageKey=STORAGE_KEY): { save: GameSave|null; warning?: string } {
  if (typeof window === 'undefined') return { save: null };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { save: null };
    try { const decoded=decodeSaveResult(raw);if(decoded.repaired){saveBrowserSave(decoded.save,storageKey);return {save:decoded.save,warning:decoded.battleWarning||'上一场战斗已修复，已恢复进度。'};}return { save: decoded.save }; }
    catch {
      const backup = localStorage.getItem(storageKey + '.backup');
      if (backup) try { return { save: decodeSave(backup), warning: '主存档损坏，已恢复上一次有效进度。' }; } catch { /* Keep both copies for inspection. */ }
      return { save: null, warning: '存档无法读取，已启动新进度；旧数据仍保留在浏览器中。' };
    }
  } catch { return { save: null, warning: '浏览器禁用了本地存储，本次进度无法保存。' }; }
}
export function saveBrowserSave(save: GameSave,storageKey=STORAGE_KEY): boolean {
  try {
    const previous = localStorage.getItem(storageKey);
    if (previous) try { decodeSave(previous); localStorage.setItem(storageKey + '.backup', previous); } catch { /* Don't replace a good backup with corrupt data. */ }
    localStorage.setItem(storageKey, encodeSave(save));
    return true;
  } catch { return false; }
}
export function clearBrowserSave(storageKey=STORAGE_KEY): void {
  try { localStorage.removeItem(storageKey); localStorage.removeItem(storageKey + '.backup'); } catch { /* Later writes report errors. */ }
}
