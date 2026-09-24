export type Vec3 = [number, number, number];
export interface AssetEntry { modelPath: string|null; previewPath?: string; scale: number; rotation: Vec3; offset: Vec3 }
export interface Appearance { name: string; description: string; modelPath: string|null; rotation?: Vec3; flip?: boolean }
export type Appearances = Record<string, Appearance>;
const assetPath = /^\/assets\/parts\/[a-z0-9_./-]+$/i;
export function isModelPath(path: unknown): path is string {
  return typeof path === 'string' && ((assetPath.test(path) && path.endsWith('.glb') && !path.includes('..')) || /^\/api\/models\/[a-f0-9-]{36}$/.test(path));
}
export function parseAssetEntry(raw: unknown): AssetEntry {
  if (!raw || typeof raw !== 'object') throw new Error('素材配置不是对象');
  const data = raw as Partial<AssetEntry>;
  if (data.modelPath !== null && !isModelPath(data.modelPath)) throw new Error('模型需要使用本地 GLB 路径');
  if (data.previewPath && (!assetPath.test(data.previewPath) || data.previewPath.includes('..'))) throw new Error('预览路径不合法');
  const vec = (v: unknown, limit: number): Vec3 => {
    if (!Array.isArray(v) || v.length !== 3 || v.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > limit)) throw new Error('变换参数不合法');
    return v as Vec3;
  };
  if (typeof data.scale !== 'number' || !Number.isFinite(data.scale) || data.scale < .05 || data.scale > 10) throw new Error('缩放超出范围');
  return { modelPath: data.modelPath, previewPath: data.previewPath, scale: data.scale, rotation: vec(data.rotation, 360), offset: vec(data.offset, 5) };
}

export function versionedModelPath(path: string, revision: string): string {
  return path.startsWith('/assets/parts/') ? `${path}?v=${encodeURIComponent(revision)}` : path;
}
export function readAppearances(raw: string|null): Appearances {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw); const result: Appearances = {};
    for (const [id, item] of Object.entries(value)) {
      const p = item as Appearance;
      if (!/^[hbl]0[1-3]$/.test(id) || !p || typeof p.name !== 'string' || p.name.length > 24 || typeof p.description !== 'string' || p.description.length > 160 || (p.modelPath !== null && !isModelPath(p.modelPath))) continue;
      result[id] = { name:p.name, description:p.description, modelPath:p.modelPath, rotation:Array.isArray(p.rotation) && p.rotation.length === 3 && p.rotation.every(n=>Number.isFinite(n)&&Math.abs(n)<=360) ? p.rotation : [0,0,0], flip:p.flip===true };
    }
    return result;
  } catch { return {}; }
}
