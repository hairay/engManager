export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
}

export class LoggerService {
  private static entries: LogEntry[] = [];
  private static maxEntries = 500;
  private static listeners: Array<(entries: LogEntry[]) => void> = [];

  public static subscribe(listener: (entries: LogEntry[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.entries]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static persistTimer: ReturnType<typeof setTimeout> | null = null;

  private static schedulePersist(): void {
    if (this.persistTimer !== null) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        localStorage.setItem('engmanager_debug_logs', JSON.stringify(this.entries.slice(-300)));
      } catch {
        // ignore storage quota errors
      }
    }, 500);
  }

  private static addLog(level: LogLevel, module: string, message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
    };
    this.entries = [...this.entries.slice(-this.maxEntries + 1), entry];
    this.schedulePersist();
    this.listeners.forEach((l) => l([...this.entries]));
  }

  public static getLogs(): LogEntry[] {
    return [...this.entries];
  }

  /** Reload persisted logs (e.g. after app restart) */
  public static hydrateFromStorage(): void {
    try {
      const raw = localStorage.getItem('engmanager_debug_logs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed.filter((e) => e && typeof e === 'object');
        }
      }
    } catch {
      this.entries = [];
    }
  }

  public static clear(): void {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.entries = [];
    localStorage.removeItem('engmanager_debug_logs');
    this.listeners.forEach((l) => l([]));
  }

  public static debug(module: string, message: string): void {
    this.addLog('debug', module, message);
  }

  public static info(module: string, message: string): void {
    this.addLog('info', module, message);
  }

  public static warn(module: string, message: string): void {
    this.addLog('warn', module, message);
  }

  public static error(module: string, message: string): void {
    this.addLog('error', module, message);
  }

  public static exportLogs(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}
