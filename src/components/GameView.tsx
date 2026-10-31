import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Word, Sentence, GameType, WordCategory, GameRecord } from '../types';
import { GAME_INFO, WORD_CATEGORY_LABELS } from '../types';
import {
  Check, X, ChevronRight, Trophy, RotateCcw,
  MousePointerClick, Undo2, Home, Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SpeechService } from '../services/speechService';
import type {
  QuizQuestion,
  SpellQuestion,
  ClozeQuestion,
  ScrambleQuestion,
  TypingQuestion,
  GameFeedback,
} from './games/gameTypes';
import { buildGameQuestions, stripPunct } from './games/gameUtils';
import { WordQuizGame } from './games/WordQuizGame';
import { SentenceClozeGame } from './games/SentenceClozeGame';
import { WordSpellingGame } from './games/WordSpellingGame';
import { TypingPracticeGame } from './games/TypingPracticeGame';
import { SentenceScrambleGame } from './games/SentenceScrambleGame';

interface GameViewProps {
  words: Word[];
  sentences: Sentence[];
  gameRecords: GameRecord[];
  onWordResult: (wordId: string, isCorrect: boolean) => void;
  onSentenceResult: (sentenceId: string, isCorrect: boolean) => void;
  onAddGameRecord: (game: GameType, score: number, total: number, durationSec: number) => void;
}

