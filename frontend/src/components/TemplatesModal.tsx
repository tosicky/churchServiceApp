import { useState, useEffect } from 'react';
import { useTemplates } from '../hooks/useTemplates';
import { useServiceQueue } from '../hooks/useServiceQueue';
import { useTheme } from '../hooks/useTheme';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateLoaded?: () => void;
}

export function TemplatesModal({ isOpen, onClose, onTemplateLoaded }: TemplatesModalProps) {
  const { theme } = useTheme();
  const { templates, loading, error: templatesError, saveTemplate, loadTemplate, deleteTemplate, refetch } = useTemplates();
  const { queue, refetch: refetchQueue } = useServiceQueue();

  // Save Template section
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load/Delete section
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

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

  const handleLoadTemplate = async (templateName: string) => {
    setLoadingTemplate(templateName);
    setDeleteError(null);

    const result = await loadTemplate(templateName);
    setLoadingTemplate(null);

    if (result.success) {
      await refetchQueue();
      if (onTemplateLoaded) {
        onTemplateLoaded();
      }
    } else {
      setDeleteError(result.error || 'Failed to load template');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${
        theme === 'dark'
          ? 'bg-gray-800 text-white'
          : 'bg-white'
      }`}>
        <h2 className="text-2xl font-bold mb-6">Service Templates</h2>

        {/* Save Current Queue as Template */}
        <div className="mb-8 pb-8 border-b">
          <h3 className="text-lg font-semibold mb-4 text-green-700">Save Current Queue as Template</h3>

          {queue.names.length === 0 ? (
            <p className="text-sm text-gray-600 mb-4">Queue is empty. Add segments to create a template.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Current queue has {queue.names.length} segment{queue.names.length !== 1 ? 's' : ''}:
              </p>
              <ul className="text-sm text-gray-700 mb-4 bg-gray-50 p-3 rounded max-h-24 overflow-y-auto">
                {queue.names.map((name, idx) => (
                  <li key={idx} className="py-1">
                    {idx + 1}. {name}
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g., Standard Sunday Service"
                    disabled={saving}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Description (optional)</label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="e.g., Typical Sunday morning service order..."
                    disabled={saving}
                    rows={2}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {saveError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {saveError}
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                    Template saved successfully!
                  </div>
                )}

                <button
                  onClick={handleSaveTemplate}
                  disabled={saving || queue.names.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition text-sm"
                >
                  {saving ? 'Saving...' : 'Save as Template'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Saved Templates */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-blue-700">Saved Templates</h3>

          {loading && (
            <p className="text-gray-600 text-sm">Loading templates...</p>
          )}

          {templatesError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
              {templatesError}
            </div>
          )}

          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
              {deleteError}
            </div>
          )}

          {!loading && templates.length === 0 && (
            <p className="text-gray-600 text-sm">No saved templates yet.</p>
          )}

          {!loading && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.name}
                  className="border border-gray-200 rounded p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {template.segment_names.length} segment{template.segment_names.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Preview segments */}
                  <div className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded max-h-16 overflow-y-auto">
                    {template.segment_names.map((name, idx) => (
                      <div key={idx} className="py-0.5">
                        {idx + 1}. {name}
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadTemplate(template.name)}
                      disabled={loadingTemplate !== null}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-3 rounded transition text-sm"
                    >
                      {loadingTemplate === template.name ? 'Loading...' : 'Load'}
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.name)}
                      disabled={loadingTemplate !== null}
                      className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-semibold py-2 px-3 rounded transition text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end gap-2 mt-8 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-semibold text-gray-700 border rounded hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
