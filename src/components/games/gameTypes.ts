import type { Word, Sentence } from '../../types';

export interface QuizQuestion {
  mode: 'en2zh' | 'zh2en';
  word: Word;
  options: string[];
  answerIdx: number;
}

export interface SpellQuestion {
  word: Word;
  tokens: string[][]; // 每個單字段的字母
  target: string;     // 不含空格的正解
}

export interface ClozeQuestion {
  sentence: Sentence;
  pre: string;   // 挖空前的文字
  post: string;  // 挖空後的文字
  answer: string;
  options: string[];
  answerIdx: number;
}

export interface ScrambleQuestion {
  sentence: Sentence;
  tokens: string[];
}

export interface TypingQuestion {
  id: string;
  kind: 'word' | 'sentence';
  target: string;
  meaning: string;
  phonetic?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  wordId?: string;
  sentenceId?: string;
}

export interface GameFeedback {
  correct: boolean;
  answerText?: string;
  chosen?: string;
}
