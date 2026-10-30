import React, { useMemo, useState } from 'react';
import type { Word, Sentence, GameRecord } from '../types';
import { GAME_INFO } from '../types';
import {
  Layers, Quote, Target, Flame, Play, Check, X, ChevronRight,
  Volume2, RotateCcw, Trophy, Zap, TrendingUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SpeechService } from '../services/speechService';

interface DashboardViewProps {
  words: Word[];
  sentences: Sentence[];
  gameRecords: GameRecord[];
  onWordResult: (wordId: string, isCorrect: boolean) => void;
  onSentenceResult: (sentenceId: string, isCorrect: boolean) => void;
  onNavigate: (tab: 'words' | 'sentences' | 'games' | 'history') => void;
}

const REVIEW_QUEUE_SIZE = 8;

export const DashboardView: React.FC<DashboardViewProps> = ({
  words,
  sentences,
  gameRecords,
  onWordResult,
  onSentenceResult,
  onNavigate,
}) => {
  const [queue, setQueue] = useState<Array<{ kind: 'word' | 'sentence'; item: Word | Sentence }> | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [feedback, setFeedback] = useState<null | 'correct' | 'wrong'>(null);
  const [stats, setStats] = useState({ got: 0, miss: 0 });

  // --- 統計 ---
  const statCards = useMemo(() => {
    const mastered = words.filter((w) => w.level >= 4).length + sentences.filter((s) => s.level >= 4).length;
    const weak = words.filter((w) => w.level <= 2).length + sentences.filter((s) => s.level <= 2).length;
    const totalReviews = gameRecords.reduce((sum, r) => sum + r.total, 0);
    const totalCorrect = gameRecords.reduce((sum, r) => sum + r.score, 0);
    return { words: words.length, sentences: sentences.length, mastered, weak, totalReviews, totalCorrect };
  }, [words, sentences, gameRecords]);

  // --- 今日複習翻卡佇列 (熟練度低 + 最久未複習優先) ---
  const buildQueue = () => {
    const wordItems = words
      .slice()
      .sort((a, b) => a.level - b.level || (a.lastReviewedAt || '').localeCompare(b.lastReviewedAt || '') || a.reviewCount - b.reviewCount)
      .slice(0, REVIEW_QUEUE_SIZE / 2)
      .map((item) => ({ kind: 'word' as const, item }));
    const sentenceItems = sentences
      .slice()
      .sort((a, b) => a.level - b.level || (a.lastReviewedAt || '').localeCompare(b.lastReviewedAt || '') || a.reviewCount - b.reviewCount)
      .slice(0, REVIEW_QUEUE_SIZE / 2)
      .map((item) => ({ kind: 'sentence' as const, item }));
    // 簡易洗牌 (Fisher-Yates)
    const combined = [...wordItems, ...sentenceItems];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    setQueue(combined);
    setIndex(0);
    setFlipped(false);
    setFeedback(null);
    setStats({ got: 0, miss: 0 });
  };

  const handleReviewAnswer = (isCorrect: boolean) => {
    if (!queue) return;
    const current = queue[index];
    if (current.kind === 'word') {
      onWordResult(current.item.id, isCorrect);
    } else {
      onSentenceResult(current.item.id, isCorrect);
    }
    setStats((prev) => ({ got: prev.got + (isCorrect ? 1 : 0), miss: prev.miss + (isCorrect ? 0 : 1) }));
    setFeedback(isCorrect ? 'correct' : 'wrong');
  };

  const handleNext = () => {
    if (!queue) return;
    if (index + 1 >= queue.length) {
      if (stats.got / Math.max(1, queue.length) >= 0.7) {
        confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 }, colors: ['#6366f1', '#34d399', '#fbbf24'] });
      }
      setQueue(null);
      setIndex(0);
      setFlipped(false);
      setFeedback(null);
      return;
    }
    setIndex(index + 1);
    setFlipped(false);
    setFeedback(null);
  };

  const recentRecords = gameRecords.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => onNavigate('words')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center space-x-2 text-brand-600">
            <Layers className="w-4 h-4" />
            <span className="text-xs font-bold">單字庫</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2">{statCards.words}<span className="text-sm text-slate-400 font-bold ml-1">個</span></div>
          <div className="text-[11px] text-slate-400 mt-1">精通 {words.filter((w) => w.level >= 4).length} • 待複習 {words.filter((w) => w.level <= 2).length}</div>
        </button>

        <button onClick={() => onNavigate('sentences')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center space-x-2 text-sky-600">
            <Quote className="w-4 h-4" />
            <span className="text-xs font-bold">句子庫</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2">{statCards.sentences}<span className="text-sm text-slate-400 font-bold ml-1">句</span></div>
          <div className="text-[11px] text-slate-400 mt-1">精通 {sentences.filter((s) => s.level >= 4).length} • 待複習 {sentences.filter((s) => s.level <= 2).length}</div>
        </button>

        <button onClick={() => onNavigate('games')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center space-x-2 text-emerald-600">
            <Target className="w-4 h-4" />
            <span className="text-xs font-bold">精通總數</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2">{statCards.mastered}</div>
          <div className="text-[11px] text-slate-400 mt-1">熟練度達 4 級以上的單字與句子</div>
        </button>

        <button onClick={() => onNavigate('history')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center space-x-2 text-amber-600">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-bold">遊戲答題數</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2">{statCards.totalReviews}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            答對 {statCards.totalCorrect} • 準確率 {statCards.totalReviews > 0 ? Math.round((statCards.totalCorrect / statCards.totalReviews) * 100) : 0}%
          </div>
        </button>
      </div>

      {/* 今日複習翻卡 */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl shadow-lg p-5 text-white">
        {!queue ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-300" />
                <span>今日翻卡複習</span>
              </h3>
              <p className="text-xs text-brand-100 leading-relaxed max-w-xl">
                系統會挑出熟練度最低、最久沒複習的單字與句子，安排 {REVIEW_QUEUE_SIZE} 張複習卡。翻開卡片確認意思後回答是否記得，正確與否會自動調整熟練度 (Leitner 5 級學習盒)。
              </p>
            </div>
            <button
              onClick={buildQueue}
              disabled={words.length === 0 && sentences.length === 0}
              className="shrink-0 px-6 py-3 rounded-xl bg-white text-brand-700 font-bold text-sm shadow-md hover:bg-brand-50 transition-all disabled:opacity-40 flex items-center space-x-1.5"
            >
              <Play className="w-4 h-4" />
              <span>{index > 0 ? '繼續複習' : '開始複習'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center justify-between text-xs font-semibold text-brand-100">
              <span>複習卡 {index + 1} / {queue.length}</span>
              <span>✓ {stats.got} ✗ {stats.miss}</span>
            </div>
            <div className="bg-white/20 rounded-full h-2 overflow-hidden">
              <div className="bg-white rounded-full h-2 transition-all duration-300" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
            </div>

            {/* Card */}
            {(() => {
              const current = queue[index];
              const item = current.item;
              const isWord = current.kind === 'word';
              return (
                <div className="bg-white rounded-2xl p-5 text-slate-800 space-y-3">
                  {/* 正面：英文 (點擊可發音) */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isWord ? 'bg-brand-100 text-brand-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isWord ? '單字' : '句子'}
                        </span>
                        <span className="text-[10px] text-slate-400">熟練度 {item.level}/5</span>
                      </div>
                      <div className="mt-2 text-xl font-bold text-slate-800 leading-relaxed">{item.english}</div>
                      {isWord && (item as Word).phonetic && (
                        <div className="text-xs text-slate-400 font-mono mt-1">{(item as Word).phonetic}</div>
                      )}
                    </div>
                    <button
                      onClick={() => SpeechService.speak(item.english, isWord ? 0.9 : 0.82)}
                      className="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 shrink-0"
                      title="朗讀"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 背面/答案 */}
                  {!flipped ? (
                    <button
                      onClick={() => setFlipped(true)}
                      className="w-full border-2 border-dashed border-brand-200 rounded-xl py-3 text-sm font-bold text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center space-x-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>點擊翻開看答案</span>
                    </button>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      {isWord ? (
                        <>
                          <div className="text-sm font-bold text-brand-800">{(item as Word).meaning}</div>
                          {(item as Word).exampleSentence && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-start justify-between gap-2">
                              <div className="text-xs text-slate-600 leading-relaxed font-medium">
                                {(item as Word).exampleSentence}
                                {(item as Word).exampleTranslation && (
                                  <div className="text-[11px] text-slate-400 mt-0.5">{(item as Word).exampleTranslation}</div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => SpeechService.speak((item as Word).exampleSentence, 0.85)}
                                title="朗讀例句發音"
                                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm font-bold text-slate-700">{(item as Sentence).chinese}</div>
                      )}
                    </div>
                  )}

                  {/* Answer buttons */}
                  {flipped && (feedback === null ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleReviewAnswer(false)}
                        className="py-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs hover:bg-rose-100 flex items-center justify-center space-x-1.5"
                      >
                        <X className="w-4 h-4" /><span>不記得 (熟練度歸 1)</span>
                      </button>
                      <button
                        onClick={() => handleReviewAnswer(true)}
                        className="py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs hover:bg-emerald-100 flex items-center justify-center space-x-1.5"
                      >
                        <Check className="w-4 h-4" /><span>我記得了 (熟練度 +1)</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5"
                    >
                      {index + 1 >= queue.length ? (
                        <><Trophy className="w-4 h-4" /><span>完成本次複習</span></>
                      ) : (
                        <><ChevronRight className="w-4 h-4" /><span>下一張卡片</span></>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* 快速入口 + 最近遊戲成績 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2 mb-3">
            <TrendingUp className="w-4 h-4 text-brand-600" />
            <span>開始複習遊戲</span>
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(GAME_INFO) as Array<keyof typeof GAME_INFO>).map((g) => (
              <button
                key={g}
                onClick={() => onNavigate('games')}
                className="text-left px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 transition-all group"
              >
                <div className="text-sm font-bold text-slate-700 group-hover:text-brand-700">
                  {GAME_INFO[g].emoji} {GAME_INFO[g].title}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{GAME_INFO[g].desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>最近遊戲成績</span>
          </h4>
          {recentRecords.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">還沒有遊戲記錄，快去「複習遊戲」玩一輪吧！</div>
          ) : (
            <div className="space-y-2">
              {recentRecords.map((r) => {
                const acc = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
                return (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{GAME_INFO[r.game].emoji}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-700">{GAME_INFO[r.game].title}</div>
                        <div className="text-[10px] text-slate-400">{r.date} {r.time} • {r.durationSec} 秒</div>
                      </div>
                    </div>
                    <div className={`text-xs font-extrabold ${acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-rose-500'}`}>
                      {r.score}/{r.total} ({acc}%)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
