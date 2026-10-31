import type {
  WordEnrichResult,
  SentenceEnrichResult,
  EnrichmentConfig,
  PartOfSpeech,
  WordCategory,
} from '../types';
import { LoggerService } from './loggerService';

// CMU / Arpabet to IPA mapping for Datamuse phonetic pronunciation tags
const ARPABET_TO_IPA: Record<string, string> = {
  AA: 'ɑ',
  AE: 'æ',
  AH: 'ʌ',
  AO: 'ɔ',
  AW: 'aʊ',
  AY: 'aɪ',
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  EH: 'ɛ',
  ER: 'ɜr',
  EY: 'eɪ',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  IH: 'ɪ',
  IY: 'i',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  OW: 'oʊ',
  OY: 'ɔɪ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  UH: 'ʊ',
  UW: 'u',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
};

/** Convert Arpabet string (e.g., 'pron:R IH0 Z IH1 L Y AH0 N T ') to IPA (/rɪzˈɪljənt/) */
function arpabetToIpa(arpabetStr: string): string {
  const tokens = arpabetStr.trim().replace(/^pron:/, '').split(/\s+/);
  let ipa = '';
  for (const t of tokens) {
    if (!t) continue;
    const match = t.match(/^([A-Z]+)([0-2])?$/);
    if (!match) continue;
    const [, phoneme, stress] = match;
    let symbol = ARPABET_TO_IPA[phoneme] || phoneme.toLowerCase();
    if (phoneme === 'AH' && stress === '0') symbol = 'ə';
    if (stress === '1') ipa += 'ˈ';
    else if (stress === '2') ipa += 'ˌ';
    ipa += symbol;
  }
  return ipa ? `/${ipa}/` : '';
}

