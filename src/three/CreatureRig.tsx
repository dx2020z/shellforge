'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Slot } from '@/domain/keywords';
import type { Vec3 } from '@/domain/types';
import { cloneCachedModel } from './model-cache';
import { assemble, fitPart, type Assembly } from './part-fit';
import { addRimLight, setFlash, tintMaterials } from './materials';
import { disposeObject } from './dispose';
import { setWorldPoint } from './anchors';
import { gameTime, isReducedMotion } from './timescale';
import { spin } from './interaction';

const SLOT_INDEX: Record<Slot, 0 | 1 | 2> = { head: 0, body: 1, legs: 2 };
const SLOTS: Slot[] = ['head', 'body', 'legs'];

export interface RigHandle {
  /** 受击：该部件单独抖动并闪白。 */
  hit(slot: Slot | 'any', heavy?: boolean): void;
  /** 向对手扑过去再退回。 */
  lunge(): void;
  /** 击碎一个部位：它碎裂掉落。 */
  shatter(slot: Slot): void;
  /** 胜利的小跳。 */
  hop(): void;
  /** 闪避：向侧后方滑开再回来。 */
  dodge(): void;
}

export interface CreatureRigProps {
  /** 锚点前缀，例如 player / guard。 */
  id: string;
  urls: [string | null, string | null, string | null];
  rotations?: [Vec3, Vec3, Vec3];
  /** 每件部件的染色（null 表示不染）。 */
  tints?: [string | null, string | null, string | null];
  position: Vec3;
  /** 绕 Y 轴的朝向。 */
  facing: number;
  scale?: number;
  /** 从上方落位的入场动画（锻造仪式）。 */
  dropIn?: boolean;
  /** 已碎的部位（战斗恢复时直接隐藏）。 */
  broken?: Slot[];
  dead?: boolean;
  /** 关节光环颜色。 */
  jointColor?: string;
  /** 彩蛋：猫会伸懒腰、肥皂会冒泡泡。 */
  secrets?: string[];
  onReady?: () => void;
}

/** 模型加载失败时的兜底：圆润的卡通块，不会让场景空着。 */
export function fallbackPart(slot: Slot): THREE.Group {
  const g = new THREE.Group();
  const color = slot === 'head' ? '#f2a36b' : slot === 'body' ? '#6fd8b6' : '#b3a9db';
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 });
  addRimLight(material);
  if (slot === 'head') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), material));
    for (const x of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#07130f' }));
      eye.position.set(x, 0.05, 0.41);
      g.add(eye);
    }
  } else if (slot === 'body') {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.5, 8, 16), material);
    g.add(m);
  } else {
    for (const x of [-0.25, 0.25]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 6, 12), material);
      leg.position.x = x;
      g.add(leg);
    }
  }
  return g;
}

export async function loadPart(url: string | null, slot: Slot): Promise<THREE.Object3D> {
  if (!url) return fallbackPart(slot);
  try {
    return await cloneCachedModel(url);
  } catch {
    return fallbackPart(slot);
  }
}

interface Effects {
  shake: Partial<Record<Slot, { t0: number; heavy: boolean }>>;
  lunge: number;
  hop: number;
  dodge: number;
  shatter: Partial<Record<Slot, number>>;
  born: number;
}

