/** Clip list card + full clip breakdown sheet. */

import { useEffect, useMemo } from 'react';
import { clipToScript, formatTime, scoreLabel } from '../core';
import type { Clip } from '../core';
import { copyText, shareText } from '../lib/native';
import { useApp } from '../state/store';
import { Bar, ScoreRing, SectionHeader } from './components';
import { BoltIcon, CloseIcon, CopyIcon, ShareIcon, TargetIcon } from './icons';

const DIMENSION_LABELS: Array<[keyof Clip['score'], string]> = [
  ['hook', 'Hook'],
  ['payoff', 'Payoff'],
  ['clarity', 'Clarity'],
  ['energy', 'Energy'],
  ['emotion', 'Emotion'],
  ['structure', 'Structure'],
  ['loop', 'Loop'],
];

export function ClipCard({ clip, onOpen }: { clip: Clip; onOpen: () => void }) {
  return (
    <button type="button" className="clip-card" onClick={onOpen}>
      <div className="clip-card-top">
        <ScoreRing score={clip.score.total} />
        <div className="grow">
          <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="badge badge-lime">#{clip.rank}</span>
            <span className="badge">{scoreLabel(clip.score.total)}</span>
            <span className="badge mono">
              {formatTime(clip.start)}–{formatTime(clip.end)}
            </span>
            <span className="badge">{Math.round(clip.duration)}s</span>
          </div>
          <div className="clip-hook">{clip.hook}</div>
        </div>
      </div>
      <div className="clip-meta">
        <span className="badge badge-violet">
          <TargetIcon size={11} /> {clip.cta.length > 42 ? `${clip.cta.slice(0, 42)}…` : clip.cta}
        </span>
        <span className="badge">{clip.hashtags.slice(0, 3).join(' ')}</span>
      </div>
    </button>
  );
}

export function ClipDetail({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const toast = useApp((s) => s.toast);
  const replaceClipHook = useApp((s) => s.replaceClipHook);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const script = useMemo(() => clipToScript(clip), [clip]);
  const relative = (index: number) => {
    const sentence = clip.source[index];
    return sentence ? Math.max(0, sentence.start - clip.start) : 0;
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    toast(ok ? `${label} copied` : 'Could not copy', ok ? 'success' : 'error');
  };

  const share = async () => {
    const outcome = await shareText(`Clip ${clip.rank}: ${clip.title}`, script);
    if (outcome === 'copied') toast('Script copied to clipboard', 'success');
    if (outcome === 'failed') toast('Could not share', 'error');
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`Clip ${clip.rank}`}>
      <div className="sheet-inner">
        <div className="sheet-head">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <CloseIcon size={15} /> Close
          </button>
          <div className="row" style={{ gap: 6 }}>
            <span className="badge mono">
              {formatTime(clip.start)}–{formatTime(clip.end)}
            </span>
            <span className="badge badge-lime">#{clip.rank}</span>
          </div>
        </div>

        <div>
          <div className="row spread" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <h2 className="page-title" style={{ fontSize: 21 }}>
                {clip.title}
              </h2>
              <div className="small muted" style={{ marginTop: 4 }}>
                {Math.round(clip.duration)}s · {Math.round(clip.wpm)} wpm · score {clip.score.total} (
                {scoreLabel(clip.score.total)})
              </div>
            </div>
            <ScoreRing score={clip.score.total} size={62} />
          </div>
        </div>

        {/* Hook ---------------------------------------------------------- */}
        <div className="section">
          <SectionHeader
            title="Hook · first 2 seconds"
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(clip.hook, 'Hook')}>
                <CopyIcon size={13} /> Copy
              </button>
            }
          />
          <div className="hook-box">{clip.hook}</div>
          {clip.hooks.length > 1 && (
            <>
              <div className="tiny dim">Swap in an alternative — tap to make it the hook.</div>
              <div className="line-list">
                {clip.hooks
                  .filter((h) => h !== clip.hook)
                  .map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      className="alt-hook"
                      onClick={() => {
                        replaceClipHook(clip.id, alt);
                        toast('Hook swapped', 'success');
                      }}
                    >
                      <BoltIcon size={14} style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--lime)' }} />
                      <span>{alt}</span>
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>

        {/* Beats ---------------------------------------------------------- */}
        <div className="section">
          <SectionHeader title="On-screen beat sheet" />
          <div className="card card-tight">
            {clip.beats.map((beat, i) => (
              <div className="beat" key={`${beat.kind}-${i}`}>
                <span className="mono tiny dim" style={{ minWidth: 38 }}>
                  {formatTime(beat.at)}
                </span>
                <span className={`beat-kind beat-${beat.kind}`}>{beat.kind}</span>
                <span className="grow">{beat.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Script -------------------------------------------------------- */}
        <div className="section">
          <SectionHeader
            title="Script"
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(script, 'Script')}>
                <CopyIcon size={13} /> Copy all
              </button>
            }
          />
          <div className="line-list">
            {clip.source.map((sentence, i) => (
              <div className="body-line" key={sentence.id}>
                <span className="body-time">{formatTime(relative(i))}</span>
                <span>{i === 0 ? clip.source[0].text : sentence.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payoff -------------------------------------------------------- */}
        <div className="section">
          <SectionHeader title="Payoff · land it before the loop" />
          <div className="quote">{clip.payoff}</div>
        </div>

        {/* Caption ------------------------------------------------------- */}
        <div className="section">
          <SectionHeader
            title="Caption + hashtags"
            action={
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => copy(`${clip.caption}\n\n${clip.hashtags.join(' ')}`, 'Caption')}
              >
                <CopyIcon size={13} /> Copy
              </button>
            }
          />
          <div className="caption-box">{clip.caption}</div>
          <div className="tag-list">
            {clip.hashtags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* CTA ----------------------------------------------------------- */}
        <div className="section">
          <SectionHeader title="Comment bait" />
          <div className="line-list">
            {clip.ctas.map((cta) => (
              <button key={cta} type="button" className="alt-hook" onClick={() => copy(cta, 'CTA')}>
                <span className="grow">{cta}</span>
                <CopyIcon size={13} style={{ color: 'var(--muted-dim)', flex: '0 0 auto', marginTop: 2 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Why ----------------------------------------------------------- */}
        <div className="section">
          <SectionHeader title="Why this should retain" />
          <ul className="bullets">
            {clip.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>

        {/* Edit notes ---------------------------------------------------- */}
        <div className="section">
          <SectionHeader title="Edit notes" />
          <ul className="bullets muted-dots">
            {clip.editNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        {/* Visuals ------------------------------------------------------- */}
        <div className="section">
          <SectionHeader title="B-roll & visuals" />
          <div className="tag-list">
            {clip.visuals.map((visual) => (
              <span className="tag" key={visual}>
                {visual}
              </span>
            ))}
          </div>
        </div>

        {/* Scores -------------------------------------------------------- */}
        <div className="section">
          <SectionHeader title="Score breakdown" />
          <div className="card card-tight bars">
            {DIMENSION_LABELS.map(([key, label]) => (
              <Bar key={key} label={label} value={clip.score[key] as number} />
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-primary grow" onClick={share}>
            <ShareIcon size={16} /> Share script
          </button>
          <button type="button" className="btn grow" onClick={() => copy(script, 'Script')}>
            <CopyIcon size={16} /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}
