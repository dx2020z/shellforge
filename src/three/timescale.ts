/**
 * 全局时间流速：命中停顿（60–90ms 冻结）与完美应对慢动作（0.3 秒）共用。
 * 场景里的动画都用 advance() 得到的时间，而不是真实时间。
 */
let scale = 1;
let freezeUntil = 0;
let slowUntil = 0;
let clock = 0;
let reduced = false;

export function setReducedMotion(value: boolean) {
  reduced = value;
}
export function isReducedMotion() {
  return reduced;
}

/** 命中停顿。 */
export function hitStop(ms = 75) {
  freezeUntil = Math.max(freezeUntil, performance.now() + ms);
}
/** 慢动作；减少动态效果时跳过。 */
export function slowMotion(ms = 300, factor = 0.3) {
  if (reduced) return;
  slowUntil = performance.now() + ms;
  scale = factor;
}

export function advance(delta: number): number {
  const now = performance.now();
  let factor = 1;
  if (now < freezeUntil) factor = 0;
  else if (now < slowUntil) factor = scale;
  clock += Math.min(delta, 0.1) * factor;
  return clock;
}
export function gameTime() {
  return clock;
}
