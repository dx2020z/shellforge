/**
 * 画面清晰度策略。
 * 旧版把像素比固定在 1、关闭抗锯齿：在手机（3 倍屏）和 Windows 125%/150% 缩放的笔记本上，
 * 3D 画面会被拉伸，看起来发糊。新版按设备像素比渲染，帧率不够时逐级降档，而不是一开始就降。
 */
export type QualityTier = 'high' | 'medium' | 'low';

export interface QualityInput {
  devicePixelRatio: number;
  /** 触屏小屏设备。 */
  mobile: boolean;
  tier: QualityTier;
}

const CAP: Record<QualityTier, { desktop: number; mobile: number }> = {
  high: { desktop: 2, mobile: 2 },
  medium: { desktop: 1.5, mobile: 1.5 },
  low: { desktop: 1, mobile: 1 },
};

/** 实际渲染像素比：不超过设备像素比，也不超过当前档位上限。 */
export function renderPixelRatio({ devicePixelRatio, mobile, tier }: QualityInput): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const cap = mobile ? CAP[tier].mobile : CAP[tier].desktop;
  return Math.max(1, Math.min(dpr, cap));
}

/**
 * 根据最近的平均帧时间决定是否降档或回升：
 * 连续低于 45 帧（桌面）/ 28 帧（手机）降一档；稳定高于 58 / 40 帧才回升，避免来回抖动。
 */
export function nextTier(current: QualityTier, averageFps: number, mobile: boolean): QualityTier {
  const low = mobile ? 28 : 45;
  const high = mobile ? 40 : 58;
  const order: QualityTier[] = ['low', 'medium', 'high'];
  const index = order.indexOf(current);
  if (averageFps < low && index > 0) return order[index - 1];
  if (averageFps > high && index < order.length - 1) return order[index + 1];
  return current;
}
