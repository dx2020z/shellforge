import * as THREE from 'three';

/**
 * 统一材质：预置件与生成件风格差异很大，渲染端统一成「哑光 + 暖色轮廓光」，
 * 让拼在一起的三件看起来出自同一只手。
 */
export const MATERIAL_STYLE = {
  metalness: 0,
  roughness: 0.75,
  rimColor: new THREE.Color('#FFC98A'),
  rimPower: 2.4,
  rimStrength: 0.55,
} as const;

interface RimUniforms {
  rimColor: { value: THREE.Color };
  rimPower: { value: number };
  rimStrength: { value: number };
  flash: { value: number };
}
/** 材质克隆不会带上 onBeforeCompile，所以用 WeakMap 记录，而不是 userData。 */
const rimMaterials = new WeakMap<THREE.Material, RimUniforms>();

export function addRimLight(material: THREE.MeshStandardMaterial, color = MATERIAL_STYLE.rimColor): void {
  if (rimMaterials.has(material)) return;
  const uniforms: RimUniforms = {
    rimColor: { value: color.clone() },
    rimPower: { value: MATERIAL_STYLE.rimPower },
    rimStrength: { value: MATERIAL_STYLE.rimStrength },
    /** 受击闪白、关节光呼吸等效果共用的额外发光。 */
    flash: { value: 0 },
  };
  rimMaterials.set(material, uniforms);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimStrength;\nuniform float flash;',
      )
      .replace(
        '#include <opaque_fragment>',
        [
          'float rimTerm = pow(saturate(1.0 - abs(dot(normal, normalize(-vViewPosition)))), rimPower);',
          'outgoingLight += rimColor * rimTerm * rimStrength + vec3(flash);',
          '#include <opaque_fragment>',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'shellforge-rim';
  material.needsUpdate = true;
}

/** 只改参数（用于缓存模板）。 */
export function matteMaterials(root: THREE.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.metalness = MATERIAL_STYLE.metalness;
      material.roughness = MATERIAL_STYLE.roughness;
      material.metalnessMap = null;
      material.roughnessMap = null;
    }
  });
}

/** 把一个模型里的所有标准材质改成统一风格并加上轮廓光。返回处理过的材质数。 */
export function toonifyMaterials(root: THREE.Object3D): number {
  let count = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.metalness = MATERIAL_STYLE.metalness;
      material.roughness = MATERIAL_STYLE.roughness;
      material.metalnessMap = null;
      material.roughnessMap = null;
      addRimLight(material);
      count++;
    }
  });
  return count;
}

/** 给部件染上一层颜色（来自它的能力关键词），同一个模型在不同造物身上也不一样。 */
export function tintMaterials(root: THREE.Object3D, color: string, amount = 0.3): void {
  const c = new THREE.Color(color);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial) material.color.lerp(c, amount);
    }
  });
}

/** 受击时单独让某件部件闪一下。 */
export function setFlash(root: THREE.Object3D, amount: number): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const uniforms = rimMaterials.get(material);
      if (uniforms) uniforms.flash.value = amount;
    }
  });
}
