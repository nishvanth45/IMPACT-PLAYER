import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function extractReadableMessage(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as {
      error?: string;
      operationType?: string;
      path?: string;
    };
    if (parsed && typeof parsed.error === 'string') {
      if (parsed.error.toLowerCase().includes('quota exceeded')) {
        return 'Cloud save quota exceeded for today. Your quota resets tomorrow.';
      }
      return `Cloud sync error (${parsed.operationType ?? 'operation'}): ${parsed.error}`;
    }
  } catch {
    // Standard non-JSON Error message
  }
  return error.message || 'An unexpected application error occurred.';
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: extractReadableMessage(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#080B0D] px-4 py-8 text-[#F5F2EA]">
          <div className="w-full max-w-lg border border-[#263039] bg-[#0E1318] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#E44949]/50 bg-[#231012] text-[#E44949]">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase">
              Something Went Wrong
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#9DA8B3] sm:text-sm">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-6 py-2 font-mono text-xs font-extrabold tracking-wider text-[#06110A] uppercase hover:bg-[#3CE282]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
