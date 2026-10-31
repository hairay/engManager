import React from 'react';
import type { ClozeQuestion, GameFeedback } from './gameTypes';

interface SentenceClozeGameProps {
  question: ClozeQuestion;
  feedback: GameFeedback | null;
  chosenIdx: number | null;
  onAnswer: (choice: number) => void;
}

export const SentenceClozeGame: React.FC<SentenceClozeGameProps> = ({
  question,
  feedback,
  chosenIdx,
  onAnswer,
}) => {
  const prompt = `${question.pre} ______ ${question.post}`.trim();

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              選出句中空格的正確單字
            </div>
            <div className="mt-2 font-bold text-slate-800 dark:text-white leading-relaxed text-lg">
              {prompt}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              提示：{question.sentence.chinese}
            </div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${feedback ? 'pointer-events-none' : ''}`}>
        {question.options.map((opt, i) => {
          const isAnswer = i === question.answerIdx;
          const isChosen = chosenIdx === i;
          let cls =
            'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-brand-500 dark:hover:bg-brand-950/40 dark:text-slate-200';
          if (feedback) {
            if (isAnswer) cls = 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-600 dark:text-emerald-300';
            else if (isChosen) cls = 'border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:border-rose-700 dark:text-rose-300';
            else cls = 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-500';
          }
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className={`border-2 rounded-xl px-4 py-3 text-sm font-semibold text-left transition-all cursor-pointer ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </>
  );
};
