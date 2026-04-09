import { useState, useEffect, useContext } from 'preact/hooks';
import { route } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { ToastContext } from '../app';

function TriggerLogsPanel({ triggerId }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const toast = useContext(ToastContext);

  useEffect(() => {
    loadLogs();
  }, [triggerId, statusFilter, offset]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = { limit, offset };
      if (statusFilter) params.status = statusFilter;

      const result = await api.getTriggerLogs(triggerId, params);
      setLogs(result.data.logs || []);
      setTotal(result.data.total || 0);
    } catch (e) {
      toast.error('Failed to load logs: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Execution Logs</h2>
        
        {/* Filters */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          No execution logs yet. Logs will appear when this trigger is executed.
        </div>
      ) : (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(log.executed_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="px-1 bg-gray-100 rounded text-xs mr-1">{log.request_method}</span>
                      <span className="text-xs truncate max-w-xs block" title={log.request_url}>
                        {log.request_url}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.response_status ? (
                        <span className={log.response_status < 400 ? 'text-green-600' : 'text-red-600'}>
                          {log.response_status}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      <details className="inline ml-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          details
                        </summary>
                        <div className="absolute bg-white border rounded-lg shadow-lg p-3 mt-1 z-10 min-w-96">
                          <div className="mb-2">
                            <strong className="text-xs text-gray-600">Request Headers:</strong>
                            <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.request_headers, null, 2)}
                            </pre>
                          </div>
                          <div className="mb-2">
                            <strong className="text-xs text-gray-600">Request Body:</strong>
                            <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.request_body, null, 2)}
                            </pre>
                          </div>
                          {log.response_body && (
                            <div>
                              <strong className="text-xs text-gray-600">Response Body:</strong>
                              <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto max-h-40">
                                {log.response_body}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} ({total} total)
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TriggerDetail({ id }) {
  const [trigger, setTrigger] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useContext(ToastContext);

  useEffect(() => {
    loadTrigger();
  }, [id]);

  const loadTrigger = async () => {
    try {
      setLoading(true);
      const result = await api.getTrigger(id);
      setTrigger(result.data);
    } catch (e) {
      toast.error('Failed to load trigger: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <div className="text-center py-8 text-gray-500">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!trigger) {
    return (
      <Layout>
        <div>
          <div className="text-center py-8 text-gray-500">Trigger not found</div>
        </div>
      </Layout>
    );
  }

  const templateInfo = trigger.template
    ? `${trigger.template.from_email} ${trigger.template.subject ? `(${trigger.template.subject})` : '(catch-all)'}`
    : `Template #${trigger.template_id}`;

  const connectionInfo = trigger.connection
    ? trigger.connection.name
    : `Connection #${trigger.connection_id}`;

  const mappedCount = (trigger.field_mappings || []).filter(m => m.source).length;
  const totalCount = trigger.connection?.fields?.length || 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <button
              onClick={() => route(`/connections/${trigger.connection_id}`)}
              className="text-blue-600 hover:underline"
            >
              ← Back to {connectionInfo}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trigger.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {templateInfo} → {connectionInfo}
                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                  trigger.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {trigger.is_active ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
            <button
              onClick={() => route(`/triggers/${id}/edit`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Edit Trigger
            </button>
          </div>
        </div>

        {/* Basic Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Template */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-medium text-gray-500 uppercase">Template</span>
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">
              {trigger.template?.from_email || `#${trigger.template_id}`}
            </p>
            {trigger.template?.subject && (
              <p className="text-xs text-gray-500 mt-0.5">{trigger.template.subject}</p>
            )}
          </div>

          {/* Connection */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-xs font-medium text-gray-500 uppercase">Connection</span>
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">
              {trigger.connection?.name || `#${trigger.connection_id}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{trigger.connection?.endpoint || ''}</p>
          </div>

          {/* Field Mappings */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium text-gray-500 uppercase">Mappings</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {mappedCount} / {totalCount} fields
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalCount > 0 && mappedCount === totalCount ? (
                <span className="text-green-600">All mapped</span>
              ) : mappedCount > 0 ? (
                <span className="text-amber-600">Some unmapped</span>
              ) : (
                <span className="text-red-600">None mapped</span>
              )}
            </p>
          </div>
        </div>

        {/* Created / Updated */}
        {(trigger.created_at || trigger.updated_at) && (
          <div className="text-xs text-gray-400 mb-6 flex gap-4">
            {trigger.created_at && <span>Created: {formatDate(trigger.created_at)}</span>}
            {trigger.updated_at && <span>Updated: {formatDate(trigger.updated_at)}</span>}
          </div>
        )}

        {/* Logs */}
        <TriggerLogsPanel triggerId={id} />
      </div>
    </Layout>
  );
}