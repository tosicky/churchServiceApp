import { useState } from 'react';
import { useTemplates } from '../hooks/useTemplates';
import { useServiceData } from '../contexts/ServiceDataContext';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateLoaded?: () => void;
}

export function TemplatesModal({ isOpen, onClose, onTemplateLoaded }: TemplatesModalProps) {
  const { templates, loading, error: templatesError, saveTemplate, loadTemplate, deleteTemplate } = useTemplates();
  const { queue, segments, refetchQueue } = useServiceData();

  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) {
      setSaveError('Template name is required');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const result = await saveTemplate(saveName, saveDescription);
    setSaving(false);

    if (result.success) {
      setSaveName('');
      setSaveDescription('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(result.error || 'Failed to save template');
    }
  };

  const handleLoadTemplate = async (templateName: string, segmentNames: string[]) => {
    // Loading a template replaces the entire queue - confirm if the current one is actually
    // underway, so a stray tap mid-service can't silently wipe it.
    if (queue.current_index > -1 && !confirm(`Load "${templateName}"? This replaces the current queue and stops the running segment.`)) {
      return;
    }

    // The broadcasting load endpoint doesn't validate segments still exist (unlike the
    // non-broadcasting one it replaced here) - check client-side first, since we already
    // have the current segment library from the shared context.
    const knownSegments = new Set(segments.map((s) => s.name));
    const missing = segmentNames.filter((n) => !knownSegments.has(n));
    if (missing.length > 0) {
      setLoadError(
        `Can't load "${templateName}" - segment${missing.length > 1 ? 's no longer exist' : ' no longer exists'}: ${missing.join(', ')}`
      );
      return;
    }

    setLoadingTemplate(templateName);
    setLoadError(null);
    setDeleteError(null);

    const result = await loadTemplate(templateName);
    setLoadingTemplate(null);

    if (result.success) {
      await refetchQueue();
      onTemplateLoaded?.();
    } else {
      setLoadError(result.error || 'Failed to load template');
    }
  };

  const handleDeleteTemplate = async (templateName: string) => {
    if (!confirm(`Delete template "${templateName}"?`)) return;

    setDeleteError(null);
    const result = await deleteTemplate(templateName);

    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete template');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Service Templates">
      {/* Save Current Queue as Template */}
      <div className="mb-8 pb-8 border-b border-line">
        <h3 className="text-lg font-semibold mb-4 text-content">Save Current Queue as Template</h3>

        {queue.names.length === 0 ? (
          <p className="text-sm text-content-secondary mb-4">Queue is empty. Add segments to create a template.</p>
        ) : (
          <>
            <p className="text-sm text-content-secondary mb-4">
              Current queue has {queue.names.length} segment{queue.names.length !== 1 ? 's' : ''}:
            </p>
            <ul className="text-sm text-content mb-4 bg-surface-subtle p-3 rounded-lg max-h-24 overflow-y-auto">
              {queue.names.map((name, idx) => (
                <li key={idx} className="py-1">
                  {idx + 1}. {name}
                </li>
              ))}
            </ul>

            <div className="space-y-3">
              <Field label="Template Name *">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., Standard Sunday Service"
                  disabled={saving}
                  className={inputClass}
                />
              </Field>

              <Field label="Description (optional)">
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="e.g., Typical Sunday morning service order..."
                  disabled={saving}
                  rows={2}
                  className={inputClass}
                />
              </Field>

              {saveError && <Alert tone="error">{saveError}</Alert>}
              {saveSuccess && <Alert tone="success">Template saved successfully!</Alert>}

              <Button
                onClick={handleSaveTemplate}
                disabled={saving || queue.names.length === 0}
                variant="primary"
                className="w-full"
              >
                {saving ? 'Saving...' : 'Save as Template'}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Saved Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-content">Saved Templates</h3>

        {loading && <p className="text-content-secondary text-sm">Loading templates...</p>}

        {templatesError && <Alert tone="error" className="mb-4">{templatesError}</Alert>}
        {loadError && (
          <Alert tone="error" className="mb-4" onDismiss={() => setLoadError(null)}>
            {loadError}
          </Alert>
        )}
        {deleteError && (
          <Alert tone="error" className="mb-4" onDismiss={() => setDeleteError(null)}>
            {deleteError}
          </Alert>
        )}

        {!loading && templates.length === 0 && (
          <p className="text-content-secondary text-sm">No saved templates yet.</p>
        )}

        {!loading && templates.length > 0 && (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.name}
                className="border border-line rounded-lg p-4 hover:bg-surface-subtle transition"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-content">{template.name}</h4>
                    {template.description && (
                      <p className="text-sm text-content-secondary mt-1">{template.description}</p>
                    )}
                    <p className="text-xs text-content-muted mt-2">
                      {template.segment_names.length} segment{template.segment_names.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Preview segments */}
                <div className="text-xs text-content-secondary mb-3 bg-surface-subtle p-2 rounded max-h-16 overflow-y-auto">
                  {template.segment_names.map((name, idx) => (
                    <div key={idx} className="py-0.5">
                      {idx + 1}. {name}
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleLoadTemplate(template.name, template.segment_names)}
                    disabled={loadingTemplate !== null}
                    variant="primary"
                    size="sm"
                    className="flex-1"
                  >
                    {loadingTemplate === template.name ? 'Loading...' : 'Load'}
                  </Button>
                  <Button
                    onClick={() => handleDeleteTemplate(template.name)}
                    disabled={loadingTemplate !== null}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
