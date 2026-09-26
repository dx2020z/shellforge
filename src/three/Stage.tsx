'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Slot } from '@/domain/keywords';
import type { Vec3 } from '@/domain/types';
import { CreatureRig, type RigHandle } from './CreatureRig';
import { SeaEnvironment } from './SeaEnvironment';
import { projectAll } from './anchors';
import { advance, gameTime } from './timescale';
import { nextTier, renderPixelRatio, type QualityTier } from './quality';
import { observeWebGLContext } from './context-health';

export type StageMode = 'workshop' | 'forge' | 'battle';

export interface StageCreature {
  urls: [string | null, string | null, string | null];
  rotations?: [Vec3, Vec3, Vec3];
  tints?: [string | null, string | null, string | null];
  secrets?: string[];
  /** 变化时重新播放落位动画。 */
  dropKey?: string;
}

export interface StageProps {
  mode: StageMode;
  player: StageCreature | null;
  guard: StageCreature | null;
  playerRef: RefObject<RigHandle | null>;
  guardRef: RefObject<RigHandle | null>;
  tide?: number;
  enraged?: boolean;
  danger?: boolean;
  school?: number;
  playerDead?: boolean;
  guardBroken?: Slot[];
  /** 镜头轻震。 */
  shakeRef?: RefObject<number>;
  /** 画面被全屏界面盖住时暂停渲染，省电。 */
  paused?: boolean;
  /** WebGL 初始化后若上下文丢失，通知外层切换到 2D 舞台。 */
  onFailure?: (message: string) => void;
}

/** 按模式和屏幕比例取景：竖屏手机把镜头拉远拉高，保证两只造物都完整入镜。 */
function framing(mode: StageMode, aspect: number) {
  const portrait = aspect < 0.9;
  if (mode === 'battle') {
    return portrait
      ? { pos: new THREE.Vector3(0, 3.1, 12.6), look: new THREE.Vector3(0, 1.25, 0), player: [-0.78, 0, 0.5] as Vec3, guard: [0.82, 0, -1.3] as Vec3 }
      : { pos: new THREE.Vector3(0, 2.4, 8.2), look: new THREE.Vector3(0, 1.35, 0), player: [-1.9, 0, 0.6] as Vec3, guard: [1.9, 0, -0.4] as Vec3 };
  }
  if (mode === 'forge') {
    return portrait
      ? { pos: new THREE.Vector3(0, 2.0, 8.2), look: new THREE.Vector3(0, 0.75, 0), player: [0, 0, 0] as Vec3, guard: [0, 0, 0] as Vec3 }
      : { pos: new THREE.Vector3(0, 1.9, 6.2), look: new THREE.Vector3(0, 1.35, 0), player: [0, 0, 0] as Vec3, guard: [0, 0, 0] as Vec3 };
  }
  return portrait
    ? { pos: new THREE.Vector3(0, 2.0, 8.4), look: new THREE.Vector3(0, 0.55, 0), player: [0, 0.15, 0] as Vec3, guard: [0, 0, 0] as Vec3 }
    : { pos: new THREE.Vector3(0.6, 1.8, 6.6), look: new THREE.Vector3(0.3, 1.35, 0), player: [0.9, 0.1, 0] as Vec3, guard: [0, 0, 0] as Vec3 };
}

function CameraRig({ mode, shakeRef }: { mode: StageMode; shakeRef?: RefObject<number> }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.3, 0));
  useFrame((_, delta) => {
    const f = framing(mode, size.width / size.height);
    const t = gameTime();
    const sway = new THREE.Vector3(Math.sin(t * 0.21) * 0.25, Math.sin(t * 0.17) * 0.08, 0);
    camera.position.lerp(f.pos.clone().add(sway), Math.min(1, delta * 2.2));
    look.current.lerp(f.look, Math.min(1, delta * 2.2));
    const shake = shakeRef?.current ?? 0;
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      if (shakeRef) shakeRef.current = Math.max(0, shake - delta * 1.2);
    }
    camera.lookAt(look.current);
  });
  return null;
}

/** 推进全局游戏时钟、投影覆盖层锚点、按帧率自动升降清晰度。 */
function Director() {
  const { camera, size, setDpr } = useThree();
  const tier = useRef<QualityTier>('high');
  const samples = useRef({ frames: 0, time: 0 });
  const mobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  useEffect(() => {
    setDpr(renderPixelRatio({ devicePixelRatio: window.devicePixelRatio, mobile, tier: tier.current }));
  }, [setDpr, mobile]);
  useFrame((_, delta) => {
    advance(delta);
    projectAll(camera, size.width, size.height);
    const s = samples.current;
    s.frames++;
    s.time += delta;
    if (s.time > 2.5) {
      const fps = s.frames / s.time;
      const next = nextTier(tier.current, fps, mobile);
      if (next !== tier.current) {
        tier.current = next;
        setDpr(renderPixelRatio({ devicePixelRatio: window.devicePixelRatio, mobile, tier: next }));
      }
      s.frames = 0;
      s.time = 0;
    }
  });
  return null;
}

function ContextHealth({ onFailure }: { onFailure?: (message: string) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    return observeWebGLContext(
      gl.domElement,
      document,
      () => document.visibilityState !== 'hidden',
      () => gl.getContext().isContextLost(),
      message => onFailure?.(message),
    );
  }, [gl, onFailure]);
  return null;
}

function Placed({ mode, player, guard, playerRef, guardRef, playerDead, guardBroken }: Pick<StageProps, 'mode' | 'player' | 'guard' | 'playerRef' | 'guardRef' | 'playerDead' | 'guardBroken'>) {
  const { size } = useThree();
  const f = framing(mode, size.width / size.height);
  const battle = mode === 'battle';
  return (
    <>
      {player && (
        <CreatureRig
          key={`p-${player.dropKey ?? ''}`}
          ref={playerRef}
          id="player"
          urls={player.urls}
          rotations={player.rotations}
          tints={player.tints}
          secrets={player.secrets}
          position={f.player}
          facing={battle ? 0.75 : mode === 'workshop' ? -0.35 : -0.25}
          dropIn={Boolean(player.dropKey)}
          dead={playerDead}
        />
      )}
      {guard && battle && (
        <CreatureRig key={`g-${guard.urls.join()}`} ref={guardRef} id="guard" urls={guard.urls} rotations={guard.rotations} tints={guard.tints} position={f.guard} facing={-0.8} scale={1.18} broken={guardBroken} jointColor="#ee9a45" />
      )}
    </>
  );
}

export default function Stage(props: StageProps) {
  return (
    <Canvas
      camera={{ fov: 34, near: 0.1, far: 80, position: [0, 2, 7] }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
      style={{ position: 'fixed', inset: 0 }}
      frameloop={props.paused ? 'never' : 'always'}
      aria-hidden
    >
      <Director />
      <CameraRig mode={props.mode} shakeRef={props.shakeRef} />
      <ContextHealth onFailure={props.onFailure} />
      <SeaEnvironment arena={props.mode === 'battle'} tide={props.tide ?? 0} enraged={Boolean(props.enraged)} danger={Boolean(props.danger)} school={props.school ?? 0} />
      <Placed {...props} />
    </Canvas>
  );
}
