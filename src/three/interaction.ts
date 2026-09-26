/** 玩家用手指拖动 / 戳一下工坊里的造物。DOM 层写入，CreatureRig 每帧读取。 */
export const spin = {
  yaw: 0,
  velocity: 0,
  dragging: false,
  /** 最近一次被戳的时间（performance.now 毫秒），0 表示没有。 */
  pokedAt: 0,
};

export function poke() {
  spin.pokedAt = performance.now();
}