export const CreatureRig = forwardRef<RigHandle, CreatureRigProps>(function CreatureRig(
  { id, urls, rotations, tints, position, facing, scale = 1, dropIn = false, broken = [], dead = false, jointColor = '#9ff0d8', secrets = [], onReady },
  ref,
) {
  const root = useRef<THREE.Group>(null);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const rings = useRef<THREE.Mesh[]>([]);
  const fx = useRef<Effects>({ shake: {}, lunge: -10, hop: -10, dodge: -10, shatter: {}, born: 0 });
  const bubbles = useRef<THREE.Group>(null);
  const key = urls.join('|') + JSON.stringify(rotations ?? []) + JSON.stringify(tints ?? []);

  useEffect(() => {
    let cancelled = false;
    let built: Assembly | null = null;
    void (async () => {
      const models = await Promise.all(SLOTS.map((slot, i) => loadPart(urls[i], slot)));
      if (cancelled) {
        models.forEach(m => disposeObject(m, { disposeTextures: false }));
        return;
      }
      models.forEach((m, i) => tints?.[i] && tintMaterials(m, tints[i]!));
      const fitted = models.map((m, i) => fitPart(m, i as 0 | 1 | 2, rotations?.[i] ?? [0, 0, 0])) as Parameters<typeof assemble>[0];
      built = assemble(fitted);
      // 关节光环：足-躯、躯-头两道。
      rings.current = built.joints.map(joint => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(joint.radius, 0.018, 6, 64),
          new THREE.MeshBasicMaterial({ color: jointColor, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = joint.y;
        built!.root.add(ring);
        return ring;
      });
      fx.current.born = gameTime();
      setAssembly(built);
      onReady?.();
    })();
    return () => {
      cancelled = true;
      if (built) disposeObject(built.root, { disposeTextures: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useImperativeHandle(ref, () => ({
    hit(slot, heavy = false) {
      const t = gameTime();
      const targets = slot === 'any' ? SLOTS : [slot];
      for (const s of targets) fx.current.shake[s] = { t0: t, heavy };
    },
    lunge() {
      fx.current.lunge = gameTime();
    },
    shatter(slot) {
      fx.current.shatter[slot] = gameTime();
    },
    hop() {
      fx.current.hop = gameTime();
    },
    dodge() {
      fx.current.dodge = gameTime();
    },
  }));

  const worldScratch = useRef(new THREE.Vector3());

  useFrame(() => {
    const g = root.current;
    if (!g || !assembly) return;
    const t = gameTime();
    const reduced = isReducedMotion();
    const since = t - fx.current.born;

    // 入场：从上方落下，带一点回弹。
    let dropY = 0;
    if (dropIn && since < 1.4) {
      const p = Math.min(1, since / 1.1);
      dropY = (1 - easeOutBack(p)) * 2.2;
    }

    // 扑击：0.35 秒前冲再退回。
    const l = t - fx.current.lunge;
    const lunge = l >= 0 && l < 0.45 ? Math.sin((l / 0.45) * Math.PI) * 0.9 : 0;
    const h = t - fx.current.hop;
    const hop = h >= 0 && h < 0.6 ? Math.sin((h / 0.6) * Math.PI) * 0.45 : 0;

    const bob = reduced ? 0 : Math.sin(t * 1.6) * 0.04;
    const dg = t - fx.current.dodge;
    const dodge = dg >= 0 && dg < 0.55 ? Math.sin((dg / 0.55) * Math.PI) : 0;
    g.position.set(
      position[0] + Math.sin(facing) * lunge - Math.sin(facing) * dodge * 0.7 + Math.cos(facing) * dodge * 0.9,
      position[1] + bob + dropY + hop + dodge * 0.25,
      position[2] + Math.cos(facing) * lunge - Math.cos(facing) * dodge * 0.7 - Math.sin(facing) * dodge * 0.9,
    );
    // 工坊里可以拖着转、戳一下会跳。
    if (id === 'player') {
      if (!spin.dragging) {
        spin.yaw += spin.velocity;
        spin.velocity *= 0.92;
        if (Math.abs(spin.velocity) < 0.002) spin.yaw *= 0.97;
      }
      if (spin.pokedAt) {
        fx.current.hop = t;
        spin.pokedAt = 0;
      }
    }
    g.rotation.y = facing + (id === 'player' ? spin.yaw : 0);

    // 倒下：侧倒并下沉。
    if (dead) {
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 1.25, 0.03);
      g.position.y -= 0.35;
    } else g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, 0.1);

    const [head, body, legs] = assembly.anchors;
    // 待机：身体呼吸、头部轻晃、腿部交替。
    const breathe = reduced ? 0 : Math.sin(t * 2.1) * 0.022;
    if (!broken.includes('body') && fx.current.shatter.body === undefined) body.scale.set(1 - breathe * 0.4, 1 + breathe, 1 - breathe * 0.4);
    head.rotation.z = reduced ? 0 : Math.sin(t * 1.3) * 0.06;
    head.rotation.x = reduced ? 0 : Math.sin(t * 0.9) * 0.03;
    legs.rotation.z = reduced ? 0 : Math.sin(t * 2.4) * 0.025;

    // 彩蛋：猫每隔一阵伸个懒腰（身体拉长、头后仰）。
    if (secrets.includes('cat-stretch') && !reduced) {
      const phase = (t % 11) / 11;
      if (phase > 0.86) {
        const s = Math.sin(((phase - 0.86) / 0.14) * Math.PI);
        body.scale.x += s * 0.12;
        body.scale.y -= s * 0.06;
        head.rotation.x -= s * 0.35;
      }
    }

    // 受击：该部件单独抖动与闪白。
    for (const slot of SLOTS) {
      const anchor = assembly.anchors[SLOT_INDEX[slot]];
      const shake = fx.current.shake[slot];
      const base = anchor.userData.baseX ?? (anchor.userData.baseX = anchor.position.x);
      if (shake) {
        const d = t - shake.t0;
        if (d < 0.32) {
          const amp = (shake.heavy ? 0.12 : 0.07) * (1 - d / 0.32);
          anchor.position.x = base + Math.sin(d * 70) * amp;
          setFlash(anchor, (1 - d / 0.32) * (shake.heavy ? 0.9 : 0.6));
        } else {
          anchor.position.x = base;
          setFlash(anchor, 0);
          delete fx.current.shake[slot];
        }
      }
      // 击碎：碎裂掉落并缩小。
      const shattered = fx.current.shatter[slot];
      if (shattered !== undefined || broken.includes(slot)) {
        const d = shattered !== undefined ? t - shattered : 5;
        const p = Math.min(1, d / 0.9);
        anchor.userData.baseY ??= anchor.position.y;
        anchor.position.y = anchor.userData.baseY - p * p * 1.2;
        anchor.rotation.z = p * (slot === 'legs' ? -0.6 : 0.9);
        const s = Math.max(0.001, 1 - p * 0.95);
        anchor.scale.setScalar(s);
        if (p >= 1) anchor.visible = false;
      }
    }

    // 关节光环：落位后亮起，之后每 3–6 秒呼吸一次（代替眨眼）。
    rings.current.forEach((ring, i) => {
      const material = ring.material as THREE.MeshBasicMaterial;
      let opacity = 0.18;
      if (since < 2.2) opacity = Math.max(0, Math.min(1, (since - 0.9 - i * 0.25) * 2)) * (1 - Math.max(0, since - 1.6));
      opacity = Math.max(opacity, 0.16);
      const cycle = (t + i * 0.4) % 4.6;
      if (cycle < 0.5) opacity += Math.sin((cycle / 0.5) * Math.PI) * 0.55;
      material.opacity = dead ? 0 : opacity;
    });

    // 泡泡彩蛋。
    if (bubbles.current) {
      bubbles.current.children.forEach((b, i) => {
        const y = ((t * 0.5 + i * 0.37) % 1.6);
        b.position.set(Math.sin(t + i * 2) * 0.35, assembly.height * 0.7 + y, Math.cos(t * 0.8 + i) * 0.3);
        b.scale.setScalar(0.04 + (i % 3) * 0.02 + y * 0.02);
      });
    }

    // 覆盖层锚点：头顶、各部位中心。
    const w = worldScratch.current;
    for (const slot of SLOTS) {
      const anchor = assembly.anchors[SLOT_INDEX[slot]];
      const placement = assembly.placements[slot];
      w.set(0, (placement.top - placement.bottom) * 0.5, 0);
      anchor.localToWorld(w);
      setWorldPoint(`${id}:${slot}`, w);
    }
    w.set(0, assembly.height + 0.25, 0);
    g.localToWorld(w);
    setWorldPoint(`${id}:top`, w);
  });

  return (
    <group ref={root} scale={scale}>
      {assembly && <primitive object={assembly.root} />}
      {secrets.includes('bubbles') && (
        <group ref={bubbles}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshBasicMaterial color="#e8fffa" transparent opacity={0.35} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
});

function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
