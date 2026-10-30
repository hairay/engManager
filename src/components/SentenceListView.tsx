import React, { useEffect, useMemo, useState } from 'react';
import type { Sentence, WordCategory } from '../types';
import {
  WORD_CATEGORY_LABELS,
  WORD_CATEGORY_COLORS,
  LEVEL_LABELS,
  LEVEL_COLORS,
} from '../types';
import { Plus, Search, Volume2, Star, Edit3, Trash2, Quote, Sparkles, Loader2 } from 'lucide-react';
import { SpeechService } from '../services/speechService';
import type { SpeechSequenceItem } from '../services/speechService';
import { SequencePlayerBar } from './SequencePlayerBar';

interface SentenceListViewProps {
  sentences: Sentence[];
  enrichingSentenceId?: string | null;
  onDeleteSentence: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (sentence: Sentence) => void;
  onEnrichSentence: (sentence: Sentence) => void;
  onOpenBatchEnrich: () => void;
}

type SearchScope = 'all' | 'favorites' | 'weak';

export const SentenceListView: React.FC<SentenceListViewProps> = ({
  sentences,
  enrichingSentenceId,
  onDeleteSentence,
  onToggleFavorite,
  onOpenAddModal,
  onOpenEditModal,
  onEnrichSentence,
  onOpenBatchEnrich,
}) => {
  const [searchText, setSearchText] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [categoryFilter, setCategoryFilter] = useState<WordCategory | 'all'>('all');
  const [seqIndex, setSeqIndex] = useState(-1); // 連續朗讀目前的項目索引

  const filteredSentences = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return sentences
      .filter((s) => {
        if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
        if (scope === 'favorites' && !s.favorite) return false;
        if (scope === 'weak' && s.level > 2) return false;
        if (keyword) {
          const combined = `${s.english} ${s.chinese} ${s.note} `.toLowerCase();
          if (!combined.includes(keyword)) return false;
        }
        return true;
      })
      .sort((a, b) => a.level - b.level || b.createdAt.localeCompare(a.createdAt));
  }, [sentences, searchText, scope, categoryFilter]);

  // 連續朗讀佇列：逐句朗讀英文原文
  const sequenceItems: SpeechSequenceItem[] = useMemo(
    () => filteredSentences.map((s) => ({ parts: [s.english], rate: 0.85 })),
    [filteredSentences]
  );

  // 監聽連續朗讀進度：高亮當前卡片並自動捲動到畫面內
  useEffect(() => {
    const off = SpeechService.addSequenceListener((index) => setSeqIndex(index));
    return () => {
      off();
      SpeechService.stopSequence();
    };
  }, []);

  useEffect(() => {
    if (seqIndex < 0) return;
    const el = document.querySelector<HTMLElement>(`[data-seq-idx="${seqIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [seqIndex]);

  const missingInfoCount = useMemo(() => {
    return sentences.filter((s) => !s.chinese || !s.note).length;
  }, [sentences]);

  const categoryChips: Array<{ key: WordCategory | 'all'; label: string }> = [
    { key: 'all', label: '全部' },
    ...(Object.keys(WORD_CATEGORY_LABELS) as WordCategory[]).map((c) => ({
      key: c,
      label: WORD_CATEGORY_LABELS[c],
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜尋英文、中文翻譯或筆記..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700">
              {([
                { key: 'all', label: '全部' },
                { key: 'favorites', label: '收藏' },
                { key: 'weak', label: '待複習' },
              ] as Array<{ key: SearchScope; label: string }>).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    scope === s.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Batch Auto Enrich button */}
            <button
              onClick={onOpenBatchEnrich}
              className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold transition-all"
              title="批量連網尋找補充缺漏的句子翻譯或筆記"
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span className="hidden sm:inline">批量補充</span>
              {missingInfoCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">
                  {missingInfoCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenAddModal}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/30 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>新增句子</span>
            </button>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryChips.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoryFilter(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                categoryFilter === c.key
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="text-xs font-semibold text-slate-500 flex items-center space-x-1.5">
          <Quote className="w-3.5 h-3.5 text-brand-600" />
          <span>共 {filteredSentences.length} 句 (全部 {sentences.length})</span>
        </div>
        <div className="shrink-0">
          {/* 連續朗讀控制列 */}
          <SequencePlayerBar items={sequenceItems} unitLabel="句子" />
        </div>
      </div>

      {/* Sentence Cards */}
      {filteredSentences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <Quote className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-500">沒有符合條件的句子</div>
          <div className="text-xs text-slate-400">試著切換分類或加入新的句子吧！</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filteredSentences.map((sentence, i) => (
            <div
              key={sentence.id}
              data-seq-idx={i}
              className={`bg-white rounded-2xl border shadow-sm transition-all p-4 flex flex-col ${
                seqIndex === i
                  ? 'border-brand-400 ring-2 ring-brand-500/60 shadow-md bg-brand-50/40'
                  : 'border-slate-200 hover:shadow-md'
              }`}
            >
              {/* Top row: english + actions */}
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => SpeechService.speak(sentence.english, 0.85)}
                  title="朗讀句子"
                  className="shrink-0 p-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-relaxed">{sentence.english}</div>
                  <div className="text-sm text-slate-500 mt-1 leading-relaxed">{sentence.chinese}</div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  {/* Smart Enrich Button */}
                  <button
                    onClick={() => onEnrichSentence(sentence)}
                    disabled={enrichingSentenceId === sentence.id}
                    title="自動補充翻譯與語法筆記"
                    className="p-1.5 rounded-lg text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors disabled:opacity-50"
                  >
                    {enrichingSentenceId === sentence.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onToggleFavorite(sentence.id)}
                    title={sentence.favorite ? '取消收藏' : '加入收藏'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      sentence.favorite ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    <Star className="w-4 h-4" fill={sentence.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => onOpenEditModal(sentence)}
                    title="編輯"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`確定要刪除此句子嗎？`)) onDeleteSentence(sentence.id);
                    }}
                    title="刪除"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom row: level + category + note */}
              <div className="mt-auto pt-3 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${LEVEL_COLORS[sentence.level] || 'bg-slate-300'}`} />
                  <span className="text-[11px] font-bold text-slate-600">{LEVEL_LABELS[sentence.level] || '生疏'}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${WORD_CATEGORY_COLORS[sentence.category]}`}
                >
                  {WORD_CATEGORY_LABELS[sentence.category]}
                </span>
              </div>
              {sentence.note && (
                <div className="mt-2 text-[11px] text-slate-400 italic border-t border-slate-100 pt-2">
                  💡 {sentence.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
