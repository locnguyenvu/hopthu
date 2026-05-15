import { useState, useEffect, useRef } from 'preact/hooks';
import { Link } from 'wouter';
import {
  ArrowLeft,
  MoreVertical,
  Trash2,
  Clock,
  Sparkles,
  EyeOff,
  CheckCircle2,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { api } from '../api';

export function EmailViewer({ emailId, onBack, onStatusChange }) {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [triggerLogs, setTriggerLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('content');
  const [showActions, setShowActions] = useState(false);
  const [contentHeight, setContentHeight] = useState('600px');
  const [selectedLog, setSelectedLog] = useState(null);
  const containerRef = useRef(null);
  const actionsRef = useRef(null);

  // Load email when ID changes
  useEffect(() => {
    if (!emailId) {
      setEmail(null);
      setActiveTab('content');
      return;
    }
    loadEmail();
  }, [emailId]);

  // Auto-switch to content tab if no logs/templates/data
  useEffect(() => {
    if (email && !loading) {
      if (!email.email_data && activeTab === 'data') {
        setActiveTab('content');
      }
      if (triggerLogs.length === 0 && activeTab === 'logs') {
        setActiveTab('content');
      }
      if (templates.length === 0 && activeTab === 'templates') {
        setActiveTab('content');
      }
    }
  }, [email, templates, triggerLogs, loading]);

  // Calculate content height
  useEffect(() => {
    const updateHeight = () => {
      const container = containerRef.current;
      if (container) {
        const containerTop = container.getBoundingClientRect().top;
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - containerTop - 24;
        setContentHeight(`${Math.max(availableHeight, 400)}px`);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [email]);

  // Close actions menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadEmail = async () => {
    try {
      setLoading(true);
      const [emailRes, templatesRes] = await Promise.all([
        api.getEmail(emailId),
        api.getEmailTemplates(emailId),
      ]);
      const emailData = emailRes.data;
      const templatesData = templatesRes.data || [];
      setEmail(emailData);
      setTemplates(templatesData);

      // Load trigger logs
      let logs = [];
      try {
        const logsRes = await api.listAllTriggerLogs({ email_id: emailId });
        logs = logsRes.data.logs || [];
      } catch (e) {
        console.error('Failed to load trigger logs:', e);
        logs = [];
      }

      setTriggerLogs(logs);

      // Auto-switch to content tab if no data
      // These checks happen after state updates, so they use the current activeTab value
      if (!emailData.email_data && activeTab === 'data') {
        setActiveTab('content');
      }
      if (logs.length === 0 && activeTab === 'logs') {
        setActiveTab('content');
      }
      if (templatesData.length === 0 && activeTab === 'templates') {
        setActiveTab('content');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await api.updateEmailStatus(emailId, status);
      await loadEmail();
      // Notify parent that status changed, so email list can refresh
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (e) {
      alert('Failed to update status: ' + e.message);
    }
  };

  const handleReparse = async () => {
    try {
      await api.reparseEmail(emailId);
      await loadEmail();
    } catch (e) {
      alert('Failed to reparse: ' + e.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'extracted': return 'bg-green-100 text-green-800';
      case 'ignored': return 'bg-yellow-100 text-yellow-800';
      case 'pushed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderBody = () => {
    if (!email?.body) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No content available</p>
        </div>
      );
    }

    if (email.content_type === 'text/html') {
      return (
        <iframe
          srcdoc={email.body}
          sandbox="allow-same-origin"
          className="w-full border-0"
          style={{ height: contentHeight, minHeight: '400px' }}
          title="Email content"
        />
      );
    }

    return (
      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 p-4" style={{ height: contentHeight }}>
        {email.body}
      </pre>
    );
  };

  // Empty state when no email selected
  if (!emailId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white text-center px-4">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-gray-700 mb-2">Select an email to read</h3>
        <p className="text-gray-500 max-w-md">
          Choose an email from the list on the left to view its contents and details.
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error state
  if (error || !email) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white px-4">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-center">{error || 'Email not found'}</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-1">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}

          {/* Status Actions */}
          <button
            onClick={() => handleStatusChange('ignored')}
            disabled={email.status === 'ignored'}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Mark as Ignored"
          >
            <EyeOff className={`w-5 h-5 ${email.status === 'ignored' ? 'text-amber-600' : 'text-gray-600'}`} />
          </button>
          <button
            onClick={handleReparse}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Re-parse / Extract"
          >
            <Sparkles className="w-5 h-5 text-gray-600" />
          </button>

        </div>
        {/* More Actions */}
        <div className="relative" ref={actionsRef}>
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
          {showActions && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
              <button
                onClick={() => { handleStatusChange('new'); setShowActions(false); }}
                disabled={email.status === 'new'}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Mark as New
              </button>
              <button
                onClick={() => { handleStatusChange('extracted'); setShowActions(false); }}
                disabled={email.status === 'extracted'}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Mark as Extracted
              </button>
              <button
                onClick={() => { handleStatusChange('pushed'); setShowActions(false); }}
                disabled={email.status === 'pushed'}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Mark as Pushed
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Email Header */}
      <div className="px-6 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-xl font-medium text-gray-900 leading-tight truncate" title={email.subject}>
            {email.subject || '(no subject)'}
          </h1>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(email.status)}`}>
            {email.status}
          </span>
        </div>

        {/* Sender Info */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-700">
            {email.from_email?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{email.from_email}</span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              <span className="text-gray-400">to </span>
              <span>{email.to_email || 'me'}</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            {formatDate(email.received_at)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab('content')}
          className={`
            px-4 py-3 text-sm font-medium transition-colors relative
            ${activeTab === 'content'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          Email Content
          {activeTab === 'content' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`
            px-4 py-3 text-sm font-medium transition-colors relative
            ${activeTab === 'templates'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          Templates
          {templates.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
              {templates.length}
            </span>
          )}
          {activeTab === 'templates' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        {email.email_data && (
          <button
            onClick={() => setActiveTab('data')}
            className={`
              px-4 py-3 text-sm font-medium transition-colors relative
              ${activeTab === 'data'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Extracted Data
            {activeTab === 'data' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        )}
        {triggerLogs.length > 0 && (
          <button
            onClick={() => setActiveTab('logs')}
            className={`
              px-4 py-3 text-sm font-medium transition-colors relative
              ${activeTab === 'logs'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Logs
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
              {triggerLogs.length}
            </span>
            {activeTab === 'logs' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        )}
      </div>

      {/* Content Area */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {activeTab === 'content' && (
          <div className="p-1">
            {renderBody()}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-6 space-y-4">
            {templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No templates match this sender</p>
                <Link
                  href={`/emails/${emailId}/new-template`}
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Template
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-700">Matching Templates</h3>
                  <Link
                    href={`/emails/${emailId}/new-template`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Create New Template
                  </Link>
                </div>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{template.from_email}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Subject: {template.subject || template.subject_pattern || 'Any subject'}
                        </p>
                      </div>
                      <Link
                        href={`/templates/${template.id}`}
                        className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'data' && email.email_data && (
          <div className="p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Extracted Data</h3>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto text-sm">
              {JSON.stringify(email.email_data.data, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-6 space-y-3">
            {triggerLogs.map((log) => (
              <div
                key={log.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {log.status}
                    </span>
                    <span className="font-medium text-gray-900">{log.trigger_name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(log.executed_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{log.request_method}</span>
                  <span className="ml-2 text-gray-500">{log.request_url}</span>
                </div>
                {log.response_status && (
                  <div className="mt-2 text-sm">
                    Response: <span className={log.response_status < 400 ? 'text-green-600' : 'text-red-600'}>
                      {log.response_status}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Execution Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
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
    </div>
  );
}
