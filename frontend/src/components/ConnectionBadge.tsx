interface ConnectionBadgeProps {
  wsConnected: boolean;
  ppConnected?: boolean;
  showPP?: boolean;
}

export function ConnectionBadge({ wsConnected, ppConnected = false, showPP = false }: ConnectionBadgeProps) {
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
