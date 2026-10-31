import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { WordListView } from './components/WordListView';
import { SentenceListView } from './components/SentenceListView';
import { GameView } from './components/GameView';
import { HistoryView } from './components/HistoryView';
import { WordModal } from './components/WordModal';
import { SentenceModal } from './components/SentenceModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { DebugLogModal } from './components/DebugLogModal';
import { EnrichmentConfigModal } from './components/EnrichmentConfigModal';
import { BatchEnrichModal } from './components/BatchEnrichModal';
import { StorageService } from './services/storageService';
import { syncWithCloud } from './services/supabaseService';
import { LoggerService } from './services/loggerService';
import { SpeechService } from './services/speechService';
import { EnrichmentService } from './services/enrichmentService';
import type { Word, Sentence, GameRecord, GameType, CloudConfig, EnrichmentConfig } from './types';
import { WORD_CATEGORY_LABELS, PART_OF_SPEECH_LABELS } from './types';
import { Zap, BookOpen, Quote, Gamepad2, BarChart3, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

/** Collision-safe entity ID: crypto.randomUUID with a non-secure-context fallback. */
const generateEntityId = (prefix: string): string => {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
};

/* ---------------- 下載/CSV 工具 ---------------- */
const downloadFile = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const csvEscape = (value: unknown): string => {
  const str = value === null || value === undefined ? '' : String(value).trim();
  // 防 CSV Formula Injection：Excel 會把以 = + - @ 開頭的儲存格當公式執行，
  // 臟值可能來自雲端同步或匯入的備份，統一加上 ' 前綴使其降級為純文字
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'words' | 'sentences' | 'games' | 'history'>('dashboard');

  // Core App Data (直接由 StorageService 初始化，免去首次渲染空閃爍與 mount 時同步 setState)
  const [words, setWords] = useState<Word[]>(() => StorageService.getWords());
  const [sentences, setSentences] = useState<Sentence[]>(() => StorageService.getSentences());
  const [gameRecords, setGameRecords] = useState<GameRecord[]>(() => StorageService.getGameRecords());
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => StorageService.getCloudConfig());
  const [enrichmentConfig, setEnrichmentConfig] = useState<EnrichmentConfig>(() => StorageService.getEnrichmentConfig());

  // Modals
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isSentenceModalOpen, setIsSentenceModalOpen] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
  const [batchModalState, setBatchModalState] = useState<{ isOpen: boolean; type: 'words' | 'sentences' }>({
    isOpen: false,
    type: 'words',
  });

  // Enrichment in-flight states
  const [enrichingWordId, setEnrichingWordId] = useState<string | null>(null);
  const [enrichingSentenceId, setEnrichingSentenceId] = useState<string | null>(null);

  // In-app Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Load Local Data
  const loadAllData = useCallback(() => {
    setWords(StorageService.getWords());
    setSentences(StorageService.getSentences());
    setGameRecords(StorageService.getGameRecords());
    setCloudConfig(StorageService.getCloudConfig());
    setEnrichmentConfig(StorageService.getEnrichmentConfig());
  }, []);

  // Sync lock: prevents overlapping pull/push from corrupting localStorage
  const syncLockRef = useRef(false);

  // Unified two-way cloud sync (pull-merge-push, converges all devices to the same state)
  const triggerCloudSync = useCallback(async () => {
    if (syncLockRef.current) return;
    const config = StorageService.getCloudConfig();
    if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) return;
    syncLockRef.current = true;
    try {
      await syncWithCloud();
    } finally {
      syncLockRef.current = false;
      // Recompute local states after sync (records may arrive from other devices)
      loadAllData();
    }
  }, [loadAllData]);

  // Load Data on Mount & Auto Sync Polling
  // 遊戲作答等高頻寫入改用 debounced 同步：合併短時間內的連續答題，
  // 避免每一題都執行一次「三表全量拉取 + 全量 upsert」的完整同步徒增延遲與配額消耗
  const syncDebounceTimerRef = useRef<number | null>(null);
  const triggerCloudSyncDebounced = useCallback(
    (delayMs = 5000) => {
      if (syncDebounceTimerRef.current !== null) return; // 已有待同步排程，不重複堆疊
      syncDebounceTimerRef.current = window.setTimeout(() => {
        syncDebounceTimerRef.current = null;
        triggerCloudSync();
      }, delayMs);
    },
    [triggerCloudSync]
  );

  useEffect(() => {
    LoggerService.info('App', '英語管家 EngManager 應用啟動');
    SpeechService.warmUp();
    triggerCloudSync();

    const interval = setInterval(
      () => {
        // 頁面最小化或分頁切至背景時暫停輪詢，節省電力與 Supabase 配額
        if (typeof document !== 'undefined' && document.hidden) return;
        triggerCloudSync();
      },
      Math.max(10, cloudConfig.syncIntervalSeconds) * 1000
    );

    // 當使用者切換回此分頁時立即觸發一次同步
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        triggerCloudSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (syncDebounceTimerRef.current !== null) {
        clearTimeout(syncDebounceTimerRef.current);
        syncDebounceTimerRef.current = null;
      }
    };
  }, [triggerCloudSync, cloudConfig.syncIntervalSeconds]);

  /* ---------------- Word CRUD ---------------- */
  const handleSaveWord = (data: Omit<Word, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const currentWords = StorageService.getWords();
    let updated: Word[];
    if (editingWord) {
      updated = currentWords.map((w) =>
        w.id === editingWord.id ? { ...data, id: editingWord.id, createdAt: editingWord.createdAt, updatedAt: now } : w
      );
      LoggerService.info('Words', `編輯單字: ${data.english}`);
      showToast(`已儲存單字「${data.english}」`, 'success');
    } else {
      const newWord: Word = { ...data, id: generateEntityId('word'), createdAt: now, updatedAt: now };
      updated = [...currentWords, newWord];
      LoggerService.info('Words', `新增單字: ${data.english}`);
      showToast(`成功新增單字「${data.english}」！`, 'success');
    }
    StorageService.saveWords(updated);
    setWords(StorageService.getWords());
    triggerCloudSync();
  };

  const handleEnrichWord = async (word: Word) => {
    setEnrichingWordId(word.id);
    try {
      const enriched = await EnrichmentService.enrichWord(word.english, enrichmentConfig);
      const now = new Date().toISOString();
      const currentWords = StorageService.getWords();
      const updated = currentWords.map((w) => {
        if (w.id !== word.id) return w;
        return {
          ...w,
          phonetic: w.phonetic || enriched.phonetic,
          partOfSpeech: w.partOfSpeech || enriched.partOfSpeech,
          meaning: w.meaning || enriched.meaning,
          exampleSentence: w.exampleSentence || enriched.exampleSentence,
          exampleTranslation: w.exampleTranslation || enriched.exampleTranslation,
          category: w.category || enriched.category,
          note: w.note || enriched.note,
          updatedAt: now,
        };
      });
      StorageService.saveWords(updated);
      setWords(updated);
      triggerCloudSync();
      showToast(`已成功為「${word.english}」自動補齊音標、例句與筆記！`, 'success');
    } catch (err) {
      showToast(`自動補充失敗: ${(err as Error).message}`, 'error');
    } finally {
      setEnrichingWordId(null);
    }
  };

  const handleDeleteWord = (id: string) => {
    StorageService.addDeletedWordId(id);
    const updated = StorageService.getWords().filter((w) => w.id !== id);
    StorageService.saveWords(updated);
    setWords(updated);
    LoggerService.info('Words', '刪除單字 (墓碑已記錄)');
    triggerCloudSync();
  };

  const handleToggleWordFavorite = (id: string) => {
    const updated = StorageService.getWords().map((w) =>
      w.id === id ? { ...w, favorite: !w.favorite, updatedAt: new Date().toISOString() } : w
    );
    StorageService.saveWords(updated);
    setWords(updated);
    triggerCloudSync();
  };

  /* ---------------- Sentence CRUD ---------------- */
  const handleSaveSentence = (data: Omit<Sentence, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const currentSentences = StorageService.getSentences();
    let updated: Sentence[];
    if (editingSentence) {
      updated = currentSentences.map((s) =>
        s.id === editingSentence.id ? { ...data, id: editingSentence.id, createdAt: editingSentence.createdAt, updatedAt: now } : s
      );
      LoggerService.info('Sentences', `編輯句子`);
      showToast('已儲存句子修改', 'success');
    } else {
      const newSentence: Sentence = { ...data, id: generateEntityId('sent'), createdAt: now, updatedAt: now };
      updated = [...currentSentences, newSentence];
      LoggerService.info('Sentences', `新增句子`);
      showToast('成功新增句子！', 'success');
    }
    StorageService.saveSentences(updated);
    setSentences(StorageService.getSentences());
    triggerCloudSync();
  };

  const handleEnrichSentence = async (sentence: Sentence) => {
    setEnrichingSentenceId(sentence.id);
    try {
      const enriched = await EnrichmentService.enrichSentence(sentence.english, enrichmentConfig);
      const now = new Date().toISOString();
      const currentSentences = StorageService.getSentences();
      const updated = currentSentences.map((s) => {
        if (s.id !== sentence.id) return s;
        return {
          ...s,
          chinese: s.chinese || enriched.chinese,
          category: s.category || enriched.category,
          note: s.note || enriched.note,
          updatedAt: now,
        };
      });
      StorageService.saveSentences(updated);
      setSentences(updated);
      triggerCloudSync();
      showToast('已為此句子自動補齊繁中翻譯與學習筆記！', 'success');
    } catch (err) {
      showToast(`自動補充失敗: ${(err as Error).message}`, 'error');
    } finally {
      setEnrichingSentenceId(null);
    }
  };

  const handleSaveEnrichmentConfig = (newConfig: EnrichmentConfig) => {
    StorageService.saveEnrichmentConfig(newConfig);
    setEnrichmentConfig(newConfig);
    showToast('已儲存自動尋找補充設定！', 'success');
  };

  const handleBatchWordsUpdated = (updatedWords: Word[]) => {
    StorageService.saveWords(updatedWords);
    setWords(updatedWords);
    triggerCloudSync();
    showToast('單字庫資訊已批量補充更新！', 'success');
  };

  const handleBatchSentencesUpdated = (updatedSentences: Sentence[]) => {
    StorageService.saveSentences(updatedSentences);
    setSentences(updatedSentences);
    triggerCloudSync();
    showToast('句子庫資訊已批量補充更新！', 'success');
  };

  const handleDeleteSentence = (id: string) => {
    StorageService.addDeletedSentenceId(id);
    const updated = StorageService.getSentences().filter((s) => s.id !== id);
    StorageService.saveSentences(updated);
    setSentences(updated);
    LoggerService.info('Sentences', '刪除句子 (墓碑已記錄)');
    triggerCloudSync();
  };

  const handleToggleSentenceFavorite = (id: string) => {
    const updated = StorageService.getSentences().map((s) =>
      s.id === id ? { ...s, favorite: !s.favorite, updatedAt: new Date().toISOString() } : s
    );
    StorageService.saveSentences(updated);
    setSentences(updated);
    triggerCloudSync();
  };

  /* ---------------- 複習結果 (Leitner 熟練度更新) ---------------- */
  const handleWordResult = (wordId: string, isCorrect: boolean) => {
    const currentWords = StorageService.getWords();
    const index = currentWords.findIndex((w) => w.id === wordId);
    if (index === -1) return;
    const w = currentWords[index];
    currentWords[index] = {
      ...w,
      level: isCorrect ? Math.min(5, w.level + 1) : 1,
      reviewCount: w.reviewCount + 1,
      correctCount: w.correctCount + (isCorrect ? 1 : 0),
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    StorageService.saveWords(currentWords);
    setWords([...currentWords]);
    triggerCloudSyncDebounced();
  };

  const handleSentenceResult = (sentenceId: string, isCorrect: boolean) => {
    const currentSentences = StorageService.getSentences();
    const index = currentSentences.findIndex((s) => s.id === sentenceId);
    if (index === -1) return;
    const s = currentSentences[index];
    currentSentences[index] = {
      ...s,
      level: isCorrect ? Math.min(5, s.level + 1) : 1,
      reviewCount: s.reviewCount + 1,
      correctCount: s.correctCount + (isCorrect ? 1 : 0),
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    StorageService.saveSentences(currentSentences);
    setSentences([...currentSentences]);
    triggerCloudSyncDebounced();
  };

  const handleAddGameRecord = (game: GameType, score: number, total: number, durationSec: number) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newRecord: GameRecord = {
      id: generateEntityId('rec'),
      game,
      score,
      total,
      durationSec,
      date,
      time,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const updated = [...StorageService.getGameRecords(), newRecord];
    StorageService.saveGameRecords(updated);
    setGameRecords(updated);
    LoggerService.info('Games', `遊戲記錄: ${game} ${score}/${total}`);
    triggerCloudSync();
  };

  /* ---------------- 備份/還原/匯出 ---------------- */
  const nowStamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const handleExportBackup = () => {
    downloadFile(StorageService.exportAllData(), `EngManager-backup-${nowStamp()}.json`, 'application/json');
    LoggerService.info('Backup', '已匯出完整 JSON 備份');
  };

  const handleImportBackup = (jsonStr: string) => {
    const ok = StorageService.importAllData(jsonStr);
    if (ok) {
      loadAllData();
      triggerCloudSync();
      alert('備份匯入成功！');
      LoggerService.info('Backup', '備份匯入成功');
    } else {
      alert('匯入失敗：JSON 格式不正確');
      LoggerService.error('Backup', '備份匯入失敗');
    }
  };

  const handleExportCSV = (kind: 'words' | 'sentences') => {
    if (kind === 'words') {
      const header = ['English', 'Phonetic', 'POS', 'Meaning', 'Example', 'Translation', 'Category', 'Level', 'Favorite', 'ReviewCount', 'CorrectCount', 'Note'];
      const rows = words.map((w: Word) =>
        [w.english, w.phonetic, PART_OF_SPEECH_LABELS[w.partOfSpeech], w.meaning, w.exampleSentence, w.exampleTranslation, WORD_CATEGORY_LABELS[w.category], w.level, w.favorite ? '★' : '', w.reviewCount, w.correctCount, w.note]
          .map(csvEscape)
          .join(',')
      );
      const csv = '\ufeff' + header.map(csvEscape).join(',') + '\n' + rows.join('\n');
      downloadFile(csv, `EngManager-words-${nowStamp()}.csv`, 'text/csv;charset=utf-8');
      LoggerService.info('Export', `匯出單字 CSV (${words.length})`);
    } else {
      const header = ['English', 'Chinese', 'Category', 'Level', 'Favorite', 'ReviewCount', 'CorrectCount', 'Note'];
      const rows = sentences.map((s: Sentence) =>
        [s.english, s.chinese, WORD_CATEGORY_LABELS[s.category], s.level, s.favorite ? '★' : '', s.reviewCount, s.correctCount, s.note]
          .map(csvEscape)
          .join(',')
      );
      const csv = '\ufeff' + header.map(csvEscape).join(',') + '\n' + rows.join('\n');
      downloadFile(csv, `EngManager-sentences-${nowStamp()}.csv`, 'text/csv;charset=utf-8');
      LoggerService.info('Export', `匯出句子 CSV (${sentences.length})`);
    }
  };

  const handleResetAll = () => {
    StorageService.resetToDefault();
    loadAllData();
    LoggerService.warn('App', '已重置本機所有學習資料');
    alert('本機資料已重置 (示範資料將重新載入)');
  };

  /* ---------------- Render ---------------- */
  const focusInput = (selector: string) => {
    // Focus search box after switching tabs for faster data entry
    setTimeout(() => {
      const el = document.querySelector(selector) as HTMLInputElement | null;
      el?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <Header
        cloudConfig={cloudConfig}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        onOpenDebugLogs={() => setIsDebugModalOpen(true)}
        onOpenEnrichmentModal={() => setIsEnrichmentModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-md mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>學習首頁</span>
          </button>

          <button
            onClick={() => { setActiveTab('words'); focusInput('input[placeholder^="搜尋英文"]'); }}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'words'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>單字庫 ({words.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('sentences'); focusInput('input[placeholder^="搜尋英文"]'); }}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sentences'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Quote className="w-4 h-4" />
            <span>句子庫 ({sentences.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('games')}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'games'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>複習遊戲</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>學習歷程</span>
          </button>
        </div>

        {/* View Switcher */}
        {activeTab === 'dashboard' && (
          <DashboardView
            words={words}
            sentences={sentences}
            gameRecords={gameRecords}
            onWordResult={handleWordResult}
            onSentenceResult={handleSentenceResult}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'words' && (
          <WordListView
            words={words}
            enrichingWordId={enrichingWordId}
            onDeleteWord={handleDeleteWord}
            onToggleFavorite={handleToggleWordFavorite}
            onOpenAddModal={() => { setEditingWord(null); setIsWordModalOpen(true); }}
            onOpenEditModal={(w) => { setEditingWord(w); setIsWordModalOpen(true); }}
            onEnrichWord={handleEnrichWord}
            onOpenBatchEnrich={() => setBatchModalState({ isOpen: true, type: 'words' })}
          />
        )}

        {activeTab === 'sentences' && (
          <SentenceListView
            sentences={sentences}
            enrichingSentenceId={enrichingSentenceId}
            onDeleteSentence={handleDeleteSentence}
            onToggleFavorite={handleToggleSentenceFavorite}
            onOpenAddModal={() => { setEditingSentence(null); setIsSentenceModalOpen(true); }}
            onOpenEditModal={(s) => { setEditingSentence(s); setIsSentenceModalOpen(true); }}
            onEnrichSentence={handleEnrichSentence}
            onOpenBatchEnrich={() => setBatchModalState({ isOpen: true, type: 'sentences' })}
          />
        )}

        {activeTab === 'games' && (
          <GameView
            words={words}
            sentences={sentences}
            gameRecords={gameRecords}
            onWordResult={handleWordResult}
            onSentenceResult={handleSentenceResult}
            onAddGameRecord={handleAddGameRecord}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            words={words}
            sentences={sentences}
            gameRecords={gameRecords}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onExportCSV={handleExportCSV}
            onResetAll={handleResetAll}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>英語管家 EngManager © 2026 - 英文單字與句子雲端學習與遊戲複習系統</div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsDebugModalOpen(true)} className="hover:underline text-purple-400 font-semibold flex items-center space-x-1 cursor-pointer">
              <span>🛠️ 系統診斷與日誌</span>
            </button>
            <span>•</span>
            <button onClick={() => setIsCloudModalOpen(true)} className="hover:underline text-sky-400 font-medium cursor-pointer">
              ☁️ Supabase 遠端資料庫
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <WordModal
        isOpen={isWordModalOpen}
        editingWord={editingWord}
        enrichmentConfig={enrichmentConfig}
        onClose={() => setIsWordModalOpen(false)}
        onSubmit={handleSaveWord}
        onDelete={handleDeleteWord}
      />

      <SentenceModal
        isOpen={isSentenceModalOpen}
        editingSentence={editingSentence}
        enrichmentConfig={enrichmentConfig}
        onClose={() => setIsSentenceModalOpen(false)}
        onSubmit={handleSaveSentence}
        onDelete={handleDeleteSentence}
      />

      <CloudSyncModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        cloudConfig={cloudConfig}
        onUpdateCloudConfig={(newCfg) => {
          setCloudConfig(newCfg);
          loadAllData();
        }}
        onSyncComplete={() => loadAllData()}
      />

      <DebugLogModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
      />

      <EnrichmentConfigModal
        isOpen={isEnrichmentModalOpen}
        config={enrichmentConfig}
        onClose={() => setIsEnrichmentModalOpen(false)}
        onSave={handleSaveEnrichmentConfig}
      />

      <BatchEnrichModal
        isOpen={batchModalState.isOpen}
        type={batchModalState.type}
        words={words}
        sentences={sentences}
        config={enrichmentConfig}
        onClose={() => setBatchModalState((prev) => ({ ...prev, isOpen: false }))}
        onWordsUpdated={handleBatchWordsUpdated}
        onSentencesUpdated={handleBatchSentencesUpdated}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-600/95 text-white border-emerald-500 shadow-emerald-900/20'
                : toast.type === 'error'
                ? 'bg-rose-600/95 text-white border-rose-500 shadow-rose-900/20'
                : 'bg-slate-800/95 text-white border-slate-700 shadow-slate-900/20'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
