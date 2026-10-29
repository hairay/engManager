import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storageService';
import { SyncUtils } from './syncUtils';
import { LoggerService } from './loggerService';
import type { Word, Sentence, GameRecord } from '../types';

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = StorageService.getCloudConfig();
  if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return supabaseClient;
};

export const resetSupabaseClient = () => {
  supabaseClient = null;
};

/** 容錯處理：相容全小寫或駝峰命名的遠端資料庫欄位 */
const normalizeWord = (row: any): Word => ({
  id: String(row.id),
  english: String(row.english || ''),
  phonetic: String(row.phonetic || ''),
  partOfSpeech: row.partOfSpeech || row.partofspeech || 'other',
  meaning: String(row.meaning || ''),
  exampleSentence: String(row.exampleSentence || row.examplesentence || ''),
  exampleTranslation: String(row.exampleTranslation || row.exampletranslation || ''),
  category: row.category || 'other',
  level: Number(row.level) || 1,
  favorite: Boolean(row.favorite),
  note: String(row.note || ''),
  reviewCount: Number(row.reviewCount ?? row.reviewcount) || 0,
  correctCount: Number(row.correctCount ?? row.correctcount) || 0,
  lastReviewedAt: row.lastReviewedAt || row.lastreviewedat || null,
  createdAt: row.createdAt || row.createdat || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updatedat || new Date().toISOString(),
});

const normalizeSentence = (row: any): Sentence => ({
  id: String(row.id),
  english: String(row.english || ''),
  chinese: String(row.chinese || ''),
  category: row.category || 'other',
  level: Number(row.level) || 1,
  favorite: Boolean(row.favorite),
  note: String(row.note || ''),
  reviewCount: Number(row.reviewCount ?? row.reviewcount) || 0,
  correctCount: Number(row.correctCount ?? row.correctcount) || 0,
  lastReviewedAt: row.lastReviewedAt || row.lastreviewedat || null,
  createdAt: row.createdAt || row.createdat || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updatedat || new Date().toISOString(),
});

const normalizeRecord = (row: any): GameRecord => ({
  id: String(row.id),
  game: row.game,
  score: Number(row.score) || 0,
  total: Number(row.total) || 0,
  durationSec: Number(row.durationSec ?? row.durationsec) || 0,
  date: String(row.date || ''),
  time: String(row.time || ''),
  createdAt: row.createdAt || row.createdat || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updatedat || new Date().toISOString(),
});

/**
 * 與 Supabase 遠端資料庫進行雙向智慧同步：
 * 1. 拉取雲端四表資料 (words / sentences / game_records)
 * 2. 依 id + 時間戳智慧合併 (最新修改優先)
 * 3. 將刪除墓碑從雲端刪除
 * 4. 將合併結果整份 Upsert 回雲端 (雙向收斂至同一狀態)
 */
