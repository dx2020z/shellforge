'use client';
import { useEffect, useState } from 'react';
import type { Vec3 } from '@/domain/types';
import type { SnapshotOptions } from '@/three/snapshot';

/** 异步拿到一张造物标本照（dataURL）；three 按需加载，不进首屏。 */
export function useSnapshot(urls: readonly (string | null)[] | null, rotations: readonly Vec3[] | undefined, options: SnapshotOptions): string | null {
  const [src, setSrc] = useState<string | null>(null);
  const key = JSON.stringify([urls, rotations ?? null, options]);
  useEffect(() => {
    if (!urls) return;
    let alive = true;
    void import('@/three/snapshot')
      .then(m => m.snapshotCreature(urls, rotations, options))
      .then(url => alive && setSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return src;
}
