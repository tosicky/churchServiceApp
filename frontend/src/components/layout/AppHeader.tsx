import { useTheme } from '../../theme/ThemeProvider';
import { ConnectionBadge } from '../ConnectionBadge';
import { IconButton } from '../ui/IconButton';
import { DesktopTabSwitcher, type TabId } from './TabBar';

interface AppHeaderProps {
  connected: boolean;
  ppConnected?: boolean;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function AppHeader({ connected, ppConnected, activeTab, onTabChange }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur border-b border-line">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-content truncate">Service Conductor</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <DesktopTabSwitcher active={activeTab} onChange={onTabChange} />
          <ConnectionBadge wsConnected={connected} ppConnected={ppConnected} showPP={true} />
          <IconButton onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </IconButton>
        </div>
      </div>
    </header>
  );
}
