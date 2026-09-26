// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StageErrorBoundary } from '@/three/StageErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('捕获舞台初始化异常并显示降级内容；重试后可以重新挂载舞台', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function TestStage({ attempt }: { attempt: number }) {
    if (attempt === 0) throw new Error('WebGL context unavailable');
    return <div>3D 舞台已恢复</div>;
  }

  render(
    <StageErrorBoundary fallback={({ retry }) => <div><p>3D 暂不可用，操作仍可继续</p><button onClick={retry}>重试 3D</button></div>}>
      {(_reportFailure, attempt) => <TestStage key={attempt} attempt={attempt} />}
    </StageErrorBoundary>,
  );

  expect(screen.getByText('3D 暂不可用，操作仍可继续')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '重试 3D' }));
  expect(screen.getByText('3D 舞台已恢复')).toBeTruthy();
});

test('运行中报告 WebGL 上下文丢失时切换到降级内容', () => {
  render(
    <StageErrorBoundary fallback={({ error }) => <p>舞台降级：{error.message}</p>}>
      {reportFailure => <button onClick={() => reportFailure('浏览器回收了图形资源')}>模拟上下文丢失</button>}
    </StageErrorBoundary>,
  );

  fireEvent.click(screen.getByRole('button', { name: '模拟上下文丢失' }));
  expect(screen.getByText('舞台降级：浏览器回收了图形资源')).toBeTruthy();
});
