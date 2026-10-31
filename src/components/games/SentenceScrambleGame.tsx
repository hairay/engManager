import React, { useState } from 'react';
import type { ScrambleQuestion, GameFeedback } from './gameTypes';
import { normToken } from './gameUtils';

interface SentenceScrambleGameProps {
  question: ScrambleQuestion;
  feedback: GameFeedback | null;
  onComplete: (correct: boolean) => void;
}

export const SentenceScrambleGame: React.FC<SentenceScrambleGameProps> = ({
  question,
  feedback,
  onComplete,
}) => {
  const [placed, setPlaced] = useState<number[]>([]);

  const checkScramble = (placedIndices: number[]) => {
    const placedTokens = placedIndices.map((i) => question.tokens[i]);
    const origTokens = question.sentence.english.trim().split(/\s+/);
    const correct =
      placedTokens.length === origTokens.length &&
      placedTokens.every((t, i) => normToken(t) === normToken(origTokens[i]));
    onComplete(correct);
  };

  return (
    <>
      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          把字卡排成正確句子
        </div>
        <div className="text-lg font-bold text-brand-700 dark:text-brand-300">
          {question.sentence.chinese}
        </div>
        {question.sentence.note && (
          <div className="text-[11px] text-slate-400 italic">
            📝 {question.sentence.note}
          </div>
        )}
      </div>

      {/* 作答區 */}
      <div className="min-h-[72px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-wrap gap-2 items-start content-start">
        {placed.length === 0 && (
          <span className="text-xs text-slate-400 m-2">👇 點擊下方字卡開始組句</span>
        )}
        {placed.map((tokenIdx, pos) => (
          <button
            key={`${tokenIdx}-${pos}`}
            onClick={() => !feedback && setPlaced(placed.filter((_, i) => i !== pos))}
            className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold shadow-sm transition-all cursor-pointer ${
              feedback
                ? feedback.correct
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-600 dark:text-emerald-300'
                  : 'bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-950/50 dark:border-rose-700 dark:text-rose-300'
                : 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-950/50 dark:border-brand-500 dark:text-brand-300 hover:border-rose-400 hover:bg-rose-50 dark:hover:border-rose-500 dark:hover:bg-rose-950/40'
            }`}
            title={feedback ? '' : '點擊移回下方'}
          >
            {question.tokens[tokenIdx]}
          </button>
        ))}
      </div>

      {/* 字卡池 */}
      {!feedback && (
        <div className="flex flex-wrap gap-2">
          {question.tokens.map((token, i) => (
            <button
              key={i}
              onClick={() => {
                const used = new Set(placed);
                if (!used.has(i)) {
                  const next = [...placed, i];
                  setPlaced(next);
                  if (next.length === question.tokens.length) {
                    setTimeout(() => checkScramble(next), 60);
                  }
                }
              }}
              disabled={placed.includes(i)}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                placed.includes(i)
                  ? 'opacity-20 cursor-default bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-brand-500 hover:bg-brand-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:border-brand-400 dark:hover:bg-slate-700 hover:-translate-y-0.5 shadow-sm cursor-pointer'
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      )}

      {!feedback && placed.length > 0 && placed.length < question.tokens.length && (
        <div className="flex justify-center">
          <button
            onClick={() => setPlaced([])}
            className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 underline cursor-pointer"
          >
            清空重排
          </button>
        </div>
      )}
    </>
  );
};
