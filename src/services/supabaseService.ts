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
const VALID_CATEGORIES: ReadonlySet<string> = new Set(['daily', 'travel', 'work', 'academic', 'exam', 'slang', 'other']);
const VALID_PARTS_OF_SPEECH: ReadonlySet<string> = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'phrase', 'other']);

/** 雲端髒值防禦：分類/詞性不符白名單時回落為 other，避免 label map 顯示 undefined */
const asCategory = (value: unknown): Word['category'] =>
  typeof value === 'string' && VALID_CATEGORIES.has(value) ? (value as Word['category']) : 'other';

const asPartOfSpeech = (value: unknown): Word['partOfSpeech'] =>
  typeof value === 'string' && VALID_PARTS_OF_SPEECH.has(value) ? (value as Word['partOfSpeech']) : 'other';

const normalizeWord = (row: any): Word => ({
  id: String(row.id),
  english: String(row.english || ''),
  phonetic: String(row.phonetic || ''),
  partOfSpeech: asPartOfSpeech(row.partOfSpeech || row.partofspeech),
  meaning: String(row.meaning || ''),
  exampleSentence: String(row.exampleSentence || row.examplesentence || ''),
  exampleTranslation: String(row.exampleTranslation || row.exampletranslation || ''),
  category: asCategory(row.category),
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
  category: asCategory(row.category),
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

    // 1a. Pull cloud-side deletion tombstones (跨裝置刪除傳播：
    //     本裝置若從未得知他機的刪除動作，合併時會把「雲端沒有、本機有」的
    //     資料視為新增而復活，形成 A 刪 / B 推的永久拉鋸迴圈)。
    //     deleted_ids 表為 best-effort：未執行新版 SQL 的舊用戶僅跳過此步。
    const { data: cloudDeletedRows, error: tombstonePullErr } = await client.from('deleted_ids').select('scope,id');
    if (tombstonePullErr) {
      LoggerService.warn('SupabaseSync', `deleted_ids 讀取失敗（請於 Supabase 重新執行最新 SQL 腳本）: ${tombstonePullErr.message}`);
    } else {
      const rows = cloudDeletedRows || [];
      const partition = (expectedScope: string) =>
        rows.filter((r: any) => r.scope === expectedScope).map((r: any) => String(r.id));
      const tombWords = partition('words');
      const tombSentences = partition('sentences');
      const tombRecords = partition('game_records');
      if (tombWords.length > 0 || tombSentences.length > 0 || tombRecords.length > 0) {
        StorageService.saveDeletedIds(tombWords, tombSentences, tombRecords);
      }
    }

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

    // 2. Fetch Local Data & Tombstones (同步開始時的快照)
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

    // 4. Re-read local storage before writing (防遺失更新:
    //    雲端拉取是數百 ms 的 await，期間使用者可能正在作答/新增資料，
    //    若直接用第 3 步的快照整份蓋掉 localStorage 會靜默覆蓋這些編輯。
    //    下方的 re-read → merge → write 之間沒有任何 await，JS 單執行緒下
    //    不會被 App 層寫入插隊)。
    const freshWords = StorageService.getWords();
    const freshSentences = StorageService.getSentences();
    const freshRecords = StorageService.getGameRecords();
    const freshDelWordIds = new Set(StorageService.getDeletedWordIds());
    const freshDelSentenceIds = new Set(StorageService.getDeletedSentenceIds());
    const freshDelRecordIds = new Set(StorageService.getDeletedRecordIds());

    const finalWords = SyncUtils.mergeByIdSmart(mergedWords, freshWords, freshDelWordIds);
    const finalSentences = SyncUtils.mergeByIdSmart(mergedSentences, freshSentences, freshDelSentenceIds);
    const finalRecords = SyncUtils.mergeByIdSmart(mergedRecords, freshRecords, freshDelRecordIds);

    // 4a. Update Local Storage if changed (與 fresh 快照比較，順序不敏感)
    if (!SyncUtils.isSameList(freshWords, finalWords)) {
      StorageService.saveWords(finalWords);
    }
    if (!SyncUtils.isSameList(freshSentences, finalSentences)) {
      StorageService.saveSentences(finalSentences);
    }
    if (!SyncUtils.isSameList(freshRecords, finalRecords)) {
      StorageService.saveGameRecords(finalRecords);
    }

    // 5. Delete Tombstoned items from Supabase (分批防 URL 長度溢出；
    //    刪除失敗時直接 throw → 保留本機墓碑，下次同步整批重試)
    const deleteInBatches = async (table: string, ids: string[]) => {
      const batchSize = 50;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await client.from(table).delete().in('id', batch);
        if (error) throw error;
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

    // 5a. Propagate local tombstones into cloud deleted_ids (best-effort：
    //     讓其他裝置下次同步得知刪除動作，避免復活拉鋸；失敗僅警告，
    //     下次同步會再上傳，本機墓碑仍保留)。
    const tombstoneRows = [
      ...delWordsArr.map((id) => ({ scope: 'words', id })),
      ...delSentencesArr.map((id) => ({ scope: 'sentences', id })),
      ...delRecordsArr.map((id) => ({ scope: 'game_records', id })),
    ];
    if (tombstoneRows.length > 0) {
      const { error: tombstonePushErr } = await client.from('deleted_ids').upsert(tombstoneRows, { onConflict: 'scope,id' });
      if (tombstonePushErr) {
        LoggerService.warn('SupabaseSync', `deleted_ids 寫入失敗（請於 Supabase 重新執行最新 SQL 腳本）: ${tombstonePushErr.message}`);
      }
    }

    // 6. Push merged data back (Upsert，使用 final* 清單——已包含同步期間的本機編輯)
    if (finalWords.length > 0) {
      const { error: upsertWordsErr } = await client.from('words').upsert(finalWords, { onConflict: 'id' });
      if (upsertWordsErr) throw upsertWordsErr;
    }
    if (finalSentences.length > 0) {
      const { error: upsertSentencesErr } = await client.from('sentences').upsert(finalSentences, { onConflict: 'id' });
      if (upsertSentencesErr) throw upsertSentencesErr;
    }
    if (finalRecords.length > 0) {
      const { error: upsertRecordsErr } = await client.from('game_records').upsert(finalRecords, { onConflict: 'id' });
      if (upsertRecordsErr) throw upsertRecordsErr;
    }

    LoggerService.info('SupabaseSync', `同步成功：單字 ${finalWords.length}、句子 ${finalSentences.length}、遊戲記錄 ${finalRecords.length}`);

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

-- 4. 刪除墓碑表 (跨裝置刪除傳播：記錄各裝置的刪除動作，
--    防止「雲端沒有、本機有」的已刪除資料被其他裝置 upsert 復活)
CREATE TABLE IF NOT EXISTS public.deleted_ids (
  scope TEXT NOT NULL,
  id TEXT NOT NULL,
  "deletedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, id)
);

-- 開啟 Row Level Security (RLS)
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_ids ENABLE ROW LEVEL SECURITY;

-- 簡易個人專屬資料庫方案 (僅限持有 Anon Key 的客戶端存取)
-- 使用 DROP POLICY IF EXISTS 讓整份腳本可重複執行 ?
-- (CREATE POLICY 沒有 IF NOT EXISTS，直接重跑會報 42710 policy already exists)
DROP POLICY IF EXISTS "Allow anon access on words" ON public.words;
CREATE POLICY "Allow anon access on words" ON public.words FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon access on sentences" ON public.sentences;
CREATE POLICY "Allow anon access on sentences" ON public.sentences FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon access on game_records" ON public.game_records;
CREATE POLICY "Allow anon access on game_records" ON public.game_records FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon access on deleted_ids" ON public.deleted_ids;
CREATE POLICY "Allow anon access on deleted_ids" ON public.deleted_ids FOR ALL TO anon USING (true) WITH CHECK (true);

-- 生產環境推薦 (搭配 Supabase Auth 使用者隔離):
-- 1. 在每張表加入 user_id UUID NOT NULL DEFAULT auth.uid()
-- 2. CREATE POLICY "User isolate" ON public.words FOR ALL TO authenticated
--    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;
