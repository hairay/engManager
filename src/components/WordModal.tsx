import React, { useState } from 'react';
import type { Word, WordCategory, PartOfSpeech } from '../types';
import {
  WORD_CATEGORY_LABELS,
  PART_OF_SPEECH_LABELS,
  LEVEL_LABELS,
} from '../types';
import { Save, X, Star } from 'lucide-react';

interface WordModalProps {
  isOpen: boolean;
  editingWord: Word | null; // null = 新增模式
  onClose: () => void;
  onSubmit: (data: Omit<Word, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string) => void;
}

const WORD_CATEGORIES = Object.keys(WORD_CATEGORY_LABELS) as WordCategory[];
const PARTS_OF_SPEECH = Object.keys(PART_OF_SPEECH_LABELS) as PartOfSpeech[];

const WordModalContent: React.FC<Omit<WordModalProps, 'isOpen'>> = ({
  editingWord,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const [english, setEnglish] = useState(editingWord?.english || '');
  const [phonetic, setPhonetic] = useState(editingWord?.phonetic || '');
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>(editingWord?.partOfSpeech || 'noun');
  const [meaning, setMeaning] = useState(editingWord?.meaning || '');
  const [exampleSentence, setExampleSentence] = useState(editingWord?.exampleSentence || '');
  const [exampleTranslation, setExampleTranslation] = useState(editingWord?.exampleTranslation || '');
  const [category, setCategory] = useState<WordCategory>(editingWord?.category || 'daily');
  const [level, setLevel] = useState(editingWord?.level || 1);
  const [favorite, setFavorite] = useState(editingWord?.favorite || false);
  const [note, setNote] = useState(editingWord?.note || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!english.trim()) {
      setError('請輸入英文單字');
      return;
    }
    if (!meaning.trim()) {
      setError('請輸入中文意思');
      return;
    }

    const reviewStats = editingWord
      ? {
          reviewCount: editingWord.reviewCount,
          correctCount: editingWord.correctCount,
          lastReviewedAt: editingWord.lastReviewedAt,
        }
      : { reviewCount: 0, correctCount: 0, lastReviewedAt: null };

    onSubmit({
      english: english.trim(),
      phonetic: phonetic.trim(),
      partOfSpeech,
      meaning: meaning.trim(),
      exampleSentence: exampleSentence.trim(),
      exampleTranslation: exampleTranslation.trim(),
      category,
      level,
      favorite,
      note: note.trim(),
      ...reviewStats,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">En</div>
            <h3 className="font-bold text-slate-800">{editingWord ? '編輯單字' : '新增單字'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* English + Phonetic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                英文單字 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                placeholder="例：abundant"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">音標 (KK/DJ)</label>
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="例：/əˈbʌndənt/"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* POS + Meaning + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">詞性</label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value as PartOfSpeech)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              >
                {PARTS_OF_SPEECH.map((pos) => (
                  <option key={pos} value={pos}>
                    {PART_OF_SPEECH_LABELS[pos]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                中文意思 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="例：豐富的、充裕的"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">分類</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WordCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              >
                {WORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {WORD_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Example sentence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">英文例句</label>
              <textarea
                value={exampleSentence}
                onChange={(e) => setExampleSentence(e.target.value)}
                placeholder="例：Rainfall is abundant in this region."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">例句翻譯</label>
              <textarea
                value={exampleTranslation}
                onChange={(e) => setExampleTranslation(e.target.value)}
                placeholder="例：這個地區雨量充沛。"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Level + Favorite */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                熟練度：<span className="text-brand-700 font-bold">{LEVEL_LABELS[level] || '生疏'} ({level}/5)</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-amber-400 peer-checked:border-amber-400 flex items-center justify-center transition-all">
                  <Star className={`w-3.5 h-3.5 text-white ${favorite ? 'opacity-100' : 'opacity-0'}`} fill="currentColor" />
                </div>
                <span className="text-xs font-semibold text-slate-700">加入收藏（星號篩選）</span>
              </label>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">筆記 (字源、易混字、記憶術)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：abound (v. 充滿) 的形容詞形"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {editingWord && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingWord.id);
                    onClose();
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-4 py-2 rounded-xl"
                >
                  刪除此單字
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center space-x-1"
              >
                <X className="w-4 h-4" />
                <span>取消</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm shadow-brand-600/30 flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{editingWord ? '儲存修改' : '新增單字'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const WordModal: React.FC<WordModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <WordModalContent key={props.editingWord?.id ?? 'new'} {...props} />;
};

export default WordModal;
