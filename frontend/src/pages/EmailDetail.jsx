import { useState, useEffect, useRef } from 'preact/hooks';
import { Link, route } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { bp } from '../lib/base';

export function EmailDetail({ id }) {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [triggerLogs, setTriggerLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [activeTab, setActiveTab] = useState('content'); // Default to 'content' tab
  const [contentHeight, setContentHeight] = useState('auto');
  const [showActions, setShowActions] = useState(false);
  const containerRef = useRef(null);
  const actionsRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Calculate height regardless of which tab is active
    // Delay to ensure DOM is rendered
    const updateHeight = () => {
      const container = containerRef.current;
      if (container) {
        const containerTop = container.getBoundingClientRect().top;
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - containerTop - 24;
        // Only update if the available height is greater than our minimum
        if (availableHeight > 800) {
          setContentHeight(`${availableHeight}px`);
        } else {
          setContentHeight('800px');
        }
      }
    };
    
    setTimeout(updateHeight, 0);
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [activeTab, email]); // Recalculate when tab or email changes

  const loadData = async () => {
    try {
      setLoading(true);
      const [emailRes, templatesRes] = await Promise.all([
        api.getEmail(id),
        api.getEmailTemplates(id),
      ]);
      setEmail(emailRes.data);
      setTemplates(templatesRes.data || []);
      
      // Load trigger logs for this email
      await loadTriggerLogs();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  
  const loadTriggerLogs = async () => {
    try {
      setLoadingLogs(true);
      const response = await api.listAllTriggerLogs({ email_id: id });
      setTriggerLogs(response.data.logs || []);
    } catch (e) {
      console.error('Failed to load trigger logs:', e.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleStatusChange = async (status) => {
    setUpdating(true);
    try {
      await api.updateEmailStatus(id, status);
      await loadData();
    } catch (e) {
      alert('Failed to update status: ' + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReparse = async () => {
    setParsing(true);
    try {
      await api.reparseEmail(id);
      await loadData();
    } catch (e) {
      alert('Failed to reparse: ' + e.message);
    } finally {
      setParsing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const renderBody = () => {
    if (!email?.body) return <p className="text-gray-500 italic">No content</p>;

    if (email.content_type === 'text/html') {
      return (
        <iframe
          srcdoc={email.body}
          sandbox="allow-same-origin"
          className="w-full border border-gray-200 rounded-md flex-grow"
          style={{ height: contentHeight, minHeight: 0 }}
          title="Email content"
        />
      );
    }

    return (
      <pre 
        className="bg-gray-50 p-4 rounded-md overflow-auto whitespace-pre-wrap text-sm"
        style={{ height: contentHeight }}
      >
        {email.body}
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

  if (!email) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Email not found</p>
          <Link href={bp('/')} className="mt-4 text-blue-600 hover:text-blue-700">
            Back to Inbox
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-4">
        <Link href={bp('/')} className="text-blue-600 hover:text-blue-700 text-sm">
          ← Back to Inbox
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-700">{email.subject || '(no subject)'}</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col flex-grow min-h-[80vh]">
          {/* Headers - Compact */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm mb-3 pb-3 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-medium">From:</span>
                <span>{email.from_email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-medium">To:</span>
                <span>{email.to_email || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-medium">Received:</span>
                <span>{formatDate(email.received_at)}</span>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                email.status === 'extracted'
                  ? 'bg-green-100 text-green-800'
                  : email.status === 'ignored'
                  ? 'bg-yellow-100 text-yellow-800'
                  : email.status === 'pushed'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {email.status}
              </span>
            </div>
            {/* Actions Menu */}
            <div className="relative" ref={actionsRef}>
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1.5 hover:bg-gray-100 rounded-md"
              >
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {showActions && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <button
                    onClick={() => { handleStatusChange('ignored'); setShowActions(false); }}
                    disabled={updating || email.status === 'ignored'}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark Ignored
                  </button>
                  <button
                    onClick={() => { handleStatusChange('new'); setShowActions(false); }}
                    disabled={updating || email.status === 'new'}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark New
                  </button>
                  <button
                    onClick={() => { handleStatusChange('extracted'); setShowActions(false); }}
                    disabled={updating || email.status === 'extracted'}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark Extracted
                  </button>
                  <button
                    onClick={() => { handleStatusChange('pushed'); setShowActions(false); }}
                    disabled={updating || email.status === 'pushed'}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark Pushed
                  </button>
                  <button
                    onClick={() => { handleReparse(); setShowActions(false); }}
                    disabled={parsing}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Re-parse
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs: Content / Matching Templates */}
          <div className="mb-3 border-b border-gray-200">
            <nav className="-mb-px flex space-x-4">
              <button
                onClick={() => setActiveTab('content')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'content'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Content
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Templates{templates.length > 0 && ` (${templates.length})`}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-grow overflow-auto flex flex-col">
            {activeTab === 'content' && (
              <div ref={containerRef} className="h-full flex flex-col flex-grow">
                {renderBody()}
              </div>
            )}

          {activeTab === 'templates' && (
            <div className="space-y-6 h-full overflow-auto flex-grow flex flex-col">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">Matching Templates</h3>
                  <Link
                    href={bp(`/emails/${id}/new-template`)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Create Template
                  </Link>
                </div>
                {templates.length === 0 ? (
                  <p className="text-gray-500">No templates match this sender.</p>
                ) : (
                  <div className="space-y-2 flex-grow">
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                        <div>
                          <p className="font-medium">{template.subject || 'Any subject'}</p>
                        </div>
                        <Link
                          href={bp(`/templates/${template.id}`)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Edit
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {email.email_data && (
                <div className="pt-6 border-t border-gray-200 flex-grow">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Extracted Data</h3>
                  <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm flex-grow">
                    {JSON.stringify(email.email_data.data, null, 2)}
                  </pre>
                </div>
              )}
              <div className="pt-6 border-t border-gray-200 flex-grow overflow-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">Execution Logs</h3>
                </div>
                {loadingLogs ? (
                  <p className="text-gray-500">Loading logs...</p>
                ) : triggerLogs.length === 0 ? (
                  <p className="text-gray-500">No trigger logs for this email.</p>
                ) : (
                  <div className="space-y-3 flex-grow overflow-auto">
                    {triggerLogs.map((log) => (
                      <div key={log.id} className="border border-gray-200 rounded-md p-4 flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.status === 'success'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {log.status}
                            </span>
                            <span className="text-sm text-gray-600">
                              {log.trigger_name}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(log.executed_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-3 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-700">{log.request_method}</span>
                            <span className="truncate">{log.request_url}</span>
                          </div>

                          {log.response_status && (
                            <div className="mt-1">
                              Response: <span className={log.response_status < 400 ? 'text-green-600' : 'text-red-600'}>
                                {log.response_status}
                              </span>
                            </div>
                          )}

                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              Request details
                            </summary>
                            <div className="mt-2 text-xs">
                              <div className="bg-gray-50 p-2 rounded">
                                <div className="mb-2">
                                  <strong>Headers:</strong>
                                  <pre className="mt-1">{JSON.stringify(log.request_headers, null, 2)}</pre>
                                </div>
                                <div className="mb-2">
                                  <strong>Body:</strong>
                                  <pre className="mt-1 overflow-auto max-h-32">{JSON.stringify(log.request_body, null, 2)}</pre>
                                </div>
                                {log.response_body && (
                                  <div>
                                    <strong>Response:</strong>
                                    <pre className="mt-1 overflow-auto max-h-32">{log.response_body}</pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
