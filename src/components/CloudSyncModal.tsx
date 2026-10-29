import React, { useState } from 'react';
import type { CloudConfig } from '../types';
import { Cloud, Check, AlertCircle, Copy, RefreshCw, Key, ShieldCheck } from 'lucide-react';
import { syncWithCloud, resetSupabaseClient, SUPABASE_SQL_SCHEMA } from '../services/supabaseService';
import { StorageService } from '../services/storageService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudConfig: CloudConfig;
  onUpdateCloudConfig: (config: CloudConfig) => void;
  onSyncComplete?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  cloudConfig,
  onUpdateCloudConfig,
  onSyncComplete,
}) => {
  const [enabled, setEnabled] = useState(cloudConfig.enabled);
  const [supabaseUrl, setSupabaseUrl] = useState(cloudConfig.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(cloudConfig.supabaseAnonKey);
  const [intervalSeconds, setIntervalSeconds] = useState(cloudConfig.syncIntervalSeconds);

  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showSQL, setShowSQL] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);

  if (!isOpen) return null;

  const handleSupabaseSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setMessage(null);

    const updatedConfig: CloudConfig = {
      ...cloudConfig,
      enabled,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      syncIntervalSeconds: Math.max(10, intervalSeconds),
    };

    StorageService.saveCloudConfig(updatedConfig);
    resetSupabaseClient();
    onUpdateCloudConfig(updatedConfig);

    if (enabled) {
      const result = await syncWithCloud();
      setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
      if (result.success && onSyncComplete) onSyncComplete();
    } else {
      setMessage({ text: '已改為本機離線模式 (資料儲存於瀏覽器 LocalStorage)', type: 'success' });
    }

    setIsSyncing(false);
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cloud className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-800 text-base">遠端資料庫同步設定 (Supabase)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSupabaseSync} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 說明 */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 space-y-1.5">
            <div className="font-bold flex items-center space-x-1.5 text-sky-950">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>免費 PostgreSQL 遠端資料庫 · 跨裝置即時同步</span>
            </div>
            <p className="leading-relaxed">
              1. 到 <span className="font-bold">supabase.com</span> 免費註冊並建立專案 (無需信用卡)。
            </p>
            <p className="leading-relaxed">
              2. 到專案的 <span className="font-bold">SQL Editor</span> 貼上並執行下方的「SQL 建表腳本」。
            </p>
            <p className="leading-relaxed">
              3. 到 <span className="font-bold">Settings → API</span> 複製 <span className="font-bold">Project URL</span> 與 <span className="font-bold">anon public key</span> 填入下方儲存，系統會每 {Math.max(10, intervalSeconds)} 秒自動雙向同步單字、句子與遊戲記錄！
            </p>
          </div>

          {/* 啟用開關 */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div>
              <div className="font-semibold text-xs text-slate-800">啟用 Supabase 遠端資料庫</div>
              <div className="text-[11px] text-slate-500">關閉時所有資料僅保存於本機</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {enabled && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  required={enabled}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supabase anon API Key (公開金鑰)
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                  required={enabled}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  自動同步間隔 (秒，最短 10 秒)
                </label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  step={5}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value) || 15)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {cloudConfig.lastSyncTime && (
                <div className="text-[11px] text-slate-400">
                  上次同步：{new Date(cloudConfig.lastSyncTime).toLocaleString('zh-TW')} · 狀態：{cloudConfig.syncStatus}
                </div>
              )}
            </div>
          )}

          {/* SQL Accordion */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowSQL(!showSQL)}
              className="text-xs text-sky-700 hover:text-sky-900 font-semibold underline flex items-center space-x-1"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{showSQL ? '隱藏 SQL 建表腳本' : '查看 Supabase SQL 建表腳本'}</span>
            </button>

            <button
              type="submit"
              disabled={isSyncing}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm shadow-sky-600/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '連線同步中...' : enabled ? '儲存並立即同步' : '儲存設定'}</span>
            </button>
          </div>

          {showSQL && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-900 text-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400 font-bold">schema.sql</span>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedSQL ? '已複製！' : '複製 SQL'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono overflow-x-auto text-slate-300 max-h-56 p-2 whitespace-pre-wrap">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          )}

          {/* Alert Message */}
          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-start space-x-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default CloudSyncModal;
