import * as THREE from 'three';

/**
 * 3D 与 HTML 覆盖层之间的桥：场景每帧把关键点（守卫头顶、各部位、玩家头顶）
 * 投影成屏幕坐标写进这里，覆盖层用 requestAnimationFrame 直接改 transform，不触发 React 重渲染。
 */
export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export const worldPoints = new Map<string, THREE.Vector3>();
export const screenPoints = new Map<string, ScreenPoint>();

export function setWorldPoint(key: string, point: THREE.Vector3) {
  const existing = worldPoints.get(key);
  if (existing) existing.copy(point);
  else worldPoints.set(key, point.clone());
}

const scratch = new THREE.Vector3();
export function projectAll(camera: THREE.Camera, width: number, height: number) {
  for (const [key, world] of worldPoints) {
    scratch.copy(world).project(camera);
    const point = screenPoints.get(key) ?? { x: 0, y: 0, visible: false };
    point.x = (scratch.x * 0.5 + 0.5) * width;
    point.y = (-scratch.y * 0.5 + 0.5) * height;
    point.visible = scratch.z < 1 && scratch.z > -1;
    screenPoints.set(key, point);
  }
}

export function clearPoints(prefix: string) {
  for (const key of [...worldPoints.keys()]) if (key.startsWith(prefix)) worldPoints.delete(key);
  for (const key of [...screenPoints.keys()]) if (key.startsWith(prefix)) screenPoints.delete(key);
}
