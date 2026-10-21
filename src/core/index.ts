/**
 * Public surface of the clip engine.
 *
 * UI code should import from `@core` only, never from individual modules — that
 * keeps the internals free to change as the app grows.
 */

export * from './types';
export { parseTranscript, formatTime, splitSentences, DEFAULT_WPM } from './transcript';
export {
  generateClips,
  clipFromRange,
  clipToScript,
  clipsToMarkdown,
  scoreDensity,
  optionsFromSettings,
  recomputeTotal,
  LENGTH_PRESETS,
  SCORE_WEIGHTS,
  scoreLabel,
} from './engine';
export {
  requestAiClips,
  testAiConnection,
  mergeAiClips,
  extractJson,
  buildUserPrompt,
  AiError,
  AI_PRESETS,
  DEFAULT_AI,
  NICHE_LABELS,
} from './ai';
export {
  scoreHook,
  scorePayoff,
  scoreClarity,
  scoreEnergy,
  scoreEmotion,
  scoreStructure,
  scoreLoop,
  extractKeywords,
  extractTopic,
  similarity,
} from './scoring';
export { buildHooks, buildCtas, buildHashtags, buildCaption, cleanOpener, stripFillers } from './hooks';
