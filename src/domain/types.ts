import type { Trait, Traits } from './keywords';
import type { Appearance } from '../assets/schema';
import type { TacticalState } from './tactical';
export type Slot='head'|'body'|'legs';
export type Ability='flame'|'guard'|'pierce'|'basic';
export interface Stats { hp:number; atk:number; def:number; speed:number }
export interface Part { id:string; slot:Slot; name:string; stats:Stats; abilityId:Ability; tags:string[]; description:string; imagePath:string; modelPath:string|null; assetSource:'placeholder'|'preset'|'generated'; rulesSource:'preset'|'llm'|'fallback' }
export interface Creature { traits?:Trait[]; id:string; name:string; partIds:[string,string,string]; stats:Stats; abilityId:Ability; generation:number; inheritPartId:string|null }
export interface BattleEvent { action?:string; slot?:Slot; targetSlot?:Slot; index:number; round:number; actor:0|1; target:0|1; damage:number; hp:[number,number]; triggered:string[] }
export interface Battle { tactical?:TacticalState; id:string; seed:number; fighters:[Creature,Creature]; first:0|1; events?:BattleEvent[]; result?:'win'|'loss'|'draw'; enemyIndex:number; generatedPartIds?:[string|null,string|null,string|null] }
export interface HistoryEntry { battleId:string; opponent:string; result:'win'|'loss'|'draw'; selectedPartId:string|null; narration:string }
export interface LineageEntry { generation:number; creatureName:string; guardsBeaten:number; inheritedPartId:string; partLevel:number }
export interface GeneratedPart { id:string; projectId:string; blueprintId:string; name:string; description:string; trait:Trait; appearance:Appearance; createdAt:number; status:'design'|'submitting'|'deferred'|'queued'|'processing'|'succeeded'|'failed'|'unknown'; source?:'deepseek'|'local'; fallbackReason?:string }
export interface GameSave { generatedParts?:GeneratedPart[]; retiredGeneratedPartIds?:string[]; equippedGenerated?:[string|null,string|null,string|null]; presetTraits?:Traits; lineage?:LineageEntry[]; expeditionWins?:number; totalWins?:number; version?:2; traits?:Traits; creatureName?:string; lore?:string; schemaVersion:1; revision:number; unlocked:string[]; equipped:[string,string,string]; inheritPartId:string|null; generation:number; enemyIndex:number; activeBattle:Battle|null; history:HistoryEntry[]; settledBattleIds:string[] }
