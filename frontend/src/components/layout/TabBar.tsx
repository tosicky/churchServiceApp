export type TabId = 'live' | 'setup';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'live', label: 'Live', icon: '▶' },
  { id: 'setup', label: 'Setup', icon: '⚙️' },
];

interface TabProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

// Mobile: fixed bottom tab bar, thumb-reachable, standard iOS/Android pattern.
// This app is operated one-handed and standing during a live service, so the
// bottom edge - not a top segmented control - is what's actually reachable.
export function TabBar({ active, onChange }: TabProps) {
  return (
    <nav
      role="tablist"
      aria-label="Sections"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-xs font-medium border-t-2 transition-colors ${
              active === tab.id ? 'text-accent border-accent' : 'text-content-secondary border-transparent'
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// Desktop/tablet: compact segmented control inline in the header - plenty of
// screen space there, and the thumb-reach argument for a bottom bar doesn't apply.
export function DesktopTabSwitcher({ active, onChange }: TabProps) {
  return (
    <nav role="tablist" aria-label="Sections" className="hidden sm:flex gap-1 bg-surface-subtle rounded-lg p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            active === tab.id ? 'bg-surface text-content shadow-card' : 'text-content-secondary hover:text-content'
          }`}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </nav>
  );
}
