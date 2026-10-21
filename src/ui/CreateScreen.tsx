/** Screen 1 — paste a transcript and set the brief. */

import { useEffect, useMemo, useState } from 'react';
import { LENGTH_PRESETS, NICHE_LABELS, formatTime, parseTranscript } from '../core';
import type { ClipLength, Niche } from '../core';
import { SAMPLE_TRANSCRIPT } from '../data/sample';
import { readClipboard } from '../lib/native';
import { NICHE_ORDER, useApp } from '../state/store';
import { Notice, Stepper } from './components';
import { BoltIcon, ChevronRightIcon, InfoIcon, SparkIcon, TrashIcon, WandIcon } from './icons';

const FORMAT_LABEL: Record<string, string> = {
  srt: 'SRT',
  vtt: 'WebVTT',
  'timestamped-text': 'Timestamped',
  'plain-text': 'Plain text',
};

function useDebounced<T>(value: T, delay = 320): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CreateScreen() {
  const transcriptText = useApp((s) => s.transcriptText);
  const setTranscript = useApp((s) => s.setTranscript);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const generate = useApp((s) => s.generate);
  const generating = useApp((s) => s.generating);
  const toast = useApp((s) => s.toast);
  const result = useApp((s) => s.result);

  const [advanced, setAdvanced] = useState(false);
  const [help, setHelp] = useState(false);
  const debouncedText = useDebounced(transcriptText, 400);

  const parsed = useMemo(
    () => (debouncedText.trim().length > 20 ? parseTranscript(debouncedText) : null),
    [debouncedText]
  );

  const wordCount = transcriptText.trim() ? transcriptText.trim().split(/\s+/).length : 0;
  const canGenerate = transcriptText.trim().length > 40 && !generating;

  const paste = async () => {
    const text = await readClipboard();
    if (!text) {
      toast('Clipboard is empty or blocked — long-press the box to paste.', 'error');
      return;
    }
    setTranscript(text);
    toast('Transcript pasted', 'success');
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">H</div>
          <div>
            <div className="brand-name">Hookline</div>
            <div className="brand-tag">long-form → shorts</div>
          </div>
        </div>
        <span className="badge badge-lime">
          <BoltIcon size={11} /> {settings.ai.enabled ? 'AI engine' : 'Offline engine'}
        </span>
      </header>

      <div>
        <h1 className="page-title">
          Long video in.
          <br />
          Shorts that hold.
        </h1>
        <p className="page-sub">
          Paste a transcript. Hookline finds the strongest moments, writes the hook, the beat sheet and
          the comment bait — so people watch to the end.
        </p>
      </div>

      {/* Transcript ---------------------------------------------------- */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Transcript</span>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={paste}>
              Paste
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setTranscript(SAMPLE_TRANSCRIPT);
                toast('Sample transcript loaded', 'info');
              }}
            >
              Sample
            </button>
            {transcriptText && (
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Clear transcript"
                onClick={() => setTranscript('')}
              >
                <TrashIcon size={14} />
              </button>
            )}
          </div>
        </div>

        <textarea
          className="textarea"
          value={transcriptText}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={
            'Paste SRT, VTT, timestamped captions, or a plain YouTube transcript…\n\n0:00 So there is one thing about money nobody explains to you.\n0:06 Everyone thinks you need more income. That is not the problem.'
          }
          spellCheck={false}
          autoCapitalize="sentences"
        />

        <div className="row spread" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <span className="tiny dim mono">
            {wordCount.toLocaleString()} words
            {parsed ? ` · ~${formatTime(parsed.duration)}` : ''}
          </span>
          <div className="row" style={{ gap: 6 }}>
            {parsed && <span className="badge">{FORMAT_LABEL[parsed.format] ?? parsed.format}</span>}
            {parsed && (
              <span className={`badge ${parsed.hasTiming ? 'badge-lime' : 'badge-amber'}`}>
                {parsed.hasTiming ? 'Real timings' : 'Estimated timings'}
              </span>
            )}
          </div>
        </div>

        {parsed && !parsed.hasTiming && parsed.sentences.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Notice>
              No timestamps in this transcript. Clip cut points are estimated at ~155 wpm — confirm them
              in your editor. SRT or VTT gives exact cuts.
            </Notice>
          </div>
        )}
      </div>

      {/* Where do I get a transcript ----------------------------------- */}
      <div className="card card-tight">
        <button
          type="button"
          className="row spread"
          style={{ width: '100%' }}
          onClick={() => setHelp((v) => !v)}
        >
          <span className="row" style={{ gap: 8 }}>
            <InfoIcon size={15} style={{ color: 'var(--muted)' }} />
            <span className="small" style={{ fontWeight: 600 }}>
              Where do I get a transcript?
            </span>
          </span>
          <ChevronRightIcon
            size={16}
            style={{ color: 'var(--muted)', transform: help ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
          />
        </button>

        {help && (
          <div className="line-list" style={{ marginTop: 12 }}>
            <div className="small muted">
              <strong style={{ color: 'var(--text)' }}>YouTube:</strong> open the video → “…” under the
              title → <em>Show transcript</em> → tap the ⋮ in that panel → toggle timestamps on → copy
              and paste above.
            </div>
            <div className="small muted">
              <strong style={{ color: 'var(--text)' }}>From your editor:</strong> export subtitles from
              Premiere / CapCut / Descript as <span className="kbd">.srt</span> or{' '}
              <span className="kbd">.vtt</span>, open the file in any text editor and paste it. Those
              carry real timings, so cut points are exact.
            </div>
            <div className="small muted">
              <strong style={{ color: 'var(--text)' }}>No transcript?</strong> Paste your script or
              rough notes — Hookline estimates timings at 155 wpm and tells you to confirm the cuts.
            </div>
          </div>
        )}
      </div>

      {/* Brief --------------------------------------------------------- */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">The brief</span>
          <span className="tiny dim">Shapes the hooks</span>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <span className="field-label">Niche</span>
          <div className="chips">
            {NICHE_ORDER.map((niche) => (
              <button
                key={niche}
                type="button"
                className="chip"
                aria-pressed={settings.niche === niche}
                onClick={() => setSettings({ niche: niche as Niche })}
              >
                {NICHE_LABELS[niche]}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <span className="field-label">Clip length</span>
          <div className="segmented">
            {(Object.keys(LENGTH_PRESETS) as ClipLength[]).map((length) => (
              <button
                key={length}
                type="button"
                aria-pressed={settings.length === length}
                onClick={() => setSettings({ length })}
              >
                {LENGTH_PRESETS[length].label}
              </button>
            ))}
          </div>
          <span className="field-hint">
            {LENGTH_PRESETS[settings.length].detail} · sweet spot {LENGTH_PRESETS[settings.length].ideal}s
          </span>
        </div>

        <div className="row spread">
          <div>
            <div className="field-label">How many clips</div>
            <div className="field-hint">Best ones are picked first</div>
          </div>
          <Stepper
            label="Number of clips"
            value={settings.count}
            min={1}
            max={10}
            onChange={(count) => setSettings({ count })}
          />
        </div>

        <div className="divider" style={{ margin: '14px 0' }} />

        <button
          type="button"
          className="row spread"
          style={{ width: '100%', padding: 0, color: 'var(--muted)' }}
          onClick={() => setAdvanced((v) => !v)}
        >
          <span className="field-label" style={{ margin: 0 }}>
            Creator details {advanced ? '' : '(optional)'}
          </span>
          <ChevronRightIcon
            size={16}
            style={{ transform: advanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
          />
        </button>

        {advanced && (
          <div className="line-list" style={{ marginTop: 12 }}>
            <div className="field">
              <span className="field-label">Handle</span>
              <input
                className="input"
                value={settings.handle}
                onChange={(e) => setSettings({ handle: e.target.value })}
                placeholder="@yourhandle"
                autoCapitalize="none"
                spellCheck={false}
              />
              <span className="field-hint">Added as a hashtag to every caption.</span>
            </div>
            <div className="field">
              <span className="field-label">Comment keyword</span>
              <input
                className="input"
                value={settings.ctaKeyword}
                onChange={(e) => setSettings({ ctaKeyword: e.target.value.toUpperCase() })}
                placeholder="PLAYBOOK"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <span className="field-hint">
                The word you ask viewers to comment to get the full breakdown. Leave empty for generic CTAs.
              </span>
            </div>
          </div>
        )}
      </div>

      {result && (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => useApp.getState().setTab('clips')}
        >
          <SparkIcon size={15} /> View your {result.clips.length} existing clips
        </button>
      )}

      <div className="sticky-cta">
        <button type="button" className="btn btn-primary btn-block" onClick={() => void generate()} disabled={!canGenerate}>
          {generating ? (
            <>
              <span className="spinner" /> Cutting clips…
            </>
          ) : (
            <>
              <WandIcon size={17} /> Generate clips
            </>
          )}
        </button>
        <div className="tiny dim" style={{ textAlign: 'center', marginTop: 8 }}>
          Works offline. Transcripts never leave your device unless you turn on the AI engine.
        </div>
      </div>
    </div>
  );
}
