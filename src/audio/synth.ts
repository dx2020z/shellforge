/**
 * 全部音效用 WebAudio 实时合成：水下的铃声与气泡，五声音阶。无需音频文件。
 */
const PENTATONIC = [0, 2, 4, 7, 9];
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    // 一点点延迟混响，让声音像在水里。
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.18;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2400;
    master.connect(lowpass).connect(ctx.destination);
    master.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(lowpass);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.05);
}
export function isMuted() {
  return muted;
}

function note(step: number, octave = 5) {
  const degree = ((step % 5) + 5) % 5;
  const oct = octave + Math.floor(step / 5);
  return 440 * Math.pow(2, (PENTATONIC[degree] + 12 * (oct - 4) - 9) / 12);
}

function tone(freq: number, { at = 0, dur = 0.6, type = 'sine' as OscillatorType, gain = 0.3, attack = 0.005, detune = 0 } = {}) {
  const a = audio();
  if (!a || !master || muted) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** 铃声：基音 + 不协和泛音，像水下的风铃。 */
export function bell(step = 0, octave = 5, gain = 0.22) {
  const f = note(step, octave);
  tone(f, { dur: 1.6, gain });
  tone(f * 2.76, { dur: 0.9, gain: gain * 0.35 });
  tone(f * 5.4, { dur: 0.4, gain: gain * 0.12 });
}

export function bubble(pitch = 1) {
  const a = audio();
  if (!a || !master || muted) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(900 * pitch, t + 0.08);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.15);
}

export function thud(heavy = false) {
  tone(heavy ? 70 : 110, { dur: 0.25, type: 'triangle', gain: heavy ? 0.5 : 0.35 });
  tone(heavy ? 45 : 60, { dur: 0.35, type: 'sine', gain: 0.3 });
}

export function blockSound() {
  tone(520, { dur: 0.3, type: 'triangle', gain: 0.18 });
  tone(780, { dur: 0.25, gain: 0.1, at: 0.02 });
}

/** 完美应对：音高逐次上升。 */
export function perfectChime(streak: number) {
  const base = Math.min(streak, 8);
  bell(base, 5, 0.25);
  bell(base + 2, 5, 0.18);
}

export function tideRumble() {
  tone(55, { dur: 1.4, type: 'sine', gain: 0.25, attack: 0.3 });
  tone(82, { dur: 1.2, type: 'sine', gain: 0.12, attack: 0.4 });
}

export function burstSound() {
  [0, 2, 4, 5, 7].forEach((s, i) => bell(s, 4 + Math.floor(i / 3), 0.2));
  tone(60, { dur: 1.2, type: 'sawtooth', gain: 0.08, attack: 0.05 });
}

/** 死亡：渐弱的钟声。 */
export function deathBell() {
  [0, -2, -4].forEach((s, i) => setTimeout(() => bell(s, 4, 0.25 - i * 0.06), i * 1100));
}

export function forgeChime(i: number) {
  bell(i * 2, 5, 0.16);
}

/** 低生命心跳。 */
export function heartbeat() {
  tone(60, { dur: 0.18, type: 'sine', gain: 0.35 });
  tone(55, { dur: 0.2, type: 'sine', gain: 0.25, at: 0.22 });
}

/** 首次交互时调用，解锁移动端的音频。 */
export function unlockAudio() {
  audio();
}
