'use client';
import { useEffect, type RefObject } from 'react';
import { screenPoints } from '@/three/anchors';

/**
 * 让一个 DOM 元素每帧跟随 3D 锚点（例如守卫头顶），直接改 transform，不触发重渲染。
 * clamp：把元素限制在屏幕内，避免手机上意图气泡被裁掉。
 */
export function useAnchor(ref: RefObject<HTMLElement | null>, key: string, options: { offsetY?: number; offsetX?: number; clamp?: boolean; align?: 'center' | 'left'; minTop?: number } = {}) {
  const { offsetY = 0, offsetX = 0, clamp = true, align = 'center', minTop = 68 } = options;
  useEffect(() => {
    let frame = 0;
    // 3D 锚点就绪之前先隐藏，避免元素在左上角闪一下。
    if (ref.current) ref.current.style.opacity = '0';
    const tick = () => {
      const el = ref.current;
      const point = screenPoints.get(key);
      if (el && point) {
        let x = point.x + offsetX;
        let y = point.y + offsetY;
        if (clamp) {
          const w = el.offsetWidth;
          const margin = 12;
          x = align === 'center' ? Math.max(w / 2 + margin, Math.min(window.innerWidth - w / 2 - margin, x)) : Math.max(margin, Math.min(window.innerWidth - w - margin, x));
          y = Math.max(el.offsetHeight + minTop, Math.min(window.innerHeight - margin, y));
        }
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${align === 'center' ? 'translate(-50%, -100%)' : 'translate(0, -50%)'}`;
        el.style.opacity = point.visible ? '' : '0';
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, key, offsetY, offsetX, clamp, align, minTop]);
}
