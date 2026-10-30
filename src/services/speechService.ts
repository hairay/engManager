import { LoggerService } from './loggerService';

/**
 * 連續朗讀佇列項目：一個項目代表一筆單字/句子，
 * parts 為該項目的朗讀內容分段 (例如：單字本體 → 例句)，會依序唸完再跳下一筆。
 */
export interface SpeechSequenceItem {
  parts: string[];
  rate?: number;
}

/**
 * Web Speech API 高音質文字轉語音服務
 * 具備「神經自然語音 (Neural/Natural Voice)」智能優先評分機制，
 * 優先選取微軟 Edge 自然人聲 (Azure Neural) 或 Google 雲端自然語音，達到接近真人的抑揚頓挫。
 */
export class SpeechService {
  private static cachedEnglishVoice: SpeechSynthesisVoice | null = null;
  private static initialized = false;

  // ---- 連續朗讀佇列狀態 ----
  private static sequenceListeners = new Set<(index: number) => void>();
  private static sequencePlaying = false;
  private static sequencePaused = false;
  private static sequenceToken = 0;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * 語音品質評分演算法
   * 分數越高代表擬真度與自然度越高：
   * 100: 微軟 Edge 內建 Azure 神經自然人聲 (如 Jenny, Guy, Aria Online Natural)
   * 90:  Google US English (Chrome/Android 雲端神經高音質人聲)
   * 85:  Apple macOS / iOS 增強版/高級人聲 (Enhanced / Premium)
   * 70:  其他高品質已知英文語音 (如 Samantha, Zoe, Ava)
   * 50:  標準本機 en-US 語音
   * 20:  其他英語系語音 (如 en-GB, en-AU)
   * -1:  非英語語音
   */
  private static rankVoice(voice: SpeechSynthesisVoice): number {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();

    // 必須為英語
    if (!lang.startsWith('en')) return -1;

    // 1. 微軟 Edge 內建 Azure 神經網路自然人聲 (極度擬真)
    if (name.includes('natural') || name.includes('online')) {
      return 100;
    }

    // 2. Google 高階美式英語 (Chrome / Android 雲端人聲)
    if (name.includes('google') && (lang === 'en-us' || lang.startsWith('en_us'))) {
      return 90;
    }

    // 3. Apple 增強版與高級語音 (iOS / macOS Enhanced / Premium)
    if (name.includes('enhanced') || name.includes('premium')) {
      return 85;
    }

    // 4. 其他 Google 英語人聲 (如 Google UK English Female/Male)
    if (name.includes('google')) {
      return 80;
    }

    // 5. 常見高品質美式發音人聲名稱
    if (
      name.includes('jenny') ||
      name.includes('guy') ||
      name.includes('aria') ||
      name.includes('samantha') ||
      name.includes('ava')
    ) {
      return 70;
    }

    // 6. 一般美式英語
    if (lang === 'en-us' || lang.startsWith('en_us')) {
      return 50;
    }

    // 7. 其他英語系 (如 en-GB, en-AU, en-CA)
    return 20;
  }

