'use client';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gameTime } from './timescale';

/** 画在 Canvas 上的径向渐变贴图，用于光斑、光束、地面。 */
function gradientTexture(stops: [number, string][], size = 256, radial = true) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = radial ? ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2) : ctx.createLinearGradient(0, 0, 0, size);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 海草剪影：几条弯曲的叶子，作为远景视差层。 */
function kelpTexture(seed: number) {
  const w = 128, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = (i: number) => {
    const x = Math.sin(seed * 91.7 + i * 12.9) * 43758.5;
    return x - Math.floor(x);
  };
  for (let blade = 0; blade < 3; blade++) {
    const x0 = 30 + rand(blade) * 70;
    const width = 8 + rand(blade + 5) * 10;
    ctx.beginPath();
    ctx.moveTo(x0 - width, h);
    for (let y = h; y > 40 + rand(blade + 9) * 120; y -= 16) {
      const sway = Math.sin(y * 0.018 + blade * 2) * (12 + blade * 4);
      ctx.lineTo(x0 + sway - width * (y / h), y);
    }
    for (let y = 40 + rand(blade + 9) * 120; y < h; y += 16) {
      const sway = Math.sin(y * 0.018 + blade * 2) * (12 + blade * 4);
      ctx.lineTo(x0 + sway + width * (y / h), y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(6, 26, 22, ${0.75 + rand(blade + 3) * 0.2})`;
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface SeaEnvironmentProps {
  /** 擂台模式：显示潮水面。 */
  arena: boolean;
  /** 潮位 0–1。 */
  tide: number;
  enraged: boolean;
  /** 低生命时，场景边缘泛红由 DOM 负责；这里把光调暗一点。 */
  danger: boolean;
  /** 连续完美应对的次数：背景鱼群越聚越多。 */
  school: number;
}

const FOG = new THREE.Color('#0b2a26');
const FOG_ENRAGED = new THREE.Color('#2a1a14');

export function SeaEnvironment({ arena, tide, enraged, danger, school }: SeaEnvironmentProps) {
  const { scene } = useThree();
  const textures = useMemo(
    () => ({
      floor: gradientTexture([[0, '#2b6a5c'], [0.45, '#15403a'], [1, 'rgba(7,19,15,0)']], 512),
      glow: gradientTexture([[0, 'rgba(159,240,216,0.9)'], [0.4, 'rgba(159,240,216,0.25)'], [1, 'rgba(159,240,216,0)']]),
      warm: gradientTexture([[0, 'rgba(255,201,138,0.8)'], [0.5, 'rgba(255,201,138,0.15)'], [1, 'rgba(255,201,138,0)']]),
      ray: gradientTexture([[0, 'rgba(210,255,240,0.0)'], [0.15, 'rgba(210,255,240,0.22)'], [1, 'rgba(210,255,240,0)']], 256, false),
      kelp: [kelpTexture(1), kelpTexture(2), kelpTexture(3)],
    }),
    [],
  );

  const fogColor = useRef(FOG.clone());
  const rays = useRef<THREE.Group>(null);
  const kelp = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  const motes = useRef<THREE.Points>(null);
  const fish = useRef<THREE.InstancedMesh>(null);
  const key = useRef<THREE.DirectionalLight>(null);

  const moteGeometry = useMemo(() => {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.sin(i * 12.9898) * 43758.5453) % 1 * 16;
      positions[i * 3 + 1] = ((i * 0.37) % 1) * 7;
      positions[i * 3 + 2] = (Math.cos(i * 78.233) * 12543.123) % 1 * 10 - 3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  const fishGeometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.05, 0.22, 5);
    g.rotateZ(-Math.PI / 2);
    return g;
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    const t = gameTime();
    // 雾色与背景：狂暴时偏暖。
    fogColor.current.lerp(enraged ? FOG_ENRAGED : FOG, Math.min(1, delta * 2));
    scene.background = fogColor.current;
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(fogColor.current);
    if (key.current) key.current.intensity = THREE.MathUtils.lerp(key.current.intensity, danger ? 1.6 : 2.6, delta * 2);

    if (rays.current) rays.current.children.forEach((ray, i) => {
      ray.rotation.z = Math.sin(t * 0.25 + i * 1.7) * 0.08 + (i - 2) * 0.12;
      ((ray as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 0.6 + i * 2.1) * 0.15;
    });
    if (kelp.current) kelp.current.children.forEach((k, i) => {
      k.rotation.z = Math.sin(t * 0.7 + i) * 0.05;
    });
    if (motes.current) {
      const pos = motes.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + delta * (0.12 + (i % 7) * 0.02);
        if (y > 7) y = 0;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    if (water.current) {
      const target = -0.25 + tide * 1.1;
      water.current.position.y = THREE.MathUtils.lerp(water.current.position.y, arena ? target : -0.4, Math.min(1, delta * 1.5));
      const material = water.current.material as THREE.MeshBasicMaterial;
      material.color.lerp(new THREE.Color(enraged ? '#ee9a45' : '#9ff0d8'), delta * 2);
      material.opacity = arena ? 0.1 + tide * 0.12 : 0;
    }
    if (fish.current) {
      const count = Math.min(60, 6 + school * 9);
      fish.current.count = count;
      for (let i = 0; i < count; i++) {
        const a = t * (0.25 + (i % 5) * 0.03) + i * 0.7;
        const r = 5.5 + (i % 7) * 0.35;
        dummy.position.set(Math.cos(a) * r, 3 + Math.sin(i * 1.3) * 1.2 + Math.sin(t + i) * 0.15, Math.sin(a) * r * 0.5 - 4.5);
        dummy.rotation.set(0, -a - Math.PI / 2, Math.sin(t * 3 + i) * 0.2);
        dummy.updateMatrix();
        fish.current.setMatrixAt(i, dummy.matrix);
      }
      fish.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <fogExp2 attach="fog" args={['#0b2a26', 0.07]} />
      <hemisphereLight args={['#cdf8ee', '#1b3a34', 1.9]} />
      <directionalLight ref={key} position={[4, 8, 6]} intensity={2.6} color="#ffd9aa" />
      <directionalLight position={[-5, 4, -4]} intensity={1.4} color="#7ff0d0" />
      <pointLight position={[0, 0.4, 1.6]} intensity={6} distance={6} color="#9ff0d8" />

      {/* 地面与光斑 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <circleGeometry args={[14, 64]} />
        <meshBasicMaterial map={textures.floor} transparent depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial map={textures.glow} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* 擂台边的金色刻度环 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <ringGeometry args={[3.05, 3.1, 96]} />
        <meshBasicMaterial color="#d4ae63" transparent opacity={arena ? 0.55 : 0.18} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.72, 2.74, 96]} />
        <meshBasicMaterial color="#9ff0d8" transparent opacity={arena ? 0.4 : 0.12} />
      </mesh>

      {/* 海面透下来的光束 */}
      <group ref={rays} position={[0, 7, -3]}>
        {[-3.5, -1.5, 0.3, 2.2, 4].map((x, i) => (
          <mesh key={i} position={[x, -3, -i * 0.4]}>
            <planeGeometry args={[1.2 + (i % 2) * 0.6, 12]} />
            <meshBasicMaterial map={textures.ray} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* 远景海草 */}
      <group ref={kelp}>
        {[-7, -5.2, -3.6, 3.4, 5.6, 7.4].map((x, i) => (
          <mesh key={i} position={[x, 2.6, -6 - (i % 3)]}>
            <planeGeometry args={[2.2, 7]} />
            <meshBasicMaterial map={textures.kelp[i % 3]} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* 暖色灯笼光团（生物荧光） */}
      {[[-4.5, 2.4, -4], [4.8, 3.2, -5], [-2.2, 4.4, -6.5]].map((p, i) => (
        <sprite key={i} position={p as [number, number, number]} scale={[1.6, 1.6, 1]}>
          <spriteMaterial map={i === 1 ? textures.warm : textures.glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55} />
        </sprite>
      ))}

      {/* 漂浮微粒 */}
      <points ref={motes} geometry={moteGeometry} position={[-8, 0, 0]}>
        <pointsMaterial size={0.045} color="#d6faee" transparent opacity={0.7} depthWrite={false} sizeAttenuation />
      </points>

      {/* 鱼群 */}
      <instancedMesh ref={fish} args={[fishGeometry, undefined, 60]}>
        <meshBasicMaterial color="#a8e6d6" transparent opacity={0.55} />
      </instancedMesh>

      {/* 潮水面 */}
      <mesh ref={water} rotation-x={-Math.PI / 2} position={[0, -0.4, 0]}>
        <circleGeometry args={[9, 64]} />
        <meshBasicMaterial color="#9ff0d8" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
