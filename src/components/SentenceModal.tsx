import React, { useState } from 'react';
import type { Sentence, WordCategory, EnrichmentConfig } from '../types';
import { WORD_CATEGORY_LABELS, LEVEL_LABELS } from '../types';
import { Save, X, Star, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { EnrichmentService } from '../services/enrichmentService';
import { StorageService } from '../services/storageService';

interface SentenceModalProps {
  isOpen: boolean;
  editingSentence: Sentence | null; // null = 新增模式
  enrichmentConfig?: EnrichmentConfig;
  onClose: () => void;
  onSubmit: (data: Omit<Sentence, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string) => void;
}

const WORD_CATEGORIES = Object.keys(WORD_CATEGORY_LABELS) as WordCategory[];

const SentenceModalContent: React.FC<Omit<SentenceModalProps, 'isOpen'>> = ({
  editingSentence,
  enrichmentConfig,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const currentConfig = enrichmentConfig || StorageService.getEnrichmentConfig();

  const [english, setEnglish] = useState(editingSentence?.english || '');
  const [chinese, setChinese] = useState(editingSentence?.chinese || '');
  const [category, setCategory] = useState<WordCategory>(editingSentence?.category || 'daily');
  const [level, setLevel] = useState(editingSentence?.level || 1);
  const [favorite, setFavorite] = useState(editingSentence?.favorite || false);
  const [note, setNote] = useState(editingSentence?.note || '');
  const [error, setError] = useState<string | null>(null);

  // Auto enrichment states
  const [isEnriching, setIsEnriching] = useState(false);
  const [autoEnrichSuccess, setAutoEnrichSuccess] = useState<string | null>(null);
  const [autoEnrichOnAdd, setAutoEnrichOnAdd] = useState(currentConfig.autoEnrichOnAdd);

  const handleAutoEnrich = async (overwrite = false) => {
    const input = english.trim() || chinese.trim();
    if (!input) {
      setError('請先輸入英文句子或中文內容再進行自動補充');
      return;
    }
    setError(null);
    setIsEnriching(true);
    setAutoEnrichSuccess(null);

    try {
      const res = await EnrichmentService.enrichSentence(input, currentConfig);
      if (overwrite || !english.trim()) setEnglish(res.english);
      if (overwrite || !chinese.trim()) setChinese(res.chinese);
      if (overwrite || !category || category === 'daily') setCategory(res.category);
      if (overwrite || !note.trim()) setNote(res.note);

      setAutoEnrichSuccess('已自動翻譯並補充句型筆記與分類！');
      setTimeout(() => setAutoEnrichSuccess(null), 3500);
    } catch (err) {
      setError(`自動翻譯失敗: ${(err as Error).message}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalEnglish = english.trim();
    let finalChinese = chinese.trim();
    let finalCategory = category;
    let finalNote = note.trim();

    if (!finalEnglish && !finalChinese) {
      setError('請至少輸入英文句子或中文翻譯');
      return;
    }

    // Auto enrich if either English or Chinese is missing
    if ((!finalEnglish || !finalChinese) && autoEnrichOnAdd) {
      setIsEnriching(true);
      try {
        const res = await EnrichmentService.enrichSentence(finalEnglish || finalChinese, currentConfig);
        if (!finalEnglish) finalEnglish = res.english;
        if (!finalChinese) finalChinese = res.chinese;
        if (finalCategory === 'daily' && res.category) finalCategory = res.category;
        if (!finalNote) finalNote = res.note;
      } catch {
        // Fallback
      } finally {
        setIsEnriching(false);
      }
    }

    if (!finalEnglish) {
      setError('請輸入英文句子');
      return;
    }
    if (!finalChinese) {
      setError('請輸入中文翻譯，或點擊「自動翻譯與補充」');
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
      english: finalEnglish,
      chinese: finalChinese,
      category: finalCategory,
      level,
      favorite,
      note: finalNote,
      ...reviewStats,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 transition-all">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl shadow-slate-950/80 border-2 border-slate-300 dark:border-slate-700 border-t-4 border-t-sky-600 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/90 border-b-2 border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center text-xl shadow-md shadow-sky-600/30">
              💬
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-slate-800 dark:text-white text-lg">{editingSentence ? '編輯句子' : '新增句子'}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                  句子庫
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">支援英文自動繁中翻譯與中翻英雙向補充解析</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white flex items-center justify-center text-base font-extrabold transition-colors cursor-pointer"
            title="關閉視窗"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} id="sentence-form" className="p-6 space-y-5 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
          {/* English sentence */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white">
                英文句子 <span className="text-rose-600 dark:text-rose-400 font-bold">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleAutoEnrich(false)}
                disabled={isEnriching || (!english.trim() && !chinese.trim())}
                className="text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-md bg-sky-600 hover:bg-sky-700 active:scale-95 text-white disabled:opacity-40 cursor-pointer"
                title="自動翻譯並產生學習筆記"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>翻譯分析中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>✨ 自動翻譯與補充</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              value={english}
              onChange={(e) => setEnglish(e.target.value)}
              placeholder="例：Actions speak louder than words."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-base font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 leading-relaxed focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 outline-none resize-none transition-all"
            />
          </div>

          {autoEnrichSuccess && (
            <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-sm font-bold animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>{autoEnrichSuccess}</span>
            </div>
          )}

          {/* Chinese translation */}
          <div>
            <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">
              中文翻譯 <span className="text-rose-600 dark:text-rose-400 font-bold">*</span>
            </label>
            <textarea
              value={chinese}
              onChange={(e) => setChinese(e.target.value)}
              placeholder="例：行動勝於言語。"
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-base font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 leading-relaxed focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 outline-none resize-none transition-all"
            />
          </div>

          {/* Category + Level Group Container */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">分類</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WordCategory)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
              >
                {WORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {WORD_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-2">
                熟練度：<span className="text-sky-600 dark:text-sky-400 font-extrabold">{LEVEL_LABELS[level] || '生疏'} ({level}/5)</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Favorite Option */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-extrabold text-slate-800 dark:text-white">收藏狀態</span>
            <label className="flex items-center space-x-2.5 cursor-pointer bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-xs hover:border-amber-400 transition-colors">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 border-2 border-slate-400 dark:border-slate-500 rounded-md peer-checked:bg-amber-400 peer-checked:border-amber-400 flex items-center justify-center transition-all">
                <Star className={`w-3.5 h-3.5 text-white ${favorite ? 'opacity-100' : 'opacity-0'}`} fill="currentColor" />
              </div>
              <span className="text-sm font-extrabold text-slate-800 dark:text-white">加入收藏（星號篩選）</span>
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">筆記 (句型解析、核心文法結構)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：常用英語諺語，強調實際行動比空口說白話更具說服力"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
            />
          </div>

          {/* Auto Enrich on Add Checkbox Card */}
          <div className="bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-200 dark:border-sky-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                新增時若未填寫翻譯或筆記，自動連網翻譯補充
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={autoEnrichOnAdd}
                onChange={(e) => setAutoEnrichOnAdd(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600" />
            </label>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 text-sm font-bold animate-in fade-in duration-150">
              {error}
            </div>
          )}
        </form>

        {/* Fixed Pinned Footer Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/90 border-t-2 border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div>
            {editingSentence && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(editingSentence.id);
                  onClose();
                }}
                className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border-2 border-rose-300 dark:border-rose-700 px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                刪除此句子
              </button>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>取消</span>
            </button>
            <button
              type="submit"
              form="sentence-form"
              disabled={isEnriching}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-extrabold shadow-md shadow-brand-600/30 flex items-center space-x-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isEnriching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>補充儲存中...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{editingSentence ? '儲存修改' : '新增句子'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SentenceModal: React.FC<SentenceModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <SentenceModalContent key={props.editingSentence?.id ?? 'new'} {...props} />;
};

export default SentenceModal;
