import { useEffect, useState, useRef } from 'react';
import { useTimerSocket } from '../hooks/useTimerSocket';
import { useTheme } from '../hooks/useTheme';
import { TimerReadout } from '../components/TimerReadout';
import { ConnectionBadge } from '../components/ConnectionBadge';

export function DisplayPage() {
  const { state, connected } = useTimerSocket();
  const { theme, toggleTheme } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check fullscreen status on load
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen request failed:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'f' || e.key === 'F') {
      handleFullscreen();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`w-screen h-screen flex flex-col items-center justify-center relative ${
        theme === 'dark' ? 'bg-black' : 'bg-white'
      }`}
    >
      {/* Connection Badge - Top Left */}
      <div className="absolute top-4 left-4">
        <ConnectionBadge wsConnected={connected} />
      </div>

      {/* Fullscreen Button - Top Right (hidden when fullscreen) */}
      {!isFullscreen && (
        <button
          onClick={handleFullscreen}
          className="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded font-semibold transition"
          title="Press 'F' or click to toggle fullscreen"
        >
          ⛶ Fullscreen
        </button>
      )}

      {/* Timer Display */}
      <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
        {!connected && !state && (
          <div className="text-center">
            <div className="text-2xl mb-4">Connecting...</div>
            <div className={`text-sm animate-pulse ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {connected ? 'Connected' : 'Disconnected - Retrying'}
            </div>
          </div>
        )}
        {state && <TimerReadout state={state} large={true} />}
      </div>

      {/* Theme Toggle (hidden in fullscreen) */}
      {!isFullscreen && (
        <button
          onClick={toggleTheme}
          className={`absolute bottom-4 left-4 p-2 rounded transition-colors ${
            theme === 'dark'
              ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300'
              : 'bg-gray-300 hover:bg-gray-400 text-gray-900'
          }`}
          title="Toggle dark/light mode"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      )}

      {/* ESC to Exit Fullscreen - Bottom Right (only in fullscreen) */}
      {isFullscreen && (
        <div className="absolute bottom-4 right-4 text-gray-500 text-xs">
          Press ESC to exit fullscreen
        </div>
      )}
    </div>
  );
}
