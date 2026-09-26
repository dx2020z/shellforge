'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { StageProps } from './Stage';
import { StageErrorBoundary } from './StageErrorBoundary';
import { StageFallback } from './StageFallback';

const Stage = dynamic(() => import('./Stage'), { ssr: false });

interface StageViewportProps extends StageProps {
  creatureName?: string;
}

export function StageViewport({ creatureName, ...stageProps }: StageViewportProps) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  // 隐藏标签不保留 WebGL 上下文，避免后台页与另一个窗口争用浏览器图形资源。
  if (!visible) return null;

  return (
    <StageErrorBoundary
      fallback={({ error, retry }) => <StageFallback mode={stageProps.mode} creatureName={creatureName} error={error} onRetry={retry} />}
    >
      {(reportFailure, attempt) => (
        <Stage
          key={attempt}
          {...stageProps}
          onFailure={reportFailure}
        />
      )}
    </StageErrorBoundary>
  );
}
