'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export type StageFailureReporter = (message: string) => void;

interface StageErrorBoundaryProps {
  children: (reportFailure: StageFailureReporter, attempt: number) => ReactNode;
  fallback: (state: { error: Error; retry: () => void }) => ReactNode;
}

interface StageErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

/** 捕获舞台的同步渲染异常，也接收 WebGL 上下文丢失通知。 */
export class StageErrorBoundary extends Component<StageErrorBoundaryProps, StageErrorBoundaryState> {
  state: StageErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<StageErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ShellForge] 3D 舞台初始化失败', error, info.componentStack);
  }

  private reportFailure: StageFailureReporter = message => {
    this.setState({ error: new Error(message) });
  };

  private retry = () => {
    this.setState(state => ({ error: null, attempt: state.attempt + 1 }));
  };

  render() {
    if (this.state.error) return this.props.fallback({ error: this.state.error, retry: this.retry });
    return this.props.children(this.reportFailure, this.state.attempt);
  }
}
