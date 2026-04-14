"use client";

import React from 'react';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep console logging now; can be replaced by external monitoring later.
    console.error('Global UI runtime error:', error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-telegram-screen safe-screen-padding flex items-center justify-center bg-[#0b1220] px-4 text-white">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/5 p-6 text-center shadow-xl">
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-300">An unexpected UI error occurred.</p>
            <button
              type="button"
              className="mt-5 min-h-[44px] rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
              onClick={this.handleReload}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
