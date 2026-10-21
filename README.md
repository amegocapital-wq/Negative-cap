# Hookline

**Turn a long-form video transcript into short-form clips built to be watched to the end — and to get commented on.**

Hookline reads a transcript (SRT, WebVTT, timestamped captions or a plain YouTube transcript), finds the
moments most likely to hold attention, and returns ready-to-shoot shorts:

- **Hook** — the first 2 seconds, with 3 alternative lines you can swap in
- **Body** — the single idea, quoted from the speaker
- **Payoff** — the line that closes the loop so the clip replays cleanly
- **Comment bait** — CTAs that fit the content (opinion, list, story, or a keyword people comment)
- **Beat sheet** — timed on-screen text cards
- **Edit notes** — where to cut, when to punch in, what b-roll to add
- **Score** — 0–100 retention score with the seven signals that produced it

Runs entirely on the phone (no API key, no upload). Optionally point it at any OpenAI-compatible model
to write sharper hooks.

---

## Get the app

Hookline is a **self-contained app**. The same build ships three ways — pick whichever is easiest for
you. None of them needs an account, a server, or a network connection to run.

### 1. Single file — no install, works anywhere

`standalone/Hookline.html` is the whole app in **one 244 kB file** with the JS and CSS inlined. Zero
external requests.

- Copy it to your phone (download, USB, email, chat app — anything).
- Open it with a browser → it runs. Data is saved in that browser on the device.
- **Add to Home Screen** (Chrome ⋯ menu / Safari share sheet) and it launches full-screen like a
  native app, icon and all.
- It also works from a plain static host, a USB stick, or `file://` — nothing else required.

Serve it locally with no dependencies at all:

```bash
node standalone/serve.mjs        # → http://localhost:5173
PORT=8080 node standalone/serve.mjs
```

### 2. Android APK (native shell, installs like any app)

Built by the workflow included in this repo (`.github/workflows/build-apk.yml`): **Actions → Build APK
→ Run workflow**, then download the `Hookline-APK` artifact. Or build it yourself:

```bash
npm ci
npm run android:apk     # → android/app/build/outputs/apk/debug/app-debug.apk
```

Then copy the APK to your phone, tap it, and allow *install unknown apps* when Android asks.

Pushing a tag (`v1.0.2`) publishes the APK to **Releases** automatically, and the workflow supports a
signed release build — see [Signing](#signing).

> Updating a sideloaded APK: CI machines generate a fresh debug key each run, so a newer build may
> refuse to install over an older one. Uninstall first, or add a signing key once ([Signing](#signing))
> and updates apply in place.

### 3. Web build

```bash
npm ci
npm run dev               # dev server with hot reload → http://localhost:5173
npm run build             # production bundle → dist/
npm run build:standalone  # single-file build → standalone/Hookline.html
```

## Build the APK locally

Prerequisites: Node 22.19+ (the test tooling needs it), JDK 17, Android SDK (or just Android Studio).

```bash
npm install
npm run android:apk   # build web → cap sync → gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Or open the `android/` folder in Android Studio and press Run.

---

## How it works

```
transcript ─► parse (SRT / VTT / timestamps / plain)
          ─► sentences with timings
          ─► every sentence window inside the length budget
          ─► 7 signal scores ──► weighted total
          ─► greedy, non-overlapping, de-duplicated selection
          ─► hook + beats + caption + CTA + edit notes per clip
```

The seven signals (weights in `src/core/engine.ts` → `SCORE_WEIGHTS`):

| Signal | What it measures | Weight |
| --- | --- | --- |
| Hook | first-line curiosity gap, specificity, brevity | 28% |
| Payoff | does the clip resolve itself | 18% |
| Clarity | understandable with zero context, little filler | 14% |
| Energy | pace, emotional words, density | 12% |
| Emotion | charge / stakes | 10% |
| Structure | question, list, number, contrast | 10% |
| Loop | closing line + echo back to the hook | 8% |

A clip shortens its own duration fitness if it drifts from the preset's sweet spot, and gets a small
bonus for starting right after a pause in the source audio (a natural cut point).

Everything is deterministic: the same transcript and settings always produce the same clips, which
makes tuning safe.

## Project layout

```
src/
  core/                 ← the engine. No React, no DOM, fully testable in Node
    types.ts            all shared types
    lexicon.ts          hook/emotion/stake/CTA vocabulary  ← main tuning surface
    transcript.ts       SRT / VTT / timestamped / plain-text parsing
    scoring.ts          feature extraction + the 7 scores
    hooks.ts            hook writing, CTAs, captions, hashtags
    engine.ts           candidate windows, ranking, clip assembly
    ai.ts               optional OpenAI-compatible engine
    index.ts            public surface (import from here)
  ui/                   screens + design system (styles.css)
  state/store.ts        zustand store, persisted to localStorage
  lib/native.ts         clipboard / share / download wrappers
  data/sample.ts        demo transcript
tools/
  engine-check.ts       headless engine tests (npm run engine:check)
  ui-smoke.tsx          renders the real app in jsdom (npm run ui:smoke)
  standalone-check.mjs  boots the single-file build and drives the UI
  make-icons.sh         regenerates the Android icon + splash art
standalone/
  Hookline.html         ← the whole app in one file (generated, committed)
  serve.mjs             zero-dependency static server
android/                committed Capacitor Android project
docs/EXTENDING.md       ← how to change things (start here)
```

## Quality gate

```bash
npm run check          # engine + UI checks (what CI runs)
npm run build          # typecheck + production bundle
```

- `npm run engine:check` — parsing, scoring and selection invariants plus determinism. It fails if any
  clip is missing a hook, overlaps another, runs past the transcript, or if ranking is not descending.
- `npm run ui:smoke` — renders the real app in jsdom, generates a set, opens a clip, swaps a hook and
  forces an AI-provider failure to prove the fallback works. Catches blank screens in about a second.
- `npm run standalone:check` — loads `standalone/Hookline.html` with **scripts enabled and no network**,
  then drives the real UI (sample → generate → open a clip). This is the exact file that ships, so a
  pass means the app genuinely boots.

CI runs both before every APK build.

## Signing

Debug APKs install fine but Play Store (and consistent updates) need your own key. Add these repository
secrets and the same workflow produces a signed release build:

| Secret | Value |
| --- | --- |
| `KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias |
| `KEY_PASSWORD` | key password |

```bash
keytool -genkey -v -keystore release.keystore -alias hookline \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore    # paste into the KEYSTORE_BASE64 secret
```

## Privacy

The offline engine never leaves the device. Transcripts, clips and settings are stored in the app's
local storage only. If you enable the AI engine, the transcript is sent to the endpoint *you* configure,
with *your* key — nothing passes through any Hookline server (there isn't one).

## Roadmap / next steps

The structure is set up so each of these is a localised change (see `docs/EXTENDING.md`):

- Pull the transcript straight from a YouTube URL (needs a proxy — see the doc)
- Frame-accurate preview player for each clip
- Auto-caption burning / FCPXML or Premiere XML export
- Better hook scoring from your own posted-clip performance data
- Multi-language transcripts

Built with React + TypeScript + Vite, wrapped by Capacitor.