/** Translate text via public Google Translate web endpoints (with multi-client rotation) & MyMemory fallback */
async function translateText(
  text: string,
  fromLang = 'auto',
  toLang = 'zh-TW'
): Promise<{ text: string; dictMeanings: string[] }> {
  const clean = text.trim();
  if (!clean) return { text: '', dictMeanings: [] };

  const clients = ['dict-chrome-ex', 'gtx', 'it'];
  for (const client of clients) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=${fromLang}&tl=${toLang}&dt=t&dt=bd&q=${encodeURIComponent(clean)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const primary = Array.isArray(data[0])
        ? data[0].map((item: [string, ...unknown[]]) => item[0] || '').join('')
        : '';
      const dictMeanings: string[] = [];
      if (Array.isArray(data[1])) {
        for (const posBlock of data[1]) {
          if (Array.isArray(posBlock[1])) {
            dictMeanings.push(...posBlock[1].slice(0, 3));
          }
        }
      }
      if (primary) {
        return { text: primary, dictMeanings };
      }
    } catch {
      continue;
    }
  }

  // Backup fallback to MyMemory API
  try {
    const pair = `${fromLang === 'auto' ? 'en' : fromLang}|${toLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${pair}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (translated && typeof translated === 'string') {
        return { text: translated, dictMeanings: [] };
      }
    }
  } catch (err) {
    LoggerService.warn('EnrichmentService', `Translation fallback failed: ${(err as Error).message}`);
  }

  // 所有翻譯來源都取不到結果 → 明確記錄在日誌 (DebugLogModal 可見)，
  // 讓使用者/開發者知道免費管線可能已被上游端點改版破壞。
  LoggerService.warn('EnrichmentService', `所有翻譯來源皆無結果 (Google/MyMemory): "${clean}"，翻譯欄位將留空`);
  return { text: '', dictMeanings: [] };
}

/** Infer appropriate category based on keywords */
function inferCategory(text: string): WordCategory {
  const lower = text.toLowerCase();
  if (
    /meeting|client|boss|revenue|deadline|project|budget|contract|negotiat|market|manager|strategy|corporate|colleague|work|interview|salary|resume/i.test(
      lower
    )
  ) {
    return 'work';
  }
  if (
    /airport|flight|hotel|tourist|luggage|baggage|passport|vacation|sightsee|train|station|ticket|trip|travel|destination|resort/i.test(
      lower
    )
  ) {
    return 'travel';
  }
  if (
    /research|thesis|hypothesis|academic|journal|professor|university|experiment|laboratory|dissertation|philosophy|scientific|theory/i.test(
      lower
    )
  ) {
    return 'academic';
  }
  if (
    /meticulous|ubiquitous|serendipity|ephemeral|ambivalent|substantiate|exacerbate|pragmatic|paradigm|dichotomy|esoteric|gregarious|resilient/i.test(
      lower
    )
  ) {
    return 'exam';
  }
  if (/gonna|wanna|kinda|chill|vibe|dude|bro|hang out|no biggie|cool|lit/i.test(lower)) {
    return 'slang';
  }
  return 'daily';
}

/** Map dictionary POS string to PartOfSpeech */
function mapPartOfSpeech(rawPos: string, word: string): PartOfSpeech {
  const p = rawPos.toLowerCase();
  if (p.includes('noun')) return 'noun';
  if (p.includes('verb')) return 'verb';
  if (p.includes('adj')) return 'adj';
  if (p.includes('adv')) return 'adv';
  if (p.includes('prep')) return 'prep';
  if (p.includes('conj')) return 'conj';
  if (word.trim().includes(' ')) return 'phrase';
  return 'other';
}

/** Clean and normalize candidate example sentence */
function cleanExampleCandidate(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  // Remove attribution like ' — Leigh Hunt, ...' or ' -- Author'
  s = s.replace(/\s*[—–-]\s*[A-Z].*$/, '');
  // Clean brackets like [W]ith -> With or [poets] -> poets
  s = s.replace(/\[([A-Z])\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += '.';
  }
  return s;
}

/** Check if a string is a natural, complete English sentence */
function isNaturalSentence(s: string): boolean {
  if (!s || s.length < 12 || s.length > 250) return false;
  if (/[\u2003\t\u00A0]|&nbsp;|:/.test(s)) return false;
  const tokens = s.trim().split(/\s+/);
  if (tokens.length < 3) return false;
  const hasGrammar = /\b(is|are|was|were|has|have|had|do|does|did|can|could|will|would|should|to|the|a|an|in|on|at|by|for|from|with|it|they|he|she|we|you|i|this|that|these|those)\b/i.test(s);
  return hasGrammar;
}

/** Generate a natural, grammatical sentence template when external dictionaries have no example */
function generateTemplateSentence(word: string, pos: PartOfSpeech): string {
  const w = word.trim();
  switch (pos) {
    case 'verb':
      return `We need to ${w} the situation carefully.`;
    case 'adj':
      return `This approach is remarkably ${w} in modern practice.`;
    case 'adv':
      return `She completed the task ${w} and with great accuracy.`;
    case 'phrase':
      return `It is essential to ${w} in our daily lives.`;
    default:
      return `The ${w} plays an important role in our daily routine.`;
  }
}

/** Free multi-source word enrichment pipeline */
async function enrichWordWithFreeSources(word: string): Promise<WordEnrichResult> {
  const cleanWord = word.trim();
  const result: WordEnrichResult = {
    english: cleanWord,
    phonetic: '',
    partOfSpeech: cleanWord.includes(' ') ? 'phrase' : 'noun',
    meaning: '',
    exampleSentence: '',
    exampleTranslation: '',
    category: inferCategory(cleanWord),
    note: '',
  };

  // 1. Launch Google Translate (with dt=ex for Oxford examples), DictionaryAPI, Datamuse, and Wiktionary in parallel
  const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&dt=bd&dt=ex&q=${encodeURIComponent(cleanWord)}`;
  const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`;
  const datamuseUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(cleanWord)}&md=dprs`;
  const wiktionaryUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(cleanWord.toLowerCase())}`;

  const [tRes, dRes, dmRes, wRes] = await Promise.allSettled([
    fetch(transUrl).then(async (r) => (r.ok ? r.json() : null)),
    fetch(dictUrl).then(async (r) => (r.ok ? r.json() : null)),
    fetch(datamuseUrl).then(async (r) => (r.ok ? r.json() : null)),
    fetch(wiktionaryUrl).then(async (r) => (r.ok ? r.json() : null)),
  ]);

  const transData = tRes.status === 'fulfilled' ? tRes.value : null;
  const dictData = dRes.status === 'fulfilled' ? dRes.value : null;
  const datamuseData = dmRes.status === 'fulfilled' ? dmRes.value : null;
  const wikData = wRes.status === 'fulfilled' ? wRes.value : null;

  // Process Chinese translation and dictionary meanings
  if (transData) {
    const primary = Array.isArray(transData[0])
      ? transData[0].map((item: [string, ...unknown[]]) => item[0] || '').join('')
      : '';
    const dictMeanings: string[] = [];
    if (Array.isArray(transData[1])) {
      for (const posBlock of transData[1]) {
        if (Array.isArray(posBlock[1])) {
          dictMeanings.push(...posBlock[1].slice(0, 3));
        }
      }
    }
    if (dictMeanings.length > 0) {
      const set = Array.from(new Set([primary, ...dictMeanings])).filter(Boolean);
      result.meaning = set.slice(0, 3).join('、');
    } else {
      result.meaning = primary;
    }
  }

  // Process DictionaryAPI results (phonetic, POS, synonyms, notes)
  if (dictData && Array.isArray(dictData) && dictData[0]) {
    const entry = dictData[0];
    result.phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p: { text?: string }) => p.text)?.text ||
      '';

    const posList: string[] = [];
    const synonyms: string[] = [];

    if (Array.isArray(entry.meanings)) {
      for (const m of entry.meanings) {
        if (m.partOfSpeech) posList.push(m.partOfSpeech);
        if (Array.isArray(m.synonyms)) synonyms.push(...m.synonyms);
        if (Array.isArray(m.definitions)) {
          for (const d of m.definitions) {
            if (Array.isArray(d.synonyms)) synonyms.push(...d.synonyms);
          }
        }
      }
    }

    if (posList[0]) {
      result.partOfSpeech = mapPartOfSpeech(posList[0], cleanWord);
    }
    if (synonyms.length > 0) {
      const uniqueSynonyms = Array.from(new Set(synonyms)).slice(0, 4);
      result.note = `同義詞: ${uniqueSynonyms.join(', ')}`;
    }
  }

  // Fallback phonetic from Datamuse if still empty
  if (!result.phonetic && Array.isArray(datamuseData) && datamuseData[0]?.tags) {
    const pronTag = datamuseData[0].tags.find((t: string) => t.startsWith('pron:'));
    if (pronTag) {
      result.phonetic = arpabetToIpa(pronTag);
    }
  }

  // SOURCING HIGH-QUALITY EXAMPLE SENTENCES:
  // Tier 1: Oxford/Google Dictionary examples from transData[13]
  if (!result.exampleSentence && transData && Array.isArray(transData[13])) {
    for (const block of transData[13]) {
      if (Array.isArray(block)) {
        for (const item of block) {
          if (Array.isArray(item) && typeof item[0] === 'string') {
            const candidate = cleanExampleCandidate(item[0]);
            if (isNaturalSentence(candidate)) {
              result.exampleSentence = candidate;
              break;
            }
          }
        }
      }
      if (result.exampleSentence) break;
    }
  }

  // Tier 2: Wiktionary REST API examples
  if (!result.exampleSentence && wikData && Array.isArray(wikData.en)) {
    for (const item of wikData.en) {
      if (Array.isArray(item.definitions)) {
        for (const d of item.definitions) {
          if (Array.isArray(d.examples)) {
            for (const ex of d.examples) {
              const text = typeof ex === 'string' ? ex : ex?.text || '';
              const candidate = cleanExampleCandidate(text);
              if (
                isNaturalSentence(candidate) &&
                candidate.toLowerCase().includes(cleanWord.toLowerCase())
              ) {
                result.exampleSentence = candidate;
                break;
              }
            }
          }
          if (result.exampleSentence) break;
        }
      }
      if (result.exampleSentence) break;
    }
  }

  // Tier 3: DictionaryAPI definition examples
  if (!result.exampleSentence && Array.isArray(dictData) && dictData[0]) {
    for (const m of dictData[0].meanings || []) {
      for (const d of m.definitions || []) {
        if (d.example) {
          const candidate = cleanExampleCandidate(d.example);
          if (isNaturalSentence(candidate)) {
            result.exampleSentence = candidate;
            break;
          }
        }
      }
      if (result.exampleSentence) break;
    }
  }

  // Tier 4: Contextual grammatical template fallback (guarantees non-empty)
  if (!result.exampleSentence) {
    result.exampleSentence = generateTemplateSentence(cleanWord, result.partOfSpeech);
  }

  // 5. Translate example sentence into Traditional Chinese
  if (result.exampleSentence) {
    try {
      const exTrans = await translateText(result.exampleSentence, 'en', 'zh-TW');
      result.exampleTranslation = exTrans.text;
    } catch {
      result.exampleTranslation = '';
    }
  }

  // 6. 免費管線完整性警示：核心欄位 (中文釋義) 仍為空代表上游資料源
  //    (Google Translate / DictionaryAPI 等) 全部失效或單字不在其收錄範圍，
  //    寫入警告日誌方便從 DebugLogModal 觀察管線健康狀態。
  if (!result.meaning) {
    LoggerService.warn('EnrichmentService', `免費補充管線未取得釋義: "${cleanWord}" (資料源可能失效)`);
  }

  return result;
}

/** Call Gemini API for Word enrichment */
async function enrichWordWithGemini(
  word: string,
  apiKey: string
): Promise<WordEnrichResult | null> {
  const prompt = `You are an expert English language tutor for Traditional Chinese (繁體中文, 台灣) learners.
