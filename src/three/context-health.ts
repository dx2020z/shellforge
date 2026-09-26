const CONTEXT_LOST_MESSAGE = '浏览器回收了图形资源';

/** 监听 WebGL 丢失事件，并在页面重新变为可见时检查是否丢失了上下文。 */
export function observeWebGLContext(
  canvas: EventTarget,
  visibilityTarget: EventTarget,
  isVisible: () => boolean,
  isContextLost: () => boolean,
  onFailure: (message: string) => void,
): () => void {
  const checkContext = () => {
    if (isVisible() && isContextLost()) onFailure(CONTEXT_LOST_MESSAGE);
  };
  const onLost = (event: Event) => {
    event.preventDefault();
    onFailure(CONTEXT_LOST_MESSAGE);
  };
  canvas.addEventListener('webglcontextlost', onLost);
  visibilityTarget.addEventListener('visibilitychange', checkContext);
  checkContext();
  return () => {
    canvas.removeEventListener('webglcontextlost', onLost);
    visibilityTarget.removeEventListener('visibilitychange', checkContext);
  };
}
