import { useState } from 'preact/hooks';

export function SourcePickerModal({
  isOpen,
  onClose,
  onSelect,
  templateFields,
  currentTarget,
  existingMappings
}) {
  const [expandedSections, setExpandedSections] = useState({
    extractedData: true,
    emailMetadata: true
  });

  if (!isOpen) return null;

  // Helper to find if a source field is already used
  const getUsedByField = (sourceValue) => {
    const mapping = existingMappings.find(m =>
      m.source === sourceValue && m.target !== currentTarget
    );
    return mapping?.target;
  };

  const isFieldUsed = (sourceValue) => {
    return existingMappings.some(m =>
      m.source === sourceValue && m.target !== currentTarget
    );
  };

  const handleSourceSelect = (sourceValue) => {
    if (!isFieldUsed(sourceValue)) {
      onSelect(sourceValue);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Build extracted data fields
  const extractedDataFields = [...templateFields]
    .sort((a, b) => (a.name || a).localeCompare(b.name || b))
    .map(f => {
      const fieldName = f.name || f;
      const sourceValue = `$extracted_data.${fieldName}`;
      return {
        value: sourceValue,
        label: fieldName,
        usedBy: getUsedByField(sourceValue)
      };
    });

  // Build email metadata fields
  const emailFields = [
    { value: '$email.received_at', label: 'received_at' },
    { value: '$email.from_email', label: 'from_email' },
    { value: '$email.to_email', label: 'to_email' },
    { value: '$email.subject', label: 'subject' }
  ]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(field => ({
      ...field,
      usedBy: getUsedByField(field.value)
    }));

  const handleClose = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[75vw] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Map source for "{currentTarget}"</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4 space-y-4">
          {/* Extracted Data Section */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('extractedData')}
              className="flex items-center gap-2 w-full text-left font-medium text-gray-900 hover:text-gray-700 mb-2"
            >
              <svg
                className={`w-4 h-4 transition-transform ${expandedSections.extractedData ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span>$extracted_data</span>
            </button>

            {expandedSections.extractedData && extractedDataFields.length > 0 && (
              <div className="space-y-2 ml-6">
                {extractedDataFields.map(field => (
                  <FieldRow
                    key={field.value}
                    field={field}
                    isUsed={!!field.usedBy}
                    onSelect={() => handleSourceSelect(field.value)}
                  />
                ))}
              </div>
            )}

            {expandedSections.extractedData && extractedDataFields.length === 0 && (
              <p className="text-sm text-gray-500 ml-6">No fields available</p>
            )}
          </div>

          {/* Email Metadata Section */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('emailMetadata')}
              className="flex items-center gap-2 w-full text-left font-medium text-gray-900 hover:text-gray-700 mb-2"
            >
              <svg
                className={`w-4 h-4 transition-transform ${expandedSections.emailMetadata ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span>$email</span>
            </button>

            {expandedSections.emailMetadata && (
              <div className="space-y-2 ml-6">
                {emailFields.map(field => (
                  <FieldRow
                    key={field.value}
                    field={field}
                    isUsed={!!field.usedBy}
                    onSelect={() => handleSourceSelect(field.value)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// FieldRow component for each source field
function FieldRow({ field, isUsed, onSelect }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">{field.label}</span>
        {isUsed && (
          <span className="block text-xs text-gray-500 mt-0.5">
            already used by <span className="font-medium text-gray-700">{field.usedBy}</span>
          </span>
        )}
      </div>

      {isUsed ? (
        <span className="ml-3 px-3 py-1.5 text-xs text-gray-500 bg-gray-200 rounded-md cursor-not-allowed">
          Used
        </span>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="ml-3 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors font-medium"
        >
          Add
        </button>
      )}
    </div>
  );
}
