import { ServerInfo } from '../ServerInfo';

export function NetworkPanel() {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-content">Network Access</h3>
      <ServerInfo />
    </div>
  );
}
