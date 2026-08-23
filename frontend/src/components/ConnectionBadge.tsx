interface ConnectionBadgeProps {
  wsConnected: boolean;
  ppConnected?: boolean;
  showPP?: boolean;
  connectedClients?: number;
}

export function ConnectionBadge({ wsConnected, ppConnected = false, showPP = false, connectedClients }: ConnectionBadgeProps) {
  // "Other" devices, not counting this one - only worth calling out when there IS someone
  // else, so a solo operator sees nothing extra.
  const otherClients = typeof connectedClients === 'number' ? Math.max(0, connectedClients - 1) : 0;

  return (
    <div className="flex gap-2 sm:gap-3 items-center text-xs">
      <div
        className="flex items-center gap-1"
        title={wsConnected ? 'Connected' : 'Disconnected'}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${wsConnected ? 'bg-success' : 'bg-danger'}`}></div>
        <span className="hidden sm:inline text-content-secondary">
          {wsConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {otherClients > 0 && (
        <div
          className="flex items-center gap-1 text-warning font-medium"
          title={`${otherClients} other device${otherClients !== 1 ? 's' : ''} connected to this service right now`}
        >
          <span>👥 {otherClients + 1}</span>
        </div>
      )}
      {showPP && (
        <div
          className="flex items-center gap-1"
          title={ppConnected ? 'ProPresenter Connected' : 'ProPresenter Offline'}
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${ppConnected ? 'bg-success' : 'bg-warning'}`}></div>
          <span className="hidden sm:inline text-content-secondary">
            {ppConnected ? 'PP Connected' : 'PP Offline'}
          </span>
        </div>
      )}
    </div>
  );
}
