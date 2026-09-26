import { expect, test } from 'vitest';
import * as THREE from 'three';
import { placeCreatureSlots, proportionScales } from '@/three/assembly';
import { fitTextureDimensions } from '@/three/texture-size';
import { assemble, fitPart } from '@/three/part-fit';
import { versionedModelUrl } from '@/three/model-cache';
import { toonifyMaterials } from '@/three/materials';

test('部件按底部堆叠，脚底为零且接缝有 30% 重叠', () => {
  const slots = placeCreatureSlots([0.8, 1.2, 0.9]);
  expect(slots.legs.bottom).toBe(0);
  expect(slots.legs.top).toBe(0.9);
  expect(slots.body.bottom).toBeCloseTo(0.63);
  expect(slots.head.bottom).toBeCloseTo(1.59);
});

test('头宽限制为身宽 72–100%，腿高限制为身高 60–100%', () => {
  const big = proportionScales([2, 1, 1], [1, 1, 2]);
  expect(2 * big.head).toBeCloseTo(1);
  expect(2 * big.legs).toBeCloseTo(1);
  const small = proportionScales([0.2, 1, 1], [1, 1, 0.2]);
  expect(0.2 * small.head).toBeCloseTo(0.72);
  expect(0.2 * small.legs).toBeCloseTo(0.6);
});

test('贴图长边等比压到 1024，不放大合规贴图', () => {
  expect(fitTextureDimensions(2048, 1024)).toEqual({ width: 1024, height: 512 });
  expect(fitTextureDimensions(1600, 2400)).toEqual({ width: 683, height: 1024 });
  expect(fitTextureDimensions(1024, 512)).toEqual({ width: 1024, height: 512 });
  expect(fitTextureDimensions(0, 2048)).toEqual({ width: 0, height: 0 });
});

test('任意尺寸、偏心的模型适配后底部贴地、水平居中，并按槽位高度缩放', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 2));
  mesh.position.set(7, 20, -3);
  const fitted = fitPart(mesh, 1);
  const box = new THREE.Box3().setFromObject(fitted.object);
  expect(box.min.y).toBeCloseTo(0);
  expect((box.min.x + box.max.x) / 2).toBeCloseTo(0);
  // 瘦高的躯干（高是宽的 2.5 倍）会被压扁到 75%。
  expect(fitted.height).toBeCloseTo(1.2 * 0.75);
  expect(fitPart(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2)), 1).height).toBeCloseTo(1.2);
});

test('三件堆叠后给出两道关节', () => {
  const part = (h: number) => fitPart(new THREE.Mesh(new THREE.BoxGeometry(1, h, 1)), 1);
  const a = assemble([part(1), part(1), part(1)]);
  expect(a.joints).toHaveLength(2);
  expect(a.joints[0].y).toBeLessThan(a.joints[1].y);
  expect(a.height).toBeGreaterThan(2);
});

test('预置模型带版本号，生成模型地址保持不变', () => {
  expect(versionedModelUrl('/assets/parts/h01/model.glb', 'r1')).toBe('/assets/parts/h01/model.glb?v=r1');
  expect(versionedModelUrl('/api/models/12345678-1234-1234-1234-123456789abc', 'r1')).toBe('/api/models/12345678-1234-1234-1234-123456789abc');
});

test('统一材质：金属度 0、粗糙度 0.75、加上轮廓光', () => {
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.1 });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
  expect(toonifyMaterials(root)).toBe(1);
  expect(mat.metalness).toBe(0);
  expect(mat.roughness).toBe(0.75);
  expect(typeof mat.onBeforeCompile).toBe('function');
});

import { nextTier, renderPixelRatio } from '@/three/quality';

test('按设备像素比渲染，避免在高分屏和系统缩放下发糊', () => {
  expect(renderPixelRatio({ devicePixelRatio: 1.5, mobile: false, tier: 'high' })).toBe(1.5);
  expect(renderPixelRatio({ devicePixelRatio: 1.25, mobile: false, tier: 'high' })).toBe(1.25);
  expect(renderPixelRatio({ devicePixelRatio: 3, mobile: true, tier: 'high' })).toBe(2);
  expect(renderPixelRatio({ devicePixelRatio: 3, mobile: true, tier: 'low' })).toBe(1);
  expect(renderPixelRatio({ devicePixelRatio: NaN, mobile: false, tier: 'high' })).toBe(1);
});

test('帧率不足逐级降档，稳定后再回升', () => {
  expect(nextTier('high', 30, false)).toBe('medium');
  expect(nextTier('medium', 30, false)).toBe('low');
  expect(nextTier('low', 20, false)).toBe('low');
  expect(nextTier('low', 60, false)).toBe('medium');
  expect(nextTier('high', 35, true)).toBe('high');
});
