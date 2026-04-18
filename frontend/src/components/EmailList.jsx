import { useState, useEffect, useContext, useCallback } from 'preact/hooks';
import {
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  ChevronLeft,
  ChevronRight,
  InboxIcon,
  AlertCircle,
  Sparkles,
  EyeOff,
  CheckCircle2,
  Mail,
  MoreVertical,
  Filter,
} from 'lucide-react';
import { api } from '../api';
import { ToastContext } from '../app';

// Status badge component - Gmail style
function StatusBadge({ status }) {
  const styles = {
    new: { icon: Mail, color: 'text-gray-500' },
    extracted: { icon: Sparkles, color: 'text-emerald-600' },
    ignored: { icon: EyeOff, color: 'text-amber-600' },
    pushed: { icon: CheckCircle2, color: 'text-blue-600' },
  };

  const style = styles[status] || styles.new;
  const Icon = style.icon;

  return (
    <span className={`inline-flex items-center ${style.color}`} title={status}>
      <Icon className="w-4 h-4" />
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function EmailList({ selectedEmailId, onEmailSelect, refreshTrigger }) {
  const toast = useContext(ToastContext);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0 });
  const [filters, setFilters] = useState({
    from_email: '',
    status: '',
  });
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const loadEmails = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        per_page: pagination.per_page,
      };
      if (filters.from_email) params.from_email = filters.from_email;
      if (filters.status) params.status = filters.status;

      const response = await api.listEmails(params);
      setEmails(response.data || []);
      setPagination(prev => ({ ...prev, ...response.pagination }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, filters]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadEmails();
    }
  }, [refreshTrigger, loadEmails]);

  useEffect(() => {
    setSelectedEmails(new Set());
  }, [pagination.page, filters]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncAll();
      setTimeout(() => {
        loadEmails();
        setSyncing(false);
      }, 2000);
    } catch (e) {
      toast.error('Sync failed: ' + e.message);
      setSyncing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  };

  const toggleSelect = (e, id) => {
    e.stopPropagation();
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

  const isSelectedAll = emails.length > 0 && selectedEmails.size === emails.length;
  const isSomeSelected = selectedEmails.size > 0 && selectedEmails.size < emails.length;

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {/* Select All Checkbox */}
          <button
            onClick={toggleSelectAll}
            disabled={loading || emails.length === 0}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            {isSelectedAll ? (
              <CheckSquare className="w-5 h-5 text-gray-700" />
            ) : isSomeSelected ? (
              <MinusSquare className="w-5 h-5 text-gray-700" />
            ) : (
              <Square className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${syncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full transition-colors ${showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
            title="Filter"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Pagination Info */}
        <div className="text-sm text-gray-500">
          {pagination.total > 0 && (
            <span>{((pagination.page - 1) * pagination.per_page) + 1}-{Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total}</span>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="from_email"
                value={filters.from_email}
                onChange={handleFilterChange}
                placeholder="Filter by sender..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="extracted">Extracted</option>
              <option value="ignored">Ignored</option>
              <option value="pushed">Pushed</option>
            </select>
            <button
              onClick={applyFilters}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedEmails.size > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedEmails.size} selected
          </span>
          <button
            onClick={() => setSelectedEmails(new Set())}
            className="text-sm text-blue-700 hover:text-blue-900"
          >
            Clear
          </button>
        </div>
      )}

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <InboxIcon className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No emails found</p>
            <button
              onClick={handleSync}
              className="mt-3 text-blue-600 text-sm hover:underline"
            >
              Sync now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {emails.map((email) => {
              const isSelected = selectedEmailId === String(email.id);
              const isChecked = selectedEmails.has(email.id);

              return (
                <div
                  key={email.id}
                  onClick={() => onEmailSelect(String(email.id))}
                  className={`
                    group flex items-start gap-3 px-4 py-3 cursor-pointer
                    transition-all duration-150
                    ${isSelected
                      ? 'bg-[#c2dbff] border-l-4 border-blue-600'
                      : 'hover:bg-[#f2f6fc] border-l-4 border-transparent'
                    }
                  `}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => toggleSelect(e, email.id)}
                    className="p-1 rounded hover:bg-gray-200 transition-colors mt-0.5"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-gray-700" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    )}
                  </button>

                  {/* Status Icon */}
                  <div className="mt-1">
                    <StatusBadge status={email.status} />
                  </div>

                  {/* Subject and Sender combined */}
                  <div className="flex-1 min-w-0">
                    {/* Subject on top */}
                    <div className={`truncate ${email.status === 'new' ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                      {email.subject || '(no subject)'}
                    </div>
                    {/* Sender below */}
                    <div className="truncate text-sm text-gray-500">
                      {email.from_email}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-sm text-gray-500 whitespace-nowrap mt-0.5">
                    {formatDate(email.received_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > pagination.per_page && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page * pagination.per_page >= pagination.total || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
