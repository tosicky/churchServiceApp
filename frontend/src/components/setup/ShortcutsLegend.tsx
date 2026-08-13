export function ShortcutsLegend() {
  return (
    <div className="hidden sm:block text-xs text-content-secondary">
      <p className="font-semibold mb-2">Keyboard Shortcuts</p>
      <div className="grid grid-cols-2 gap-2">
        <p><kbd className="bg-surface-subtle px-2 py-1 rounded">Space</kbd> Start/Pause</p>
        <p><kbd className="bg-surface-subtle px-2 py-1 rounded">↑↓</kbd> ±1 minute</p>
        <p><kbd className="bg-surface-subtle px-2 py-1 rounded">R</kbd> Reset</p>
      </div>
    </div>
  );
}
