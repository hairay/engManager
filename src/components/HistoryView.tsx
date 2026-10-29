import React, { useMemo, useState } from 'react';
import type { Word, Sentence, GameRecord, GameType } from '../types';
import { GAME_INFO, LEVEL_COLORS, LEVEL_LABELS } from '../types';
import {
  BarChart3, Trophy, Download, Upload, Trash2, FileJson, FileSpreadsheet, BookOpen, Quote, Gamepad2,
} from 'lucide-react';

interface HistoryViewProps {
  words: Word[];
  sentences: Sentence[];
  gameRecords: GameRecord[];
  onExportBackup: () => void;
  onImportBackup: (jsonStr: string) => void;
  onExportCSV: (kind: 'words' | 'sentences') => void;
  onResetAll: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  words,
  sentences,
  gameRecords,
  onExportBackup,
  onImportBackup,
  onExportCSV,
  onResetAll,
}) => {
  const [confirmingReset, setConfirmingReset] = useState(false);

  /* --- 每種遊戲的統計 --- */
  const gameStats = useMemo(() => {
    return (Object.keys(GAME_INFO) as GameType[]).map((game) => {
      const records = gameRecords.filter((r) => r.game === game);
      const totalQs = records.reduce((sum, r) => sum + r.total, 0);
      const totalScore = records.reduce((sum, r) => sum + r.score, 0);
      const acc = totalQs > 0 ? Math.round((totalScore / totalQs) * 100) : 0;
      const best = records.reduce<(typeof records)[0] | null>(
        (acc2, r) => (!acc2 || r.score / r.total > acc2.score / acc2.total ? r : acc2),
        null
      );
      return { game, rounds: records.length, acc, best };
    });
  }, [gameRecords]);

  /* --- 熟練度分佈圖 (單字 + 句子合併) --- */
  const distribution = useMemo(() => {
    const levels = [1, 2, 3, 4, 5];
    const items = [...words, ...sentences];
    const total = Math.max(1, items.length);
    return levels.map((level) => {
      const count = items.filter((i) => i.level === level).length;
      return { level, count, pct: Math.round((count / total) * 100) };
    });
  }, [words, sentences]);

  const sortedRecords = useMemo(
    () => gameRecords.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [gameRecords]
  );

  return (
    <div className="space-y-4">
      {/* 遊戲統計 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2 mb-3">
          <Gamepad2 className="w-4 h-4 text-brand-600" />
          <span>遊戲複習成效</span>
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {gameStats.map((g) => (
            <div key={g.game} className="bg-slate-50 rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-bold text-slate-700">
                {GAME_INFO[g.game].emoji} {GAME_INFO[g.game].title}
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">累積場次</div>
                  <div className="text-lg font-extrabold text-slate-800">{g.rounds}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-semibold">平均準確率</div>
                  <div className={`text-lg font-extrabold ${g.acc >= 80 ? 'text-emerald-600' : g.acc >= 60 ? 'text-amber-600' : 'text-rose-500'}`}>{g.acc}%</div>
                </div>
              </div>
              {g.best && (
                <div className="mt-1.5 text-[10px] font-semibold text-amber-600 flex items-center space-x-1">
                  <Trophy className="w-3 h-3" />
                  <span>最佳 {g.best.score}/{g.best.total} • {g.best.date}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 熟練度分佈 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2 mb-3">
          <BarChart3 className="w-4 h-4 text-brand-600" />
          <span>熟練度分佈 (單字 {words.length} + 句子 {sentences.length})</span>
        </h4>
        <div className="space-y-2">
          {distribution.map((d) => (
            <div key={d.level} className="flex items-center gap-3">
              <div className="w-16 flex items-center space-x-1.5 shrink-0">
                <span className={`w-2.5 h-2.5 rounded-full ${LEVEL_COLORS[d.level]}`} />
                <span className="text-[11px] font-bold text-slate-600">
                  {d.level} {LEVEL_LABELS[d.level]}
                </span>
              </div>
              <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full ${LEVEL_COLORS[d.level]} transition-all duration-500`}
                  style={{ width: `${d.pct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-500 w-14 text-right shrink-0">{d.count} 個 ({d.pct}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* 遊戲記錄列表 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>遊戲歷史記錄 ({gameRecords.length} 場)</span>
        </h4>
        {sortedRecords.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center">還沒有任何遊戲記錄</div>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {sortedRecords.map((r) => {
              const acc = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
              return (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">{GAME_INFO[r.game].emoji}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-700">{GAME_INFO[r.game].title}</div>
                      <div className="text-[10px] text-slate-400">{r.date} {r.time} • 用時 {r.durationSec} 秒</div>
                    </div>
                  </div>
                  <div className={`text-xs font-extrabold ${acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-rose-500'}`}>
                    {r.score}/{r.total} ({acc}%)
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 資料備份還原 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2 mb-3">
          <FileJson className="w-4 h-4 text-sky-600" />
          <span>資料備份與還原</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={onExportBackup}
            className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            <span>匯出完整備份 (JSON)</span>
          </button>

          <label className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>匯入 備份 JSON 還原</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm('匯入備份將覆蓋目前的本機資料，確定繼續嗎？')) return;
                const reader = new FileReader();
                reader.onload = () => {
                  onImportBackup(String(reader.result || ''));
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>

          <button
            onClick={() => onExportCSV('words')}
            className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-xs font-bold transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <BookOpen className="w-3.5 h-3.5" />
            <span>匯出單字 CSV</span>
          </button>

          <button
            onClick={() => onExportCSV('sentences')}
            className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <Quote className="w-3.5 h-3.5" />
            <span>匯出句子 CSV</span>
          </button>
        </div>

        {/* Danger zone */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              className="flex items-center space-x-2 text-xs font-semibold text-rose-500 hover:text-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>重置本機資料 (清除所有單字、句子與遊戲記錄)</span>
            </button>
          ) : (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700">確定要清除本機所有學習資料嗎？此動作無法復原！(雲端資料不受影響)</span>
              <div className="flex space-x-2 shrink-0">
                <button onClick={() => setConfirmingReset(false)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold">
                  取消
                </button>
                <button onClick={() => { setConfirmingReset(false); onResetAll(); }} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold">
                  確定重置
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryView;
