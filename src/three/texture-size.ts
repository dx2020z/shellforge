export interface TextureDimensions { width:number; height:number }

/** Preserve aspect ratio while capping the longest texture edge. */
export function fitTextureDimensions(width:number,height:number,maxEdge=1024):TextureDimensions {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isFinite(maxEdge)||maxEdge<=0)return {width:0,height:0};
  const scale=Math.min(1,maxEdge/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
