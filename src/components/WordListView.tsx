import React, { useMemo, useState } from 'react';
import type { Word, WordCategory } from '../types';
import {
  WORD_CATEGORY_LABELS,
  WORD_CATEGORY_COLORS,
  PART_OF_SPEECH_LABELS,
  LEVEL_LABELS,
  LEVEL_COLORS,
} from '../types';
import { Plus, Search, Volume2, Star, Edit3, Trash2, BookOpen, GraduationCap } from 'lucide-react';
import { SpeechService } from '../services/speechService';

interface WordListViewProps {
  words: Word[];
  onDeleteWord: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (word: Word) => void;
}

type SearchScope = 'all' | 'favorites' | 'weak';

export const WordListView: React.FC<WordListViewProps> = ({
  words,
  onDeleteWord,
  onToggleFavorite,
  onOpenAddModal,
  onOpenEditModal,
}) => {
  const [searchText, setSearchText] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [categoryFilter, setCategoryFilter] = useState<WordCategory | 'all'>('all');

  const filteredWords = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return words
      .filter((w) => {
        if (categoryFilter !== 'all' && w.category !== categoryFilter) return false;
        if (scope === 'favorites' && !w.favorite) return false;
        if (scope === 'weak' && w.level > 2) return false;
        if (keyword) {
          const combined = `${w.english} ${w.phonetic} ${w.meaning} ${w.exampleSentence} ${w.note} `.toLowerCase();
          if (!combined.includes(keyword)) return false;
        }
        return true;
      })
      .sort((a, b) => a.level - b.level || b.createdAt.localeCompare(a.createdAt));
  }, [words, searchText, scope, categoryFilter]);

  const categoryCards: Array<{ key: WordCategory | 'all'; label: string }> = [
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
              placeholder="搜尋英文、中文、音標或筆記..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">
              {([
                { key: 'all', label: '全部' },
                { key: 'favorites', label: '收藏' },
                { key: 'weak', label: '待複習' },
              ] as Array<{ key: SearchScope; label: string }>).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    scope === s.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              onClick={onOpenAddModal}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>新增單字</span>
            </button>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryCards.map((c) => (
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
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-semibold text-slate-500 flex items-center space-x-1.5">
          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
          <span>共 {filteredWords.length} 個單字 (全部 {words.length})</span>
        </div>
      </div>

      {/* Word Grid */}
      {filteredWords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-500">沒有符合條件的單字</div>
          <div className="text-xs text-slate-400">試著切換分類或加入新的單字吧！</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredWords.map((word) => (
            <div
              key={word.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 flex flex-col"
            >
              {/* Top row: english + favorite + edit */}
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => SpeechService.speak(word.english)}
                      title="朗讀發音"
                      className="shrink-0 p-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-slate-800 text-lg truncate">{word.english}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5 ml-1">{word.phonetic || '—'}</div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => onToggleFavorite(word.id)}
                    title={word.favorite ? '取消收藏' : '加入收藏'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      word.favorite ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    <Star className="w-4 h-4" fill={word.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => onOpenEditModal(word)}
                    title="編輯"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`確定要刪除「${word.english}」嗎？`)) onDeleteWord(word.id);
                    }}
                    title="刪除"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Meaning + POS chip */}
              <div className="flex items-center flex-wrap gap-1.5 mt-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {PART_OF_SPEECH_LABELS[word.partOfSpeech]}
                </span>
                <span className="text-sm font-semibold text-brand-800">{word.meaning}</span>
              </div>

              {/* Example */}
              {(word.exampleSentence || word.exampleTranslation) && (
                <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  {word.exampleSentence && (
                    <div className="text-xs text-slate-700 font-medium leading-relaxed">{word.exampleSentence}</div>
                  )}
                  {word.exampleTranslation && (
                    <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{word.exampleTranslation}</div>
                  )}
                </div>
              )}

              {/* Bottom row: level + category */}
              <div className="mt-auto pt-3 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${LEVEL_COLORS[word.level] || 'bg-slate-300'}`} />
                  <span className="text-[11px] font-bold text-slate-600">{LEVEL_LABELS[word.level] || '生疏'}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${WORD_CATEGORY_COLORS[word.category]}`}>
                  {WORD_CATEGORY_LABELS[word.category]}
                </span>
              </div>
              {word.note && (
                <div className="mt-2 text-[11px] text-slate-400 italic border-t border-slate-100 pt-2">📝 {word.note}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
