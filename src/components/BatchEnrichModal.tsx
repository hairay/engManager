import React, { useState, useRef } from 'react';
import type { Word, Sentence, EnrichmentConfig } from '../types';
import { EnrichmentService } from '../services/enrichmentService';
import { Sparkles, Loader2, CheckCircle2, X } from 'lucide-react';

interface BatchEnrichModalProps {
  isOpen: boolean;
  type: 'words' | 'sentences';
  words?: Word[];
  sentences?: Sentence[];
  config: EnrichmentConfig;
  onClose: () => void;
  onWordsUpdated?: (updatedWords: Word[]) => void;
  onSentencesUpdated?: (updatedSentences: Sentence[]) => void;
}

export const BatchEnrichModal: React.FC<BatchEnrichModalProps> = ({
  isOpen,
  type,
  words = [],
  sentences = [],
  config,
  onClose,
  onWordsUpdated,
  onSentencesUpdated,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLabel, setCurrentLabel] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const stopRef = useRef(false);

  if (!isOpen) return null;

  // Filter items that have missing information
  const candidateWords = words.filter(
    (w) =>
      !w.phonetic ||
      !w.meaning ||
      !w.exampleSentence ||
      !w.exampleTranslation ||
      !w.note
  );

  const candidateSentences = sentences.filter(
    (s) => !s.chinese || !s.note
  );

  const totalCandidates = type === 'words' ? candidateWords.length : candidateSentences.length;

  const handleStart = async () => {
    setIsRunning(true);
    setIsFinished(false);
    stopRef.current = false;
    setCurrentIndex(0);
    setCompletedCount(0);
    setErrorCount(0);

    const now = new Date().toISOString();

    if (type === 'words') {
      const workingWords = [...words];
      let success = 0;
      let fails = 0;

      for (let i = 0; i < candidateWords.length; i++) {
        if (stopRef.current) break;
        const target = candidateWords[i];
        setCurrentIndex(i + 1);
        setCurrentLabel(target.english);

        try {
          const enriched = await EnrichmentService.enrichWord(target.english, config);
          const idx = workingWords.findIndex((w) => w.id === target.id);
          if (idx !== -1) {
            workingWords[idx] = {
              ...workingWords[idx],
              phonetic: workingWords[idx].phonetic || enriched.phonetic,
              partOfSpeech: workingWords[idx].partOfSpeech || enriched.partOfSpeech,
              meaning: workingWords[idx].meaning || enriched.meaning,
              exampleSentence: workingWords[idx].exampleSentence || enriched.exampleSentence,
              exampleTranslation: workingWords[idx].exampleTranslation || enriched.exampleTranslation,
              note: workingWords[idx].note || enriched.note,
              updatedAt: now,
            };
          }
          success++;
          setCompletedCount(success);
        } catch {
          fails++;
          setErrorCount(fails);
        }

        // 批次請求微小節流 (350ms)，防止觸發免金鑰端點 429 頻率限制
        if (i < candidateWords.length - 1 && !stopRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }

      if (onWordsUpdated) {
        onWordsUpdated(workingWords);
      }
    } else {
      const workingSentences = [...sentences];
      let success = 0;
      let fails = 0;

      for (let i = 0; i < candidateSentences.length; i++) {
        if (stopRef.current) break;
        const target = candidateSentences[i];
        setCurrentIndex(i + 1);
        setCurrentLabel(target.english.slice(0, 30));

        try {
          const enriched = await EnrichmentService.enrichSentence(target.english, config);
          const idx = workingSentences.findIndex((s) => s.id === target.id);
          if (idx !== -1) {
            workingSentences[idx] = {
              ...workingSentences[idx],
              chinese: workingSentences[idx].chinese || enriched.chinese,
              note: workingSentences[idx].note || enriched.note,
              updatedAt: now,
            };
          }
          success++;
          setCompletedCount(success);
        } catch {
          fails++;
          setErrorCount(fails);
        }

        // 批次請求微小節流 (350ms)，防止觸發免金鑰端點 429 頻率限制
        if (i < candidateSentences.length - 1 && !stopRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }

      if (onSentencesUpdated) {
        onSentencesUpdated(workingSentences);
      }
    }

    setIsRunning(false);
    setIsFinished(true);
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  const progressPercent = totalCandidates > 0 ? Math.round((currentIndex / totalCandidates) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 transition-all">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl shadow-slate-950/80 border-2 border-slate-700 border-t-4 border-t-brand-600 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b-2 border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-950/60 text-brand-300 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm sm:text-base">
                一鍵批量尋找補充{type === 'words' ? '單字' : '句子'}資訊
              </h3>
              <p className="text-[11px] text-slate-300 font-medium">自動掃描並補齊缺少音標、釋義或例句的項目</p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-sm font-semibold p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {!isRunning && !isFinished && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 text-sm">
                  掃描檢測結果：共找到{' '}
                  <span className="text-brand-600 font-extrabold text-base">{totalCandidates}</span>{' '}
                  個待補齊的{type === 'words' ? '單字' : '句子'}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  系統將依序透過
                  {config.geminiApiKey ? ' Google Gemini AI 與內建辭典 ' : ' 內建英漢辭典與 Google 翻譯引擎 '}
                  自動尋找並補充缺漏的音標、中文翻譯、例句或學習筆記，原有已填寫的內容不受影響。
                </p>
              </div>

              {totalCandidates === 0 ? (
                <div className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>太棒了！目前的全部{type === 'words' ? '單字' : '句子'}資訊均已十分完整。</span>
                </div>
              ) : (
                <div className="text-xs text-slate-500 space-y-1 pl-1">
                  <div>📌 補齊項目包含：音標 (IPA/KK)、中文釋義、生活例句、同義詞與文法筆記。</div>
                  <div>⚡ 過程可隨時暫停，完成後將自動更新清單並同步至雲端。</div>
                </div>
              )}
            </div>
          )}

          {isRunning && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 font-medium text-slate-700">
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                  <span>正在補充: <strong className="text-brand-800">{currentLabel}</strong></span>
                </div>
                <div className="font-bold text-brand-700">
                  {currentIndex} / {totalCandidates} ({progressPercent}%)
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>已成功補充: {completedCount} 筆</span>
                {errorCount > 0 && <span className="text-rose-500">略過: {errorCount} 筆</span>}
              </div>
            </div>
          )}

          {isFinished && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>批量尋找補充完成！</span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                成功補充了 <strong>{completedCount}</strong> 個{type === 'words' ? '單字' : '句子'}的資訊。
                {errorCount > 0 && `（有 ${errorCount} 筆因連線或查無結果略過）`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-end space-x-2">
          {!isRunning && !isFinished && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={totalCandidates === 0}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm shadow-brand-600/30 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>開始自動尋找補充</span>
              </button>
            </>
          )}

          {isRunning && (
            <button
              type="button"
              onClick={handleStop}
              className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-semibold cursor-pointer"
            >
              停止補充
            </button>
          )}

          {isFinished && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm shadow-brand-600/30 cursor-pointer"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
