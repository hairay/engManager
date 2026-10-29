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
import { StorageService } from './services/storageService';
import { syncWithCloud } from './services/supabaseService';
import { LoggerService } from './services/loggerService';
import { SpeechService } from './services/speechService';
import type { Word, Sentence, GameRecord, GameType, CloudConfig } from './types';
import { WORD_CATEGORY_LABELS, PART_OF_SPEECH_LABELS } from './types';
import { Zap, BookOpen, Quote, Gamepad2, BarChart3 } from 'lucide-react';

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
  return `"${str.replace(/"/g, '""')}"`;
};

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'words' | 'sentences' | 'games' | 'history'>('dashboard');

  // Core App Data
  const [words, setWords] = useState<Word[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [gameRecords, setGameRecords] = useState<GameRecord[]>([]);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(StorageService.getCloudConfig());

  // Modals
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isSentenceModalOpen, setIsSentenceModalOpen] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);

  // Load Local Data
  const loadAllData = useCallback(() => {
    setWords(StorageService.getWords());
    setSentences(StorageService.getSentences());
    setGameRecords(StorageService.getGameRecords());
    setCloudConfig(StorageService.getCloudConfig());
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
  useEffect(() => {
    LoggerService.hydrateFromStorage();
    LoggerService.info('App', '英語管家 EngManager 應用啟動');
    SpeechService.warmUp();
    loadAllData();
    triggerCloudSync();

    const interval = setInterval(
      () => {
        triggerCloudSync();
      },
      Math.max(10, cloudConfig.syncIntervalSeconds) * 1000
    );

    return () => clearInterval(interval);
  }, [loadAllData, triggerCloudSync, cloudConfig.syncIntervalSeconds]);

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
    } else {
      const newWord: Word = { ...data, id: generateEntityId('word'), createdAt: now, updatedAt: now };
      updated = [...currentWords, newWord];
      LoggerService.info('Words', `新增單字: ${data.english}`);
    }
    StorageService.saveWords(updated);
    setWords(StorageService.getWords());
    triggerCloudSync();
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
    } else {
      const newSentence: Sentence = { ...data, id: generateEntityId('sent'), createdAt: now, updatedAt: now };
      updated = [...currentSentences, newSentence];
      LoggerService.info('Sentences', `新增句子`);
    }
    StorageService.saveSentences(updated);
    setSentences(StorageService.getSentences());
    triggerCloudSync();
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
    triggerCloudSync();
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
    triggerCloudSync();
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header Bar */}
      <Header
        cloudConfig={cloudConfig}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        onOpenDebugLogs={() => setIsDebugModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Navigation Tabs */}
        <div className="flex items-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>學習首頁</span>
          </button>

          <button
            onClick={() => { setActiveTab('words'); focusInput('input[placeholder^="搜尋英文"]'); }}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'words'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>單字庫 ({words.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('sentences'); focusInput('input[placeholder^="搜尋英文"]'); }}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sentences'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Quote className="w-4 h-4" />
            <span>句子庫 ({sentences.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('games')}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'games'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>複習遊戲</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 whitespace-nowrap flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
            onDeleteWord={handleDeleteWord}
            onToggleFavorite={handleToggleWordFavorite}
            onOpenAddModal={() => { setEditingWord(null); setIsWordModalOpen(true); }}
            onOpenEditModal={(w) => { setEditingWord(w); setIsWordModalOpen(true); }}
          />
        )}

        {activeTab === 'sentences' && (
          <SentenceListView
            sentences={sentences}
            onDeleteSentence={handleDeleteSentence}
            onToggleFavorite={handleToggleSentenceFavorite}
            onOpenAddModal={() => { setEditingSentence(null); setIsSentenceModalOpen(true); }}
            onOpenEditModal={(s) => { setEditingSentence(s); setIsSentenceModalOpen(true); }}
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
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>英語管家 EngManager © 2026 - 英文單字與句子雲端學習與遊戲複習系統</div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsDebugModalOpen(true)} className="hover:underline text-purple-600 font-semibold flex items-center space-x-1">
              <span>🛠️ 系統診斷與日誌</span>
            </button>
            <span>•</span>
            <button onClick={() => setIsCloudModalOpen(true)} className="hover:underline text-sky-600 font-medium">
              ☁️ Supabase 遠端資料庫
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <WordModal
        isOpen={isWordModalOpen}
        editingWord={editingWord}
        onClose={() => setIsWordModalOpen(false)}
        onSubmit={handleSaveWord}
        onDelete={handleDeleteWord}
      />

      <SentenceModal
        isOpen={isSentenceModalOpen}
        editingSentence={editingSentence}
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
    </div>
  );
}

export default App;
