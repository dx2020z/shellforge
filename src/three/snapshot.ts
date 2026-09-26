'use client';
import * as THREE from 'three';
import type { Vec3 } from '@/domain/types';
import { loadPart } from './CreatureRig';
import { assemble, fitPart, threeQuarterCamera } from './part-fit';
import { disposeObject } from './dispose';
import { tintMaterials } from './materials';

/**
 * 离屏渲染一只造物的透明底标本照：四分之三正面、按包围盒取景。
 * 造物卡、图鉴、远征地图的守卫头像都用它。整个页面共用一个渲染器，排队执行。
 */

export interface SnapshotOptions {
  width: number;
  height: number;
  /** 取景留白，1 为刚好装下。 */
  margin?: number;
  /** 朝向：正值让它稍微转向右边。 */
  yaw?: number;
  /** 剪影模式：只留一个深色轮廓（未解锁的守卫）。 */
  silhouette?: boolean;
  /** 每件部件的染色。 */
  tints?: (string | null)[];
}

const SLOTS = ['head', 'body', 'legs'] as const;
let renderer: THREE.WebGLRenderer | null = null;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string>>();

function getRenderer(): THREE.WebGLRenderer {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(1);
  return renderer;
}

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight('#cdf8ee', '#1b3a34', 1.9));
  const key = new THREE.DirectionalLight('#ffd9aa', 2.8);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#7ff0d0', 1.6);
  rim.position.set(-5, 4, -4);
  scene.add(rim);
  const fill = new THREE.PointLight('#9ff0d8', 5, 7);
  fill.position.set(0, 0.6, 2);
  scene.add(fill);
}

async function render(urls: readonly (string | null)[], rotations: readonly Vec3[] | undefined, o: SnapshotOptions): Promise<string> {
  const models = await Promise.all(SLOTS.map((slot, i) => loadPart(urls[i] ?? null, slot)));
  models.forEach((m, i) => o.tints?.[i] && !o.silhouette && tintMaterials(m, o.tints[i]!));
  const fitted = models.map((m, i) => fitPart(m, i as 0 | 1 | 2, rotations?.[i] ?? [0, 0, 0])) as Parameters<typeof assemble>[0];
  const built = assemble(fitted);
  built.root.rotation.y = o.yaw ?? 0;
  const scene = new THREE.Scene();
  scene.add(built.root);
  if (o.silhouette) {
    built.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.material = new THREE.MeshBasicMaterial({ color: '#0c2520' });
    });
  } else lights(scene);
  built.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(built.root);
  const camera = new THREE.PerspectiveCamera(30, o.width / o.height, 0.05, 100);
  const view = threeQuarterCamera(bounds, 30, o.width / o.height, o.margin ?? 1.05);
  camera.position.copy(view.position);
  camera.lookAt(view.target);
  const gl = getRenderer();
  gl.setSize(o.width, o.height, false);
  gl.clear();
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL('image/png');
  disposeObject(built.root, { disposeTextures: false });
  return url;
}

/** 返回 PNG dataURL；同样的造物和尺寸只渲染一次。 */
export function snapshotCreature(urls: readonly (string | null)[], rotations: readonly Vec3[] | undefined, options: SnapshotOptions): Promise<string> {
  const key = JSON.stringify([urls, rotations ?? null, options]);
  const hit = cache.get(key);
  if (hit) return hit;
  const job = queue.then(() => render(urls, rotations, options));
  queue = job.catch(() => undefined);
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}

/** 把 dataURL 解码成可以画进 Canvas 2D 的图片。 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
