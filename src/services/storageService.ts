import type { Word, Sentence, GameRecord, CloudConfig, EnrichmentConfig } from '../types';
import { INITIAL_WORDS, INITIAL_SENTENCES } from './mockData';

const KEYS = {
  WORDS: 'engmanager_words',
  SENTENCES: 'engmanager_sentences',
  GAME_RECORDS: 'engmanager_game_records',
  CLOUD: 'engmanager_cloud_config',
  ENRICHMENT: 'engmanager_enrichment_config',
  DELETED_WORDS: 'engmanager_deleted_word_ids',
  DELETED_SENTENCES: 'engmanager_deleted_sentence_ids',
  DELETED_RECORDS: 'engmanager_deleted_record_ids',
};

export class StorageService {
  // --- Deleted Item Tombstone Tracking (防止雲端同步復活已刪除資料) ---
  public static getDeletedWordIds(): string[] {
    try {
      const raw = localStorage.getItem(KEYS.DELETED_WORDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static addDeletedWordId(id: string): void {
    const set = new Set([...this.getDeletedWordIds(), id]);
    localStorage.setItem(KEYS.DELETED_WORDS, JSON.stringify(Array.from(set)));
  }

  public static getDeletedSentenceIds(): string[] {
    try {
      const raw = localStorage.getItem(KEYS.DELETED_SENTENCES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static addDeletedSentenceId(id: string): void {
    const set = new Set([...this.getDeletedSentenceIds(), id]);
    localStorage.setItem(KEYS.DELETED_SENTENCES, JSON.stringify(Array.from(set)));
  }

  public static getDeletedRecordIds(): string[] {
    try {
      const raw = localStorage.getItem(KEYS.DELETED_RECORDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static addDeletedRecordId(id: string): void {
    const set = new Set([...this.getDeletedRecordIds(), id]);
    localStorage.setItem(KEYS.DELETED_RECORDS, JSON.stringify(Array.from(set)));
  }

  public static saveDeletedIds(wordIds: string[] = [], sentenceIds: string[] = [], recordIds: string[] = []): void {
    const currentWordIds = new Set([...this.getDeletedWordIds(), ...wordIds]);
    const currentSentenceIds = new Set([...this.getDeletedSentenceIds(), ...sentenceIds]);
    const currentRecordIds = new Set([...this.getDeletedRecordIds(), ...recordIds]);
    localStorage.setItem(KEYS.DELETED_WORDS, JSON.stringify(Array.from(currentWordIds)));
    localStorage.setItem(KEYS.DELETED_SENTENCES, JSON.stringify(Array.from(currentSentenceIds)));
    localStorage.setItem(KEYS.DELETED_RECORDS, JSON.stringify(Array.from(currentRecordIds)));
  }

  // --- Words ---
  public static getWords(): Word[] {
    const deletedIds = new Set(this.getDeletedWordIds());
    const raw = localStorage.getItem(KEYS.WORDS);
    let words: Word[] = [];

    if (!raw) {
      words = INITIAL_WORDS;
      this.saveWords(words);
    } else {
      try {
        words = JSON.parse(raw);
      } catch {
        words = INITIAL_WORDS;
      }
    }

    return words.filter((w) => !deletedIds.has(w.id));
  }

  public static saveWords(words: Word[]): void {
    const deletedIds = new Set(this.getDeletedWordIds());
    const cleanWords = words.filter((w) => !deletedIds.has(w.id));
    localStorage.setItem(KEYS.WORDS, JSON.stringify(cleanWords));
  }

  // --- Sentences ---
  public static getSentences(): Sentence[] {
    const deletedIds = new Set(this.getDeletedSentenceIds());
    const raw = localStorage.getItem(KEYS.SENTENCES);
    let sentences: Sentence[] = [];

    if (!raw) {
      sentences = INITIAL_SENTENCES;
      this.saveSentences(sentences);
    } else {
      try {
        sentences = JSON.parse(raw);
      } catch {
        sentences = INITIAL_SENTENCES;
      }
    }

    return sentences.filter((s) => !deletedIds.has(s.id));
  }

  public static saveSentences(sentences: Sentence[]): void {
    const deletedIds = new Set(this.getDeletedSentenceIds());
    const cleanSentences = sentences.filter((s) => !deletedIds.has(s.id));
    localStorage.setItem(KEYS.SENTENCES, JSON.stringify(cleanSentences));
  }

  // --- Game Records ---
  public static getGameRecords(): GameRecord[] {
    const deletedIds = new Set(this.getDeletedRecordIds());
    const raw = localStorage.getItem(KEYS.GAME_RECORDS);
    let records: GameRecord[] = [];

    if (raw) {
      try {
        records = JSON.parse(raw);
      } catch {
        records = [];
      }
    }

    return records.filter((r) => !deletedIds.has(r.id));
  }

  public static saveGameRecords(records: GameRecord[]): void {
    const deletedIds = new Set(this.getDeletedRecordIds());
    const cleanRecords = records.filter((r) => !deletedIds.has(r.id));
    localStorage.setItem(KEYS.GAME_RECORDS, JSON.stringify(cleanRecords));
  }

  // --- Cloud Config ---
  public static getCloudConfig(): CloudConfig {
    const defaultConfig: CloudConfig = {
      enabled: false,
      supabaseUrl: '',
      supabaseAnonKey: '',
      syncIntervalSeconds: 15,
      lastSyncTime: null,
      syncStatus: 'idle',
    };
    const raw = localStorage.getItem(KEYS.CLOUD);
    if (!raw) return defaultConfig;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultConfig;
    }
  }

  public static saveCloudConfig(config: CloudConfig): void {
    localStorage.setItem(KEYS.CLOUD, JSON.stringify(config));
  }

  // --- Enrichment Config ---
  public static getEnrichmentConfig(): EnrichmentConfig {
    const defaultConfig: EnrichmentConfig = {
      autoEnrichOnAdd: true,
      geminiApiKey: '',
    };
    const raw = localStorage.getItem(KEYS.ENRICHMENT);
    if (!raw) return defaultConfig;
    try {
      const parsed = JSON.parse(raw);
      return {
        autoEnrichOnAdd: parsed.autoEnrichOnAdd ?? true,
        geminiApiKey: parsed.geminiApiKey || '',
      };
    } catch {
      return defaultConfig;
    }
  }

  public static saveEnrichmentConfig(config: EnrichmentConfig): void {
    localStorage.setItem(KEYS.ENRICHMENT, JSON.stringify(config));
  }

  // --- Demo Data Eviction (避免示範資料汙染雲端的真實資料) ---
  public static getDemoIds(): { wordIds: Set<string>; sentenceIds: Set<string> } {
    return {
      wordIds: new Set(INITIAL_WORDS.map((w) => w.id)),
      sentenceIds: new Set(INITIAL_SENTENCES.map((s) => s.id)),
    };
  }

  /** 檢查本機是否只包含未編輯過的初始示範資料 */
  public static isDemoDataOnly(): boolean {
    const demo = this.getDemoIds();
    const words = this.getWords();
    const sentences = this.getSentences();

    const isMockWords = words.length > 0 && words.every((w) => demo.wordIds.has(w.id));
    const isMockSentences = sentences.length > 0 && sentences.every((s) => demo.sentenceIds.has(s.id));

    return isMockWords && isMockSentences;
  }

  /** 安全地移除初始示範資料，保留任何使用者自行新增的資料 */
  public static clearDemoData(): void {
    const demo = this.getDemoIds();
    const realWords = this.getWords().filter((w) => !demo.wordIds.has(w.id));
    const realSentences = this.getSentences().filter((s) => !demo.sentenceIds.has(s.id));

    this.saveWords(realWords);
    this.saveSentences(realSentences);
  }

  // --- Reset / Backup / Restore ---
  public static resetToDefault(): void {
    localStorage.removeItem(KEYS.WORDS);
    localStorage.removeItem(KEYS.SENTENCES);
    localStorage.removeItem(KEYS.GAME_RECORDS);
    localStorage.removeItem(KEYS.DELETED_WORDS);
    localStorage.removeItem(KEYS.DELETED_SENTENCES);
    localStorage.removeItem(KEYS.DELETED_RECORDS);
    localStorage.removeItem(KEYS.CLOUD);
    localStorage.removeItem(KEYS.ENRICHMENT);
  }

  public static exportAllData(): string {
    const data = {
      words: this.getWords(),
      sentences: this.getSentences(),
      gameRecords: this.getGameRecords(),
      deletedWordIds: this.getDeletedWordIds(),
      deletedSentenceIds: this.getDeletedSentenceIds(),
      deletedRecordIds: this.getDeletedRecordIds(),
      // 匿名金鑰不隨備份匯出 (備份檔一旦外流，持 key 者等於可直接讀寫整個雲端資料庫；
      // 匯入端本來就不會覆蓋雲端設定，故此處直接清空即可)
      cloudConfig: { ...this.getCloudConfig(), supabaseAnonKey: '' },
      enrichmentConfig: { ...this.getEnrichmentConfig(), geminiApiKey: '' },
      exportDate: new Date().toISOString(),
      version: '1.0.0',
    };
    return JSON.stringify(data, null, 2);
  }

  public static importAllData(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      // 形狀驗證：清單欄位必須是陣列且每筆為含字串 id 的物件，
      // 防止髒備份整份寫入 localStorage (拋出錯誤由 catch 統一處理)
      const assertEntityArray = (value: unknown, field: string): void => {
        if (value === undefined) return;
        if (
          !Array.isArray(value) ||
          !value.every((e) => e && typeof e === 'object' && typeof (e as { id: unknown }).id === 'string')
        ) {
          throw new Error(`備份欄位格式不正確: ${field}`);
        }
      };
      assertEntityArray(data.words, 'words');
      assertEntityArray(data.sentences, 'sentences');
      assertEntityArray(data.gameRecords, 'gameRecords');
      // 若匯入的備份包含特定項目，先將其從既有墓碑中移除，確保能正常復原
      if (data.words && Array.isArray(data.words)) {
        const importedWordIds = new Set(data.words.map((w: { id: string }) => w.id));
        const filteredDelWords = this.getDeletedWordIds().filter((id) => !importedWordIds.has(id));
        localStorage.setItem(KEYS.DELETED_WORDS, JSON.stringify(filteredDelWords));
      }
      if (data.sentences && Array.isArray(data.sentences)) {
        const importedSentenceIds = new Set(data.sentences.map((s: { id: string }) => s.id));
        const filteredDelSentences = this.getDeletedSentenceIds().filter((id) => !importedSentenceIds.has(id));
        localStorage.setItem(KEYS.DELETED_SENTENCES, JSON.stringify(filteredDelSentences));
      }
      if (data.gameRecords && Array.isArray(data.gameRecords)) {
        const importedRecordIds = new Set(data.gameRecords.map((r: { id: string }) => r.id));
        const filteredDelRecords = this.getDeletedRecordIds().filter((id) => !importedRecordIds.has(id));
        localStorage.setItem(KEYS.DELETED_RECORDS, JSON.stringify(filteredDelRecords));
      }
      if (data.deletedWordIds && Array.isArray(data.deletedWordIds)) {
        this.saveDeletedIds(data.deletedWordIds, [], []);
      }
      if (data.deletedSentenceIds && Array.isArray(data.deletedSentenceIds)) {
        this.saveDeletedIds([], data.deletedSentenceIds, []);
      }
      if (data.deletedRecordIds && Array.isArray(data.deletedRecordIds)) {
        this.saveDeletedIds([], [], data.deletedRecordIds);
      }
      if (data.words && Array.isArray(data.words)) this.saveWords(data.words);
      if (data.sentences && Array.isArray(data.sentences)) this.saveSentences(data.sentences);
      if (data.gameRecords && Array.isArray(data.gameRecords)) this.saveGameRecords(data.gameRecords);
      return true;
    } catch (e) {
      console.error('Failed to import data', e);
      return false;
    }
  }
}
