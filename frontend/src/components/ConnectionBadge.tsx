interface ConnectionBadgeProps {
  wsConnected: boolean;
  ppConnected?: boolean;
  showPP?: boolean;
}

export function ConnectionBadge({ wsConnected, ppConnected = false, showPP = false }: ConnectionBadgeProps) {
  return (
    <div className="flex gap-3 items-center text-xs">
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-gray-600">{wsConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {showPP && (
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${ppConnected ? 'bg-green-500' : 'bg-orange-500'}`}></div>
          <span className="text-gray-600">{ppConnected ? 'PP Connected' : 'PP Offline'}</span>
        </div>
      )}
    </div>
  );
}