Analyze the following English word or phrase: "${word.trim()}".
Return ONLY a valid JSON object without markdown, code fences, or extra text:
{
  "phonetic": "KK/IPA phonetic notation e.g. /əˈbʌndənt/",
  "partOfSpeech": "noun" | "verb" | "adj" | "adv" | "prep" | "conj" | "phrase" | "other",
  "meaning": "常用繁體中文釋義 (1-3個，頓號隔開)",
  "exampleSentence": "實用地道的英文例句",
  "exampleTranslation": "例句繁體中文翻譯",
  "category": "daily" | "travel" | "work" | "academic" | "exam" | "slang" | "other",
  "note": "詞根詞綴、記憶聯想術或易混淆字解析 (繁體中文)"
}`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText.trim());
      return {
        english: word.trim(),
        phonetic: parsed.phonetic || '',
        partOfSpeech: (parsed.partOfSpeech || 'noun') as PartOfSpeech,
        meaning: parsed.meaning || '',
        exampleSentence: parsed.exampleSentence || '',
        exampleTranslation: parsed.exampleTranslation || '',
        category: (parsed.category || 'daily') as WordCategory,
        note: parsed.note || '',
      };
    } catch {
      continue;
    }
  }

  return null;
}

/** Call Gemini API for Sentence enrichment */
async function enrichSentenceWithGemini(
  sentence: string,
  apiKey: string
): Promise<SentenceEnrichResult | null> {
  const prompt = `You are an expert English-Traditional Chinese language tutor for Taiwan learners.
