import React from 'react';
import type { CloudConfig } from '../types';
import { BookMarked, Cloud, CloudOff, Terminal, Sparkles } from 'lucide-react';
import { SpeechService } from '../services/speechService';

interface HeaderProps {
  cloudConfig: CloudConfig;
  onOpenCloudModal: () => void;
  onOpenDebugLogs: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cloudConfig,
  onOpenCloudModal,
  onOpenDebugLogs,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg sm:text-xl text-slate-800 tracking-tight">英語管家 EngManager</h1>
                <span className="bg-brand-100 text-brand-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-brand-200">
                  雲端學習版
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">單字與句子的雲端學習與遊戲複習</p>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Pronunciation Test */}
            <button
              onClick={() => SpeechService.speak('Actions speak louder than words.')}
              title="測試英文發音 (Web Speech API)"
              className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center text-xs space-x-1"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden md:inline">測試發音</span>
            </button>

            {/* Debug Logs Button */}
            <button
              onClick={onOpenDebugLogs}
              title="查看系統除錯與連線日誌"
              className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center text-xs space-x-1 border border-slate-200"
            >
              <Terminal className="w-4 h-4 text-purple-600" />
              <span className="hidden md:inline">系統診斷</span>
            </button>

            {/* Cloud Sync Button */}
            <button
              onClick={onOpenCloudModal}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                cloudConfig.enabled && cloudConfig.syncStatus === 'success'
                  ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                  : cloudConfig.enabled && cloudConfig.syncStatus === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cloudConfig.enabled ? (
                <Cloud className="w-4 h-4 text-sky-600" />
              ) : (
                <CloudOff className="w-4 h-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">
                {cloudConfig.enabled ? '雲端同步中' : '設定雲端'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
