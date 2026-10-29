import type { Word, Sentence } from '../types';

const now = () => new Date().toISOString();

const mkWord = (
  id: string,
  english: string,
  phonetic: string,
  partOfSpeech: Word['partOfSpeech'],
  meaning: string,
  exampleSentence: string,
  exampleTranslation: string,
  category: Word['category'],
  level: number,
  favorite: boolean = false
): Word => ({
  id,
  english,
  phonetic,
  partOfSpeech,
  meaning,
  exampleSentence,
  exampleTranslation,
  category,
  level,
  favorite,
  note: '',
  reviewCount: 0,
  correctCount: 0,
  lastReviewedAt: null,
  createdAt: now(),
  updatedAt: now(),
});

const mkSentence = (
  id: string,
  english: string,
  chinese: string,
  category: Sentence['category'],
  level: number,
  favorite: boolean = false
): Sentence => ({
  id,
  english,
  chinese,
  category,
  level,
  favorite,
  note: '',
  reviewCount: 0,
  correctCount: 0,
  lastReviewedAt: null,
  createdAt: now(),
  updatedAt: now(),
});

export const INITIAL_WORDS: Word[] = [
  mkWord('word-demo-1', 'abundant', '/əˈbʌndənt/', 'adj', '豐富的、充裕的', 'Rainfall is abundant in this region.', '這個地區雨量充沛。', 'academic', 1),
  mkWord('word-demo-2', 'reluctant', '/rɪˈlʌktənt/', 'adj', '不情願的、勉強的', "She was reluctant to leave the fun party.", '她很不情願離開那場有趣的派對。', 'daily', 2),
  mkWord('word-demo-3', 'commute', '/kəˈmjuːt/', 'verb', '通勤', 'I commute to work by train every morning.', '我每天早上搭火車通勤上班。', 'work', 1),
  mkWord('word-demo-4', 'itinerary', '/aɪˈtɪnərəri/', 'noun', '行程表、旅程安排', 'We planned the itinerary for our Paris trip.', '我們規劃了巴黎之旅的行程表。', 'travel', 1),
  mkWord('word-demo-5', 'procrastinate', '/proʊˈkræstəˌneɪt/', 'verb', '拖延、耽擱', 'Stop procrastinating and start studying now.', '別再拖延了，現在就開始念書。', 'exam', 1, true),
  mkWord('word-demo-6', 'negotiate', '/nɪˈɡoʊʃieɪt/', 'verb', '談判、協商', 'They negotiated a better price at the market.', '他們在市場上殺到了更好的價錢。', 'travel', 2),
  mkWord('word-demo-7', 'aesthetic', '/esˈθetɪk/', 'adj', '美感的、美學的', 'The bridge has great aesthetic value.', '這座橋具有很高的美感價值。', 'academic', 1),
  mkWord('word-demo-8', 'bargain', '/ˈbɑːrɡɪn/', 'noun', '便宜貨、划算的東西', 'These sneakers were a real bargain.', '這雙運動鞋真是超值便宜貨。', 'daily', 3, true),
  mkWord('word-demo-9', 'peruse', '/pərˈuːz/', 'verb', '細讀、審閱', 'You may peruse the report before the meeting.', '你可以在會議前仔細審閱這份報告。', 'work', 1),
  mkWord('word-demo-10', 'scrumptious', '/ˈskrʌmpʃəs/', 'adj', '美味極了的', 'The bakery sells scrumptious pastries.', '這家麵包店賣著極為美味的糕點。', 'slang', 1),
];

export const INITIAL_SENTENCES: Sentence[] = [
  mkSentence('sent-demo-1', 'Actions speak louder than words.', '行動勝於言語。', 'daily', 1),
  mkSentence('sent-demo-2', 'Could you tell me how to get to the train station?', '可以告訴我如何前往火車站嗎？', 'travel', 2),
  mkSentence('sent-demo-3', "Let's touch base after the meeting and finalize the details.", '會後我們再聯繫並確定細節。', 'work', 3, true),
  mkSentence('sent-demo-4', "The sooner you start, the sooner you'll succeed.", '你越早開始，就越快成功。', 'exam', 1),
  mkSentence('sent-demo-5', "I'd like to book a double room for three nights.", '我想訂一間雙人房住三晚。', 'travel', 1),
  mkSentence('sent-demo-6', 'Even when it feels hard, keep practising a little every day.', '即使覺得很難，也要每天一點點持續練習。', 'exam', 1, true),
];
