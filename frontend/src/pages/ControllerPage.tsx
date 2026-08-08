import { useState, useEffect } from 'react';
import { useTimerSocket } from '../hooks/useTimerSocket';
import { useTheme } from '../hooks/useTheme';
import { TimerReadout } from '../components/TimerReadout';
import { ControlPanel } from '../components/ControlPanel';
import { StageMessagePanel } from '../components/StageMessagePanel';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ServerInfo } from '../components/ServerInfo';
import { SettingsModal } from '../components/SettingsModal';
import { TemplatesModal } from '../components/TemplatesModal';
import { pauseTimer, startTimer, resetTimer, addTime, subtractTime } from '../lib/api';

export function ControllerPage() {
  const { state, connected } = useTimerSocket();
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or select
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLSelectElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      try {
        if (e.code === 'Space') {
          e.preventDefault();
          if (!state) return;
          if (state.status === 'running') {
            await pauseTimer();
          } else if (state.status === 'paused' || state.status === 'idle') {
            // Need segment name and duration - use current state
            if (state.name && state.duration) {
              await startTimer(state.name, state.duration);
            }
          }
        } else if (e.code === 'ArrowUp') {
          e.preventDefault();
          await addTime(60); // 1 minute
        } else if (e.code === 'ArrowDown') {
          e.preventDefault();
          await subtractTime(60); // 1 minute
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          await resetTimer();
        }
      } catch (err) {
        console.error('Keyboard shortcut error:', err);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  return (
    <div className={`min-h-screen transition-colors ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-gray-900 to-gray-800'
        : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    } p-4 sm:p-8`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className={`text-3xl sm:text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            Service Conductor
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300'
                  : 'hover:bg-white/50 text-gray-800'
              }`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              onClick={() => setTemplatesOpen(true)}
              className={`p-2 rounded transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'hover:bg-white/50'
              }`}
              title="Templates"
            >
              ⏱️
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className={`p-2 rounded transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'hover:bg-white/50'
              }`}
              title="Settings"
            >
              ⚙️
            </button>
            <ConnectionBadge wsConnected={connected} ppConnected={state?.propresenter_connected} showPP={true} />
          </div>
        </div>

        <div className="grid gap-6 sm:gap-8">
          <ServerInfo />

          <div className="bg-black rounded-lg p-6 sm:p-8 text-center">
            <TimerReadout state={state} />
          </div>

          <ControlPanel />

          <StageMessagePanel />
        </div>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TemplatesModal
        isOpen={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onTemplateLoaded={() => {
          // Close modal after successfully loading a template
          setTemplatesOpen(false);
        }}
      />
    </div>
  );
}
