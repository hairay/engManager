/**
 * Web Speech API 文字轉語音服務
 * 用於英文單字與句子發音（免費、離線、無需任何 API Key）
 */
export class SpeechService {
  private static cachedEnglishVoice: SpeechSynthesisVoice | null = null;
  private static initialized = false;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Some browsers load the voice list asynchronously - warm it up on app start */
  public static warmUp(): void {
    if (!this.isSupported() || this.initialized) return;
    this.initialized = true;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang === 'en-US') ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null;
      this.cachedEnglishVoice = preferred;
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  public static speak(text: string, rate: number = 0.9): void {
    if (!this.isSupported() || !text.trim()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'en-US';
      utterance.rate = rate;
      if (!this.cachedEnglishVoice) {
        const voices = window.speechSynthesis.getVoices();
        this.cachedEnglishVoice =
          voices.find((v) => v.lang === 'en-US') || voices.find((v) => v.lang.startsWith('en')) || null;
      }
      if (this.cachedEnglishVoice) {
        utterance.voice = this.cachedEnglishVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // speech synthesis failures should never break the UI
    }
  }
}
