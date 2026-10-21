import { useApp } from './state/store';
import type { Tab } from './state/store';
import { ClipsScreen } from './ui/ClipsScreen';
import { CreateScreen } from './ui/CreateScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { FilmIcon, SlidersIcon, WandIcon } from './ui/icons';

const NAV: Array<{ id: Tab; label: string; Icon: typeof WandIcon }> = [
  { id: 'create', label: 'Create', Icon: WandIcon },
  { id: 'clips', label: 'Clips', Icon: FilmIcon },
  { id: 'settings', label: 'Settings', Icon: SlidersIcon },
];

export default function App() {
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const toasts = useApp((s) => s.toasts);
  const dismissToast = useApp((s) => s.dismissToast);
  const clipCount = useApp((s) => s.result?.clips.length ?? 0);

  return (
    <>
      <div className="ambient" />
      <div className="app">
        {tab === 'create' && <CreateScreen />}
        {tab === 'clips' && <ClipsScreen />}
        {tab === 'settings' && <SettingsScreen />}

        <nav className="nav" aria-label="Sections">
          <div className="nav-inner">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className="nav-item"
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <span className="nav-dot" />
                <Icon size={21} className="nav-icon" />
                <span>{label}</span>
                {id === 'clips' && clipCount > 0 && <span className="nav-count">{clipCount}</span>}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`toast toast-${toast.tone}`}
            style={{ pointerEvents: 'auto' }}
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </>
  );
}
