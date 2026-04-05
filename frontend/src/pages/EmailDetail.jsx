import { useState, useEffect, useRef } from 'preact/hooks';
import { Link, route } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';

export function EmailDetail({ id }) {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [contentHeight, setContentHeight] = useState('auto');
  const containerRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'content') {
      const updateHeight = () => {
        const container = containerRef.current;
        if (container) {
          const containerTop = container.getBoundingClientRect().top;
          const viewportHeight = window.innerHeight;
          const availableHeight = viewportHeight - containerTop - 24;
          setContentHeight(`${availableHeight}px`);
        }
      };
      // Delay to ensure DOM is rendered
      setTimeout(updateHeight, 0);
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, [activeTab, email]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [emailRes, templatesRes] = await Promise.all([
        api.getEmail(id),
        api.getEmailTemplates(id),
      ]);
      setEmail(emailRes.data);
      setTemplates(templatesRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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
          className="w-full border border-gray-200 rounded-md"
          style={{ height: contentHeight }}
          title="Email content"
        />
      );
    }

    return (
      <pre className="bg-gray-50 p-4 rounded-md overflow-auto whitespace-pre-wrap text-sm" style={{ maxHeight: contentHeight }}>
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
          <Link href="/" className="mt-4 text-blue-600 hover:text-blue-700">
            Back to Inbox
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-4">
        <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm">
          ← Back to Inbox
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {/* Headers */}
        <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2 text-sm font-medium text-gray-500">From:</div>
            <div className="col-span-10 text-sm">{email.from_email}</div>
          </div>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2 text-sm font-medium text-gray-500">To:</div>
            <div className="col-span-10 text-sm">{email.to_email || '-'}</div>
          </div>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2 text-sm font-medium text-gray-500">Subject:</div>
            <div className="col-span-10 text-sm font-medium">{email.subject || '(no subject)'}</div>
          </div>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2 text-sm font-medium text-gray-500">Received:</div>
            <div className="col-span-10 text-sm">{formatDate(email.received_at)}</div>
          </div>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2 text-sm font-medium text-gray-500">Status:</div>
            <div className="col-span-10">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                email.status === 'extracted'
                  ? 'bg-green-100 text-green-800'
                  : email.status === 'ignored'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {email.status}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => handleStatusChange('ignored')}
            disabled={updating || email.status === 'ignored'}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            {updating ? 'Updating...' : 'Mark Ignored'}
          </button>
          <button
            onClick={() => handleStatusChange('new')}
            disabled={updating || email.status === 'new'}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            Mark New
          </button>
          <button
            onClick={handleReparse}
            disabled={parsing}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 disabled:opacity-50"
          >
            {parsing ? 'Re-parsing...' : 'Re-parse'}
          </button>
          <Link
            href={`/emails/${id}/new-template`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Create Template
          </Link>
        </div>

        {/* Tabs: Content / Matching Templates */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab('content')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'content'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Content
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
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
        {activeTab === 'content' && (
          <div ref={containerRef}>
            {renderBody()}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-6">
            {templates.length === 0 ? (
              <p className="text-gray-500">No templates match this sender.</p>
            ) : (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Matching Templates</h3>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div key={template.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                      <div>
                        <p className="font-medium">{template.subject || 'Any subject'}</p>
                      </div>
                      <Link
                        href={`/templates/${template.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Edit
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {email.email_data && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Extracted Data</h3>
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
                  {JSON.stringify(email.email_data.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
