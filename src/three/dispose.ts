import * as THREE from 'three';

/** 释放几何与材质；贴图默认也释放，缓存模板共享的贴图传 disposeTextures:false。 */
export function disposeObject(object: THREE.Object3D, options: { disposeTextures?: boolean } = {}) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse(o => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    }
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) {
    if (options.disposeTextures !== false) for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
    m.dispose();
  }
  for (const t of textures) t.dispose();
}
