import { useState, useEffect } from 'react';
import { ServiceDataProvider, useServiceData } from '../contexts/ServiceDataContext';
import { useTimerControls } from '../hooks/useTimerControls';
import { AppShell } from '../components/layout/AppShell';
import { AppHeader } from '../components/layout/AppHeader';
import { TabBar, type TabId } from '../components/layout/TabBar';
import { LiveTab } from '../components/live/LiveTab';
import { SetupTab } from '../components/setup/SetupTab';

function ControllerPageInner() {
  const { state, connected } = useServiceData();
  const controls = useTimerControls(state);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem('activeTab');
    return saved === 'setup' ? 'setup' : 'live';
  });

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or select
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLSelectElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        controls.toggle();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        controls.addSeconds(60);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        controls.subtractSeconds(60);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        controls.reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <AppShell
      header={
        <AppHeader
          connected={connected}
          ppConnected={state?.propresenter_connected}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      }
      tabBar={<TabBar active={activeTab} onChange={handleTabChange} />}
    >
      {/* Live stays mounted always (it owns the pinned timer + drag state); Setup
          unmounts when hidden so its polling intervals (e.g. ServerInfo) stop. */}
      <div id="tabpanel-live" role="tabpanel" aria-labelledby="tab-live" hidden={activeTab !== 'live'}>
        <LiveTab />
      </div>
      {activeTab === 'setup' && (
        <div id="tabpanel-setup" role="tabpanel" aria-labelledby="tab-setup">
          <SetupTab onTemplateLoaded={() => handleTabChange('live')} />
        </div>
      )}
    </AppShell>
  );
}

export function ControllerPage() {
  return (
    <ServiceDataProvider>
      <ControllerPageInner />
    </ServiceDataProvider>
  );
}
