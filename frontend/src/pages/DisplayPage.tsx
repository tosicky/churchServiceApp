import { useEffect, useState, useRef } from 'react';
import { useTimerSocket } from '../hooks/useTimerSocket';
import { useTheme } from '../theme/ThemeProvider';
import { TimerReadout } from '../components/TimerReadout';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { IconButton } from '../components/ui/IconButton';

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

  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      className="w-full min-h-screen h-[100dvh] overflow-hidden flex flex-col items-center justify-center relative bg-canvas text-content"
    >
      {/* Connection Badge - Top Left */}
      <div className="absolute top-4 left-4">
        <ConnectionBadge wsConnected={connected} />
      </div>

      {/* Fullscreen Button - Top Right (hidden when fullscreen or unsupported, e.g. iOS Safari) */}
      {!isFullscreen && fullscreenSupported && (
        <IconButton onClick={handleFullscreen} className="absolute top-4 right-4" title="Press 'F' or click to toggle fullscreen">
          ⛶
        </IconButton>
      )}

      {/* Timer Display */}
      <div className="w-full flex-1 flex items-center justify-center min-w-0 px-4">
        {!connected && !state && (
          <div className="text-center">
            <div className="text-2xl mb-4">Connecting...</div>
            <div className="text-sm animate-pulse text-content-secondary">
              {connected ? 'Connected' : 'Disconnected - Retrying'}
            </div>
          </div>
        )}
        {state && <TimerReadout state={state} large={true} />}
      </div>

      {/* Theme Toggle (hidden in fullscreen) */}
      {!isFullscreen && (
        <IconButton
          onClick={toggleTheme}
          className="absolute bottom-4 left-4"
          title="Toggle dark/light mode"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </IconButton>
      )}

      {/* ESC to Exit Fullscreen - Bottom Right (only in fullscreen) */}
      {isFullscreen && (
        <div className="absolute bottom-4 right-4 text-content-muted text-xs">
          Press ESC to exit fullscreen
        </div>
      )}
    </div>
  );
}
