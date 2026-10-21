/**
 * Signal vocabulary for the local (no-API-key) clip engine.
 *
 * This is the main "tuning surface" of the app: add words here to change what
 * Hookline considers hooky, emotional, contrarian, etc. Each list is matched
 * case-insensitively on word boundaries unless noted otherwise.
 *
 * Keep this file data-only — no logic — so it stays easy to edit.
 */

/** Opens a curiosity gap: "why", "the reason", "nobody tells you". */
export const CURIOSITY = [
  'why',
  'how',
  'what if',
  'secret',
  'nobody',
  'no one',
  'most people',
  'everyone',
  'truth',
  'the reason',
  'reason is',
  'mistake',
  'hidden',
  'surprising',
  'weird',
  'strange',
  'turns out',
  'until',
  'but then',
  'here is why',
  "here's why",
  'the problem',
  'what happened',
  'the catch',
  'you would not believe',
  "you won't believe",
  'little known',
  'underrated',
  'overrated',
];

/** Contrarian / myth-busting language — strong scroll-stoppers. */
export const CONTRARIAN = [
  'most people',
  'everyone thinks',
  'nobody tells you',
  'nobody talks about',
  'myth',
  'lie',
  'wrong',
  'actually',
  'opposite',
  'contrary',
  'stop doing',
  'stop',
  'never',
  "don't",
  'do not',
  'overrated',
  'underrated',
  'not true',
  'bad advice',
  'waste of',
  'ruining',
  'killing',
  'broken',
  'scam',
  'nonsense',
];

/** What the viewer stands to gain or lose — raises perceived stakes. */
export const STAKES = [
  'money',
  'dollars',
  'revenue',
  'income',
  'salary',
  'profit',
  'cost',
  'price',
  'broke',
  'rich',
  'million',
  'billion',
  'thousand',
  'percent',
  'job',
  'career',
  'business',
  'health',
  'sleep',
  'time',
  'years',
  'life',
  'risk',
  'fail',
  'failure',
  'lose',
  'lost',
  'danger',
  'dangerous',
  'dead',
  'death',
  'hurt',
  'injury',
  'burnout',
  'anxiety',
];

/** Emotional charge. */
export const EMOTION = [
  'amazing',
  'incredible',
  'insane',
  'crazy',
  'brutal',
  'terrifying',
  'scary',
  'horrible',
  'painful',
  'love',
  'hate',
  'fear',
  'shocked',
  'shocking',
  'embarrassing',
  'frustrating',
  'excited',
  'obsessed',
  'regret',
  'proud',
  'angry',
  'furious',
  'devastating',
  'heartbreaking',
  'mind blowing',
  'unbelievable',
  'wild',
];

/** Storytelling signposts — narrative clips retain better than lectures. */
export const STORY = [
  'i was',
  'when i',
  'one day',
  'so i',
  'and then',
  'suddenly',
  'ended up',
  'i remember',
  'we were',
  'he said',
  'she said',
  'they told me',
  'at first',
  'eventually',
  'the first time',
  'years ago',
  'last year',
];

/** Proof: numbers, studies, concrete outcomes. */
export const EVIDENCE = [
  'percent',
  '%',
  'study',
  'research',
  'data',
  'survey',
  'experiment',
  'tested',
  'results',
  'case study',
  'for example',
  'for instance',
  'i measured',
  'i tracked',
];

/** Signals that a thought is resolving — good clip endings. */
export const PAYOFF = [
  'so',
  'therefore',
  'that means',
  'which means',
  'turns out',
  'the result',
  'in the end',
  'bottom line',
  'the lesson',
  'what i learned',
  "that's why",
  'that is why',
  'because of that',
  'here is the thing',
  "here's the thing",
  'the answer is',
  'the fix',
  'the takeaway',
  'so the fix',
  'that changed',
  'now i',
];

/** Filler that dilutes a clip (used as a penalty, and for trim suggestions). */
export const FILLERS = [
  'um',
  'uh',
  'er',
  'ah',
  'like',
  'you know',
  'basically',
  'literally',
  'actually',
  'sort of',
  'kind of',
  'i mean',
  'right',
  'so yeah',
  'anyway',
  'whatever',
  'stuff like that',
  'and so on',
  'at the end of the day',
  'to be honest',
  'honestly',
];

/** Words that make an opening feel like a fragment of a bigger thought. */
export const WEAK_OPENERS = [
  'and',
  'but',
  'so',
  'because',
  'also',
  'then',
  'which',
  'that',
  'this',
  'it',
  'they',
  'he',
  'she',
  'them',
  'those',
  'these',
  'there',
  'however',
  'therefore',
  'plus',
  'or',
];

