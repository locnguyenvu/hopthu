import { useState, useEffect, useContext, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { ToastContext } from '../app';
import { SourcePickerModal } from '../components/SourcePickerModal';

export function TriggerEditor({ id }) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fieldMappings, setFieldMappings] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [connections, setConnections] = useState([]);
  const [templateFields, setTemplateFields] = useState([]);
  const [connectionFields, setConnectionFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState(null);
  const isLoadingRef = useRef(false);
  const toast = useContext(ToastContext);

  const isEdit = Boolean(id);

  // Computed values for mapping status
  const mappedCount = fieldMappings.filter(m => m.source).length;
  const unmappedCount = fieldMappings.filter(m => !m.source && !m.required).length;
  const requiredMissingCount = fieldMappings.filter(m => !m.source && m.required).length;

  useEffect(() => {
    loadTemplates();
    loadConnections();
    if (isEdit) {
      loadTrigger();
    } else {
      // Check for connection_id in URL params (for new triggers from connection detail)
      const urlParams = new URLSearchParams(window.location.search);
      const preselectedConnectionId = urlParams.get('connection_id');
      if (preselectedConnectionId) {
        setConnectionId(preselectedConnectionId);
      }

      // Check for template_id in URL params (for new triggers from template detail)
      const preselectedTemplateId = urlParams.get('template_id');
      if (preselectedTemplateId) {
        setTemplateId(preselectedTemplateId);
      }
    }
  }, [id]);

  // Update template fields when template is selected
  useEffect(() => {
    if (templateId) {
      const selectedTemplate = templates.find(t => t.id === parseInt(templateId));
      if (selectedTemplate && selectedTemplate.fields) {
        setTemplateFields(selectedTemplate.fields);
      } else {
        // Fetch template details if not loaded yet
        fetchTemplateFields(templateId);
      }
    } else {
      setTemplateFields([]);
    }
  }, [templateId, templates]);

  // Update connection fields when connection is selected
  useEffect(() => {
    // Skip if we're loading existing trigger data
    if (isLoadingRef.current) return;

    if (connectionId) {
      const selectedConnection = connections.find(c => c.id === parseInt(connectionId));
      if (selectedConnection && selectedConnection.fields) {
        setConnectionFields(selectedConnection.fields);
        // Only initialize mappings for new triggers, not when editing
        if (!isEdit) {
          initializeMappings(selectedConnection.fields);
        }
      } else {
        // Fetch connection details if not loaded yet
        fetchConnectionFields(connectionId);
      }
    } else {
      setConnectionFields([]);
      if (!isEdit) {
        setFieldMappings([]);
      }
    }
  }, [connectionId, connections]);

  // Auto-generate mappings when both are selected (only for new triggers)
  useEffect(() => {
    if (!isEdit && templateFields.length > 0 && connectionFields.length > 0) {
      generateAutoMappings();
    }
  }, [templateFields, connectionFields]);

  const fetchTemplateFields = async (id) => {
    try {
      const result = await api.getTemplate(id);
      setTemplateFields(result.data.fields || []);
    } catch (e) {
      console.error('Failed to fetch template fields:', e);
    }
  };

  const fetchConnectionFields = async (id) => {
    try {
      const result = await api.getConnection(id);
      const fields = result.data.fields || [];
      setConnectionFields(fields);
      // Only initialize mappings for new triggers, not when editing
      if (!isEdit) {
        initializeMappings(fields);
      }
    } catch (e) {
      console.error('Failed to fetch connection fields:', e);
    }
  };

  const initializeMappings = (connFields) => {
    // Create a mapping entry for each connection field
    const mappings = connFields.map(f => ({
      source: '',
      target: f.name,
      required: f.required || false
    }));
    setFieldMappings(mappings);
  };

  const generateAutoMappings = () => {
    const mappings = connectionFields.map(connField => {
      const cName = connField.name;
      const lastSegment = cName.split('.').pop();

      // Try to find matching template field
      const matchedTemplateField = templateFields.find(tField => {
        const tName = tField.name || tField;
        return tName === cName || tName === lastSegment;
      });

      return {
        source: matchedTemplateField ? `$extracted_data.${matchedTemplateField.name || matchedTemplateField}` : '',
        target: connField.name,
        required: connField.required || false
      };
    });

    setFieldMappings(mappings);
    const autoMappedCount = mappings.filter(m => m.source).length;
    toast.success(`Auto-mapped ${autoMappedCount} of ${mappings.length} fields`);
  };

  const clearAllMappings = () => {
    setFieldMappings(prev => prev.map(m => ({ ...m, source: '' })));
    toast.info('All mappings cleared');
  };

  const updateMappingByTarget = (target, source) => {
    setFieldMappings(prev => prev.map(m =>
      m.target === target ? { ...m, source } : m
    ));
  };

  const openModalFor = (targetFieldName) => {
    setModalTarget(targetFieldName);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalTarget(null);
  };

  const handleSourceSelect = (sourceValue) => {
    if (modalTarget) {
      updateMappingByTarget(modalTarget, sourceValue);
      setModalOpen(false);
      setModalTarget(null);
    }
  };

  const handleRemoveMapping = (targetFieldName) => {
    updateMappingByTarget(targetFieldName, '');
  };


  const loadTemplates = async () => {
    try {
      const result = await api.listTemplates();
      setTemplates(result.data || []);
    } catch (e) {
      toast.error('Failed to load templates: ' + e.message);
    }
  };

  const loadConnections = async () => {
    try {
      const result = await api.listConnections();
      setConnections(result.data || []);
    } catch (e) {
      toast.error('Failed to load connections: ' + e.message);
    }
  };

  const loadTrigger = async () => {
    try {
      isLoadingRef.current = true;
      setLoading(true);
      const result = await api.getTrigger(id);
      const trigger = result.data;
      setName(trigger.name);
      setTemplateId(trigger.template_id);
      setConnectionId(trigger.connection_id);
      setIsActive(trigger.is_active);

      // Load template and connection details for fields
      const templateResult = await api.getTemplate(trigger.template_id);
      const templateFieldsData = templateResult.data.fields || [];
      setTemplateFields(templateFieldsData);

      const connResult = await api.getConnection(trigger.connection_id);
      const connFields = connResult.data.fields || [];
      setConnectionFields(connFields);

      // Build mappings from all connection fields, applying saved sources
      const savedMappings = trigger.field_mappings || [];
      const mappings = connFields.map(f => {
        const saved = savedMappings.find(m => m.target === f.name);
        return {
          source: saved?.source || '',
          target: f.name,
          required: f.required || false
        };
      });
      setFieldMappings(mappings);

      // Also update the connections list with the fetched connection data
      // so the useEffect doesn't re-fetch
      setConnections(prev => {
        const exists = prev.find(c => c.id === connResult.data.id);
        if (exists) return prev;
        return [...prev, connResult.data];
      });

      // Same for templates
      setTemplates(prev => {
        const exists = prev.find(t => t.id === templateResult.data.id);
        if (exists) return prev;
        return [...prev, templateResult.data];
      });

    } catch (e) {
      toast.error('Failed to load trigger: ' + e.message);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !templateId || !connectionId) {
      toast.error('Name, template, and connection are required');
      return;
    }

    // Check for required fields that are unmapped
    if (requiredMissingCount > 0) {
      toast.error(`${requiredMissingCount} required field(s) are not mapped`);
      return;
    }

    try {
      setLoading(true);
      const data = {
        name,
        template_id: templateId,
        connection_id: connectionId,
        is_active: isActive,
        field_mappings: fieldMappings
          .filter(m => m.source && m.target)
          .map(m => ({ source: m.source, target: m.target })),
      };

      if (isEdit) {
        await api.updateTrigger(id, data);
        toast.success('Trigger updated');
      } else {
        const result = await api.createTrigger(data);
        toast.success('Trigger created');
        route(`/triggers/${result.data.id}`);
      }
    } catch (e) {
      toast.error('Failed to save: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === parseInt(templateId));
  const selectedConnection = connections.find(c => c.id === parseInt(connectionId));

  if (loading && isEdit) {
    return (
      <Layout>
        <div className="text-center py-8 text-gray-500">Loading...</div>
      </Layout>
    );
  }

  // Breadcrumb navigation
  const renderBreadcrumb = () => {
    if (!connectionId || !selectedConnection) {
      return (
        <nav className="text-sm text-gray-500 mb-4">
          <a href="/connections" className="hover:text-blue-600">Connections</a>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-700">{isEdit ? name || 'Edit Trigger' : 'New Trigger'}</span>
        </nav>
      );
    }

    return (
      <nav className="text-sm text-gray-500 mb-4">
        <a href={`/connections/${connectionId}#triggers`} className="hover:text-blue-600">
          {selectedConnection.name}
        </a>
        <span className="mx-2">&gt;</span>
        <a href={`/connections/${connectionId}#triggers`} className="hover:text-blue-600">Triggers</a>
        <span className="mx-2">&gt;</span>
        {isEdit ? (
          <a href={`/triggers/${id}`} className="text-gray-700 hover:text-blue-600">
            {name}
          </a>
        ) : (
          <span className="text-gray-700">New Trigger</span>
        )}
      </nav>
    );
  };

  return (
    <Layout>
      <div>
        {renderBreadcrumb()}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isEdit ? 'Edit Trigger' : 'New Trigger'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Basic Configuration
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onInput={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Payment Notification"
                  required
                />
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template <span className="text-red-500">*</span>
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.from_email} {t.subject ? `(${t.subject})` : '(catch-all)'}
                    </option>
                  ))}
                </select>
                {templateId && templateFields.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {templateFields.length} field(s) available for extraction
                  </p>
                )}
              </div>

              {/* Connection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection <span className="text-red-500">*</span>
                </label>
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a connection...</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.endpoint})
                    </option>
                  ))}
                </select>
                {connectionId && connectionFields.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {connectionFields.length} field(s) to map
                  </p>
                )}
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <p className="text-xs text-gray-500">Trigger will process incoming emails when active</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Field Mappings */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Field Mappings</h2>
                <p className="text-xs text-gray-500 mt-1">Map extracted data fields to connection payload fields</p>
              </div>
              {templateFields.length > 0 && connectionFields.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={generateAutoMappings}
                    className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-md border border-blue-200 hover:bg-blue-50"
                  >
                    Auto-map
                  </button>
                  <button
                    type="button"
                    onClick={clearAllMappings}
                    className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Selected Resources Summary */}
            {templateId && selectedTemplate && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-blue-800">{selectedTemplate.from_email}</span>
                  {selectedTemplate.subject && (
                    <span className="text-blue-600 text-sm">({selectedTemplate.subject})</span>
                  )}
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">
                    {templateFields.length} fields
                  </span>
                </div>
              </div>
            )}

            {/* Mapping Status Summary */}
            {connectionFields.length > 0 && (
              <div className="flex items-center gap-4 text-sm mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="font-medium text-green-700">{mappedCount}</span>
                  <span className="text-gray-600">mapped</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="font-medium text-amber-700">{unmappedCount}</span>
                  <span className="text-gray-600">unmapped</span>
                </div>
                {requiredMissingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="font-medium text-red-700">{requiredMissingCount}</span>
                    <span className="text-gray-600">required missing</span>
                  </div>
                )}
              </div>
            )}

            {/* Available Template Fields Info */}
            {templateId && templateFields.length > 0 && (
              <div className="mb-4 p-2 bg-gray-50 rounded text-xs">
                <span className="font-medium text-gray-700">Available source fields:</span>
                <span className="text-gray-600 ml-1">
                  {templateFields.map(f => f.name || f).join(', ')}
                </span>
              </div>
            )}

            {/* Field Mapping Rows */}
            {connectionFields.length > 0 ? (
              <div className="space-y-2">
                {connectionFields.map((connField) => {
                  const mapping = fieldMappings.find(m => m.target === connField.name) || {
                    source: '',
                    target: connField.name,
                    required: connField.required
                  };
                  const isMapped = Boolean(mapping.source);
                  const hasError = connField.required && !mapping.source;

                  return (
                    <div
                      key={connField.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        hasError
                          ? 'bg-red-50 border-red-200'
                          : isMapped
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {/* Target field FIRST (left side) */}
                      <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">{connField.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {connField.type || 'string'}
                            </span>
                            {connField.required && (
                              <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded font-medium">
                                required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>

                      {/* Source picker (right side) */}
                      {mapping.source ? (
                        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm">
                          <span className="flex-1 text-gray-700 truncate" title={mapping.source}>
                            {mapping.source}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMapping(connField.name)}
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                            title="Remove mapping"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openModalFor(connField.name)}
                          className="flex-1 px-3 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          + Add Source
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600 mb-1">
                  {connectionId ? 'No fields defined for this connection' : 'Select a template and connection to configure mappings'}
                </p>
                {connectionId && connectionFields.length === 0 && (
                  <p className="text-sm text-gray-400">Define fields in your connection to see them here</p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-end items-center gap-3">
              <button
                type="button"
                onClick={() => route('/triggers')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  isEdit ? 'Update Trigger' : 'Create Trigger'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Source Picker Modal */}
      <SourcePickerModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSelect={handleSourceSelect}
        templateFields={templateFields}
        currentTarget={modalTarget}
        existingMappings={fieldMappings}
      />
    </Layout>
  );
}
