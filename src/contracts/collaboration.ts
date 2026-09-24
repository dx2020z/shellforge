import type { TacticalState, Action } from '@/domain/tactical';
import type { BattleEvent, Creature, Part } from '@/domain/types';
import type { Appearances } from '@/assets/schema';

export interface BattleStageProps { taunt?:string; tactical?:TacticalState; onAction?:(action:Action)=>void; onAbandon?:()=>void;
  player: Creature;
  enemy: Creature;
  events: BattleEvent[];
  eventIndex: number;
  onComplete?: () => void;
  appearances?: Appearances;
}

export interface PartViewerProps {
  part: Part|null;
  showPlaceholder?: boolean;
  onLoadError?: () => void;
}

export const COLLABORATION_RULES = {
  owners: { battleStage:'online-teammate-a', partViewer:'online-teammate-b' },
  allowedFiles: ['src/features/battle/BattleStage.tsx','src/features/battle/BattleStage.module.css','src/features/viewer/PartViewer.tsx','src/features/viewer/PartViewer.module.css'],
  forbiddenFiles: ['src/domain/*','src/components/GameClient.tsx','src/app/*','package.json'],
  handoff: '提交上述文件和一段截图或短录屏；不提交node_modules、.env、构建缓存或修改后的领域类型。',
} as const;
