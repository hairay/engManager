import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { SpellQuestion, GameFeedback } from './gameTypes';
import { shuffle } from './gameUtils';
import { Volume2, Sparkles } from 'lucide-react';
import { SpeechService } from '../../services/speechService';

interface WordSpellingGameProps {
  question: SpellQuestion;
  feedback: GameFeedback | null;
  onComplete: (correct: boolean, chosenText: string) => void;
}

export const WordSpellingGame: React.FC<WordSpellingGameProps> = ({
  question,
  feedback,
  onComplete,
}) => {
  const [typed, setTyped] = useState<number[]>([]);

  const spellingLetters = useMemo(
    () => question.tokens.flat(),
    [question.tokens]
  );

  const spellingScrambledIdx = useMemo(() => {
    let order = shuffle(spellingLetters.map((_, i) => i));
    let tries = 0;
    while (
      tries < 10 &&
      order.length >= 3 &&
      order.every((origIdx, pos) => spellingLetters[origIdx] === spellingLetters[pos])
    ) {
      order = shuffle(spellingLetters.map((_, i) => i));
      tries++;
    }
    return order;
  }, [spellingLetters]);

  const target = question.target;

  const checkSpelling = useCallback(
    (finalTyped: number[]) => {
      const guess = finalTyped.map((i) => spellingLetters[i]).join('').toLowerCase();
      const correct = guess === target;
      onComplete(correct, finalTyped.map((i) => spellingLetters[i]).join(''));
    },
    [spellingLetters, target, onComplete]
  );

  // 鍵盤直接輸入與 Backspace 支援
  useEffect(() => {
    if (feedback) return;

    const handler = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) {
        const key = e.key.toLowerCase();
        setTyped((prev) => {
          if (prev.length >= spellingLetters.length) return prev;
          const used = new Set(prev);
          const tileIdx = spellingScrambledIdx.find((i) => !used.has(i) && spellingLetters[i] === key);
          if (tileIdx === undefined) return prev;
          const next = [...prev, tileIdx];
          if (next.length === spellingLetters.length) {
            setTimeout(() => checkSpelling(next), 30);
          }
          return next;
        });
      } else if (e.key === 'Backspace') {
        setTyped((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, spellingLetters, spellingScrambledIdx, checkSpelling]);

  const word = question.word;

  const slotGroups = useMemo(() => {
    return question.tokens.reduce<{ letters: string[]; start: number }[]>((acc, letters) => {
      const start = acc.length > 0 ? acc[acc.length - 1].start + acc[acc.length - 1].letters.length : 0;
      acc.push({ letters, start });
      return acc;
    }, []);
  }, [question.tokens]);

  const remaining = spellingScrambledIdx.filter((i) => !typed.includes(i));

  return (
    <>
      <div className="text-center space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          拼出正確的英文單字
        </div>
        <div className="text-2xl font-bold text-brand-700 dark:text-brand-300">
          {word.meaning}
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {word.phonetic || ''}
        </div>
        {word.exampleSentence && (() => {
          const pattern = word.english
            .trim()
            .split(/\s+/)
            .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
            .filter(Boolean)
            .join('\\s+');
          const masked = pattern
            ? word.exampleSentence.replace(new RegExp(pattern, 'gi'), '____')
            : word.exampleSentence;
          return (
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 inline-flex items-center space-x-2">
              <span>{masked}</span>
              <button
                type="button"
                onClick={() => SpeechService.speak(word.exampleSentence, 0.85)}
                className="p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 rounded transition-colors cursor-pointer"
                title="朗讀例句發音"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })()}
        {feedback && (
          <button
            onClick={() => SpeechService.speak(word.english)}
            className="ml-2 p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 dark:hover:bg-brand-900/60 cursor-pointer"
            title="播放正解發音"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 作答槽位 */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 min-h-[56px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
        {slotGroups.map((g, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <span className="text-slate-300 dark:text-slate-600 text-xl font-bold">␣</span>}
            {g.letters.map((_, li) => {
              const absolute = g.start + li;
              const typedLetter = typed.length > absolute ? spellingLetters[typed[absolute]] : null;
              return (
                <div
                  key={li}
                  className={`w-9 h-11 rounded-lg border-2 flex items-center justify-center font-extrabold text-lg shadow-sm ${
                    typedLetter
                      ? feedback
                        ? feedback.correct
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-950/50 dark:border-rose-700 dark:text-rose-300'
                        : 'bg-brand-50 border-brand-400 text-brand-700 dark:bg-brand-950/50 dark:border-brand-500 dark:text-brand-300'
                      : 'bg-white border-dashed border-slate-300 text-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-600'
                  }`}
                >
                  {typedLetter ? typedLetter.toUpperCase() : ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* 字母 tiles */}
      {!feedback && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {spellingScrambledIdx.map((tileIdx) => {
            const isUsed = typed.includes(tileIdx);
            const letter = spellingLetters[tileIdx];
            return (
              <button
                key={tileIdx}
                onClick={() => {
                  setTyped((prev) => {
                    if (prev.includes(tileIdx)) return prev.filter((i) => i !== tileIdx);
                    if (prev.length >= spellingLetters.length) return prev;
                    const next = [...prev, tileIdx];
                    if (next.length === spellingLetters.length) {
                      setTimeout(() => checkSpelling(next), 30);
                    }
                    return next;
                  });
                }}
                disabled={isUsed}
                className={`w-10 h-12 rounded-xl border-2 font-extrabold text-lg transition-all cursor-pointer ${
                  isUsed
                    ? 'bg-slate-100 border-slate-200 text-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-700 cursor-default'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-brand-500 hover:bg-brand-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:border-brand-400 dark:hover:bg-slate-700 hover:-translate-y-0.5 shadow-sm'
                }`}
              >
                {letter.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      {!feedback && (
        <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>可直接打鍵盤輸入字母、Backspace 刪除；填滿後自動判斷（剩餘 {remaining.length} 顆）</span>
        </div>
      )}
    </>
  );
};
