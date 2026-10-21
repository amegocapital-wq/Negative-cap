/** Screen 2 — the generated clips. */

import { useMemo, useState } from 'react';
import { clipsToMarkdown, formatTime } from '../core';
import { copyText, downloadFile, shareText } from '../lib/native';
import { useApp } from '../state/store';
import { ClipCard, ClipDetail } from './ClipViews';
import { Empty, Notice } from './components';
import { BoltIcon, DownloadIcon, FilmIcon, ShareIcon, SparkIcon, WandIcon } from './icons';

export function ClipsScreen() {
  const result = useApp((s) => s.result);
  const engineNotice = useApp((s) => s.engineNotice);
  const setTab = useApp((s) => s.setTab);
  const toast = useApp((s) => s.toast);
  const [openId, setOpenId] = useState<string | null>(null);

  const markdown = useMemo(() => (result ? clipsToMarkdown(result) : ''), [result]);
  const open = result?.clips.find((c) => c.id === openId) ?? null;

  if (!result || !result.clips.length) {
    return (
      <div className="screen">
        <Empty
          icon={<FilmIcon size={24} />}
          title="No clips yet"
          body="Paste a transcript on the Create tab and Hookline will pull out the moments that hold attention."
          action={
            <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setTab('create')}>
              <WandIcon size={16} /> Start with a transcript
            </button>
          }
        />
      </div>
    );
  }

  const average = Math.round(result.clips.reduce((sum, c) => sum + c.score.total, 0) / result.clips.length);
  const totalRuntime = result.clips.reduce((sum, c) => sum + c.duration, 0);

  const exportAll = async () => {
    const outcome = await shareText('Hookline clips', markdown);
    if (outcome === 'copied') toast('All clips copied as Markdown', 'success');
    if (outcome === 'failed') toast('Could not share', 'error');
  };

  return (
    <div className="screen">
      <div>
        <h1 className="page-title">Your clips</h1>
        <p className="page-sub">
          Ranked by hook strength, payoff and loopability. Tap a clip for the script, beat sheet and edit
          notes.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">This set</span>
          <span className={`badge ${result.engine === 'ai' ? 'badge-violet' : 'badge-lime'}`}>
            <BoltIcon size={11} /> {result.engine === 'ai' ? 'AI engine' : 'Offline engine'}
          </span>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <div className="stat-value">{result.clips.length}</div>
            <div className="stat-label">Clips</div>
          </div>
          <div className="stat">
            <div className="stat-value">{average}</div>
            <div className="stat-label">Avg score</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatTime(totalRuntime)}</div>
            <div className="stat-label">Cut total</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatTime(result.transcript.duration)}</div>
            <div className="stat-label">Source</div>
          </div>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button type="button" className="btn grow" onClick={exportAll}>
            <ShareIcon size={15} /> Export all
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Download Markdown"
            onClick={() => {
              downloadFile(`hookline-clips-${Date.now()}.md`, markdown);
              toast('Markdown exported', 'success');
            }}
          >
            <DownloadIcon size={16} />
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Copy all"
            onClick={async () => {
              const ok = await copyText(markdown);
              toast(ok ? 'Copied all clips' : 'Could not copy', ok ? 'success' : 'error');
            }}
          >
            <SparkIcon size={16} />
          </button>
        </div>
      </div>

      {engineNotice && <Notice>{engineNotice}</Notice>}

      <div className="clip-list">
        {result.clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} onOpen={() => setOpenId(clip.id)} />
        ))}
      </div>

      <button type="button" className="btn btn-ghost btn-block" onClick={() => setTab('create')}>
        <WandIcon size={15} /> Generate another set
      </button>

      {open && <ClipDetail clip={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
