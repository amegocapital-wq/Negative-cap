# Extending Hookline

A guide to the changes you'll most likely want, ordered from "one line" to "new module". Every change
ends with the same three commands:

```bash
npm run engine:check   # did I break an invariant?
npm run dev            # look at it
npm run build          # typecheck + bundle (also what CI does before the APK)
```

The engine is pure TypeScript with no DOM access, so `engine:check` runs it in Node in under a second.
Add a case to `tools/engine-check.ts` whenever you change behaviour — that file is the contract.

---

## 1. Change what counts as a hook

**`src/core/lexicon.ts`** — plain word lists. No logic, safe to edit.

```ts
export const CURIOSITY = ['why', 'how', 'secret', /* add: */ 'nobody warned me', 'plot twist'];
export const CONTRARIAN = ['most people', /* add: */ 'hot take', 'unpopular opinion'];
export const STAKES = ['money', 'revenue', /* add: */ 'runway', 'churn'];
```

Then change how strongly a match counts in **`src/core/scoring.ts`**:

```ts
score += DIMINISH(countMatches(t, CURIOSITY), 9, 22);   // per hit, capped
```

`DIMINISH(hits, pointsPerHit, cap)` — raise `pointsPerHit` to make that signal matter more.

> Rule of thumb: add words to the lexicon first, only touch `scoring.ts` if the ranking still feels off.

## 2. Change how hooks are worded

**`src/core/hooks.ts`**

- `topicFrames()` — the "Nobody talks about this side of X" style templates.
- `questionHook()` — turns a flat statement into a question. Only fires on patterns that stay
  grammatical; extend the `match()` branches to cover your niche's phrasing.
- `revealHook()` — payoff-first opening ("The real answer: …").
- `CTA_TEMPLATES` (in `lexicon.ts`) — comment-bait lines per clip type.
- `buildHooks()` — add a candidate source here; the list is scored and ranked, so more candidates is
  always safe.

## 3. Change the ranking formula

**`src/core/engine.ts`**

```ts
export const SCORE_WEIGHTS = { hook: 0.28, payoff: 0.18, /* … */ };   // must sum to 1
```

- `durationFactor` in `buildCandidates` — how hard clips are punished for missing the ideal length.
- `pauseBonus` — the reward for starting right after a silence.
- `selectCandidates` — overlap tolerance (`+ 1.2` seconds) and the topic-diversity threshold (`0.55`).

After changing weights, run `npm run engine:check` and compare the printed top clip.

## 4. Change clip lengths

**`src/core/engine.ts` → `LENGTH_PRESETS`**

```ts
short: { min: 14, max: 26, ideal: 20, label: 'Punchy', detail: '15–25s · loops & one-liners' }
```

`min`/`max` gate the candidate windows, `ideal` drives duration fitness. Add a fourth preset
(`'micro'`) and it appears in the UI automatically — the length chips iterate over the presets object.
Update the `ClipLength` union in `src/core/types.ts` too.

## 5. Support another transcript format

**`src/core/transcript.ts`**

1. Add the format to `ParsedTranscript['format']` in `types.ts`.
2. Teach `detectFormat()` to recognise it.
3. Write a `parseX()` that returns `Cue[]` (`{ start, end, text }`) — `normaliseCues` handles gaps and
   duplicate rolling captions for you.
4. Return the cues through `sentencesFromCues()` in `parseTranscript()`.
5. Add a fixture and assertion to `tools/engine-check.ts`.

Formats worth adding: YouTube's `"0:12 some words"` export is already covered; Whisper JSON is a
10-line adapter (`segments[].start/end/text`).

## 6. Pull the transcript from a YouTube URL

The phone cannot scrape YouTube directly (CORS + consent walls), and doing it inside the app breaks
terms quickly. The clean version is a tiny proxy you host:

```
GET /transcript?url=https://youtube.com/watch?v=…
→ { title, segments: [{ start, end, text }] }
```

