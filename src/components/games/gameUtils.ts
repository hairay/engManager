import type { Word, Sentence, GameType } from '../../types';
import type {
  QuizQuestion,
  SpellQuestion,
  ClozeQuestion,
  ScrambleQuestion,
  TypingQuestion,
} from './gameTypes';

export const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const normToken = (t: string): string =>
  t.toLowerCase().replace(/[^a-z0-9']/g, '');

export const stripPunct = (t: string): string => t.replace(/[^A-Za-z]/g, '');

export const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'in', 'it', 'that', 'for',
  'on', 'with', 'as', 'at', 'by', 'from', 'you', 'i', 'we', 'he', 'she', 'they', 'this',
  'these', 'those', 'be', 'been', 'am', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'should', 'may', 'might', 'have', 'has', 'had', 'not', 'no', 'so', 'or', 'but', 'if',
  'than', 'then', 'there', 'their', 'his', 'her', 'its', 'our', 'my', 'your', 'me', 'him',
  'them', 'us', 'get', 'got', 'let', 'like', 'just', 'very', 'too', 'more', 'most',
]);

export interface BuiltQuestions {
  quizQs: QuizQuestion[];
  spellingQs: SpellQuestion[];
  clozeQs: ClozeQuestion[];
  scrambleQs: ScrambleQuestion[];
  typingQs: TypingQuestion[];
  total: number;
}

export function buildGameQuestions(
  game: GameType,
  count: number,
  poolWords: Word[],
  poolSentences: Sentence[],
  allWords: Word[],
  allSentences: Sentence[]
): BuiltQuestions {
  const n = count;
  const result: BuiltQuestions = {
    quizQs: [],
    spellingQs: [],
    clozeQs: [],
    scrambleQs: [],
    typingQs: [],
    total: 0,
  };

  if (game === 'word_quiz') {
    const picked = shuffle(poolWords).slice(0, n);
    const questions: QuizQuestion[] = picked.map((word, qIdx) => {
      const mode: QuizQuestion['mode'] = qIdx % 2 === 0 ? 'en2zh' : 'zh2en';
      const correct = mode === 'en2zh' ? word.meaning : word.english;
      const distractSource =
        mode === 'en2zh'
          ? allWords.filter((w) => w.id !== word.id).map((w) => w.meaning)
          : allWords.filter((w) => w.id !== word.id).map((w) => w.english);
      const seen = new Set<string>([correct.toLowerCase()]);
      const distractors: string[] = [];
      for (const d of shuffle(distractSource)) {
        if (distractors.length >= 3) break;
        if (!seen.has(d.toLowerCase())) {
          seen.add(d.toLowerCase());
          distractors.push(d);
        }
      }
      const options = shuffle([correct, ...distractors]);
      return { mode, word, options, answerIdx: options.indexOf(correct) };
    });
    result.quizQs = questions;
    result.total = questions.length;
  } else if (game === 'word_spelling') {
    const candidates = poolWords.filter((w) => stripPunct(w.english).length >= 2);
    const picked = shuffle(candidates).slice(0, n);
    const questions: SpellQuestion[] = picked.map((word) => {
      const tokens = word.english
        .split(/\s+/)
        .map((tk) => stripPunct(tk).split(''));
      return { word, tokens, target: stripPunct(word.english).toLowerCase() };
    });
    result.spellingQs = questions;
    result.total = questions.length;
  } else if (game === 'typing_practice') {
    const candidates: Array<Word | Sentence> = poolWords.length > 0 ? poolWords : poolSentences;
    const picked = shuffle(candidates).slice(0, n);
    const questions: TypingQuestion[] = picked.map((item) => {
      if ('meaning' in item) {
        const w = item as Word;
        return {
          id: w.id,
          kind: 'word',
          target: w.english.trim(),
          meaning: w.meaning,
          phonetic: w.phonetic,
          exampleSentence: w.exampleSentence,
          exampleTranslation: w.exampleTranslation,
          wordId: w.id,
        };
      } else {
        const s = item as Sentence;
        return {
          id: s.id,
          kind: 'sentence',
          target: s.english.trim(),
          meaning: s.chinese,
          exampleSentence: s.english,
          exampleTranslation: s.chinese,
          sentenceId: s.id,
        };
      }
    });
    result.typingQs = questions;
    result.total = questions.length;
  } else if (game === 'sentence_cloze') {
    const picked = shuffle(poolSentences).slice(0, n);
    // 干擾選項池（排除當前題目句子，避免同句其他單字也變成選項）
    const buildDistractorPool = (excludeId: string) =>
      Array.from(
        new Set([
          ...allSentences
            .filter((s) => s.id !== excludeId)
            .flatMap((s) => s.english.split(/\s+/).map(normToken))
            .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
          ...allWords.map((w) => stripPunct(w.english).toLowerCase()).filter((t) => t.length >= 3),
        ])
      );
    const questions: ClozeQuestion[] = [];
    for (const sentence of picked) {
      const distractorPool = buildDistractorPool(sentence.id);
      const tokensRaw = sentence.english.split(/\s+/);
      const candidates = tokensRaw
        .map(stripPunct)
        .map((core) => core.toLowerCase())
        .filter((core) => core.length >= 3 && !STOPWORDS.has(core));
      if (candidates.length === 0) continue;
      const longest = Math.max(...candidates.map((c) => c.length));
      const topOnes = candidates.filter((c) => c.length >= longest - 1);
      const answer = topOnes[Math.floor(Math.random() * topOnes.length)];
      const tokenIdx = tokensRaw.findIndex((t) => normToken(t) === answer);
      if (tokenIdx < 0) continue;
      const seen = new Set<string>([answer]);
      const distractors: string[] = [];
      for (const d of shuffle(distractorPool)) {
        if (distractors.length >= 3) break;
        if (!seen.has(d)) {
          seen.add(d);
          distractors.push(d);
        }
      }
      if (distractors.length < 3) {
        const FALLBACK_WORDS = ['always', 'usually', 'sometimes', 'already', 'almost', 'enough', 'together', 'important', 'different', 'possible'];
        for (const d of shuffle(FALLBACK_WORDS)) {
          if (distractors.length >= 3) break;
          if (!seen.has(d)) {
            seen.add(d);
            distractors.push(d);
          }
        }
      }
      const options = shuffle([answer, ...distractors]);
      questions.push({
        sentence,
        pre: tokensRaw.slice(0, tokenIdx).join(' '),
        post: tokensRaw.slice(tokenIdx + 1).join(' '),
        answer,
        options,
        answerIdx: options.indexOf(answer),
      });
    }
    result.clozeQs = questions;
    result.total = questions.length;
  } else {
    // sentence_scramble
    const picked = shuffle(poolSentences).slice(0, n);
    const questions: ScrambleQuestion[] = picked.map((sentence) => {
      const tokens = sentence.english.split(/\s+/);
      let scrambled = shuffle(tokens);
      let tries = 0;
      while (
        tries < 10 &&
        scrambled.length > 1 &&
        scrambled.every((t, i) => normToken(t) === normToken(tokens[i]))
      ) {
        scrambled = shuffle(tokens);
        tries++;
      }
      return { sentence, tokens: scrambled };
    });
    result.scrambleQs = questions;
    result.total = questions.length;
  }

  return result;
}
