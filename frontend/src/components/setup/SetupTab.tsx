import { useState } from 'react';
import { SegmentLibraryPanel } from './SegmentLibraryPanel';
import { NetworkPanel } from './NetworkPanel';
import { ServiceCountdownPanel } from './ServiceCountdownPanel';
import { ShortcutsLegend } from './ShortcutsLegend';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TemplatesModal } from '../TemplatesModal';
import { SettingsModal } from '../SettingsModal';

interface SetupTabProps {
  onTemplateLoaded?: () => void;
}

export function SetupTab({ onTemplateLoaded }: SetupTabProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-semibold text-content">Run of Show Templates</h3>
        <p className="text-sm text-content-secondary">
          Save the current queue as a reusable template, or load a saved one.
        </p>
        <Button onClick={() => setTemplatesOpen(true)} variant="primary" className="w-full">
          📋 Templates
        </Button>
      </Card>

      <Card>
        <SegmentLibraryPanel />
      </Card>

      <Card>
        <ServiceCountdownPanel />
      </Card>

      <Card>
        <NetworkPanel />
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-content">Settings</h3>
        <p className="text-sm text-content-secondary">ProPresenter connection and server address.</p>
        <Button onClick={() => setSettingsOpen(true)} variant="secondary" className="w-full">
          ⚙️ Open Settings
        </Button>
      </Card>

      <Card>
        <ShortcutsLegend />
      </Card>

      <TemplatesModal
        isOpen={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onTemplateLoaded={() => {
          setTemplatesOpen(false);
          onTemplateLoaded?.();
        }}
      />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