Then in `src/state/store.ts`, before `parseTranscript`, fetch that endpoint with the URL the user
pasted, and feed `segments` into `parseTranscript` as `"0:12 text"` lines (or straight into a new
`parseSegments()`). The UI only needs an extra "From URL" button in `CreateScreen.tsx` that calls a new
`generateFromUrl()` action. Keep the proxy behind a key you control, or self-host it.

## 7. Use a different AI provider

**`src/core/ai.ts`**

- `AI_PRESETS` — add an entry (`baseUrl`, `model`, `note`); it shows up as a chip in Settings.
- The request is a standard `/chat/completions` call. Non-OpenAI shapes (Anthropic, Gemini) need a
  small adapter around `requestAiClips` — everything downstream consumes `Clip` objects and is
  provider-agnostic.
- `SYSTEM_PROMPT` is where the clip *style* lives. Tighten it here, not in code.
- Hardening: `mergeAiClips()` validates ranges and fills missing fields from the local engine, so a
  flaky model degrades instead of breaking.

## 8. Add a screen

1. Create `src/ui/NewScreen.tsx` exporting a component.
2. Add an id to `Tab` in `src/state/store.ts`.
3. Render it in `src/App.tsx` and add an entry to `NAV` (icon import from `src/ui/icons.tsx`).
4. Compose from the existing primitives in `src/ui/components.tsx` (`ScoreRing`, `Bar`, `Toggle`,
   `Stepper`, `Notice`, `Empty`) so styling stays consistent.

## 9. Change the look

`src/ui/styles.css` is one file, organised top-down:

```
:root variables  →  layout  →  header  →  cards  →  controls  →  badges
→  clip card  →  detail sheet  →  nav  →  toasts  →  states
```

The whole theme hangs off these tokens:

```css
--bg:#07070b; --surface:#12121a; --text:#f4f4f7;
--lime:#c8ff4d;      /* accent — primary actions, scores, hooks */
--violet:#8b6bff;    /* secondary — hashtags, body beats */
--pink:#ff3d7f;      /* payoff highlights */
```

Change `--lime` and the entire app re-themes. The logo/splash art is generated from
`tools/make-icons.sh` — edit `ACCENT`, `ACCENT_2`, `GLYPH` at the top and rerun
`bash tools/make-icons.sh`.

## 10. Add a new field to a clip

1. Add it to `Clip` in `src/core/types.ts`.
2. Fill it in `makeClip()` (`src/core/engine.ts`).
3. Render it in `src/ui/ClipViews.tsx` (`ClipDetail`) and, if it should be in the export, in
   `clipToScript()` / `clipsToMarkdown()`.
4. Saved clip sets are versioned by the `version` field in the zustand `persist` options — bump it if
   the shape changes in a breaking way (a merge function keeps old saves working).

---

## Testing without a phone

```bash
npm run engine:check             # fast, deterministic
npx esbuild <scratch>.ts --bundle --platform=node --format=esm --outfile=/tmp/x.mjs && node /tmp/x.mjs
```

Print a clip set and eyeball it:

```ts
import { generateClips, parseTranscript } from './src/core';
import { SAMPLE_TRANSCRIPT } from './src/data/sample';

const t = parseTranscript(SAMPLE_TRANSCRIPT);
const { clips } = generateClips(t, {
  niche: 'business', length: 'medium', count: 5, handle: '@me', ctaKeyword: 'PLAYBOOK',
});
console.table(clips.map((c) => ({ score: c.score.total, hook: c.hook, cta: c.cta })));
```

## Invariants the engine must keep

`engine:check` enforces these — don't relax them without a reason:

- no clip without a hook or payoff
- no clip past the end of the transcript or shorter than ~5s
- no two clips covering the same seconds
- ranking sorted descending by score
- hour/minute/second formatting never renders `NaN`
- the same input always yields the same output (deterministic)
