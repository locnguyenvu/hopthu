import { useState, useEffect, useContext } from 'preact/hooks';
import { route } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { ToastContext } from '../app';

function ConnectionEditForm({ id, connection, onSaved }) {
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState([{ key: '', value: '', encrypted: false }]);
  const [fields, setFields] = useState([{ name: '', type: 'string', required: false }]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const toast = useContext(ToastContext);

  const isEdit = Boolean(id);

  useEffect(() => {
    if (connection) {
      setName(connection.name);
      setEndpoint(connection.endpoint);
      setMethod(connection.method);
      setHeaders(connection.headers || [{ key: '', value: '', encrypted: false }]);
      setFields(connection.fields || [{ name: '', type: 'string', required: false }]);
    }
  }, [connection]);

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', encrypted: false }]);
  };

  const removeHeader = (index) => {
    if (headers.length > 1) {
      setHeaders(headers.filter((_, i) => i !== index));
    }
  };

  const updateHeader = (index, field, value) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setHeaders(newHeaders);
  };

  const addField = () => {
    setFields([...fields, { name: '', type: 'string', required: false }]);
  };

  const removeField = (index) => {
    if (fields.length > 1) {
      setFields(fields.filter((_, i) => i !== index));
    }
  };

  const updateField = (index, prop, value) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [prop]: value };
    setFields(newFields);
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await api.testConnection(id);
      setTestResult(result.data);
    } catch (e) {
      toast.error('Test failed: ' + e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !endpoint) {
      toast.error('Name and endpoint are required');
      return;
    }

    try {
      setLoading(true);
      const data = {
        name,
        endpoint,
        method,
        headers: headers.filter(h => h.key).map(h => ({
          key: h.key,
          value: h.value,
          encrypted: h.encrypted,
        })),
        fields: fields.filter(f => f.name).map(f => ({
          name: f.name,
          type: f.type,
          required: f.required,
        })),
      };

      if (isEdit) {
        await api.updateConnection(id, data);
        toast.success('Connection updated');
        if (onSaved) onSaved();
      }
    } catch (e) {
      toast.error('Failed to save: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
      {/* Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onInput={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Payment Webhook"
          required
        />
      </div>

      {/* Endpoint */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
        <input
          type="url"
          value={endpoint}
          onInput={(e) => setEndpoint(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://api.example.com/webhook"
          required
        />
      </div>

      {/* Method */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="GET">GET</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      {/* Headers */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Headers</label>
        {headers.map((header, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={header.key}
              onInput={(e) => updateHeader(index, 'key', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Header name (e.g., Authorization)"
            />
            <input
              type="text"
              value={header.value}
              onInput={(e) => updateHeader(index, 'value', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Header value"
            />
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={header.encrypted}
                onChange={(e) => updateHeader(index, 'encrypted', e.target.checked)}
                className="rounded border-gray-300"
              />
              Encrypt
            </label>
            <button
              type="button"
              onClick={() => removeHeader(index)}
              className="px-2 py-2 text-gray-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addHeader}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + Add header
        </button>
      </div>

      {/* Payload Fields */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payload Fields
          <span className="text-xs text-gray-500 ml-1">(define expected payload structure)</span>
        </label>
        {fields.map((field, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={field.name}
              onInput={(e) => updateField(index, 'name', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Field name (e.g., amount)"
            />
            <select
              value={field.type}
              onChange={(e) => updateField(index, 'type', e.target.value)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
            </select>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => updateField(index, 'required', e.target.checked)}
                className="rounded border-gray-300"
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => removeField(index)}
              className="px-2 py-2 text-gray-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addField}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + Add field
        </button>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Test Result</h3>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-sm ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {testResult.response_status || 'Error'}
            </span>
            <span className="text-sm text-gray-600">
              {testResult.success ? 'Success' : 'Failed'}
            </span>
          </div>
          {testResult.response_body && (
            <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
              {testResult.response_body}
            </pre>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 border rounded-md"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => route('/connections')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Update'}
          </button>
        </div>
      </div>
    </form>
  );
}

function ConnectionTriggers({ connectionId, connectionName }) {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useContext(ToastContext);

  useEffect(() => {
    loadTriggers();
  }, [connectionId]);

  const loadTriggers = async () => {
    try {
      setLoading(true);
      const result = await api.listTriggers({ connection_id: connectionId });
      setTriggers(result.data || []);
    } catch (e) {
      toast.error('Failed to load triggers: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete trigger "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteTrigger(id);
      toast.success('Trigger deleted');
      loadTriggers();
    } catch (e) {
      toast.error('Failed to delete: ' + e.message);
    }
  };

  const handleToggleActive = async (trigger) => {
    try {
      await api.updateTrigger(trigger.id, { is_active: !trigger.is_active });
      toast.success(trigger.is_active ? 'Trigger disabled' : 'Trigger enabled');
      loadTriggers();
    } catch (e) {
      toast.error('Failed to update: ' + e.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">
          Triggers using this connection
        </h2>
        <button
          onClick={() => route(`/triggers/new?connection_id=${connectionId}`)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          New Trigger
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : triggers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          No triggers configured for this connection.
          <div className="mt-4">
            <button
              onClick={() => route(`/triggers/new?connection_id=${connectionId}`)}
              className="text-blue-600 hover:underline"
            >
              Create a trigger
            </button>
            to fire HTTP requests when emails are extracted.
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {triggers.map((trigger) => (
                <tr key={trigger.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                    {trigger.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {trigger.template_from_email || `Template #${trigger.template_id}`}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(trigger)}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trigger.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {trigger.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={`/triggers/${trigger.id}`}
                      className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 mr-2"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDelete(trigger.id, trigger.name)}
                      className="text-sm text-red-600 hover:text-red-800 px-2 py-1"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ConnectionDetail({ id }) {
  const [activeTab, setActiveTab] = useState('edit');
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useContext(ToastContext);

  useEffect(() => {
    loadConnection();
  }, [id]);

  const loadConnection = async () => {
    try {
      setLoading(true);
      const result = await api.getConnection(id);
      setConnection(result.data);
    } catch (e) {
      toast.error('Failed to load connection: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8 text-gray-500">Loading...</div>
      </Layout>
    );
  }

  if (!connection) {
    return (
      <Layout>
        <div className="text-center py-8 text-gray-500">Connection not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{connection.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{connection.endpoint}</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-4">
            <button
              onClick={() => setActiveTab('edit')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'edit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setActiveTab('triggers')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'triggers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Triggers
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'edit' && (
          <ConnectionEditForm
            id={id}
            connection={connection}
            onSaved={loadConnection}
          />
        )}

        {activeTab === 'triggers' && (
          <ConnectionTriggers
            connectionId={id}
            connectionName={connection.name}
          />
        )}
      </div>
    </Layout>
  );
}