export const syncWithCloud = async (): Promise<{ success: boolean; message: string }> => {
  const config = StorageService.getCloudConfig();
  if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return { success: false, message: '雲端同步未啟用或未設定 Supabase 金鑰' };
  }

  try {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client error');

    // 1. Fetch Cloud Data
    const { data: rawCloudWords, error: wordsErr } = await client.from('words').select('*');
    if (wordsErr) throw wordsErr;

    const { data: rawCloudSentences, error: sentencesErr } = await client.from('sentences').select('*');
    if (sentencesErr) throw sentencesErr;

    const { data: rawCloudRecords, error: recordsErr } = await client.from('game_records').select('*');
    if (recordsErr) throw recordsErr;

    const cloudWords = (rawCloudWords || []).map(normalizeWord);
    const cloudSentences = (rawCloudSentences || []).map(normalizeSentence);
    const cloudRecords = (rawCloudRecords || []).map(normalizeRecord);

    // Auto-Eviction: 本機只有未編輯的示範資料且雲端已有真實資料時，先清掉示範資料
    const cloudHasContent = cloudWords.length > 0 || cloudSentences.length > 0;
    if (cloudHasContent && StorageService.isDemoDataOnly()) {
      const demoIds = StorageService.getDemoIds();
      const cloudIsAlsoDemo =
        cloudWords.length > 0 && cloudWords.every((w) => demoIds.wordIds.has(w.id));
      if (!cloudIsAlsoDemo) {
        StorageService.clearDemoData();
      }
    }

    // 2. Fetch Local Data & Tombstones
    const localWords = StorageService.getWords();
    const localSentences = StorageService.getSentences();
    const localRecords = StorageService.getGameRecords();

    const delWordIds = new Set(StorageService.getDeletedWordIds());
    const delSentenceIds = new Set(StorageService.getDeletedSentenceIds());
    const delRecordIds = new Set(StorageService.getDeletedRecordIds());

    // 3. Merge (最新時間戳優先)
    const mergedWords = SyncUtils.mergeByIdSmart(localWords, cloudWords, delWordIds);
    const mergedSentences = SyncUtils.mergeByIdSmart(localSentences, cloudSentences, delSentenceIds);
    const mergedRecords = SyncUtils.mergeByIdSmart(localRecords, cloudRecords, delRecordIds);

    // 4. Update Local Storage if changed
    if (!SyncUtils.isSameList(localWords, mergedWords)) {
      StorageService.saveWords(mergedWords);
    }
    if (!SyncUtils.isSameList(localSentences, mergedSentences)) {
      StorageService.saveSentences(mergedSentences);
    }
    if (!SyncUtils.isSameList(localRecords, mergedRecords)) {
      StorageService.saveGameRecords(mergedRecords);
    }

    // 5. Delete Tombstoned items from Supabase (分批防 URL 長度溢出)
    const deleteInBatches = async (table: string, ids: string[]) => {
      const batchSize = 50;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await client.from(table).delete().in('id', batch);
      }
    };

    const delWordsArr = Array.from(delWordIds);
    if (delWordsArr.length > 0) {
      await deleteInBatches('words', delWordsArr);
    }
    const delSentencesArr = Array.from(delSentenceIds);
    if (delSentencesArr.length > 0) {
      await deleteInBatches('sentences', delSentencesArr);
    }
    const delRecordsArr = Array.from(delRecordIds);
    if (delRecordsArr.length > 0) {
      await deleteInBatches('game_records', delRecordsArr);
    }

    // 6. Push merged data back (Upsert)
    if (mergedWords.length > 0) {
      const { error: upsertWordsErr } = await client.from('words').upsert(mergedWords, { onConflict: 'id' });
      if (upsertWordsErr) throw upsertWordsErr;
    }
    if (mergedSentences.length > 0) {
      const { error: upsertSentencesErr } = await client.from('sentences').upsert(mergedSentences, { onConflict: 'id' });
      if (upsertSentencesErr) throw upsertSentencesErr;
    }
    if (mergedRecords.length > 0) {
      const { error: upsertRecordsErr } = await client.from('game_records').upsert(mergedRecords, { onConflict: 'id' });
      if (upsertRecordsErr) throw upsertRecordsErr;
    }

    LoggerService.info('SupabaseSync', `同步成功：單字 ${mergedWords.length}、句子 ${mergedSentences.length}、遊戲記錄 ${mergedRecords.length}`);

    // Update cloud config status
    config.lastSyncTime = new Date().toISOString();
    config.syncStatus = 'success';
    config.errorMessage = undefined;
    StorageService.saveCloudConfig(config);

    return { success: true, message: '遠端資料庫同步完成！' };
  } catch (error: any) {
    LoggerService.error('SupabaseSync', `同步失敗: ${error?.message || '未知錯誤'}`);
    config.syncStatus = 'error';
    config.errorMessage = error?.message || '同步失敗';
    StorageService.saveCloudConfig(config);
    return { success: false, message: `同步失敗: ${error?.message || '未知錯誤'}` };
  }
};

export const SUPABASE_SQL_SCHEMA = `-- 英語管家 EngManager Supabase 遠端資料庫建表 SQL 指令
-- 請至 Supabase Dashboard -> SQL Editor 貼上執行

-- 1. 英文單字表
CREATE TABLE IF NOT EXISTS public.words (
  id TEXT PRIMARY KEY,
  english TEXT NOT NULL,
  phonetic TEXT,
  "partOfSpeech" TEXT NOT NULL DEFAULT 'other',
  meaning TEXT NOT NULL,
  "exampleSentence" TEXT,
  "exampleTranslation" TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  level INT NOT NULL DEFAULT 1,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  "reviewCount" INT NOT NULL DEFAULT 0,
  "correctCount" INT NOT NULL DEFAULT 0,
  "lastReviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 英文句子表
CREATE TABLE IF NOT EXISTS public.sentences (
  id TEXT PRIMARY KEY,
  english TEXT NOT NULL,
  chinese TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  level INT NOT NULL DEFAULT 1,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  "reviewCount" INT NOT NULL DEFAULT 0,
  "correctCount" INT NOT NULL DEFAULT 0,
  "lastReviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 遊戲複習記錄表
CREATE TABLE IF NOT EXISTS public.game_records (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  "durationSec" INT NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  time TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 開啟 Row Level Security (RLS)
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_records ENABLE ROW LEVEL SECURITY;

-- 簡易個人專屬資料庫方案 (僅限持有 Anon Key 的客戶端存取)
CREATE POLICY "Allow anon access on words" ON public.words FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access on sentences" ON public.sentences FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access on game_records" ON public.game_records FOR ALL TO anon USING (true) WITH CHECK (true);

-- 生產環境推薦 (搭配 Supabase Auth 使用者隔離):
-- 1. 在每張表加入 user_id UUID NOT NULL DEFAULT auth.uid()
-- 2. CREATE POLICY "User isolate" ON public.words FOR ALL TO authenticated
--    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;