/** Unresolved openings: pronouns with no antecedent in the clip. */
export const DANGLING_PRONOUNS = ['this', 'that', 'it', 'they', 'them', 'those', 'these', 'he', 'she'];

/** Viewer-directed language — makes a clip feel personal. */
export const SECOND_PERSON = ['you', 'your', 'youre', "you're", 'yourself', 'yours'];

/** Superlatives and absolutes. */
export const ABSOLUTES = [
  'best',
  'worst',
  'greatest',
  'biggest',
  'fastest',
  'easiest',
  'hardest',
  'only',
  'always',
  'never',
  'every',
  'everything',
  'nothing',
  'nobody',
  'everyone',
  'first',
  'last',
  'single',
];

/** List / step structure markers. */
export const LIST_MARKERS = [
  'first',
  'second',
  'third',
  'one',
  'two',
  'three',
  'four',
  'five',
  'step',
  'steps',
  'things',
  'ways',
  'reasons',
  'rules',
  'mistakes',
  'tips',
  'lessons',
  'principles',
];

/** Comment-bait angles, keyed by what the clip contains. */
export const CTA_TEMPLATES = {
  question: [
    'Answer this in the comments 👇',
    'What would you add? Drop it below.',
    'Comment your answer — best one gets pinned.',
  ],
  controversial: [
    'Do you agree or disagree? 👇',
    'Tell me I’m wrong in the comments.',
    'Drop a 🔥 if you agree, a 🤔 if you don’t.',
  ],
  list: [
    'Which one hits hardest? Comment 1, 2 or 3.',
    'Save this — you’ll want it later.',
    'Which one are you guilty of? Be honest 👇',
  ],
  story: [
    'Has this happened to you too? Comment below.',
    'Would you have done the same? 👇',
  ],
  keyword: [
    "Comment '{keyword}' and I'll send you the full breakdown.",
    "Want the template? Comment '{keyword}'.",
    "Comment '{keyword}' if you want the full version.",
  ],
} as const;

/** Fallback hashtags per niche (kept small; real keywords are appended). */
export const NICHE_HASHTAGS: Record<string, string[]> = {
  general: ['#shorts', '#learnontiktok', '#didyouknow'],
  education: ['#learnontiktok', '#studytok', '#explained'],
  business: ['#business', '#entrepreneur', '#smallbusiness'],
  finance: ['#moneytok', '#personalfinance', '#investing'],
  tech: ['#tech', '#ai', '#coding'],
  fitness: ['#fitnesstok', '#gymtok', '#healthylifestyle'],
  motivation: ['#motivation', '#mindset', '#selfimprovement'],
  comedy: ['#funny', '#comedy', '#relatable'],
};

/** Niche-flavored framing used by hook templates. */
export const NICHE_AUDIENCE: Record<string, string> = {
  general: 'most people',
  education: 'most people',
  business: 'most founders',
  finance: 'most people',
  tech: 'most developers',
  fitness: 'most people who train',
  motivation: 'most people',
  comedy: 'everyone',
};

/** B-roll visual vocabulary keyed by concept. */
export const VISUAL_MAP: Array<[RegExp, string]> = [
  [/\b(money|dollars|revenue|income|profit|salary|price|cost)\b/i, 'close-up of cash / a revenue graph'],
  [/\b(percent|%|number|data|study|research|results)\b/i, 'animated chart or stat card'],
  [/\b(sleep|tired|energy|morning)\b/i, 'bedroom b-roll, alarm clock, sunrise'],
  [/\b(gym|workout|training|lift|muscle)\b/i, 'gym b-roll, weights, training montage'],
  [/\b(code|coding|developer|software|app)\b/i, 'over-the-shoulder coding shot'],
  [/\b(ai|model|algorithm|chatgpt|automation)\b/i, 'screen recording of the tool in action'],
  [/\b(book|read|reading|learn)\b/i, 'book pages / library b-roll'],
  [/\b(phone|camera|video|content|tiktok|instagram)\b/i, 'phone screen recording, recording setup'],
  [/\b(office|meeting|team|hire|business)\b/i, 'office b-roll, laptop, whiteboard'],
  [/\b(food|eat|diet|protein|calories)\b/i, 'food prep shots, macro graphic'],
];

/** Stopwords for keyword extraction. */
export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just',
  'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  'yourselves', 'gonna', 'wanna', 'got', 'get', 'gets', 'like', 'really', 'actually', 'thing',
  'things', 'stuff', 'people', 'one', 'two', 'also', 'im', "i'm", 'youre', "you're", 'dont',
  "don't", 'didnt', "didn't", 'thats', "that's", 'lot', 'much', 'many', 'make', 'made',
  'going', 'go', 'went', 'say', 'said', 'know', 'think', 'want', 'need', 'see', 'look',
]);
