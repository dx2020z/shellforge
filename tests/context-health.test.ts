import { expect, test, vi } from 'vitest';
import { observeWebGLContext } from '@/three/context-health';

test('WebGL 上下文丢失事件会阻止默认恢复并通知舞台保护层', () => {
  const canvas = new EventTarget();
  const visibility = new EventTarget();
  const onFailure = vi.fn();
  const cleanup = observeWebGLContext(canvas, visibility, () => true, () => false, onFailure);
  const event = new Event('webglcontextlost', { cancelable: true });

  canvas.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(true);
  expect(onFailure).toHaveBeenCalledWith('浏览器回收了图形资源');
  cleanup();
});

test('切回页面时发现上下文已经丢失会进入降级', () => {
  const canvas = new EventTarget();
  const visibility = new EventTarget();
  const onFailure = vi.fn();
  let visible = false;
  const cleanup = observeWebGLContext(canvas, visibility, () => visible, () => true, onFailure);

  expect(onFailure).not.toHaveBeenCalled();
  visible = true;
  visibility.dispatchEvent(new Event('visibilitychange'));
  expect(onFailure).toHaveBeenCalledWith('浏览器回收了图形资源');
  cleanup();
});
