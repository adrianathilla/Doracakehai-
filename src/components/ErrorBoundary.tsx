import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'Terjadi gangguan tak terduga pada aplikasi.';
    try {
      const parsed = JSON.parse(readable);
      if (parsed && typeof parsed.error === 'string') {
        readable = `Akses data (${parsed.operationType || 'read'} ${parsed.path || ''}): ${parsed.error}`;
      }
    } catch {
      // Bukan JSON FirestoreErrorInfo
    }
    return { hasError: true, errorMessage: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6EFE4] px-4 text-[#2C1810]">
          <div className="w-full max-w-md rounded-3xl border border-[#2C1810]/15 bg-[#FFFDF9] p-6 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 font-serif text-xl font-bold text-[#2C1810]">
              Terjadi Gangguan Aplikasi
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#6E5544]">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#3B2316] px-5 py-2.5 text-sm font-semibold text-[#FBF6EE] transition hover:bg-[#2C1810]"
            >
              <RefreshCw className="h-4 w-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
