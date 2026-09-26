import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fitTextureDimensions } from './texture-size';
import { matteMaterials, toonifyMaterials } from './materials';

/** 预置 GLB 更新时改这个版本号，浏览器缓存随之失效；生成模型地址本身唯一，不加版本。 */
export const PRESET_ASSET_REVISION = 'v2-1';
export const MAX_GLB_BYTES = 40 * 1024 * 1024;

export function versionedModelUrl(url: string, revision = PRESET_ASSET_REVISION): string {
  return url.startsWith('/assets/parts/') ? `${url}?v=${encodeURIComponent(revision)}` : url;
}

const parsed = new Map<string, Promise<THREE.Group>>();

function sourceSize(source: unknown): { width: number; height: number } | null {
  if (!source || typeof source !== 'object') return null;
  const value = source as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const width = value.naturalWidth && value.naturalWidth > 0 ? value.naturalWidth : value.width;
  const height = value.naturalHeight && value.naturalHeight > 0 ? value.naturalHeight : value.height;
  return typeof width === 'number' && typeof height === 'number' ? { width, height } : null;
}

/** 在模板上一次性把贴图长边压到上限，发生在首次上传 GPU 之前。 */
export function capModelTextures(root: THREE.Object3D, maxEdge = 1024): number {
  if (typeof document === 'undefined') return 0;
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  let resized = 0;
  for (const texture of textures) {
    const source = texture.source?.data;
    const size = sourceSize(source);
    if (!size) continue;
    const target = fitTextureDimensions(size.width, size.height, maxEdge);
    if (!target.width || (target.width === size.width && target.height === size.height)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) continue;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    try {
      context.drawImage(source as CanvasImageSource, 0, 0, target.width, target.height);
    } catch {
      continue;
    }
    texture.image = canvas;
    texture.needsUpdate = true;
    resized++;
  }
  return resized;
}

async function parseOnce(url: string): Promise<THREE.Group> {
  let pending = parsed.get(url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(versionedModelUrl(url), { cache: 'force-cache' });
      if (!response.ok) throw new Error(`GLB ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_GLB_BYTES) throw new Error('GLB 超过 40 MB');
      const manager = new THREE.LoadingManager();
      // 只允许内嵌贴图，拒绝 GLB 引用外部地址。
      manager.setURLModifier(value => {
        if (!value.startsWith('blob:') && !value.startsWith('data:')) throw new Error('GLB 必须内嵌贴图');
        return value;
      });
      const scene = (await new GLTFLoader(manager).parseAsync(buffer, '')).scene;
      scene.userData.resizedTextures = capModelTextures(scene);
      matteMaterials(scene);
      return scene;
    })();
    parsed.set(url, pending);
    pending.catch(() => {
      if (parsed.get(url) === pending) parsed.delete(url);
    });
  }
  return pending;
}

/** 每个地址只下载解析一次；返回独立的几何与材质克隆，贴图共享。 */
export async function cloneCachedModel(url: string): Promise<THREE.Group> {
  const template = await parseOnce(url);
  const clone = template.clone(true);
  clone.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
  });
  toonifyMaterials(clone);
  return clone;
}

export function preloadModel(url: string): void {
  void parseOnce(url).catch(() => {});
}
