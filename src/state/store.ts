/**
 * Global app state (zustand + localStorage persistence).
 *
 * Everything the user types survives an app restart. Screen components read
 * from here and call actions; they never touch the engine directly.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AI_PRESETS,
  DEFAULT_AI,
  optionsFromSettings,
  parseTranscript,
  requestAiClips,
  AiError,
  generateClips,
} from '../core';
import type { AiConfig, Clip, ClipResult, Niche, Settings } from '../core';

export type Tab = 'create' | 'clips' | 'settings';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface AppState {
  transcriptText: string;
  settings: Settings;
  result: ClipResult | null;
  tab: Tab;
  generating: boolean;
  engineNotice: string | null;
  toasts: Toast[];
  lastOptionsKey: string | null;

  setTranscript: (text: string) => void;
  setTab: (tab: Tab) => void;
  setSettings: (partial: Partial<Settings>) => void;
  setAi: (partial: Partial<AiConfig>) => void;
  applyAiPreset: (id: string) => void;
  generate: () => Promise<void>;
  replaceClipHook: (clipId: string, hook: string) => void;
  clearResult: () => void;
  clearAll: () => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  niche: 'business',
  length: 'medium',
  count: 5,
  handle: '@yourhandle',
  ctaKeyword: 'PLAYBOOK',
  ai: DEFAULT_AI,
};

let toastId = 0;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      transcriptText: '',
      settings: DEFAULT_SETTINGS,
      result: null,
      tab: 'create',
      generating: false,
      engineNotice: null,
      toasts: [],
      lastOptionsKey: null,

      setTranscript: (text) => set({ transcriptText: text }),
      setTab: (tab) => set({ tab }),

      setSettings: (partial) => set({ settings: { ...get().settings, ...partial } }),
      setAi: (partial) =>
        set({ settings: { ...get().settings, ai: { ...get().settings.ai, ...partial } } }),

      applyAiPreset: (id) => {
        const preset = AI_PRESETS.find((p) => p.id === id);
        if (!preset) return;
        set({
          settings: {
            ...get().settings,
            ai: { ...get().settings.ai, baseUrl: preset.baseUrl, model: preset.model, enabled: true },
          },
        });
      },

      generate: async () => {
        const { transcriptText, settings } = get();
        if (!transcriptText.trim()) {
          get().toast('Paste a transcript first.', 'error');
          return;
        }

        set({ generating: true, engineNotice: null });
        const transcript = parseTranscript(transcriptText);
        const options = optionsFromSettings(settings);

        if (!transcript.sentences.length) {
          set({ generating: false, engineNotice: transcript.warnings[0] || 'Could not read that transcript.' });
          get().toast('Could not read that transcript.', 'error');
          return;
        }

        // Local engine first: it is the safety net and the fallback.
        const local = generateClips(transcript, options);

        if (settings.ai.enabled && settings.ai.baseUrl.trim()) {
          try {
            const clips: Clip[] = await requestAiClips(transcript, options, settings.ai);
            set({
              result: {
                clips,
                transcript,
                options,
                createdAt: Date.now(),
                engine: 'ai',
              },
              generating: false,
              tab: 'clips',
              engineNotice:
                clips.length < options.count
                  ? `AI returned ${clips.length} of ${options.count} clips.`
                  : null,
            });
            return;
          } catch (error) {
            const message = error instanceof AiError ? `${error.message} ${error.hint ?? ''}`.trim() : 'AI request failed.';
            set({
              result: local,
              generating: false,
              tab: 'clips',
              engineNotice: `AI engine unavailable — used the offline engine instead. ${message}`,
            });
            get().toast('Fell back to the offline engine.', 'error');
            return;
          }
        }

        set({
          result: local,
          generating: false,
          tab: 'clips',
          engineNotice: transcript.warnings.length ? transcript.warnings.join(' ') : null,
          lastOptionsKey: JSON.stringify(options),
        });
      },

      replaceClipHook: (clipId, hook) => {
        const result = get().result;
        if (!result) return;
        set({
          result: {
            ...result,
            clips: result.clips.map((clip) => (clip.id === clipId ? { ...clip, hook } : clip)),
          },
        });
      },

      clearResult: () => set({ result: null, engineNotice: null }),

      clearAll: () =>
        set({
          transcriptText: '',
          result: null,
          engineNotice: null,
          settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_AI } },
          tab: 'create',
        }),

      toast: (message, tone = 'info') => {
        toastId += 1;
        const toast: Toast = { id: toastId, message, tone };
        set({ toasts: [...get().toasts, toast].slice(-3) });
        setTimeout(() => get().dismissToast(toast.id), 3200);
      },

      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: 'hookline-v1',
      version: 1,
      partialize: (state) => ({
        transcriptText: state.transcriptText,
        settings: state.settings,
        result: state.result,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(saved.settings ?? {}),
            ai: { ...DEFAULT_AI, ...(saved.settings?.ai ?? {}) },
          },
          tab: current.tab,
          generating: false,
          toasts: [],
        };
      },
    }
  )
);

export const NICHE_ORDER: Niche[] = [
  'business',
  'finance',
  'education',
  'tech',
  'fitness',
  'motivation',
  'comedy',
  'general',
];
