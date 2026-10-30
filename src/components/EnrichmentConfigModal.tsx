import React, { useState } from 'react';
import type { EnrichmentConfig } from '../types';
import { EnrichmentService } from '../services/enrichmentService';
import { Sparkles, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';

interface EnrichmentConfigModalProps {
  isOpen: boolean;
  config: EnrichmentConfig;
  onClose: () => void;
  onSave: (config: EnrichmentConfig) => void;
}

export const EnrichmentConfigModal: React.FC<EnrichmentConfigModalProps> = ({
  isOpen,
  config,
  onClose,
  onSave,
}) => {
  const [autoEnrichOnAdd, setAutoEnrichOnAdd] = useState(config.autoEnrichOnAdd);
  const [geminiApiKey, setGeminiApiKey] = useState(config.geminiApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!geminiApiKey.trim()) {
      setTestResult({ success: false, message: '請先輸入 Gemini API 金鑰' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await EnrichmentService.testGeminiApiKey(geminiApiKey.trim());
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, message: `連線失敗: ${(e as Error).message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      autoEnrichOnAdd,
      geminiApiKey: geminiApiKey.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 transition-all">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl shadow-slate-950/80 border-2 border-slate-300 dark:border-slate-700 border-t-4 border-t-amber-500 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/90 border-b-2 border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm sm:text-base">自動尋找補充與 AI 設定</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">自訂單字與句子的自動補充引擎</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-sm font-extrabold flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
          {/* Auto Enrich Toggle */}
          <div className="flex items-start justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700">
            <div className="space-y-0.5 pr-3">
              <div className="font-extrabold text-slate-800 dark:text-white text-xs sm:text-sm">
                新增時自動補充未填欄位
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                新增單字或句子時，若音標、中文釋義、例句或翻譯留空，系統將自動連網尋找並補齊。
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={autoEnrichOnAdd}
                onChange={(e) => setAutoEnrichOnAdd(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
            </label>
          </div>

          {/* Engine 1: Built-in Free Engine */}
          <div className="p-3.5 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">內建免費辭典與翻譯（開箱即用）</div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                預設啟用
              </span>
            </div>
            <p className="text-[11px] text-emerald-800/80 leading-relaxed">
              整合 Free Dictionary API、Datamuse 音標轉換、Tatoeba 真實例句庫與 Google
              翻譯引擎。無需註冊、免輸入任何金鑰即可享有完整的音標、中文釋義、例句與同義詞補充。
            </p>
          </div>

          {/* Engine 2: Gemini AI Key */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-purple-600" />
                <span className="font-bold text-slate-800">可選：Google Gemini AI 擴充金鑰</span>
              </div>
              <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
                深度字源與記憶術
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              輸入您的個人 Google Gemini API Key（可於 Google AI Studio 免費申請）。設定後系統將優先由 AI
              提供更細膩的詞根詞綴解構、趣味記憶法與語境分析。留空則自動使用內建免費辭典。
            </p>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="AIzaSy..."
                  className="w-full pl-3 pr-20 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-500 outline-none"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title={showKey ? '隱藏' : '顯示'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={testing || !geminiApiKey.trim()}
                    className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 flex items-center space-x-1"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>測試中</span>
                      </>
                    ) : (
                      <span>測試</span>
                    )}
                  </button>
                </div>
              </div>

              {testResult && (
                <div
                  className={`flex items-center space-x-1.5 p-2 rounded-lg text-[11px] ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/90 border-t-2 border-slate-200 dark:border-slate-700 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-extrabold shadow-md shadow-brand-600/30 cursor-pointer"
          >
            儲存設定
          </button>
        </div>
      </div>
    </div>
  );
};
