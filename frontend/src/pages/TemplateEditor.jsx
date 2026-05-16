import { useState, useEffect } from 'preact/hooks';
import { useLocation, useParams } from 'wouter';
import { Layout } from '../components/Layout';
import { api } from '../api';

export function TemplateEditor() {
  const [location, setLocation] = useLocation();
  const params = useParams();
  const id = params.id;
  const emailId = params.emailId;

  const [template, setTemplate] = useState({
    from_email: '',
    subject: '',
    content_type: 'text/plain',
    template: '',
    priority: '',
  });
  const [originalBody, setOriginalBody] = useState('');
  const [referenceEmail, setReferenceEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [emails, setEmails] = useState([]);
  const [testEmailId, setTestEmailId] = useState('');
  const [activeTab, setActiveTab] = useState('reference');

  // Separate state for extracted fields and variable assignments
  const [extractedFields, setExtractedFields] = useState([]);
  const [variableAssignments, setVariableAssignments] = useState([]);

  // Modal state for text selection
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [variableName, setVariableName] = useState('');
  const [dataType, setDataType] = useState('str');

  // Modal state for variable assignment
  const [isVarModalOpen, setIsVarModalOpen] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarType, setNewVarType] = useState('str');

  // State for trigger existence check
  const [hasTrigger, setHasTrigger] = useState(false);
  const [triggerId, setTriggerId] = useState(null);
  const [checkingTrigger, setCheckingTrigger] = useState(false);


  // Build full template text with variable assignments prepended
  const [fullTemplateText, setFullTemplateText] = useState('')

  useEffect(() => {
    loadData();
  }, [id, emailId]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (id) {
        // Load existing template
        const response = await api.getTemplate(id);
        const t = response.data;

        // Use fields from server if available (contains both extract and static_assign)
        if (t.fields && Array.isArray(t.fields)) {
          const extracted = t.fields.filter(f => f.kind === 'extract');
          const assignments = t.fields.filter(f => f.kind === 'static_assign');
          setExtractedFields(extracted);
          setVariableAssignments(assignments);
        }

        // Don't include fields in template state, we use extractedFields instead
        const { fields: _, ...templateData } = t;
        setTemplate({
          ...templateData,
          priority: t.priority?.toString() || '',
          template: t.template,
        });
        setOriginalBody(t.template);
        setFullTemplateText(t.template)

        // Check if a trigger exists for this template
        await checkForExistingTrigger(id);
      } else if (emailId) {
        // Create from email
        const response = await api.getEmail(emailId);
        const email = response.data;
        setReferenceEmail(email);
        setTemplate({
          from_email: email.from_email,
          subject: email.subject,
          content_type: email.content_type,
          template: email.body,
          priority: '',
        });
        setOriginalBody(email.body);
        setFullTemplateText(email.body)
        setExtractedFields([]);
        setVariableAssignments([]);
      }

      // Load emails for testing - filter by from_email, status=new, order by created_at desc
      const emailsRes = await api.listEmails({ per_page: 100, status: 'new', from_email: template.from_email, order_by: 'created_at', order_dir: 'desc' });
      setEmails(emailsRes.data || []);
      if (emailId) {
        setTestEmailId(emailId);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkForExistingTrigger = async (templateId) => {
    try {
      setCheckingTrigger(true);
      const response = await api.listTriggers({ template_id: templateId });
      const triggers = response.data || [];
      
      if (triggers.length > 0) {
        // Take the first trigger if multiple exist
        setHasTrigger(true);
        setTriggerId(triggers[0].id);
      } else {
        setHasTrigger(false);
        setTriggerId(null);
      }
    } catch (e) {
      console.error('Error checking for existing trigger:', e.message);
      setHasTrigger(false);
      setTriggerId(null);
    } finally {
      setCheckingTrigger(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTemplate(prev => ({ ...prev, [name]: value }));
  };

  const handleTemplateChange = async (e) => {
    const fullText = e.target.value;
    
    // Update full template text immediately
    setFullTemplateText(fullText);
    
    // Send request to server to extract fields
    try {
      const response = await api.extractTemplateFields({ template: fullText });
      const fields = response.data;
      const extracted = fields.filter(f => f.kind === 'extract');
      const assignments = fields.filter(f => f.kind === 'static_assign');
      setExtractedFields(extracted);
      setVariableAssignments(assignments);
    } catch (e) {
      console.error('Failed to extract fields:', e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Build variable assignments section from static_assign fields
      // Use single newline to separate assignments from template content
      // Note: docthu doesn't support type annotations in assignments, only in variables
      const data = {
        ...template,
        priority: template.priority ? parseInt(template.priority) : null,
        // Prepend variable assignments to template
        template: fullTemplateText,
      };

      if (id) {
        await api.updateTemplate(id, data);
      } else {
        const res = await api.createTemplate(data);
        setLocation(`/templates/${res.data.id}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      setLocation('/templates');
    } catch (e) {
      setError('Failed to delete: ' + e.message);
    }
  };

  const handleTest = async () => {
    if (!testEmailId) {
      setError('Please select an email to test');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testTemplate(id, testEmailId);
      setTestResult({ success: true, data: res.data });
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const removeField = (fieldName) => {
    // Remove from extractedFields
    setExtractedFields(prev => prev.filter(f => f.name !== fieldName));
    // Also remove from template
    setTemplate(prev => ({
      ...prev,
      template: prev.template.replace(new RegExp(`\\{\\{${fieldName}(?::\\w+)?\\}\\}`, 'g'), ''),
    }));
  };

  const addVariableAssignment = async () => {
    const name = newVarName.trim();
    const value = newVarValue.trim();
    if (!name || !value) return;

    if (variableAssignments.some(v => v.name === name)) {
      alert('Variable name already exists');
      return;
    }

    setIsVarModalOpen(false);

    // Update fullTemplateText with the new assignment
    const updatedAssignments = [{ name, value, type: newVarType }];
    const assignmentsText = updatedAssignments.map(v =>
        `{% ${v.name} = '${v.value}' %}`
    ).join('\n') + (updatedAssignments.length > 0 ? '\n' : '');
    const newFullText = assignmentsText + template.template;
    setFullTemplateText(newFullText);

    // Extract fields from the server using docthu
    try {
      const response = await api.extractTemplateFields({ template: newFullText });
      const fields = response.data;
      const extracted = fields.filter(f => f.kind === 'extract');
      const assignments = fields.filter(f => f.kind === 'static_assign');
      setExtractedFields(extracted);
      setVariableAssignments(assignments);
    } catch (e) {
      console.error('Failed to extract fields:', e.message);
    }

    setNewVarName('');
    setNewVarValue('');
    setNewVarType('str');
  };

  const handleVarModalClose = () => {
    setIsVarModalOpen(false);
    setNewVarName('');
    setNewVarValue('');
    setNewVarType('str');
  };

  const removeVariableAssignment = (index) => {
    setVariableAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text && text.length > 0) {
      setSelectedText(text);
      setVariableName('');
      setDataType('str');
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedText('');
    setVariableName('');
    setDataType('str');
    // Clear the selection
    window.getSelection().removeAllRanges();
  };

  const handleAddVariableFromSelection = async () => {
    const fieldName = variableName.trim();
    if (!fieldName) return;
    if (extractedFields.some(f => f.name === fieldName)) {
      alert('Field already exists');
      return;
    }

    // Build marker with type if not str (default)
    const marker = dataType === 'str' ? `{{${fieldName}}}` : `{{${fieldName}:${dataType}}}`;

    const newTemplateText = template.template.replace(selectedText, marker);
    setTemplate(prev => ({
      ...prev,
      template: newTemplateText,
    }));

    // Also update referenceEmail body to show the variable
    if (referenceEmail) {
      setReferenceEmail(prev => ({
        ...prev,
        body: prev.body.replace(selectedText, marker),
      }));
    }

    // Also update originalBody if it exists
    if (originalBody) {
      setOriginalBody(prev => prev.replace(selectedText, marker));
    }

    // Update fullTemplateText
    const assignmentsText = variableAssignments.map(v =>
        `{% ${v.name} = ${v.value} %}`
    ).join('\n') + (variableAssignments.length > 0 ? '\n' : '');
    const newFullText = assignmentsText + newTemplateText;
    setFullTemplateText(newFullText);

    // Extract fields from the server using docthu
    try {
      const response = await api.extractTemplateFields({ template: newFullText });
      const fields = response.data;
      const extracted = fields.filter(f => f.kind === 'extract');
      const assignments = fields.filter(f => f.kind === 'static_assign');
      setExtractedFields(extracted);
      setVariableAssignments(assignments);
    } catch (e) {
      console.error('Failed to extract fields:', e.message);
    }

    handleModalClose();
  };

  const highlightVariables = (text) => {
    const extractFieldNames = extractedFields.map(f => f.name);
    if (!extractFieldNames.length) return text;

    // Create a regex pattern to match all variable markers (with or without type)
    const pattern = extractFieldNames.map(f => `\\{\\{${f}(?::\\w+)?\\}\\}`).join('|');
    const regex = new RegExp(`(${pattern})`, 'g');

    return text.split(regex).map((part, index) => {
      // Check if this part is a variable marker
      const isVariable = extractFieldNames.some(f => 
        part === `{{${f}}}` || part.startsWith(`{{${f}:`)
      );
      if (isVariable) {
        return (
          <span key={index} className="bg-yellow-200 px-1 rounded font-medium text-blue-700">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const renderReference = () => {
    if (!referenceEmail && !originalBody) return null;

    // const body = referenceEmail?.body || originalBody;
    const body = fullTemplateText
    const extractFieldNames = extractedFields.map(f => f.name);

    // Build variable assignments text
    const varAssignmentsText = variableAssignments.length > 0
      ? variableAssignments.map(v => `{% ${v.name} = ${v.value} %}`).join('\n') + '\n'
      : '';

    // Full text with assignments for highlighting
    const fullText = varAssignmentsText + body;

    if (template.content_type === 'text/html') {
      // For HTML content, highlight variables by modifying the HTML
      let highlightedBody = body;
      extractedFields.forEach(field => {
        const marker = `{{${field.name}}}`;
        const markerWithType = `{{${field.name}:${field.type}}}`;
        // Escape special regex characters in the marker
        const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedMarkerWithType = markerWithType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const combinedPattern = `(${escapedMarker}|${escapedMarkerWithType})`;
        highlightedBody = highlightedBody.replace(
          new RegExp(combinedPattern, 'g'),
          '<span style="background-color: #fef08a; padding: 0 2px; border-radius: 2px; color: #1d4ed8; font-weight: 500;">$1</span>'
        );
      });

      return (
        <div
          className="w-full h-full border border-gray-200 rounded-md overflow-auto p-3 bg-white"
          onMouseUp={handleTextSelection}
          dangerouslySetInnerHTML={{ __html: highlightedBody }}
        />
      );
    }

    // For text content, show assignments then variables
    const lines = fullText.split('\n');
    return (
      <pre
        className="bg-gray-50 p-3 rounded-md overflow-auto text-sm h-full whitespace-pre-wrap cursor-text select-text"
        onMouseUp={handleTextSelection}
      >
        {lines.map((line, index) => {
          // Check if line is a variable assignment
          if (line.match(/^\{%\s*[\w.]+(?::\w+)?\s*=\s*.+?\s*%\}$/)) {
            return line + '\n';
          }
          // Otherwise highlight variables normally
          return highlightVariables(line + (index < lines.length - 1 ? '\n' : ''));
        })}
      </pre>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {id ? 'Edit Template' : 'New Template'}
          </h1>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {id && (
              checkingTrigger ? (
                <button
                  disabled
                  className="px-4 py-2 bg-gray-400 text-white rounded-md text-sm font-medium"
                >
                  Checking...
                </button>
              ) : hasTrigger ? (
                <button
                  onClick={() => setLocation(`/triggers/${triggerId}`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                >
                  View Trigger
                </button>
              ) : (
                <button
                  onClick={() => setLocation(`/triggers/new?template_id=${id}`)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Create Trigger
                </button>
              )
            )}
            {id && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-10 gap-6">
          {/* Left side - Reference and Template Input */}
          <div className="col-span-6 bg-white rounded-lg border border-gray-200">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('reference')}
                className={`px-4 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'reference'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Reference Email
              </button>
              <button
                onClick={() => setActiveTab('template')}
                className={`px-4 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'template'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Template
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 h-[calc(100%-49px)]">
              {activeTab === 'reference' && (
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    {renderReference()}
                  </div>
                </div>
              )}
              {activeTab === 'template' && (
                <div className="h-full flex flex-col">
                  <textarea
                    name="template"
                    value={fullTemplateText}
                    onChange={handleTemplateChange}
                    className="w-full flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    placeholder="Email template with {{variables}}"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right side - Settings and Fields */}
          <div className="col-span-4 space-y-4">
            {/* Settings */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                  <input
                    type="email"
                    name="from_email"
                    value={template.from_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject (optional)</label>
                  <input
                    type="text"
                    name="subject"
                    value={template.subject || ''}
                    onChange={handleChange}
                    placeholder="Match any subject"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority (optional)</label>
                  <input
                    type="number"
                    name="priority"
                    value={template.priority}
                    onChange={handleChange}
                    placeholder="Auto"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                  <select
                    name="content_type"
                    value={template.content_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="text/plain">Plain Text</option>
                    <option value="text/html">HTML</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Fields</h3>
                <button
                  onClick={() => setIsVarModalOpen(true)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  + Add
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Define variables using Docthu syntax
              </p>
              <div className="space-y-2">
                {[...variableAssignments.map((v, i) => ({...v, kind: 'static_assign', index: i})),
                  ...extractedFields.map(f => ({...f, kind: 'extract'}))
                ].map((field, index) => (
                  <div key={index} className={`flex items-center justify-between p-2 rounded ${field.kind === 'static_assign' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <code className="text-sm">{field.name}</code>
                      <span className={`text-xs px-2 py-0.5 rounded ${field.kind === 'static_assign' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>{field.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${field.kind === 'static_assign' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{field.kind}</span>
                    </div>
                    <button
                      onClick={() => field.kind === 'static_assign' ? removeVariableAssignment(field.index) : removeField(field.name)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {variableAssignments.length === 0 && extractedFields.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No fields defined</p>
                )}
              </div>
            </div>

            {/* Test Section */}
            {id && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-3">Test Template</h3>
                <select
                  value={testEmailId}
                  onChange={(e) => setTestEmailId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
                >
                  <option value="">Select an email...</option>
                  {emails
                    .map(email => (
                      <option key={email.id} value={email.id}>
                        {email.subject?.substring(0, 50) || 'No subject'}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test'}
                </button>
                {testResult && (
                  <div className={`mt-3 p-3 rounded text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testResult.success ? (
                      <pre className="overflow-auto">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    ) : (
                      testResult.error
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Modal for creating variable from selected text */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Create Variable
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Text
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600 break-all">
                  {selectedText}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variable Name
                </label>
                <input
                  type="text"
                  value={variableName}
                  onChange={(e) => setVariableName(e.target.value)}
                  placeholder="Enter variable name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Type
                </label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="str">String</option>
                  <option value="int">Integer</option>
                  <option value="float">Float</option>
                  <option value="date">Date</option>
                  <option value="datetime">DateTime</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleModalClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddVariableFromSelection}
                  disabled={!variableName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Variable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for variable assignment */}
      {isVarModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Add Variable Assignment
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variable Name
                </label>
                <input
                  type="text"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  placeholder="var_name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && addVariableAssignment()}
                  autoComplete="off"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  placeholder="'value'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && addVariableAssignment()}
                  autoComplete="off"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newVarType}
                  onChange={(e) => setNewVarType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="str">String</option>
                  <option value="int">Integer</option>
                  <option value="float">Float</option>
                  <option value="date">Date</option>
                  <option value="datetime">DateTime</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleVarModalClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addVariableAssignment}
                  disabled={!newVarName.trim() || !newVarValue.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
