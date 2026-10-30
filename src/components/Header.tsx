import React from 'react';
import type { CloudConfig } from '../types';
import { BookMarked, Cloud, CloudOff, Terminal, Sparkles, Wand2 } from 'lucide-react';
import { SpeechService } from '../services/speechService';

interface HeaderProps {
  cloudConfig: CloudConfig;
  onOpenCloudModal: () => void;
  onOpenDebugLogs: () => void;
  onOpenEnrichmentModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cloudConfig,
  onOpenCloudModal,
  onOpenDebugLogs,
  onOpenEnrichmentModal,
}) => {
  return (
    <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg sm:text-xl text-white tracking-tight">英語管家 EngManager</h1>
                <span className="bg-brand-950/90 text-brand-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-brand-800">
                  雲端學習版
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">單字與句子的雲端學習與遊戲複習</p>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Auto Enrich / AI Config Button */}
            <button
              onClick={onOpenEnrichmentModal}
              title="自動尋找補充與 AI 引擎設定"
              className="p-2 text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 rounded-lg transition-colors flex items-center text-xs space-x-1 border border-amber-800 cursor-pointer"
            >
              <Wand2 className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline font-medium">補充設定</span>
            </button>

            {/* Pronunciation Test */}
            <button
              onClick={() => SpeechService.speak('Actions speak louder than words.')}
              title={`測試英文發音 (當前語音: ${SpeechService.getCurrentVoiceName()})`}
              className="p-2 text-slate-300 hover:text-brand-400 hover:bg-slate-800 rounded-lg transition-colors flex items-center text-xs space-x-1 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden md:inline">測試發音</span>
            </button>

            {/* Debug Logs Button */}
            <button
              onClick={onOpenDebugLogs}
              title="查看系統除錯與連線日誌"
              className="p-2 text-slate-300 hover:text-purple-400 hover:bg-purple-950/60 rounded-lg transition-colors flex items-center text-xs space-x-1 border border-slate-700 cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-purple-400" />
              <span className="hidden md:inline">系統診斷</span>
            </button>

            {/* Cloud Sync Button */}
            <button
              onClick={onOpenCloudModal}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                cloudConfig.enabled && cloudConfig.syncStatus === 'success'
                  ? 'bg-sky-950/60 text-sky-300 border-sky-800 hover:bg-sky-900/60'
                  : cloudConfig.enabled && cloudConfig.syncStatus === 'error'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800 hover:bg-rose-900/60'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {cloudConfig.enabled ? (
                <Cloud className="w-4 h-4 text-sky-400" />
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
