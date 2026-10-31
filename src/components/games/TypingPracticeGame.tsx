import React, { useEffect, useRef, useState } from 'react';
import type { TypingQuestion, GameFeedback } from './gameTypes';
import { Keyboard, Volume2 } from 'lucide-react';
import { SpeechService } from '../../services/speechService';

interface TypingPracticeGameProps {
  question: TypingQuestion;
  feedback: GameFeedback | null;
  onComplete: (isSuccess: boolean, answerText: string) => void;
  onNext: () => void;
}

export const TypingPracticeGame: React.FC<TypingPracticeGameProps> = ({
  question,
  feedback,
  onComplete,
  onNext,
}) => {
  const [typedText, setTypedText] = useState('');
  const [mistakeCount, setMistakeCount] = useState(0);
  const mistakeCountRef = useRef(0);
  const typingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!feedback) {
      const timer = setTimeout(() => {
        typingInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const target = question.target;
  const targetChars = target.split('');
  const uniqueSymbols = Array.from(
    new Set(target.replace(/[a-zA-Z0-9]/g, '').split(''))
  ).filter((c) => c !== '');

  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (feedback) return;
    const val = e.target.value;

    // Disallow typing past target length
    if (val.length > target.length) return;

    // Check newly typed character
    if (val.length > typedText.length) {
      const newIdx = val.length - 1;
      if (val[newIdx].toLowerCase() !== target[newIdx].toLowerCase()) {
        mistakeCountRef.current = mistakeCountRef.current + 1;
      }
    }

    setMistakeCount(mistakeCountRef.current);
    setTypedText(val);

    // If completely typed
    if (val.length === target.length) {
      const isMatch = val.toLowerCase() === target.toLowerCase();
      if (isMatch) {
        const isSuccess = mistakeCountRef.current <= 1;
        SpeechService.speak(target);
        onComplete(isSuccess, target);
      }
    }
  };

  return (
    <div
      onClick={() => typingInputRef.current?.focus()}
      className="space-y-4 cursor-text"
    >
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
          <Keyboard className="w-3.5 h-3.5" />
          <span>英打肌肉記憶練習</span>
          {question.kind === 'word' ? <span>· 單字</span> : <span>· 句子</span>}
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mt-2">
          {question.meaning}
        </div>
        {question.phonetic && (
          <div className="text-xs text-slate-400 font-mono">
            {question.phonetic}
          </div>
        )}
        {question.exampleSentence && (
          <div className="max-w-md mx-auto text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-left">
            <div className="flex-1 min-w-0">
              <div className="font-medium italic">"{question.exampleSentence}"</div>
              {question.exampleTranslation && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {question.exampleTranslation}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                SpeechService.speak(question.exampleSentence!, 0.85);
              }}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="朗讀例句發音"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 字母磚即時顯示 */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 my-5 select-none font-mono">
        {targetChars.map((char, i) => {
          const isTyped = i < typedText.length;
          const isCurrent = i === typedText.length;
          const isCorrect = isTyped && typedText[i].toLowerCase() === char.toLowerCase();
          const isMistake = isTyped && !isCorrect;

          let tileStyle =
            'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-500';
          if (isMistake) {
            tileStyle =
              'border-rose-400 bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-300 font-extrabold ring-2 ring-rose-400/40';
          } else if (isCorrect) {
            tileStyle =
              'border-emerald-400 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-600 dark:text-emerald-300 font-extrabold';
          } else if (isCurrent) {
            tileStyle =
              'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:border-brand-500 dark:text-brand-300 ring-2 ring-brand-500/40 animate-pulse font-extrabold';
          }

          return (
            <span
              key={i}
              className={`inline-flex items-center justify-center min-w-[28px] sm:min-w-[34px] h-10 sm:h-12 px-1 text-lg sm:text-2xl rounded-xl border-2 transition-all ${tileStyle} ${
                char === ' ' ? 'w-6 sm:w-8 border-dashed bg-slate-100/60 dark:bg-slate-800/40' : ''
              }`}
            >
              {char === ' ' ? (isTyped ? '␣' : '·') : isTyped ? typedText[i] : char}
            </span>
          );
        })}
      </div>

      {/* 輸入欄 */}
      <div className="max-w-md mx-auto space-y-2">
        <div className="relative">
          <input
            ref={typingInputRef}
            type="text"
            value={typedText}
            onChange={handleTypingChange}
            onKeyDown={(e) => {
              const isFinished =
                feedback ||
                (typedText.length === target.length &&
                  typedText.toLowerCase() === target.toLowerCase());
              if (
                isFinished &&
                (e.key === 'Enter' || e.key === ' ' || e.code === 'Space')
              ) {
                e.preventDefault();
                e.stopPropagation();
                onNext();
                return;
              }
              if (
                !feedback &&
                e.key === 'Enter' &&
                typedText.length === target.length &&
                typedText.toLowerCase() !== target.toLowerCase()
              ) {
                e.preventDefault();
                e.stopPropagation();
                SpeechService.speak(target);
                onComplete(false, target);
              }
            }}
            placeholder={
              feedback ? '按 Enter 或 空白鍵進入下一題 →' : '請直接在鍵盤打字輸入...'
            }
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            readOnly={Boolean(feedback)}
            className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl text-center text-lg sm:text-xl font-bold font-mono text-slate-800 dark:text-white placeholder:text-slate-400 outline-none transition-all ${
              feedback
                ? feedback.correct
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-rose-400 ring-2 ring-rose-400/20'
                : 'border-slate-300 dark:border-slate-600 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20'
            }`}
          />
          {typedText.length > 0 && !feedback && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTypedText('');
                typingInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg cursor-pointer"
            >
              清空
            </button>
          )}
        </div>

        {/* 標點與空格快捷晶片（方便手機平板觸控） */}
        {!feedback && (uniqueSymbols.length > 0 || target.includes(' ')) && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {target.includes(' ') && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (typedText.length < target.length) {
                    handleTypingChange({
                      target: { value: typedText + ' ' },
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                  typingInputRef.current?.focus();
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                輸入空格 [␣]
              </button>
            )}
            {uniqueSymbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (typedText.length < target.length) {
                    handleTypingChange({
                      target: { value: typedText + sym },
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                  typingInputRef.current?.focus();
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono cursor-pointer"
              >
                輸入 [ {sym} ]
              </button>
            ))}
          </div>
        )}

        {!feedback && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>
              進度：{typedText.length} / {target.length} 字母
            </span>
            <span>失誤：{mistakeCount} 次</span>
          </div>
        )}
      </div>
    </div>
  );
};
