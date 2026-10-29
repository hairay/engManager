import { LoggerService } from './loggerService';

/**
 * Web Speech API 高音質文字轉語音服務
 * 具備「神經自然語音 (Neural/Natural Voice)」智能優先評分機制，
 * 優先選取微軟 Edge 自然人聲 (Azure Neural) 或 Google 雲端自然語音，達到接近真人的抑揚頓挫。
 */
export class SpeechService {
  private static cachedEnglishVoice: SpeechSynthesisVoice | null = null;
  private static initialized = false;

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

    try {
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
}