Analyze the following sentence: "${sentence.trim()}".
Return ONLY a valid JSON object without markdown, code fences, or extra text:
{
  "english": "標準道地的英文句子 (若原句為中文請翻譯為自然英文；若有文法錯誤請修正)",
  "chinese": "流暢道地的繁體中文翻譯",
  "category": "daily" | "travel" | "work" | "academic" | "exam" | "slang" | "other",
  "note": "重點文法結構、核心片語拆解或用法重點提示 (繁體中文)"
}`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText.trim());
      return {
        english: parsed.english || sentence.trim(),
        chinese: parsed.chinese || '',
        category: (parsed.category || 'daily') as WordCategory,
        note: parsed.note || '',
      };
    } catch {
      continue;
    }
  }

  return null;
}

/** Free sentence enrichment pipeline */
async function enrichSentenceWithFreeSources(input: string): Promise<SentenceEnrichResult> {
  const text = input.trim();
  const isChineseInput = /[\u4e00-\u9fa5]/.test(text);

  let english = '';
  let chinese = '';

  if (isChineseInput) {
    chinese = text;
    const trans = await translateText(text, 'auto', 'en');
    english = trans.text || text;
  } else {
    english = text;
    const trans = await translateText(text, 'auto', 'zh-TW');
    chinese = trans.text || '';
  }

  const category = inferCategory(english || chinese);

  // Analyze potential key phrases or idioms for note
  const noteSnippets: string[] = [];
  const lower = english.toLowerCase();
  if (lower.includes('look forward to')) noteSnippets.push('片語「look forward to」後接名詞或 V-ing');
  if (lower.includes('take advantage of')) noteSnippets.push('片語「take advantage of」意為利用、佔便宜');
  if (lower.includes('think outside the box')) noteSnippets.push('成語「think outside the box」意為跳脫傳統思維');
  if (lower.includes('in order to')) noteSnippets.push('「in order to」表目的，後接原形動詞');
  if (lower.includes('as long as')) noteSnippets.push('「as long as」表條件，意為只要');
  if (lower.includes('as soon as')) noteSnippets.push('「as soon as」表一...就...');

  return {
    english,
    chinese,
    category,
    note: noteSnippets.length > 0 ? noteSnippets.join('；') : '常用語句',
  };
}

export class EnrichmentService {
  /** Enrich word information with Gemini or Free multi-source fallback */
  public static async enrichWord(
    word: string,
    config?: EnrichmentConfig
  ): Promise<WordEnrichResult> {
    const trimmed = word.trim();
    if (!trimmed) {
      throw new Error('請輸入英文單字');
    }

    // Try Gemini if API key is provided
    if (config?.geminiApiKey && config.geminiApiKey.trim()) {
      try {
        const aiResult = await enrichWordWithGemini(trimmed, config.geminiApiKey);
        if (aiResult) {
          LoggerService.info('EnrichmentService', `AI 自動補充單字成功: ${trimmed}`);
          return aiResult;
        }
      } catch (err) {
        LoggerService.warn(
          'EnrichmentService',
          `Gemini API 失敗，切換為內建辭典: ${(err as Error).message}`
        );
      }
    }

    // Free sources fallback
    LoggerService.info('EnrichmentService', `使用內建辭典與翻譯補充單字: ${trimmed}`);
    return enrichWordWithFreeSources(trimmed);
  }

  /** Enrich sentence information with Gemini or Free multi-source fallback */
  public static async enrichSentence(
    input: string,
    config?: EnrichmentConfig
  ): Promise<SentenceEnrichResult> {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('請輸入句子內容');
    }

    // Try Gemini if API key is provided
    if (config?.geminiApiKey && config.geminiApiKey.trim()) {
      try {
        const aiResult = await enrichSentenceWithGemini(trimmed, config.geminiApiKey);
        if (aiResult) {
          LoggerService.info('EnrichmentService', `AI 自動翻譯與補充句子成功`);
          return aiResult;
        }
      } catch (err) {
        LoggerService.warn(
          'EnrichmentService',
          `Gemini API 失敗，切換為內建翻譯: ${(err as Error).message}`
        );
      }
    }

    // Free sources fallback
    LoggerService.info('EnrichmentService', `使用內建翻譯引擎補充句子`);
    return enrichSentenceWithFreeSources(trimmed);
  }

  /** Test Gemini API Key connectivity */
  public static async testGeminiApiKey(
    apiKey: string
  ): Promise<{ success: boolean; message: string }> {
    if (!apiKey.trim()) {
      return { success: false, message: '請輸入金鑰' };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with "OK"' }] }],
        }),
      });

      if (res.ok) {
        return { success: true, message: 'Gemini API 金鑰驗證成功 (2.0 Flash)！' };
      }

      // Try 1.5 fallback
      const url15 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
      const res15 = await fetch(url15, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with "OK"' }] }],
        }),
      });

      if (res15.ok) {
        return { success: true, message: 'Gemini API 金鑰驗證成功 (1.5 Flash)！' };
      }

      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error?.message || `HTTP ${res.status}`;
      return { success: false, message: `驗證失敗: ${errMsg}` };
    } catch (err) {
      return { success: false, message: `連線失敗: ${(err as Error).message}` };
    }
  }
}
