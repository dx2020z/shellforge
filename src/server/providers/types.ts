import type { Cost, Keyword } from '../../domain/keywords';
import type { Ability, Slot, Stats } from '../../domain/types';
export interface PartDraft { keywords:Keyword[]; cost:Cost|null; reasons:{keyword:Keyword|Cost;quote:string;why:string}[];
  partId: string; name: string; slot: Slot; stats: Stats; abilityId: Ability;
  tags: string[]; description: string; prompt: string; visualPrompt: string; source: 'local'|'deepseek'; fallbackReason?:string;
}
export type TaskStatus = 'submitting'|'deferred'|'queued'|'processing'|'succeeded'|'failed'|'unknown';
export interface ModelTask {
  id: string; partId: string; prompt: string; startedAt?:number; taskId?: string; status: TaskStatus;
  progress: number; modelPath: string|null; message?: string; updatedAt: number; nextPollAt: number; attempts?:number;
}
