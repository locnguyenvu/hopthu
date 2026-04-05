import { useState, useEffect, useContext } from 'preact/hooks';
import { Link } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { ToastContext } from '../app';

export function Inbox() {
  const toast = useContext(ToastContext);
  const [emails, setEmails] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 });
  const [filters, setFilters] = useState({
    from_email: '',
    status: '',
    account_id: '',
  });
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    loadData();
  }, [pagination.page]);

  // Clear selection when page/filter changes
  useEffect(() => {
    setSelectedEmails(new Set());
  }, [pagination.page, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        per_page: pagination.per_page,
      };
      if (filters.from_email) params.from_email = filters.from_email;
      if (filters.status) params.status = filters.status;
      if (filters.account_id) params.account_id = filters.account_id;

      const [emailsRes, accountsRes] = await Promise.all([
        api.listEmails(params),
        api.listAccounts(),
      ]);
      setEmails(emailsRes.data || []);
      setPagination(prev => ({ ...prev, ...emailsRes.pagination }));
      setAccounts(accountsRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncAll();
      // Wait a moment for sync to start, then reload
      setTimeout(() => {
        loadData();
        setSyncing(false);
      }, 2000);
    } catch (e) {
      setError(e.message);
      setSyncing(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadData();
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedEmails(new Set());
  };

  const handleBulkExtract = async () => {
    if (selectedEmails.size === 0) return;
    setExtracting(true);
    const ids = [...selectedEmails];

    // Process each email sequentially
    for (const id of ids) {
      const email = emails.find(e => e.id === id);
      const label = email?.subject || email?.from_email || `Email #${id}`;
      try {
        await api.reparseEmail(id);
        toast.success(`Extracted: ${label}`);
      } catch (e) {
        toast.error(`Failed: ${label} - ${e.message}`);
      }
    }

    setExtracting(false);
    clearSelection();
    loadData();
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-gray-100 text-gray-800',
      extracted: 'bg-green-100 text-green-800',
      ignored: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.new}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const isSelectedAll = emails.length > 0 && selectedEmails.size === emails.length;
  const isSomeSelected = selectedEmails.size > 0 && selectedEmails.size < emails.length;

  return (
    <Layout
      collapsibleSidebar
      sidebar={
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Accounts</h3>
          <div className="space-y-1">
            <button
              onClick={() => { setFilters(prev => ({ ...prev, account_id: '' })); applyFilters(); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                filters.account_id === '' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Accounts
            </button>
            {accounts.map(account => (
              <button
                key={account.id}
                onClick={() => { setFilters(prev => ({ ...prev, account_id: account.id })); applyFilters(); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  filters.account_id == account.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {account.email}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : '🔄 Sync'}
          </button>
        </div>

        {/* Bulk action bar */}
        {selectedEmails.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-4">
            <span className="text-sm font-medium text-blue-900">
              {selectedEmails.size} email{selectedEmails.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleBulkExtract}
              disabled={extracting}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {extracting ? 'Extracting...' : '📤 Extract'}
            </button>
            <button
              onClick={clearSelection}
              disabled={extracting}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="text"
                name="from_email"
                value={filters.from_email}
                onChange={handleFilterChange}
                placeholder="Filter by sender..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All</option>
                <option value="new">New</option>
                <option value="extracted">Extracted</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
            <button
              onClick={applyFilters}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Apply
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No emails yet</p>
            <button
              onClick={handleSync}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Sync emails now
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={isSelectedAll}
                      ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                      onChange={toggleSelectAll}
                      disabled={extracting}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {emails.map((email) => (
                  <tr
                    key={email.id}
                    className={`hover:bg-gray-50 ${selectedEmails.has(email.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(email.id)}
                        onChange={() => toggleSelect(email.id)}
                        disabled={extracting}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/emails/${email.id}`}
                        className="text-gray-900 font-medium"
                      >
                        {email.from_email}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/emails/${email.id}`}
                        className="text-gray-600 hover:text-blue-600"
                      >
                        {email.subject || '(no subject)'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(email.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(email.received_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.per_page) + 1} to{' '}
                {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page * pagination.per_page >= pagination.total}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
