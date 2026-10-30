import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Word, Sentence, GameType, WordCategory, GameRecord } from '../types';
import { GAME_INFO, WORD_CATEGORY_LABELS, LEVEL_LABELS } from '../types';
import {
  Check, X, ChevronRight, Volume2, Trophy, Target, RotateCcw,
  Sparkles, MousePointerClick, Undo2, Home, Keyboard,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SpeechService } from '../services/speechService';

interface GameViewProps {
  words: Word[];
  sentences: Sentence[];
  gameRecords: GameRecord[];
  onWordResult: (wordId: string, isCorrect: boolean) => void;
  onSentenceResult: (sentenceId: string, isCorrect: boolean) => void;
  onAddGameRecord: (game: GameType, score: number, total: number, durationSec: number) => void;
}

/* ------------------------- 共用工具 ------------------------- */

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const normToken = (t: string): string =>
  t.toLowerCase().replace(/[^a-z0-9']/g, '');

const stripPunct = (t: string): string => t.replace(/[^A-Za-z]/g, '');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'in', 'it', 'that', 'for',
  'on', 'with', 'as', 'at', 'by', 'from', 'you', 'i', 'we', 'he', 'she', 'they', 'this',
  'these', 'those', 'be', 'been', 'am', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'should', 'may', 'might', 'have', 'has', 'had', 'not', 'no', 'so', 'or', 'but', 'if',
  'than', 'then', 'there', 'their', 'his', 'her', 'its', 'our', 'my', 'your', 'me', 'him',
  'them', 'us', 'get', 'got', 'let', 'like', 'just', 'very', 'too', 'more', 'most',
]);

/* 題目結構 */
interface QuizQuestion {
  mode: 'en2zh' | 'zh2en';
  word: Word;
  options: string[];
  answerIdx: number;
}
interface SpellQuestion {
  word: Word;
  tokens: string[][]; // 每個單字段的字母
  target: string;     // 不含空格的正解
}
interface ClozeQuestion {
  sentence: Sentence;
  pre: string;   // 挖空前的文字
  post: string;  // 挖空後的文字
  answer: string;
  options: string[];
  answerIdx: number;
}
interface ScrambleQuestion {
  sentence: Sentence;
  tokens: string[];
}
interface TypingQuestion {
  id: string;
  kind: 'word' | 'sentence';
  target: string;
  meaning: string;
  phonetic?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  wordId?: string;
  sentenceId?: string;
}