export const GameView: React.FC<GameViewProps> = ({
  words,
  sentences,
  gameRecords,
  onWordResult,
  onSentenceResult,
  onAddGameRecord,
}) => {
  const [screen, setScreen] = useState<'menu' | 'play' | 'result'>('menu');
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [scope, setScope] = useState<'all' | 'favorites' | 'weak'>('all');
  const [category, setCategory] = useState<WordCategory | 'all'>('all');
  const [count, setCount] = useState(5);

  const [quizQs, setQuizQs] = useState<QuizQuestion[]>([]);
  const [spellingQs, setSpellingQs] = useState<SpellQuestion[]>([]);
  const [clozeQs, setClozeQs] = useState<ClozeQuestion[]>([]);
  const [scrambleQs, setScrambleQs] = useState<ScrambleQuestion[]>([]);
  const [typingQs, setTypingQs] = useState<TypingQuestion[]>([]);

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<GameFeedback | null>(null);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const startTsRef = useRef<number>(0);

  /* ---------------- 最佳成績 ---------------- */
  const bestByGame = useMemo(() => {
    const map = new Map<GameType, { acc: number; score: number; total: number }>();
    gameRecords.forEach((r) => {
      const acc = r.total > 0 ? r.score / r.total : 0;
      const prev = map.get(r.game);
      if (!prev || acc > prev.acc) {
        map.set(r.game, { acc: Math.round(acc * 100), score: r.score, total: r.total });
      }
    });
    return map;
  }, [gameRecords]);

  /* ---------------- 可用題庫 (依範圍設定篩選) ---------------- */
  const poolWords = useMemo(() => {
    const weak = scope === 'weak';
    const fav = scope === 'favorites';
    return words.filter((w) => {
      if (category !== 'all' && w.category !== category) return false;
      if (weak && w.level > 2) return false;
      if (fav && !w.favorite) return false;
      return true;
    });
  }, [words, scope, category]);

  const poolSentences = useMemo(() => {
    const weak = scope === 'weak';
    const fav = scope === 'favorites';
    return sentences.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (weak && s.level > 2) return false;
      if (fav && !s.favorite) return false;
      return true;
    });
  }, [sentences, scope, category]);

  const needMap: Record<GameType, { count: number; label: string; current: number }> = useMemo(() => ({
    word_quiz: { count: 4, label: '單字', current: poolWords.length },
    word_spelling: {
      count: 1,
      label: '單字',
      current: poolWords.filter((w) => stripPunct(w.english).length >= 2).length,
    },
    typing_practice: {
      count: 1,
      label: '單字/句子',
      current: poolWords.length > 0 ? poolWords.length : poolSentences.length,
    },
    sentence_cloze: { count: 2, label: '句子', current: poolSentences.length },
    sentence_scramble: { count: 1, label: '句子', current: poolSentences.length },
  }), [poolWords, poolSentences]);

  /* ---------------- 啟動遊戲 ---------------- */
  const startGame = useCallback((game: GameType) => {
    const built = buildGameQuestions(
      game,
      count,
      poolWords,
      poolSentences,
      words,
      sentences
    );

    if (built.total <= 0) {
      alert(`符合篩選條件的${needMap[game].label}不足，請先調整篩選或新增${needMap[game].label}！`);
      return;
    }

    setQuizQs(built.quizQs);
    setSpellingQs(built.spellingQs);
    setClozeQs(built.clozeQs);
    setScrambleQs(built.scrambleQs);
    setTypingQs(built.typingQs);

    setActiveGame(game);
    setScreen('play');
    setIdx(0);
    setScore(0);
    setFeedback(null);
    setChosenIdx(null);
    startTsRef.current = Date.now();
  }, [count, needMap, poolWords, poolSentences, words, sentences]);

  const totalQs = useMemo(() => {
    if (!activeGame) return 0;
    switch (activeGame) {
      case 'word_quiz':
        return quizQs.length;
      case 'word_spelling':
        return spellingQs.length;
      case 'typing_practice':
        return typingQs.length;
      case 'sentence_cloze':
        return clozeQs.length;
      case 'sentence_scramble':
        return scrambleQs.length;
    }
  }, [activeGame, quizQs.length, spellingQs.length, typingQs.length, clozeQs.length, scrambleQs.length]);

  const finish = useCallback((finalScore: number, finalTotal: number) => {
    const durationSec = Math.max(1, Math.round((Date.now() - startTsRef.current) / 1000));
    if (activeGame) {
      onAddGameRecord(activeGame, finalScore, finalTotal, durationSec);
    }
    if (finalTotal > 0 && finalScore / finalTotal >= 0.7) {
      confetti({
        particleCount: 160,
        spread: 80,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#34d399', '#fbbf24', '#f472b6'],
      });
    }
    setScreen('result');
  }, [activeGame, onAddGameRecord]);

  const nextQuestion = useCallback(() => {
    if (idx + 1 >= totalQs) {
      finish(score, totalQs);
      return;
    }
    setIdx((prev) => prev + 1);
    setFeedback(null);
    setChosenIdx(null);
  }, [idx, totalQs, score, finish]);

  // 鍵盤 Space / Enter 進入下一題快捷鍵
  useEffect(() => {
    if (screen !== 'play' || !feedback) return;
    const handleNextKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        nextQuestion();
      }
    };
    window.addEventListener('keydown', handleNextKey);
    return () => window.removeEventListener('keydown', handleNextKey);
  }, [screen, feedback, nextQuestion]);

  /* ---------------- 作答回呼處理 ---------------- */
  const handleQuizAnswer = (choice: number) => {
    if (feedback || !quizQs[idx]) return;
    const q = quizQs[idx];
    const correct = choice === q.answerIdx;
    setChosenIdx(choice);
    onWordResult(q.word.id, correct);
    if (correct) setScore((s) => s + 1);
    setFeedback({
      correct,
      answerText: q.mode === 'en2zh' ? q.word.meaning : q.word.english,
      chosen: q.options[choice],
    });
    if (q.mode === 'zh2en') {
      SpeechService.speak(q.word.english);
    }
  };

  const handleClozeAnswer = (choice: number) => {
    if (feedback || !clozeQs[idx]) return;
    const q = clozeQs[idx];
    const correct = choice === q.answerIdx;
    setChosenIdx(choice);
    onSentenceResult(q.sentence.id, correct);
    if (correct) setScore((s) => s + 1);
    setFeedback({
      correct,
      answerText: q.answer,
      chosen: q.options[choice],
    });
  };

  const handleSpellingComplete = (correct: boolean, chosenText: string) => {
    if (!spellingQs[idx]) return;
    const q = spellingQs[idx];
    if (correct) setScore((s) => s + 1);
    onWordResult(q.word.id, correct);
    setFeedback({
      correct,
      answerText: q.word.english,
      chosen: chosenText,
    });
  };

  const handleTypingComplete = (isSuccess: boolean, answerText: string) => {
    if (!typingQs[idx]) return;
    const q = typingQs[idx];
    if (isSuccess) setScore((s) => s + 1);
    if (q.wordId) onWordResult(q.wordId, isSuccess);
    else if (q.sentenceId) onSentenceResult(q.sentenceId, isSuccess);
    setFeedback({
      correct: isSuccess,
      answerText,
    });
  };

  const handleScrambleComplete = (correct: boolean) => {
    if (!scrambleQs[idx]) return;
    const q = scrambleQs[idx];
    if (correct) setScore((s) => s + 1);
    onSentenceResult(q.sentence.id, correct);
    setFeedback({
      correct,
      answerText: q.sentence.english,
    });
  };

  /* ---------------- 畫面渲染 ---------------- */
  if (screen === 'menu') {
    return (
      <div className="space-y-4">
        {/* 出題設定 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
              <MousePointerClick className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>出題設定</span>
            </h3>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              🌱 無時間限制 · 輕鬆複習
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">範圍：</span>
            {([
              { key: 'all', label: '全部' },
              { key: 'favorites', label: '收藏' },
              { key: 'weak', label: '待複習 (1-2級)' },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  scope === s.key
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">分類：</span>
            <button
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                category === 'all'
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              全部
            </button>
            {(Object.keys(WORD_CATEGORY_LABELS) as WordCategory[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  category === c
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {WORD_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">題數：</span>
            {[5, 8, 10, 15].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  count === n
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-[11px] text-slate-400 ml-1">
              (目前篩選：單字 {poolWords.length} 個、句子 {poolSentences.length} 句)
            </span>
          </div>
        </div>

        {/* 遊戲卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(GAME_INFO) as GameType[]).map((g) => {
            const info = GAME_INFO[g];
            const need = needMap[g];
            const enough = need.current >= need.count;
            const best = bestByGame.get(g);
            return (
              <button
                key={g}
                onClick={() => enough && startGame(g)}
                disabled={!enough}
                className={`text-left rounded-2xl border p-5 transition-all shadow-sm ${
                  enough
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-brand-400 dark:hover:border-brand-500 hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{info.emoji}</div>
                  {best && (
                    <div className="flex items-center space-x-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-1 rounded-full">
                      <Trophy className="w-3 h-3" />
                      <span>最佳 {best.score}/{best.total} ({best.acc}%)</span>
                    </div>
                  )}
                </div>
                <div className="font-bold text-slate-800 dark:text-white mt-2">{info.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{info.desc}</div>
                {!enough && (
                  <div className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold mt-2">
                    ⚠ {need.label}數不足 (至少需 {need.count} 個，目前 {need.current} 個)
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {(Object.keys(GAME_INFO) as GameType[]).some((g) => needMap[g].current < needMap[g].count) &&
          poolWords.length === 0 &&
          poolSentences.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300">
              目前篩選條件下沒有任何單字或句子，請調整「出題設定」或先到單字庫/句子庫新增內容。
            </div>
          )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (confirm('確定要離開本輪遊戲嗎？')) setScreen('menu');
              }}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              title="離開遊戲"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm text-slate-800 dark:text-white">
              {activeGame && GAME_INFO[activeGame].emoji} {activeGame && GAME_INFO[activeGame].title}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              無時間限制
            </span>
            <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
              <Check className="w-3.5 h-3.5" />
              <span>{score}</span>
            </span>
            <span className="text-slate-700 dark:text-slate-300 font-bold">
              {screen === 'play' ? `第 ${idx + 1}/${totalQs} 題` : '完成'}
            </span>
          </div>
        </div>
        {screen === 'play' && (
          <div className="mt-3 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-brand-500 to-brand-700 rounded-full h-2 transition-all duration-300"
              style={{ width: `${((idx + 1) / Math.max(1, totalQs)) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* 結果畫面 */}
      {screen === 'result' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-4">
          <div className="text-5xl">
            {score / Math.max(1, totalQs) >= 0.7 ? '🎉' : score / Math.max(1, totalQs) >= 0.4 ? '💪' : '📚'}
          </div>
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">
            {score / Math.max(1, totalQs) >= 0.7 ? '太棒了！' : score / Math.max(1, totalQs) >= 0.4 ? '不錯的表現！' : '繼續加油！'}
          </h3>
          <div className="text-2xl font-extrabold text-brand-700 dark:text-brand-400">
            {score} / {totalQs}{' '}
            <span className="text-sm text-slate-400 font-bold">
              ({Math.round((score / Math.max(1, totalQs)) * 100)}%)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-left">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-400 uppercase">答對題數</div>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                {score} / {totalQs}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-400 uppercase">正確率</div>
              <div className="text-lg font-extrabold text-brand-600 dark:text-brand-400">
                {Math.round((score / Math.max(1, totalQs)) * 100)}%
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            答錯的單字/句子熟練度已自動下降，答對的會上升，下次複習時會優先出現在翻卡複習中。
          </div>
          <div className="flex items-center justify-center space-x-2 pt-2">
            <button
              onClick={() => activeGame && startGame(activeGame)}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm flex items-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>再玩一輪</span>
            </button>
            <button
              onClick={() => setScreen('menu')}
              className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>回遊戲選單</span>
            </button>
          </div>
        </div>
      )}

      {/* 遊戲進行中 */}
      {screen === 'play' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          {/* = 1. 單字測驗 (四選一) = */}
          {activeGame === 'word_quiz' && quizQs[idx] && (
            <WordQuizGame
              key={quizQs[idx].word.id}
              question={quizQs[idx]}
              feedback={feedback}
              chosenIdx={chosenIdx}
              onAnswer={handleQuizAnswer}
            />
          )}

          {/* = 2. 句子填空 (四選一) = */}
          {activeGame === 'sentence_cloze' && clozeQs[idx] && (
            <SentenceClozeGame
              key={clozeQs[idx].sentence.id}
              question={clozeQs[idx]}
              feedback={feedback}
              chosenIdx={chosenIdx}
              onAnswer={handleClozeAnswer}
            />
          )}

          {/* = 3. 拼字闖關 (字母拼圖) = */}
          {activeGame === 'word_spelling' && spellingQs[idx] && (
            <WordSpellingGame
              key={spellingQs[idx].word.id}
              question={spellingQs[idx]}
              feedback={feedback}
              onComplete={handleSpellingComplete}
            />
          )}

          {/* = 4. 英打挑戰 (鍵盤打字) = */}
          {activeGame === 'typing_practice' && typingQs[idx] && (
            <TypingPracticeGame
              key={typingQs[idx].id}
              question={typingQs[idx]}
              feedback={feedback}
              onComplete={handleTypingComplete}
              onNext={nextQuestion}
            />
          )}

          {/* = 5. 排句成序 (字卡排序) = */}
          {activeGame === 'sentence_scramble' && scrambleQs[idx] && (
            <SentenceScrambleGame
              key={scrambleQs[idx].sentence.id}
              question={scrambleQs[idx]}
              feedback={feedback}
              onComplete={handleScrambleComplete}
            />
          )}

          {/* = 作答回饋 + 下一題 = */}
          {feedback && (
            <div
              className={`rounded-xl p-4 border-2 ${
                feedback.correct
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800'
              }`}
            >
              <div
                className={`flex items-center space-x-2 text-sm font-bold ${
                  feedback.correct
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-600 dark:text-rose-300'
                }`}
              >
                {feedback.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                <span>
                  {feedback.correct
                    ? '答對了！熟練度 +1'
                    : `答錯了${feedback.answerText ? `，正確答案：${feedback.answerText}` : ''}（熟練度降回生疏）`}
                </span>
              </div>

              {activeGame === 'word_quiz' && quizQs[idx]?.word.exampleSentence && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start justify-between gap-2 text-left bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {quizQs[idx].word.exampleSentence}
                    </div>
                    {quizQs[idx].word.exampleTranslation && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {quizQs[idx].word.exampleTranslation}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => SpeechService.speak(quizQs[idx].word.exampleSentence, 0.85)}
                    className="shrink-0 p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title="朗讀例句發音"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                onClick={nextQuestion}
                className="mt-3 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm shadow-brand-600/30"
              >
                {idx + 1 >= totalQs ? (
                  <>
                    <Trophy className="w-4 h-4" />
                    <span>查看本輪成績</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    <span>下一題（可按 Enter 或 空白鍵）</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
