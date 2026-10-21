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

## Get the app (Android)

The APK is built by GitHub Actions:

1. Open **Actions → Build APK → Run workflow** (branch: `main`).
2. When it finishes, download the **Hookline-APK** artifact.
3. Copy it to your phone and open it. Allow *install unknown apps* when prompted.

Every push to `main` also builds an APK, and pushing a tag like `v1.0.0` publishes it as a GitHub
Release (`/releases`). See [Signing](#signing) for a release-key build.

## Run it in a browser

```bash
npm install
npm run dev          # http://localhost:5173
```

The web version is the same app (Capacitor wraps it for Android), handy for quick checks while editing.

## Build the APK locally

Prerequisites: Node 20+, JDK 17, Android SDK (or just Android Studio).

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
  make-icons.sh         regenerates the Android icon + splash art
android/                committed Capacitor Android project
docs/EXTENDING.md       ← how to change things (start here)
```

## Quality gate

```bash
npm run engine:check   # parsing, scoring, selection invariants, determinism
npm run build          # typecheck + production bundle
```

`engine:check` is deliberately assertive: it fails if any clip is missing a hook, overlaps another,
runs past the transcript, or if ranking is not descending. CI runs it before every APK build.

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
