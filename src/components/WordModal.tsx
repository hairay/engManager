import React, { useState } from 'react';
import type { Word, WordCategory, PartOfSpeech, EnrichmentConfig } from '../types';
import {
  WORD_CATEGORY_LABELS,
  PART_OF_SPEECH_LABELS,
  LEVEL_LABELS,
} from '../types';
import { Save, X, Star, Sparkles, Loader2, CheckCircle2, Volume2 } from 'lucide-react';
import { SpeechService } from '../services/speechService';
import { EnrichmentService } from '../services/enrichmentService';
import { StorageService } from '../services/storageService';

interface WordModalProps {
  isOpen: boolean;
  editingWord: Word | null; // null = 新增模式
  enrichmentConfig?: EnrichmentConfig;
  onClose: () => void;
  onSubmit: (data: Omit<Word, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string) => void;
}

const WORD_CATEGORIES = Object.keys(WORD_CATEGORY_LABELS) as WordCategory[];
const PARTS_OF_SPEECH = Object.keys(PART_OF_SPEECH_LABELS) as PartOfSpeech[];

const WordModalContent: React.FC<Omit<WordModalProps, 'isOpen'>> = ({
  editingWord,
  enrichmentConfig,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const currentConfig = enrichmentConfig || StorageService.getEnrichmentConfig();

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

  // Auto enrichment states
  const [isEnriching, setIsEnriching] = useState(false);
  const [autoEnrichSuccess, setAutoEnrichSuccess] = useState<string | null>(null);
  const [autoEnrichOnAdd, setAutoEnrichOnAdd] = useState(currentConfig.autoEnrichOnAdd);

  const handleAutoEnrich = async (overwrite = false) => {
    const wordQuery = english.trim();
    if (!wordQuery) {
      setError('請先輸入英文單字再進行自動查找');
      return;
    }
    setError(null);
    setIsEnriching(true);
    setAutoEnrichSuccess(null);

    try {
      const res = await EnrichmentService.enrichWord(wordQuery, currentConfig);
      if (res.phonetic && (overwrite || !phonetic.trim())) setPhonetic(res.phonetic);
      if (res.partOfSpeech && (overwrite || !partOfSpeech || partOfSpeech === 'noun')) setPartOfSpeech(res.partOfSpeech);
      if (res.meaning && (overwrite || !meaning.trim())) setMeaning(res.meaning);
      // Example sentence and translation: always fill if returned
      if (res.exampleSentence) setExampleSentence(res.exampleSentence);
      if (res.exampleTranslation) setExampleTranslation(res.exampleTranslation);
      if (res.category && (overwrite || !category || category === 'daily')) setCategory(res.category);
      if (res.note && (overwrite || !note.trim())) setNote(res.note);

      setAutoEnrichSuccess('已自動補充音標、詞性、釋義與例句！');
      setTimeout(() => setAutoEnrichSuccess(null), 3500);
    } catch (err) {
      setError(`自動補充失敗: ${(err as Error).message}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEnglish = english.trim();
    if (!cleanEnglish) {
      setError('請輸入英文單字');
      return;
    }

    let finalMeaning = meaning.trim();
    let finalPhonetic = phonetic.trim();
    let finalPos = partOfSpeech;
    let finalExample = exampleSentence.trim();
    let finalTranslation = exampleTranslation.trim();
    let finalCategory = category;
    let finalNote = note.trim();

    // If meaning or other fields are missing and auto-enrich is enabled, automatically enrich now!
    if ((!finalMeaning || !finalPhonetic || !finalExample) && autoEnrichOnAdd) {
      setIsEnriching(true);
      try {
        const res = await EnrichmentService.enrichWord(cleanEnglish, currentConfig);
        if (!finalMeaning) finalMeaning = res.meaning;
        if (!finalPhonetic) finalPhonetic = res.phonetic;
        if (!finalExample) finalExample = res.exampleSentence;
        if (!finalTranslation) finalTranslation = res.exampleTranslation;
        if (finalPos === 'noun' && res.partOfSpeech) finalPos = res.partOfSpeech;
        if (finalCategory === 'daily' && res.category) finalCategory = res.category;
        if (!finalNote) finalNote = res.note;
      } catch {
        // Fallback to manual validation below
      } finally {
        setIsEnriching(false);
      }
    }

    if (!finalMeaning) {
      setError('請輸入中文意思，或點擊「自動查找補充」');
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
      english: cleanEnglish,
      phonetic: finalPhonetic,
      partOfSpeech: finalPos,
      meaning: finalMeaning,
      exampleSentence: finalExample,
      exampleTranslation: finalTranslation,
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
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl shadow-slate-950/80 border-2 border-slate-300 dark:border-slate-700 border-t-4 border-t-brand-600 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/90 border-b-2 border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-base shadow-md shadow-brand-600/30">
              En
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-slate-800 dark:text-white text-lg">{editingWord ? '編輯單字' : '新增單字'}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 border border-brand-300 dark:border-brand-700">
                  單字庫
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">輸入單字後可一鍵自動尋找補充音標、釋義與例句</p>
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
        <form onSubmit={handleSubmit} id="word-form" className="p-6 space-y-5 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
          {/* English + Phonetic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-extrabold text-slate-800 dark:text-white">
                  英文單字 <span className="text-rose-600 dark:text-rose-400 font-bold">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleAutoEnrich(false)}
                  disabled={isEnriching || !english.trim()}
                  className="text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-md bg-brand-600 hover:bg-brand-700 active:scale-95 text-white disabled:opacity-40 cursor-pointer"
                  title="自動連網查詢音標、釋義、詞性與例句"
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>查詢中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>✨ 自動查找補充</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                placeholder="例：abundant"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-base font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">音標 (KK/IPA)</label>
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="例：/əˈbʌndənt/"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-base font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-mono focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              />
            </div>
          </div>

          {autoEnrichSuccess && (
            <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-sm font-bold animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>{autoEnrichSuccess}</span>
            </div>
          )}

          {/* POS + Meaning + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">詞性</label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value as PartOfSpeech)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              >
                {PARTS_OF_SPEECH.map((pos) => (
                  <option key={pos} value={pos}>
                    {PART_OF_SPEECH_LABELS[pos]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">
                中文意思 <span className="text-rose-600 dark:text-rose-400 font-bold">*</span>
              </label>
              <input
                type="text"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="例：豐富的、充裕的"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-base font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">分類</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WordCategory)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              >
                {WORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {WORD_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Example Sentence & Translation in High-Contrast Container */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-800 dark:text-white">💬 英文例句與中文翻譯</span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {exampleSentence ? '已填寫' : '可手動輸入或由上方自動查找獲取'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-white">英文例句</label>
                  {exampleSentence.trim() && (
                    <button
                      type="button"
                      onClick={() => SpeechService.speak(exampleSentence.trim(), 0.85)}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center space-x-1 font-bold cursor-pointer"
                      title="朗讀例句發音"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>朗讀例句</span>
                    </button>
                  )}
                </div>
                <textarea
                  value={exampleSentence}
                  onChange={(e) => setExampleSentence(e.target.value)}
                  placeholder="例：Rainfall is abundant in this region."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 leading-relaxed focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1">例句翻譯</label>
                <textarea
                  value={exampleTranslation}
                  onChange={(e) => setExampleTranslation(e.target.value)}
                  placeholder="例：這個地區雨量充沛。"
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 leading-relaxed focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Level + Favorite Container */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-2">
                熟練度：<span className="text-brand-600 dark:text-brand-400 font-extrabold">{LEVEL_LABELS[level] || '生疏'} ({level}/5)</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
            </div>
            <div className="flex items-center sm:justify-end">
              <label className="flex items-center space-x-2.5 cursor-pointer bg-white dark:bg-slate-800 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-xs hover:border-amber-400 transition-colors">
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
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-extrabold text-slate-800 dark:text-white mb-1.5">筆記 (字源、同義字、記憶術)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：abound (v. 充滿) 的形容詞形 / 同義詞: plentiful"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          {/* Auto Enrich on Add Checkbox Card */}
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                新增時若有空白欄位（如釋義或例句），自動連網尋找補充
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={autoEnrichOnAdd}
                onChange={(e) => setAutoEnrichOnAdd(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
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
            {editingWord && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(editingWord.id);
                  onClose();
                }}
                className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border-2 border-rose-300 dark:border-rose-700 px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                刪除此單字
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
              form="word-form"
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
                  <span>{editingWord ? '儲存修改' : '新增單字'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const WordModal: React.FC<WordModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <WordModalContent key={props.editingWord?.id ?? 'new'} {...props} />;
};

export default WordModal;
