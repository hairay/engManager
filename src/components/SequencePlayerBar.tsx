import React, { useEffect, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { SpeechService } from '../services/speechService';
import type { SpeechSequenceItem } from '../services/speechService';

interface SequencePlayerBarProps {
  /** 朗讀佇列 (由仍開啟中的篩選結果即時組成)；空陣列時按鈕停用 */
  items: SpeechSequenceItem[];
  /** 操作提示文字 (朗讀/句子) */
  unitLabel?: string;
}

/**
 * 連續朗讀控制列：Playlist 式依序朗讀清單內容，
 * 支援播放/暫停/上一筆/下一筆/停止，並顯示目前進度。
 * 播放索引狀態由 SpeechService 佇列引擎驅動 (與清單卡片高亮共用同一事件來源)。
 */
export const SequencePlayerBar: React.FC<SequencePlayerBarProps> = ({ items, unitLabel = '項目' }) => {
  const [playingIndex, setPlayingIndex] = useState(-1); // -1 = 閒置
  const [paused, setPaused] = useState(false);

  // items 以 ref 保存，避免播放中清單變動導致回呼捕獲過期快照
  const [itemsSnapshot, setItemsSnapshot] = useState(items);

  useEffect(() => {
    const off = SpeechService.addSequenceListener((index) => {
      setPlayingIndex(index);
      if (index >= 0) {
        setPaused(SpeechService.isSequencePaused());
      } else {
        setPaused(false);
      }
    });
    // 元件卸載時停止朗讀，避免跨頁面背景殘留
    return () => {
      off();
      SpeechService.stopSequence();
    };
  }, []);

  const isPlaying = playingIndex >= 0;

  const start = (index: number) => {
    if (items.length === 0) return;
    setItemsSnapshot(items);
    SpeechService.playSequence(items, index);
  };

  const handlePrev = () => {
    if (!isPlaying) return;
    SpeechService.playSequence(itemsSnapshot, Math.max(0, playingIndex - 1));
  };

  const handleNext = () => {
    if (!isPlaying) return;
    if (playingIndex + 1 < itemsSnapshot.length) {
      SpeechService.playSequence(itemsSnapshot, playingIndex + 1);
    } else {
      SpeechService.stopSequence();
    }
  };

  if (isPlaying) {
    return (
      <div className="flex items-center gap-1.5 bg-slate-900 rounded-xl px-1.5 py-1.5 border border-slate-700 shadow-sm">
        <SkipBack
          role="button"
          aria-label="上一筆"
          onClick={handlePrev}
          className="w-6 h-6 p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
        />
        {paused ? (
          <Play
            role="button"
            aria-label="繼續播放"
            onClick={() => { SpeechService.resumeSequence(); setPaused(false); }}
            className="w-6 h-6 p-1 rounded-md text-amber-300 hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          />
        ) : (
          <Pause
            role="button"
            aria-label="暫停"
            onClick={() => { SpeechService.pauseSequence(); setPaused(true); }}
            className="w-6 h-6 p-1 rounded-md text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          />
        )}
        <SkipForward
          role="button"
          aria-label="下一筆"
          onClick={handleNext}
          className="w-6 h-6 p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
        />
        <Square
          role="button"
          aria-label="停止朗讀"
          onClick={() => SpeechService.stopSequence()}
          className="w-6 h-6 p-1 rounded-md text-rose-400 hover:text-rose-300 hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
        />
        <div className="flex items-center gap-1 pl-1 pr-1.5 border-l border-slate-700 ml-0.5">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-bold font-mono text-brand-300 whitespace-nowrap tabular-nums">
            {playingIndex + 1} / {itemsSnapshot.length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => start(0)}
      disabled={items.length === 0}
      title={`依序自動朗讀清單中的每個${unitLabel} (套用目前的搜尋與篩選條件)`}
      className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
    >
      <Play className="w-4 h-4" />
      <span>連續朗讀{items.length > 0 ? ` (${items.length})` : ''}</span>
    </button>
  );
};
