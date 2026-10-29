import React, { useEffect, useState } from 'react';
import { LoggerService } from '../services/loggerService';
import type { LogEntry, LogLevel } from '../services/loggerService';
import { Terminal, Copy, Check, Trash2 } from 'lucide-react';

interface DebugLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'text-slate-400',
  info: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-rose-400',
};

export const DebugLogModal: React.FC<DebugLogModalProps> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = LoggerService.subscribe((newEntries) => {
      setEntries([...newEntries].reverse());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(LoggerService.exportLogs());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-800">系統診斷與連線日誌</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-[11px] font-semibold text-slate-400">{entries.length} 條記錄 (最新在上)</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已複製' : '複製全部'}</span>
            </button>
            <button
              onClick={() => LoggerService.clear()}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空</span>
            </button>
          </div>
        </div>

        {/* Log list */}
        <div className="flex-1 min-h-[200px] max-h-[60vh] overflow-y-auto p-3 space-y-1 bg-slate-900">
          {entries.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-10">目前沒有日誌記錄</div>
          ) : (
            entries.map((entry, i) => (
              <div key={`${entry.timestamp}-${i}`} className="text-[11px] font-mono leading-relaxed">
                <span className="text-slate-600">{entry.timestamp.slice(11, 19)}</span>{' '}
                <span className={LEVEL_COLORS[entry.level]}>[{entry.level.toUpperCase()}]</span>{' '}
                <span className="text-sky-300">{entry.module}</span>{' '}
                <span className="text-slate-200">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugLogModal;
