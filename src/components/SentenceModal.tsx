import React, { useState } from 'react';
import type { Sentence, WordCategory } from '../types';
import { WORD_CATEGORY_LABELS, LEVEL_LABELS } from '../types';
import { Save, X, Star } from 'lucide-react';

interface SentenceModalProps {
  isOpen: boolean;
  editingSentence: Sentence | null; // null = 新增模式
  onClose: () => void;
  onSubmit: (data: Omit<Sentence, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string) => void;
}

const WORD_CATEGORIES = Object.keys(WORD_CATEGORY_LABELS) as WordCategory[];

const SentenceModalContent: React.FC<Omit<SentenceModalProps, 'isOpen'>> = ({
  editingSentence,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const [english, setEnglish] = useState(editingSentence?.english || '');
  const [chinese, setChinese] = useState(editingSentence?.chinese || '');
  const [category, setCategory] = useState<WordCategory>(editingSentence?.category || 'daily');
  const [level, setLevel] = useState(editingSentence?.level || 1);
  const [favorite, setFavorite] = useState(editingSentence?.favorite || false);
  const [note, setNote] = useState(editingSentence?.note || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!english.trim()) {
      setError('請輸入英文句子');
      return;
    }
    if (!chinese.trim()) {
      setError('請輸入中文翻譯');
      return;
    }

    const reviewStats = editingSentence
      ? {
          reviewCount: editingSentence.reviewCount,
          correctCount: editingSentence.correctCount,
          lastReviewedAt: editingSentence.lastReviewedAt,
        }
      : { reviewCount: 0, correctCount: 0, lastReviewedAt: null };

    onSubmit({
      english: english.trim(),
      chinese: chinese.trim(),
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
            <span className="text-xl">💬</span>
            <h3 className="font-bold text-slate-800">{editingSentence ? '編輯句子' : '新增句子'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* English sentence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              英文句子 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={english}
              onChange={(e) => setEnglish(e.target.value)}
              placeholder="例：Actions speak louder than words."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              required
            />
          </div>

          {/* Chinese translation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              中文翻譯 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={chinese}
              onChange={(e) => setChinese(e.target.value)}
              placeholder="例：行動勝於言語。"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              required
            />
          </div>

          {/* Category + Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* Favorite */}
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

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">筆記 (用法解析、單字底蘊)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：touch base 為商務常用片語"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {editingSentence && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingSentence.id);
                    onClose();
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-4 py-2 rounded-xl"
                >
                  刪除此句子
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
                <span>{editingSentence ? '儲存修改' : '新增句子'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SentenceModal: React.FC<SentenceModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <SentenceModalContent key={props.editingSentence?.id ?? 'new'} {...props} />;
};

export default SentenceModal;
