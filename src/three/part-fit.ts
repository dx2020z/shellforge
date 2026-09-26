import * as THREE from 'three';
import { placeCreatureSlots, proportionScales, type CreaturePlacements } from './assembly';
import type { Vec3 } from '@/domain/types';

/** 每个槽位的目标尺寸（场景单位）。头、躯、足按包围盒等比缩放到这里。 */
export const SLOT_TARGET_HEIGHT = [0.8, 1.2, 0.9] as const;
export const SLOT_TARGET_WIDTH = [1.0, 1.25, 1.05] as const;

export interface FittedPart {
  /** 已经居中、脚底落在 y=0 的包装节点。 */
  object: THREE.Group;
  height: number;
  width: number;
  /** 正面看过去的宽度（x 方向）：头和身子的比例按它来算，尾巴、背鳍不算进去。 */
  frontWidth?: number;
}

/**
 * 把任意模型包进一个包装节点：先按校准角度旋转，再水平居中、底部贴地，
 * 最后等比缩放到槽位目标尺寸。场景、造物卡离屏渲染都用这一个函数。
 */
export function fitPart(model: THREE.Object3D, slotIndex: 0 | 1 | 2, rotation: Vec3 = [0, 0, 0], extraScale = 1): FittedPart {
  const oriented = new THREE.Group();
  oriented.rotation.set(...(rotation.map(THREE.MathUtils.degToRad) as Vec3));
  oriented.add(model);
  oriented.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(oriented);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 1e-4) throw new Error('模型为空');

  const width = Math.max(size.x, size.z);
  const maxWidth = slotIndex === 0 ? SLOT_TARGET_WIDTH[1] * 0.9 : SLOT_TARGET_WIDTH[slotIndex];
  let factor = Math.min(SLOT_TARGET_HEIGHT[slotIndex] / size.y, maxWidth / Math.max(width, 1e-4)) * extraScale;
  if (slotIndex === 0) {
    const minWidth = SLOT_TARGET_WIDTH[1] * 0.72;
    if (width * factor < minWidth) factor = Math.min(minWidth / Math.max(width, 1e-4), SLOT_TARGET_HEIGHT[0] / size.y) * extraScale;
  }
  oriented.position.set(-center.x, -box.min.y, -center.z);
  const wrapper = new THREE.Group();
  wrapper.scale.setScalar(factor);
  // 躯干太瘦高时（像花瓶），轻轻压扁一点，最多压到 75%，让造物更像一只动物而不是一根柱子。
  let squash = 1;
  if (slotIndex === 1) {
    const ratio = size.y / Math.max(width, 1e-4);
    if (ratio > 1.25) squash = Math.max(0.75, 1.25 / ratio);
    wrapper.scale.y *= squash;
  }
  wrapper.add(oriented);
  return { object: wrapper, height: size.y * factor * squash, width: width * factor, frontWidth: size.x * factor };
}

export interface Assembly {
  root: THREE.Group;
  /** 头、躯、足三个锚点，动画直接驱动它们。 */
  anchors: [THREE.Group, THREE.Group, THREE.Group];
  placements: CreaturePlacements;
  /** 两道关节（足-躯、躯-头）的高度与半径，用来放关节光环。 */
  joints: { y: number; radius: number }[];
  height: number;
}

/** 把三件已适配的部件按比例约束和 30% 重叠堆叠成一只造物。 */
export function assemble(parts: [FittedPart, FittedPart, FittedPart]): Assembly {
  const root = new THREE.Group();
  const anchors = parts.map(part => {
    const anchor = new THREE.Group();
    anchor.add(part.object);
    root.add(anchor);
    return anchor;
  }) as Assembly['anchors'];
  const heights = parts.map(p => p.height) as [number, number, number];
  const widths = parts.map(p => p.width) as [number, number, number];
  const fronts = parts.map(p => p.frontWidth ?? p.width) as [number, number, number];
  const scales = proportionScales(fronts, heights);
  parts[0].object.scale.multiplyScalar(scales.head);
  heights[0] *= scales.head;
  widths[0] *= scales.head;
  parts[2].object.scale.multiplyScalar(scales.legs);
  heights[2] *= scales.legs;
  widths[2] *= scales.legs;
  const placements = placeCreatureSlots(heights);
  anchors[0].position.y = placements.head.bottom;
  anchors[1].position.y = placements.body.bottom;
  anchors[2].position.y = placements.legs.bottom;
  const joints = [
    { y: placements.legs.top, radius: Math.max(0.1, Math.min(widths[1], widths[2]) * 0.52) },
    { y: placements.body.top, radius: Math.max(0.1, Math.min(widths[0], widths[1]) * 0.52) },
  ];
  return { root, anchors, placements, joints, height: placements.head.top };
}

/** 按包围盒给出四分之三正面视角的相机位置（造物卡与图鉴标本用）。 */
export function threeQuarterCamera(bounds: THREE.Box3, fovDeg: number, aspect: number, margin = 1.12) {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const verticalHalf = THREE.MathUtils.degToRad(fovDeg / 2);
  const horizontalHalf = Math.atan(Math.tan(verticalHalf) * aspect);
  const radius = Math.max(size.length() * 0.5, 0.5);
  const distance = (radius / Math.sin(Math.min(verticalHalf, horizontalHalf))) * margin;
  const direction = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(28)), Math.sin(THREE.MathUtils.degToRad(12)), Math.cos(THREE.MathUtils.degToRad(28))).normalize();
  return { position: center.clone().add(direction.multiplyScalar(distance)), target: center };
}
