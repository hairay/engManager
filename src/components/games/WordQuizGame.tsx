import React from 'react';
import type { QuizQuestion, GameFeedback } from './gameTypes';
import { LEVEL_LABELS } from '../../types';
import { Volume2 } from 'lucide-react';
import { SpeechService } from '../../services/speechService';

interface WordQuizGameProps {
  question: QuizQuestion;
  feedback: GameFeedback | null;
  chosenIdx: number | null;
  onAnswer: (choice: number) => void;
}

export const WordQuizGame: React.FC<WordQuizGameProps> = ({
  question,
  feedback,
  chosenIdx,
  onAnswer,
}) => {
  const prompt =
    question.mode === 'en2zh'
      ? question.word.english
      : question.word.meaning;

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {question.mode === 'en2zh'
                ? '選出正確的中文意思'
                : '選出對應的英文單字'}
            </div>
            <div
              className={`mt-2 font-bold text-slate-800 dark:text-white leading-relaxed ${
                question.mode === 'en2zh' ? 'text-3xl' : 'text-lg'
              }`}
            >
              {prompt}
            </div>
            {question.mode === 'en2zh' && question.word.phonetic && (
              <div className="text-xs text-slate-400 font-mono mt-1">
                {question.word.phonetic}
              </div>
            )}
            {question.mode === 'zh2en' && (
              <div className="text-[11px] text-slate-400 mt-1">
                熟練度 {LEVEL_LABELS[question.word.level]}
              </div>
            )}
          </div>
          <button
            onClick={() => SpeechService.speak(question.word.english)}
            className="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 dark:hover:bg-brand-900/60 shrink-0 cursor-pointer"
            title={question.mode === 'en2zh' ? '朗讀' : '聽發音'}
          >
            <Volume2 className="w-5 h-5" />
          </button>
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
