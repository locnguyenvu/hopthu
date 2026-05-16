import { useState, useEffect, useContext } from 'preact/hooks';
import { useLocation, useParams, Link } from 'wouter';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { ToastContext } from '../app';

function TriggerLogsPanel({ triggerId }) {
  const [location, setLocation] = useLocation();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLog(log)}>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(log.executed_at)}
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
                      <div className="text-xs text-gray-600 mb-1">
                        <span className="px-1 bg-gray-100 rounded text-xs mr-1">{log.request_method}</span>
                        <span className="truncate max-w-xs block" title={log.request_url}>
                          {log.request_url}
                        </span>
                      </div>
                      <div className="text-sm">
                        {log.response_status ? (
                          <span className={log.response_status < 400 ? 'text-green-600' : 'text-red-600'}>
                            {log.response_status}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal */}
          {selectedLog && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedLog(null)}>
              <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Execution Details</h3>
                  <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {/* Request Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Request</h4>
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">{selectedLog.request_method}</span>
                        <span className="text-sm text-gray-600 break-all">{selectedLog.request_url}</span>
                      </div>
                      {selectedLog.request_headers && Object.keys(selectedLog.request_headers).length > 0 && (
                        <div>
                          <strong className="text-xs text-gray-600">Headers:</strong>
                          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto border">
                            {JSON.stringify(selectedLog.request_headers, null, 2)}
                          </pre>
                        </div>
                      )}
                      {selectedLog.request_body && (
                        <div>
                          <strong className="text-xs text-gray-600">Body:</strong>
                          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto border">
                            {JSON.stringify(selectedLog.request_body, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Response Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Response</h4>
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      {selectedLog.response_status ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedLog.response_status < 400 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {selectedLog.response_status}
                          </span>
                          <span className="text-xs text-gray-500">HTTP Status</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No response</span>
                      )}
                      {selectedLog.response_body && (
                        <div>
                          <strong className="text-xs text-gray-600">Body:</strong>
                          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto max-h-40 border">
                            {selectedLog.response_body}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Error Section */}
                  {selectedLog.error_message && (
                    <div>
                      <h4 className="text-sm font-medium text-red-700 mb-2">Error</h4>
                      <div className="bg-red-50 rounded p-3">
                        <p className="text-sm text-red-600">{selectedLog.error_message}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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

export function TriggerDetail() {
  const [location, setLocation] = useLocation();
  const params = useParams();
  const id = params.id;

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
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 mb-4">
            <Link
              href={`/connections/${trigger.connection_id}`}
              className="hover:text-blue-600"
            >
              {connectionInfo}
            </Link>
            <span className="mx-2">&gt;</span>
            <Link
              href={`/connections/${trigger.connection_id}#triggers`}
              className="hover:text-blue-600"
            >
              Triggers
            </Link>
            <span className="mx-2">&gt;</span>
            <span className="text-gray-700">{trigger.name}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trigger.name}</h1>
            </div>
            <button
              onClick={() => setLocation(`/triggers/${id}/edit`)}
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
