import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LoggerService } from '../services/loggerService';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 頂層錯誤邊界：任何視圖元件拋錯時顯示救援畫面而非整頁白屏，
 * 並將錯誤寫入 LoggerService 供 DebugLogModal 檢視
 * (Capacitor 行動裝置沒有 devtools，此處是唯一的錯誤觀察窗口)。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    LoggerService.error('ErrorBoundary', `渲染錯誤: ${error.message}`);
    const stack = info.componentStack || '';
    if (stack) {
      LoggerService.error('ErrorBoundary', `元件堆疊: ${stack}`);
    }
  }

  public render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-white">應用程式發生錯誤</h1>
          <p className="text-xs text-slate-400 break-words">{error.message}</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            錯誤已記錄到系統日誌（🛠️ 系統診斷與日誌可查看）。
            學習資料儲存於本機 localStorage，此錯誤不會造成資料遺失。
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              重新載入
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors"
            >
              回到應用
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
