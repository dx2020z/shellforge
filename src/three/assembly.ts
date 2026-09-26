export interface SlotPlacement { bottom:number; center:number; top:number }
export type CreaturePlacements={head:SlotPlacement;body:SlotPlacement;legs:SlotPlacement};
export interface ProportionScales { head:number; legs:number }

/** Uniform scale factors that keep the head width and leg height in relation to the body. */
export function proportionScales(widths:readonly [number,number,number],heights:readonly [number,number,number]):ProportionScales {
  const [headWidth,bodyWidth]=widths,[headHeight,bodyHeight,legHeight]=heights;
  if(![headWidth,bodyWidth,headHeight,bodyHeight,legHeight].every(x=>Number.isFinite(x)&&x>0))return {head:1,legs:1};
  const headTarget=Math.min(bodyWidth*1.0,Math.max(bodyWidth*.72,headWidth));
  const legTarget=Math.min(bodyHeight,Math.max(bodyHeight*.6,legHeight));
  return {head:headTarget/headWidth,legs:legTarget/legHeight};
}

/** One canonical stack layout shared by the game scene and the manual QA viewer. */
export function placeCreatureSlots(heights:readonly [number,number,number],floorY=0):CreaturePlacements {
  const [headHeight,bodyHeight,legHeight]=heights;
  const legs:SlotPlacement={bottom:floorY,center:floorY+legHeight/2,top:floorY+legHeight};
  const bodyBottom=legs.top-Math.min(legHeight,bodyHeight)*.3;
  const body:SlotPlacement={bottom:bodyBottom,center:bodyBottom+bodyHeight/2,top:bodyBottom+bodyHeight};
  const headBottom=body.top-Math.min(bodyHeight,headHeight)*.3;
  const head:SlotPlacement={bottom:headBottom,center:headBottom+headHeight/2,top:headBottom+headHeight};
  return {head,body,legs};
}
