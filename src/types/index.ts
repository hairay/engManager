export type WordCategory =
  | 'daily'      // 日常生活
  | 'travel'     // 旅遊
  | 'work'       // 職場商務
  | 'academic'   // 學術
  | 'exam'       // 考試
  | 'slang'      // 口語俚語
  | 'other';     // 其他

export type PartOfSpeech =
  | 'noun'       // 名詞
  | 'verb'       // 動詞
  | 'adj'        // 形容詞
  | 'adv'        // 副詞
  | 'prep'       // 介系詞
  | 'conj'       // 連接詞
  | 'phrase'     // 片語
  | 'other';     // 其他

export interface Word {
  id: string;
  english: string;             // 英文單字或片語
  phonetic: string;            // KK/DJ 音標
  partOfSpeech: PartOfSpeech;
  meaning: string;             // 中文意思
  exampleSentence: string;     // 英文例句
  exampleTranslation: string;  // 例句翻譯
  category: WordCategory;
  level: number;               // 熟練度 1-5 (Leitner 學習盒)
  favorite: boolean;
  note: string;
  reviewCount: number;         // 累計複習/出題次數
  correctCount: number;        // 累計答對次數
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sentence {
  id: string;
  english: string;             // 英文句子
  chinese: string;             // 中文翻譯
  category: WordCategory;
  level: number;               // 熟練度 1-5
  favorite: boolean;
  note: string;
  reviewCount: number;
  correctCount: number;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GameType =
  | 'word_quiz'        // 單字快問快答 (四選一)
  | 'word_spelling'    // 拼字闖關 (字母拼圖)
  | 'sentence_cloze'   // 句子填空 (四選一)
  | 'sentence_scramble'; // 排句成序 (字卡排序)

export const GAME_INFO: Record<GameType, { title: string; emoji: string; desc: string }> = {
  word_quiz: { title: '單字快問快答', emoji: '⚡', desc: '看單字選中文，或看中文選單字' },
  word_spelling: { title: '拼字闖關', emoji: '🔤', desc: '依中文提示與音標，拼出正確單字' },
  sentence_cloze: { title: '句子填空', emoji: '✏️', desc: '句子挖出一個關鍵字，選出正確答案' },
  sentence_scramble: { title: '排句成序', emoji: '🧩', desc: '把打亂的字卡排成正確句子' },
};

export interface GameRecord {
  id: string;
  game: GameType;
  score: number;        // 答對題數
  total: number;        // 總題數
  durationSec: number;  // 用時 (秒)
  date: string;         // YYYY-MM-DD
  time: string;         // HH:mm
  createdAt: string;
  updatedAt: string;
}

export interface CloudConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  syncIntervalSeconds: number;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export const WORD_CATEGORY_LABELS: Record<WordCategory, string> = {
  daily: '日常生活',
  travel: '旅遊',
  work: '職場商務',
  academic: '學術',
  exam: '考試必備',
  slang: '口語俚語',
  other: '其他',
};

export const WORD_CATEGORY_COLORS: Record<WordCategory, string> = {
  daily: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  travel: 'bg-sky-100 text-sky-800 border-sky-200',
  work: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  academic: 'bg-violet-100 text-violet-800 border-violet-200',
  exam: 'bg-amber-100 text-amber-800 border-amber-200',
  slang: 'bg-rose-100 text-rose-800 border-rose-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, string> = {
  noun: '名詞',
  verb: '動詞',
  adj: '形容詞',
  adv: '副詞',
  prep: '介系詞',
  conj: '連接詞',
  phrase: '片語',
  other: '其他',
};

/** 熟練度等級標籤 (Leitner 學習盒) */
export const LEVEL_LABELS: Record<number, string> = {
  1: '生疏',
  2: '初識',
  3: '熟悉',
  4: '精通',
  5: '大師',
};

export const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-rose-500',
  2: 'bg-orange-500',
  3: 'bg-amber-500',
  4: 'bg-lime-500',
  5: 'bg-emerald-500',
};
