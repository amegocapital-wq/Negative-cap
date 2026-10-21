/** Screen 3 — defaults, AI engine, data. */

import { useState } from 'react';
import {
  AI_PRESETS,
  LENGTH_PRESETS,
  NICHE_LABELS,
  SCORE_WEIGHTS,
  formatTime,
  testAiConnection,
} from '../core';
import type { ClipLength, Niche } from '../core';
import { isNative } from '../lib/native';
import { NICHE_ORDER, useApp } from '../state/store';
import { Notice, Stepper, Toggle } from './components';
import { BoltIcon, InfoIcon, SlidersIcon, SparkIcon, TrashIcon } from './icons';

export function SettingsScreen() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setAi = useApp((s) => s.setAi);
  const applyAiPreset = useApp((s) => s.applyAiPreset);
  const clearAll = useApp((s) => s.clearAll);
  const clearResult = useApp((s) => s.clearResult);
  const toast = useApp((s) => s.toast);
  const result = useApp((s) => s.result);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const message = await testAiConnection(settings.ai);
      setTestResult({ ok: true, message });
    } catch (error) {
      setTestResult({ ok: false, message: (error as Error).message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="screen">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Defaults for new clip sets, plus the optional AI hook writer.</p>
      </div>

      {/* Defaults ------------------------------------------------------ */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <SlidersIcon size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Defaults
          </span>
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
          <span className="field-hint">{LENGTH_PRESETS[settings.length].detail}</span>
        </div>

        <div className="row spread" style={{ marginBottom: 14 }}>
          <div>
            <div className="field-label">Clips per run</div>
            <div className="field-hint">Between 1 and 10</div>
          </div>
          <Stepper label="Clips per run" value={settings.count} min={1} max={10} onChange={(count) => setSettings({ count })} />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <span className="field-label">Handle</span>
          <input
            className="input"
            value={settings.handle}
            onChange={(e) => setSettings({ handle: e.target.value })}
            placeholder="@yourhandle"
            autoCapitalize="none"
            spellCheck={false}
          />
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
        </div>
      </div>

      {/* AI engine ----------------------------------------------------- */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <SparkIcon size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            AI engine
          </span>
          <Toggle
            label="Enable AI engine"
            checked={settings.ai.enabled}
            onChange={(enabled) => setAi({ enabled })}
          />
        </div>

        <p className="small muted" style={{ marginBottom: 12 }}>
          The offline engine runs on your phone and never sends anything anywhere. Turn this on to have a
          language model write sharper hooks instead — it gets the transcript and nothing else.
        </p>

        <div className="chips" style={{ marginBottom: 12 }}>
          {AI_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip"
              aria-pressed={settings.ai.baseUrl === preset.baseUrl}
              onClick={() => applyAiPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="line-list">
          <div className="field">
            <span className="field-label">Endpoint</span>
            <input
              className="input"
              value={settings.ai.baseUrl}
              onChange={(e) => setAi({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
            />
          </div>
          <div className="field">
            <span className="field-label">Model</span>
            <input
              className="input"
              value={settings.ai.model}
              onChange={(e) => setAi({ model: e.target.value })}
              placeholder="gpt-4o-mini"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="field">
            <span className="field-label">API key</span>
            <input
              className="input"
              type="password"
              value={settings.ai.apiKey}
              onChange={(e) => setAi({ apiKey: e.target.value })}
              placeholder="sk-…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <span className="field-hint">
              Stored only on this device (local storage). Not needed for a local Ollama endpoint.
            </span>
          </div>
        </div>

        <button type="button" className="btn btn-block btn-sm" style={{ marginTop: 12 }} onClick={test} disabled={testing}>
          {testing ? <span className="spinner spinner-light" /> : <BoltIcon size={14} />}
          {testing ? 'Testing…' : 'Test connection'}
        </button>

        {testResult && (
          <div style={{ marginTop: 10 }}>
            <Notice tone={testResult.ok ? 'warn' : 'error'}>{testResult.message}</Notice>
          </div>
        )}

        {settings.ai.enabled && !settings.ai.apiKey && /openai|openrouter|groq/.test(settings.ai.baseUrl) && (
          <div style={{ marginTop: 10 }}>
            <Notice tone="error">This provider needs an API key. Without one the app falls back to the offline engine.</Notice>
          </div>
        )}
      </div>

      {/* Scoring ------------------------------------------------------- */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <InfoIcon size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            How clips are chosen
          </span>
        </div>
        <p className="small muted" style={{ marginBottom: 10 }}>
          Every sentence window is scored on seven signals. The weighted total decides the ranking, then
          overlapping clips are removed so you never get the same moment twice.
        </p>
        <div className="bars">
          {Object.entries(SCORE_WEIGHTS).map(([key, weight]) => (
            <div className="bar-row" key={key}>
              <span style={{ textTransform: 'capitalize' }}>{key}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${weight * 100 * 3}%` }} />
              </span>
              <span className="mono" style={{ textAlign: 'right' }}>
                {Math.round(weight * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data ---------------------------------------------------------- */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <TrashIcon size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Data
          </span>
        </div>
        <div className="small muted" style={{ marginBottom: 12 }}>
          {result
            ? `${result.clips.length} clips from a ${formatTime(result.transcript.duration)} transcript, generated ${new Date(result.createdAt).toLocaleDateString()}.`
            : 'No clip set stored.'}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn grow" onClick={clearResult} disabled={!result}>
            Delete clips
          </button>
          <button
            type="button"
            className="btn grow"
            style={{ color: 'var(--danger)', borderColor: 'rgba(255,93,93,0.3)' }}
            onClick={() => {
              clearAll();
              toast('Everything cleared', 'success');
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="tiny dim" style={{ textAlign: 'center', padding: '4px 0 8px' }}>
        Hookline v1.0 · offline-first · {isNative() ? 'Android app' : 'web preview'}
      </div>
    </div>
  );
}