/* ------------------------- 主組件 ------------------------- */

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
  const [feedback, setFeedback] = useState<null | { correct: boolean; answerText?: string; chosen?: string }>(null);
  const startTsRef = useRef<number>(0);

  /* --- 每個遊戲自己的作答狀態 --- */
  // 快問快答 / 填空: 選項選擇
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  // 拼字: 已放置的 tile index (依序)
  const [typed, setTyped] = useState<number[]>([]);
  // 排句: 已拼接的 token 流
  const [placed, setPlaced] = useState<number[]>([]);
  // 英打挑戰: 已輸入文字與錯誤計數
  const [typedText, setTypedText] = useState('');
  const [mistakeCount, setMistakeCount] = useState(0);
  const typingInputRef = useRef<HTMLInputElement>(null);

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
    return words
      .filter((w) => {
        if (category !== 'all' && w.category !== category) return false;
        if (weak && w.level > 2) return false;
        if (fav && !w.favorite) return false;
        return true;
      });
  }, [words, scope, category]);

  const poolSentences = useMemo(() => {
    const weak = scope === 'weak';
    const fav = scope === 'favorites';
    return sentences
      .filter((s) => {
        if (category !== 'all' && s.category !== category) return false;
        if (weak && s.level > 2) return false;
        if (fav && !s.favorite) return false;
        return true;
      });
  }, [sentences, scope, category]);

  const needMap: Record<GameType, { count: number; label: string; current: number }> = {
    word_quiz: { count: 4, label: '單字', current: poolWords.length },
    word_spelling: { count: 1, label: '單字', current: poolWords.filter((w) => stripPunct(w.english).length >= 2).length },
    typing_practice: { count: 1, label: '單字/句子', current: poolWords.length > 0 ? poolWords.length : poolSentences.length },
    sentence_cloze: { count: 2, label: '句子', current: poolSentences.length },
    sentence_scramble: { count: 1, label: '句子', current: poolSentences.length },
  };

  /* ---------------- 出題 ---------------- */
  const buildQuestions = (game: GameType) => {
    const n = count;
    let total = 0;

    if (game === 'word_quiz') {
      const picked = shuffle(poolWords).slice(0, n);
      const questions: QuizQuestion[] = picked.map((word, qIdx) => {
        const mode: QuizQuestion['mode'] = qIdx % 2 === 0 ? 'en2zh' : 'zh2en';
        const correct = mode === 'en2zh' ? word.meaning : word.english;
        const distractSource =
          mode === 'en2zh'
            ? words.filter((w) => w.id !== word.id).map((w) => w.meaning)
            : words.filter((w) => w.id !== word.id).map((w) => w.english);
        const seen = new Set<string>([correct.toLowerCase()]);
        const distractors: string[] = [];
        for (const d of shuffle(distractSource)) {
          if (distractors.length >= 3) break;
          if (!seen.has(d.toLowerCase())) {
            seen.add(d.toLowerCase());
            distractors.push(d);
          }
        }
        const options = shuffle([correct, ...distractors]);
        return { mode, word, options, answerIdx: options.indexOf(correct) };
      });
      setQuizQs(questions);
      total = questions.length;
    } else if (game === 'word_spelling') {
      const candidates = poolWords.filter((w) => stripPunct(w.english).length >= 2);
      const picked = shuffle(candidates).slice(0, n);
      const questions: SpellQuestion[] = picked.map((word) => {
        const tokens = word.english
          .split(/\s+/)
          .map((tk) => stripPunct(tk).split(''));
        return { word, tokens, target: stripPunct(word.english).toLowerCase() };
      });
      setSpellingQs(questions);
      total = questions.length;
    } else if (game === 'typing_practice') {
      const candidates: Array<Word | Sentence> = poolWords.length > 0 ? poolWords : poolSentences;
      const picked = shuffle(candidates).slice(0, n);
      const questions: TypingQuestion[] = picked.map((item) => {
        if ('meaning' in item) {
          const w = item as Word;
          return {
            id: w.id,
            kind: 'word',
            target: w.english.trim(),
            meaning: w.meaning,
            phonetic: w.phonetic,
            exampleSentence: w.exampleSentence,
            exampleTranslation: w.exampleTranslation,
            wordId: w.id,
          };
        } else {
          const s = item as Sentence;
          return {
            id: s.id,
            kind: 'sentence',
            target: s.english.trim(),
            meaning: s.chinese,
            exampleSentence: s.english,
            exampleTranslation: s.chinese,
            sentenceId: s.id,
          };
        }
      });
      setTypingQs(questions);
      total = questions.length;
    } else if (game === 'sentence_cloze') {
      const picked = shuffle(poolSentences).slice(0, n);
      // 干擾選項池（排除當前題目句子，避免同句其他單字也變成選項）
      const buildDistractorPool = (excludeId: string) =>
        Array.from(
          new Set([
            ...sentences
              .filter((s) => s.id !== excludeId)
              .flatMap((s) => s.english.split(/\s+/).map(normToken))
              .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
            ...words.map((w) => stripPunct(w.english).toLowerCase()).filter((t) => t.length >= 3),
          ])
        );
      const questions: ClozeQuestion[] = [];
      for (const sentence of picked) {
        const distractorPool = buildDistractorPool(sentence.id);
        const tokensRaw = sentence.english.split(/\s+/);
        const candidates = tokensRaw
          .map(stripPunct)
          .map((core) => core.toLowerCase())
          .filter((core) => core.length >= 3 && !STOPWORDS.has(core));
        if (candidates.length === 0) continue;
        const longest = Math.max(...candidates.map((c) => c.length));
        const topOnes = candidates.filter((c) => c.length >= longest - 1);
        const answer = topOnes[Math.floor(Math.random() * topOnes.length)];
        const tokenIdx = tokensRaw.findIndex((t) => normToken(t) === answer);
        if (tokenIdx < 0) continue;
        const seen = new Set<string>([answer]);
        const distractors: string[] = [];
        for (const d of shuffle(distractorPool)) {
          if (distractors.length >= 3) break;
          if (!seen.has(d)) {
            seen.add(d);
            distractors.push(d);
          }
        }
        if (distractors.length < 3) {
          const FALLBACK_WORDS = ['always', 'usually', 'sometimes', 'already', 'almost', 'enough', 'together', 'important', 'different', 'possible'];
          for (const d of shuffle(FALLBACK_WORDS)) {
            if (distractors.length >= 3) break;
            if (!seen.has(d)) {
              seen.add(d);
              distractors.push(d);
            }
          }
        }
        const options = shuffle([answer, ...distractors]);
        questions.push({
          sentence,
          pre: tokensRaw.slice(0, tokenIdx).join(' '),
          post: tokensRaw.slice(tokenIdx + 1).join(' '),
          answer,
          options,
          answerIdx: options.indexOf(answer),
        });
      }
      setClozeQs(questions);
      total = questions.length;
    } else {
      const picked = shuffle(poolSentences).slice(0, n);
      const questions: ScrambleQuestion[] = picked.map((sentence) => {
        const tokens = sentence.english.split(/\s+/);
        let scrambled = shuffle(tokens);
        let tries = 0;
        while (
          tries < 10 &&
          scrambled.length > 1 &&
          scrambled.every((t, i) => normToken(t) === normToken(tokens[i]))
        ) {
          scrambled = shuffle(tokens);
          tries++;
        }
        return { sentence, tokens: scrambled };
      });
      setScrambleQs(questions);
      total = questions.length;
    }

    return total;
  };

  const startGame = (game: GameType) => {
    const total = buildQuestions(game);
    if (total <= 0) {
      alert(`符合篩選條件的${needMap[game].label}不足，請先調整篩選或新增${needMap[game].label}！`);
      return;
    }
    setActiveGame(game);
    setScreen('play');
    setIdx(0);
    setScore(0);
    setFeedback(null);
    setChosenIdx(null);
    setTyped([]);
    setPlaced([]);
    setTypedText('');
    setMistakeCount(0);
    startTsRef.current = Date.now();
  };

  const finish = (finalScore: number, totalQs: number) => {
    const durationSec = Math.max(1, Math.round((Date.now() - startTsRef.current) / 1000));
    if (activeGame) {
      onAddGameRecord(activeGame, finalScore, totalQs, durationSec);
    }
    if (totalQs > 0 && finalScore / totalQs >= 0.7) {
      confetti({ particleCount: 160, spread: 80, origin: { y: 0.7 }, colors: ['#6366f1', '#34d399', '#fbbf24', '#f472b6'] });
    }
    setScreen('result');
  };

  /* ---------------- 作答處理 ---------------- */
  const answerQuizOrCloze = (isQuiz: boolean, question: QuizQuestion | ClozeQuestion, choice: number) => {
    if (feedback) return;
    const correct = choice === question.answerIdx;
    setChosenIdx(choice);
    if (isQuiz) {
      onWordResult((question as QuizQuestion).word.id, correct);
    } else {
      onSentenceResult((question as ClozeQuestion).sentence.id, correct);
    }
    setFeedback({
      correct,
      answerText: isQuiz
        ? (question as QuizQuestion).mode === 'en2zh'
          ? (question as QuizQuestion).word.meaning
          : (question as QuizQuestion).word.english
        : (question as ClozeQuestion).answer,
      chosen: question.options[choice],
    });
    if (correct) setScore((s) => s + 1);
    if (isQuiz && (question as QuizQuestion).mode === 'zh2en') {
      SpeechService.speak((question as QuizQuestion).word.english);
    }
  };

  const nextQuestion = () => {
    const totalQs =
      activeGame === 'word_quiz' ? quizQs.length
      : activeGame === 'word_spelling' ? spellingQs.length
      : activeGame === 'typing_practice' ? typingQs.length
      : activeGame === 'sentence_cloze' ? clozeQs.length
      : scrambleQs.length;

    if (idx + 1 >= totalQs) {
      finish(score, totalQs);
      return;
    }
    setIdx(idx + 1);
    setFeedback(null);
    setChosenIdx(null);
    setTyped([]);
    setPlaced([]);
    setTypedText('');
    setMistakeCount(0);
  };

  /* --- 拼字: tile 操作 + 自動檢查 + 鍵盤支援 --- */
  const spellingQ = activeGame === 'word_spelling' && spellingQs[idx] ? spellingQs[idx] : null;
  const spellingLetters = useMemo(
    () => (spellingQ ? spellingQ.tokens.flat() : []),
    [spellingQ]
  );
  const spellingScrambledIdx = useMemo(() => {
    if (!spellingQ) return [];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, spellingQ?.word.id]);

  const checkSpelling = (finalTyped: number[]) => {
    if (!spellingQ) return;
    const guess = finalTyped.map((i) => spellingLetters[i]).join('').toLowerCase();
    const correct = guess === spellingQ.target;
    if (correct) setScore((s) => s + 1);
    onWordResult(spellingQ.word.id, correct);
    setFeedback({
      correct,
      answerText: spellingQ.word.english,
      chosen: finalTyped.map((i) => spellingLetters[i]).join(''),
    });
  };

  useEffect(() => {
    if (screen !== 'play' || activeGame !== 'word_spelling' || feedback) return;
    const handler = (e: KeyboardEvent) => {
      if (!spellingQ) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeGame, feedback, idx, spellingQ?.word.id]);

  /* --- 排句 --- */
  const scrambleQ = activeGame === 'sentence_scramble' && scrambleQs[idx] ? scrambleQs[idx] : null;

  const checkScramble = (placedOverride?: number[]) => {
    if (!scrambleQ) return;
    const seq = placedOverride !== undefined ? placedOverride : placed;
    const placedTokens = seq.map((i) => scrambleQ.tokens[i]);
    const origTokens = scrambleQ.sentence.english.trim().split(/\s+/);
    const correct =
      placedTokens.length === origTokens.length &&
      placedTokens.every((t, i) => normToken(t) === normToken(origTokens[i]));
    if (correct) setScore((s) => s + 1);
    onSentenceResult(scrambleQ.sentence.id, correct);
    setFeedback({ correct, answerText: scrambleQ.sentence.english });
  };

  /* --- 英打挑戰 --- */
  const typingQ = activeGame === 'typing_practice' && typingQs[idx] ? typingQs[idx] : null;

  useEffect(() => {
    if (screen === 'play' && activeGame === 'typing_practice' && !feedback) {
      const timer = setTimeout(() => {
        typingInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [screen, activeGame, idx, feedback]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, feedback, idx]);

  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (feedback || !typingQ) return;
    const val = e.target.value;
    const target = typingQ.target;

    // Disallow typing past target length
    if (val.length > target.length) return;

    // Check newly typed character
    if (val.length > typedText.length) {
      const newIdx = val.length - 1;
      if (val[newIdx].toLowerCase() !== target[newIdx].toLowerCase()) {
        setMistakeCount((m) => m + 1);
      }
    }

    setTypedText(val);

    // If completely typed
    if (val.length === target.length) {
      const isMatch = val.toLowerCase() === target.toLowerCase();
      if (isMatch) {
        const isSuccess = mistakeCount <= 1;
        if (isSuccess) setScore((s) => s + 1);
        if (typingQ.wordId) onWordResult(typingQ.wordId, isSuccess);
        else if (typingQ.sentenceId) onSentenceResult(typingQ.sentenceId, isSuccess);
        SpeechService.speak(target);
        setFeedback({
          correct: isSuccess,
          answerText: target,
        });
      }
    }
  };

  /* ====================== RENDER ====================== */

  const totalQs =
    screen === 'play' || screen === 'result'
      ? (activeGame === 'word_quiz' ? quizQs.length
        : activeGame === 'word_spelling' ? spellingQs.length
        : activeGame === 'typing_practice' ? typingQs.length
        : activeGame === 'sentence_cloze' ? clozeQs.length
        : scrambleQs.length)
      : 0;

  /* --- 遊戲選單 --- */
  if (screen === 'menu') {
    return (
      <div className="space-y-4">
        {/* 出題設定 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
              <MousePointerClick className="w-4 h-4 text-brand-600" />
              <span>出題設定</span>
            </h3>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              🌱 無時間限制 · 輕鬆複習
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">範圍：</span>
            {([
              { key: 'all', label: '全部' },
              { key: 'favorites', label: '收藏' },
              { key: 'weak', label: '待複習 (1-2級)' },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  scope === s.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">分類：</span>
            <button
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                category === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              全部
            </button>
            {(Object.keys(WORD_CATEGORY_LABELS) as WordCategory[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  category === c ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {WORD_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">題數：</span>
            {[5, 8, 10, 15].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  count === n ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
                    ? 'bg-white border-slate-200 hover:shadow-lg hover:border-brand-300 hover:-translate-y-0.5'
                    : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{info.emoji}</div>
                  {best && (
                    <div className="flex items-center space-x-1 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                      <Trophy className="w-3 h-3" />
                      <span>最佳 {best.score}/{best.total} ({best.acc}%)</span>
                    </div>
                  )}
                </div>
                <div className="font-bold text-slate-800 mt-2">{info.title}</div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">{info.desc}</div>
                {!enough && (
                  <div className="text-[11px] text-rose-500 font-semibold mt-2">
                    ⚠ {need.label}數不足 (至少需 {need.count} 個，目前 {need.current} 個)
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {(Object.keys(GAME_INFO) as GameType[]).some((g) => needMap[g].current < needMap[g].count) && poolWords.length === 0 && poolSentences.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
            目前篩選條件下沒有任何單字或句子，請調整「出題設定」或先到單字庫/句子庫新增內容。
          </div>
        )}
      </div>
    );
  }

  /* --- 遊戲進行共用外框 + 結果畫面 --- */
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (confirm('確定要離開本輪遊戲嗎？')) setScreen('menu');
              }}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              title="離開遊戲"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm text-slate-800">
              {activeGame && GAME_INFO[activeGame].emoji} {activeGame && GAME_INFO[activeGame].title}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs font-bold text-slate-500">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              無時間限制
            </span>
            <span className="flex items-center space-x-1 text-emerald-600 font-extrabold">
              <Check className="w-3.5 h-3.5" />
              <span>{score}</span>
            </span>
            <span className="text-slate-700 font-bold">{screen === 'play' ? `第 ${idx + 1}/${totalQs} 題` : '完成'}</span>
          </div>
        </div>
        {screen === 'play' && (
          <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-brand-700 rounded-full h-2 transition-all duration-300" style={{ width: `${((idx + 1) / Math.max(1, totalQs)) * 100}%` }} />
          </div>
        )}
      </div>

      {/* 結果畫面 */}
      {screen === 'result' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="text-5xl">{score / Math.max(1, totalQs) >= 0.7 ? '🎉' : score / Math.max(1, totalQs) >= 0.4 ? '💪' : '📚'}</div>
          <h3 className="text-xl font-extrabold text-slate-800">
            {score / Math.max(1, totalQs) >= 0.7 ? '太棒了！' : score / Math.max(1, totalQs) >= 0.4 ? '不錯的表現！' : '繼續加油！'}
          </h3>
          <div className="text-2xl font-extrabold text-brand-700">{score} / {totalQs} <span className="text-sm text-slate-400 font-bold">({Math.round((score / Math.max(1, totalQs)) * 100)}%)</span></div>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-left">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase">答對題數</div>
              <div className="text-lg font-extrabold text-emerald-600">{score} / {totalQs}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase">正確率</div>
              <div className="text-lg font-extrabold text-brand-600">
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
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm flex items-center space-x-1.5"
            >
              <RotateCcw className="w-4 h-4" /><span>再玩一輪</span>
            </button>
            <button
              onClick={() => setScreen('menu')}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1.5"
            >
              <Home className="w-4 h-4" /><span>回遊戲選單</span>
            </button>
          </div>
        </div>
      )}

      {/* 遊戲進行中 */}
      {screen === 'play' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          {/* = 快問快答 / 填空 = */}
          {(activeGame === 'word_quiz' || activeGame === 'sentence_cloze') && (() => {
            const q =
              activeGame === 'word_quiz'
                ? quizQs[idx]
                : clozeQs[idx];
            if (!q) return null;
            const prompt =
              activeGame === 'word_quiz'
                ? (q as QuizQuestion).mode === 'en2zh'
                  ? (q as QuizQuestion).word.english
                  : (q as QuizQuestion).word.meaning
                : `${(q as ClozeQuestion).pre} ______ ${(q as ClozeQuestion).post}`.trim();

            return (
              <>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {activeGame === 'word_quiz'
                          ? (q as QuizQuestion).mode === 'en2zh'
                            ? '選出正確的中文意思'
                            : '選出對應的英文單字'
                          : '選出句中空格的正確單字'}
                      </div>
                      <div className={`mt-2 font-bold text-slate-800 leading-relaxed ${activeGame === 'word_quiz' && (q as QuizQuestion).mode === 'en2zh' ? 'text-3xl' : 'text-lg'}`}>
                        {prompt}
                      </div>
                      {activeGame === 'word_quiz' && (q as QuizQuestion).mode === 'en2zh' && (q as QuizQuestion).word.phonetic && (
                        <div className="text-xs text-slate-400 font-mono mt-1">{(q as QuizQuestion).word.phonetic}</div>
                      )}
                      {activeGame === 'word_quiz' && (q as QuizQuestion).mode === 'zh2en' && (
                        <div className="text-[11px] text-slate-400 mt-1">熟練度 {LEVEL_LABELS[(q as QuizQuestion).word.level]}</div>
                      )}
                      {activeGame === 'sentence_cloze' && (
                        <div className="text-xs text-slate-400 mt-1">提示：{(q as ClozeQuestion).sentence.chinese}</div>
                      )}
                    </div>
                    {activeGame === 'word_quiz' && (q as QuizQuestion).mode === 'en2zh' && (
                      <button
                        onClick={() => SpeechService.speak((q as QuizQuestion).word.english)}
                        className="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 shrink-0"
                        title="朗讀"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    )}
                    {activeGame === 'word_quiz' && (q as QuizQuestion).mode === 'zh2en' && (
                      <button
                        onClick={() => SpeechService.speak((q as QuizQuestion).word.english)}
                        className="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 shrink-0"
                        title="聽發音"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-2 ${feedback ? 'pointer-events-none' : ''}`}>
                  {q.options.map((opt, i) => {
                    const isAnswer = i === q.answerIdx;
                    const isChosen = chosenIdx === i;
                    let cls = 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50 text-slate-700';
                    if (feedback) {
                      if (isAnswer) cls = 'border-emerald-400 bg-emerald-50 text-emerald-700';
                      else if (isChosen) cls = 'border-rose-300 bg-rose-50 text-rose-600';
                      else cls = 'border-slate-200 bg-slate-50 text-slate-400';
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => answerQuizOrCloze(activeGame === 'word_quiz', q, i)}
                        className={`border-2 rounded-xl px-4 py-3 text-sm font-semibold text-left transition-all ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* = 拼字闖關 = */}
          {activeGame === 'word_spelling' && spellingQ && (() => {
            const word = spellingQ.word;
            let running = 0;
            const slotGroups = spellingQ.tokens.map((letters) => {
              const start = running;
              running += letters.length;
              return { letters, start };
            });
            const remaining = spellingScrambledIdx.filter((i) => !typed.includes(i));
            return (
              <>
                <div className="text-center space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">拼出正確的英文單字</div>
                  <div className="text-2xl font-bold text-brand-800">{word.meaning}</div>
                  <div className="text-xs text-slate-400 font-mono">{word.phonetic || ''}</div>
                  {word.exampleSentence && (() => {
                    const pattern = word.english.trim().split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean).join('\\s+');
                    const masked = pattern ? word.exampleSentence.replace(new RegExp(pattern, 'gi'), '____') : word.exampleSentence;
                    return (
                      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 inline-flex items-center space-x-2">
                        <span>{masked}</span>
                        <button
                          type="button"
                          onClick={() => SpeechService.speak(word.exampleSentence, 0.85)}
                          className="p-1 text-slate-400 hover:text-brand-600 rounded transition-colors cursor-pointer"
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
                      className="ml-2 p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600"
                      title="播放正解發音"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 作答槽位 */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 min-h-[56px] bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {slotGroups.map((g, gi) => (
                    <React.Fragment key={gi}>
                      {gi > 0 && <span className="text-slate-300 text-xl font-bold">␣</span>}
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
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                    : 'bg-rose-50 border-rose-300 text-rose-600'
                                  : 'bg-brand-50 border-brand-400 text-brand-700'
                                : 'bg-white border-dashed border-slate-300 text-slate-300'
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
                          className={`w-10 h-12 rounded-xl border-2 font-extrabold text-lg transition-all ${
                            isUsed
                              ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-default'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:-translate-y-0.5 shadow-sm'
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
                    <span>可直接打鍵盤輸入字母、Backspace 刪除；填滿後自動判斷 （剩餘 {remaining.length} 顆）</span>
                  </div>
                )}
              </>
            );
          })()}

          {/* = 英打挑戰 = */}
          {activeGame === 'typing_practice' && typingQ && (() => {
            const target = typingQ.target;
            const targetChars = target.split('');
            const uniqueSymbols = Array.from(new Set(target.replace(/[a-zA-Z0-9]/g, '').split(''))).filter((c) => c !== '');

            return (
              <div
                onClick={() => typingInputRef.current?.focus()}
                className="space-y-4 cursor-text"
              >
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>英打肌肉記憶練習</span>
                    {typingQ.kind === 'word' ? <span>· 單字</span> : <span>· 句子</span>}
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
                    {typingQ.meaning}
                  </div>
                  {typingQ.phonetic && (
                    <div className="text-xs text-slate-400 font-mono">
                      {typingQ.phonetic}
                    </div>
                  )}
                  {typingQ.exampleSentence && (
                    <div className="max-w-md mx-auto text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-left">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium italic">"{typingQ.exampleSentence}"</div>
                        {typingQ.exampleTranslation && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {typingQ.exampleTranslation}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          SpeechService.speak(typingQ.exampleSentence!, 0.85);
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-white transition-colors cursor-pointer"
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

                    let tileStyle = 'border-slate-200 bg-slate-50 text-slate-400';
                    if (isMistake) {
                      tileStyle = 'border-rose-400 bg-rose-100 text-rose-700 font-extrabold ring-2 ring-rose-400/40';
                    } else if (isCorrect) {
                      tileStyle = 'border-emerald-400 bg-emerald-100 text-emerald-700 font-extrabold';
                    } else if (isCurrent) {
                      tileStyle = 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-500/40 animate-pulse font-extrabold';
                    }

                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center min-w-[28px] sm:min-w-[34px] h-10 sm:h-12 px-1 text-lg sm:text-2xl rounded-xl border-2 transition-all ${tileStyle} ${char === ' ' ? 'w-6 sm:w-8 border-dashed bg-slate-100/60' : ''}`}
                      >
                        {char === ' ' ? (isTyped ? '␣' : '·') : (isTyped ? typedText[i] : char)}
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
                        const isFinished = feedback || (typedText.length === target.length && typedText.toLowerCase() === target.toLowerCase());
                        if (isFinished && (e.key === 'Enter' || e.key === ' ' || e.code === 'Space')) {
                          e.preventDefault();
                          e.stopPropagation();
                          nextQuestion();
                          return;
                        }
                        if (!feedback && e.key === 'Enter' && typedText.length === target.length && typedText.toLowerCase() !== target.toLowerCase()) {
                          e.preventDefault();
                          e.stopPropagation();
                          if (typingQ.wordId) onWordResult(typingQ.wordId, false);
                          else if (typingQ.sentenceId) onSentenceResult(typingQ.sentenceId, false);
                          SpeechService.speak(target);
                          setFeedback({
                            correct: false,
                            answerText: target,
                          });
                        }
                      }}
                      placeholder={feedback ? '按 Enter 或 空白鍵進入下一題 →' : '請直接在鍵盤打字輸入...'}
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      readOnly={Boolean(feedback)}
                      className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-center text-lg sm:text-xl font-bold font-mono text-slate-800 placeholder:text-slate-400 outline-none transition-all ${
                        feedback
                          ? feedback.correct
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'border-rose-400 ring-2 ring-rose-400/20'
                          : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20'
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-1 rounded-lg"
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
                              handleTypingChange({ target: { value: typedText + ' ' } } as React.ChangeEvent<HTMLInputElement>);
                            }
                            typingInputRef.current?.focus();
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                              handleTypingChange({ target: { value: typedText + sym } } as React.ChangeEvent<HTMLInputElement>);
                            }
                            typingInputRef.current?.focus();
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 font-mono"
                        >
                          輸入 [ {sym} ]
                        </button>
                      ))}
                    </div>
                  )}

                  {!feedback && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>進度：{typedText.length} / {target.length} 字母</span>
                      <span>失誤：{mistakeCount} 次</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* = 排句成序 = */}
          {activeGame === 'sentence_scramble' && scrambleQ && (() => {
            return (
              <>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">把字卡排成正確句子</div>
                  <div className="text-lg font-bold text-brand-800">{scrambleQ.sentence.chinese}</div>
                  {scrambleQ.sentence.note && <div className="text-[11px] text-slate-400 italic">📝 {scrambleQ.sentence.note}</div>}
                </div>

                {/* 作答區 */}
                <div className="min-h-[72px] bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-start content-start">
                  {placed.length === 0 && <span className="text-xs text-slate-400 m-2">👇 點擊下方字卡開始組句</span>}
                  {placed.map((tokenIdx, pos) => (
                    <button
                      key={`${tokenIdx}-${pos}`}
                      onClick={() => !feedback && setPlaced(placed.filter((_, i) => i !== pos))}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold shadow-sm transition-all ${
                        feedback
                          ? feedback.correct
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                            : 'bg-rose-50 border-rose-300 text-rose-600'
                          : 'bg-brand-50 border-brand-300 text-brand-700 hover:border-rose-400 hover:bg-rose-50'
                      }`}
                      title={feedback ? '' : '點擊移回下方'}
                    >
                      {scrambleQ.tokens[tokenIdx]}
                    </button>
                  ))}
                </div>

                {/* 字卡池 */}
                {!feedback && (
                  <div className="flex flex-wrap gap-2">
                    {scrambleQ.tokens.map((token, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const used = new Set(placed);
                          if (!used.has(i)) {
                            const next = [...placed, i];
                            setPlaced(next);
                            if (next.length === scrambleQ.tokens.length) {
                              setTimeout(() => checkScramble(next), 60);
                            }
                          }
                        }}
                        disabled={placed.includes(i)}
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                          placed.includes(i)
                            ? 'opacity-20 cursor-default bg-white border-slate-200 text-slate-400'
                            : 'bg-white border-slate-300 text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:-translate-y-0.5 shadow-sm'
                        }`}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                )}

                {!feedback && placed.length > 0 && placed.length < scrambleQ.tokens.length && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setPlaced([])}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 underline"
                    >
                      清空重排
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          {/* = 作答回饋 + 下一題 = */}
          {screen === 'play' && feedback && (
            <div className={`rounded-xl p-4 border-2 ${feedback.correct ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div className={`flex items-center space-x-2 text-sm font-bold ${feedback.correct ? 'text-emerald-700' : 'text-rose-600'}`}>
                {feedback.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                <span>{feedback.correct ? '答對了！熟練度 +1' : `答錯了${feedback.answerText ? `，正確答案：${feedback.answerText}` : ''}（熟練度降回生疏）`}</span>
              </div>
              {activeGame === 'word_quiz' && quizQs[idx]?.word.exampleSentence && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-start justify-between gap-2 text-left bg-white/70 p-2.5 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">
                      {quizQs[idx].word.exampleSentence}
                    </div>
                    {quizQs[idx].word.exampleTranslation && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {quizQs[idx].word.exampleTranslation}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => SpeechService.speak(quizQs[idx].word.exampleSentence, 0.85)}
                    className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="朗讀例句發音"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={nextQuestion}
                className="mt-3 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {idx + 1 >= totalQs ? (
                  <><Trophy className="w-4 h-4" /><span>查看本輪成績</span></>
                ) : (
                  <><ChevronRight className="w-4 h-4" /><span>下一題（可按 Enter 或 空白鍵）</span></>
                )}
              </button>
            </div>
          )}

          {/* = 排句:全部字卡放置後的檢查鈕 = */}
          {screen === 'play' && activeGame === 'sentence_scramble' && scrambleQ && !feedback && placed.length === scrambleQ.tokens.length && (
            <button
              onClick={() => checkScramble()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center space-x-1.5"
            >
              <Target className="w-4 h-4" />
              <span>檢查句子</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameView;