  /** 從瀏覽器可用語音中挑選最佳音質的英語人聲 */
  private static selectBestVoice(): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const ranked = voices
      .map((v) => ({ voice: v, score: this.rankVoice(v) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length > 0) {
      const best = ranked[0].voice;
      LoggerService.info('Speech', `已選用語音：${best.name} [評分: ${ranked[0].score}]`);
      return best;
    }

    return voices.find((v) => v.lang.startsWith('en')) || null;
  }

  /** 預熱並非同步監聽瀏覽器語音清單就緒 */
  public static warmUp(): void {
    if (!this.isSupported() || this.initialized) return;
    this.initialized = true;

    const update = () => {
      const best = this.selectBestVoice();
      if (best) {
        this.cachedEnglishVoice = best;
      }
    };

    update();
    window.speechSynthesis.onvoiceschanged = update;
  }

  /** 取得當前使用的語音名稱 */
  public static getCurrentVoiceName(): string {
    return this.cachedEnglishVoice?.name || '瀏覽器預設語音';
  }

  /** 播放英文語音發音 (支援可調語速與防斷音機制) */
  public static speak(text: string, rate: number = 0.92, pitch: number = 1.0): void {
    if (!this.isSupported() || !text.trim()) return;

    // 若連續朗讀進行中，先干淨地停止佇列，避免鏈式回呼殘留
    if (this.sequencePlaying) this.stopSequence();

    try {
      // 清除上一筆朗讀的殘留參照 (保留引用乃是為了避免瀏覽器對 utterance 的 GC 斷音)
      if (this.currentUtterance) this.currentUtterance = null;

      // 解決 Chrome 在閒置時可能出現的播放中斷/凍結問題
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      if (!this.cachedEnglishVoice) {
        this.cachedEnglishVoice = this.selectBestVoice();
      }

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'en-US';
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1.0;

      if (this.cachedEnglishVoice) {
        utterance.voice = this.cachedEnglishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // 語音播放失敗不影響 UI 操作
    }
  }

  /* ---------------- 連續朗讀佇列 ---------------- */

  /** 連續朗讀是否進行中 */
  public static isSequencePlaying(): boolean {
    return this.sequencePlaying;
  }

  /** 連續朗讀是否暫停中 */
  public static isSequencePaused(): boolean {
    return this.sequencePaused;
  }

  /**
   * 註冊連續朗讀進度監聽器。
   * 回呼參數 index：
   *   >= 0 → 正在朗讀第 index 個項目 (0 起始)
   *   -1   → 佇列已停止或自然播放完畢
   * 回傳解除註冊函式。
   */
  public static addSequenceListener(cb: (index: number) => void): () => void {
    this.sequenceListeners.add(cb);
    return () => {
      this.sequenceListeners.delete(cb);
    };
  }

  private static emitSequenceProgress(index: number): void {
    this.sequenceListeners.forEach((cb) => {
      try {
        cb(index);
      } catch {
        // 單一監聽器出錯不影響播放
      }
    });
  }

  /** 開始依序朗讀佇列 (可指定起始項目索引，用於「上一句/下一句」跳轉) */
  public static playSequence(items: SpeechSequenceItem[], startIndex: number = 0): void {
    if (!this.isSupported() || items.length === 0) return;
    this.stopSequence();

    const safeStart = Math.max(0, Math.min(startIndex, items.length - 1));
    const token = ++this.sequenceToken;
    this.sequencePlaying = true;
    this.sequencePaused = false;
    LoggerService.info('Speech', `連續朗讀開始：共 ${items.length} 項，從第 ${safeStart + 1} 項播放`);
    this.speakSequenceAt(items, safeStart, 0, token);
  }

  /** 遞迴朗讀第 itemIndex 項的第 partIndex 段，並透過 onend 鏈接下一段/下一項 */
  private static speakSequenceAt(
    items: SpeechSequenceItem[],
    itemIndex: number,
    partIndex: number,
    token: number
  ): void {
    if (token !== this.sequenceToken) return; // 已被新的播放/停止取代，忽略過期回呼

    if (itemIndex >= items.length) {
      // 播完整佇列，自然結束
      this.sequenceToken++;
      this.finishSequenceState();
      this.emitSequenceProgress(-1);
      return;
    }

    const item = items[itemIndex];

    if (partIndex >= item.parts.length) {
      // 本項目所有段落唸完 → 停頓後前往下一項
      const itemGap = 700;
      window.setTimeout(() => this.speakSequenceAt(items, itemIndex + 1, 0, token), itemGap);
      return;
    }

    if (partIndex === 0) this.emitSequenceProgress(itemIndex);

    const synth = window.speechSynthesis;
    const text = item.parts[partIndex].trim();
    if (!text) {
      // 空段直接跳下一段
      this.speakSequenceAt(items, itemIndex, partIndex + 1, token);
      return;
    }

    try {
      if (synth.paused) synth.resume();
      if (synth.speaking) synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = item.rate ?? 0.92;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      if (this.cachedEnglishVoice) utterance.voice = this.cachedEnglishVoice;

      utterance.onend = () => {
        if (token !== this.sequenceToken) return;
        const partGap = item.parts.length > 1 ? 450 : 200;
        window.setTimeout(() => this.speakSequenceAt(items, itemIndex, partIndex + 1, token), partGap);
      };
      utterance.onerror = () => {
        if (token !== this.sequenceToken) return;
        this.sequenceToken++;
        this.finishSequenceState();
        this.emitSequenceProgress(-1);
      };
      this.currentUtterance = utterance;
      synth.speak(utterance);
    } catch {
      if (token === this.sequenceToken) {
        this.sequenceToken++;
        this.finishSequenceState();
        this.emitSequenceProgress(-1);
      }
    }
  }

  /** 重置佇列播放狀態 (由呼叫端負責 emit -1) */
  private static finishSequenceState(): void {
    this.sequencePlaying = false;
    this.sequencePaused = false;
    this.currentUtterance = null;
    try {
      const synth = window.speechSynthesis;
      if (synth.paused) synth.resume();
      if (synth.speaking) synth.cancel();
    } catch {
      // ignore
    }
  }

  /** 暫停目前朗讀 (Web Speech 平台不支援時可能無效，但不影響資料) */
  public static pauseSequence(): void {
    if (!this.isSupported() || !this.sequencePlaying) return;
    try {
      window.speechSynthesis.pause();
    } catch {
      // ignore
    }
    this.sequencePaused = true;
  }

  /** 繼續目前朗讀 */
  public static resumeSequence(): void {
    if (!this.isSupported() || !this.sequencePlaying) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }
    this.sequencePaused = false;
  }

  /** 停止整個連續朗讀佇列 (立即中斷，並通知所有監聽器 -1) */
  public static stopSequence(): void {
    if (!this.isSupported()) return;
    const wasPlaying = this.sequencePlaying;
    this.sequenceToken++; // 讓一切過期回呼失效
    this.currentUtterance = null;
    try {
      const synth = window.speechSynthesis;
      if (synth.paused) synth.resume();
      if (synth.speaking) synth.cancel();
    } catch {
      // ignore
    }
    this.sequencePlaying = false;
    this.sequencePaused = false;
    if (wasPlaying) this.emitSequenceProgress(-1);
  }
}
