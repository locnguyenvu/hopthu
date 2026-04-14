import { useState, useEffect, useContext } from 'preact/hooks';
import { Link } from 'preact-router';
import {
  RefreshCw,
  Filter,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  FileText,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Mail,
  Sparkles,
  InboxIcon,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { api } from '../api';
import { ToastContext } from '../app';

// Status badge component
function StatusBadge({ status }) {
  const styles = {
    new: { bg: 'bg-slate-100', text: 'text-slate-700', icon: Mail },
    extracted: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Sparkles },
    ignored: { bg: 'bg-amber-100', text: 'text-amber-700', icon: EyeOff },
    pushed: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle2 },
  };

  const style = styles[status] || styles.new;
  const Icon = style.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="capitalize">{status}</span>
    </span>
  );
}

// Email card component for mobile
function EmailCard({ email, isSelected, onToggle, disabled }) {
  return (
    <Link
      href={`/emails/${email.id}`}
      className={`block p-4 border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-muted)] ${
        isSelected ? 'bg-blue-50/50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle(email.id);
          }}
          disabled={disabled}
          className="mt-0.5 p-1 -ml-1 rounded hover:bg-gray-200 transition-colors"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-[var(--color-primary)]" />
          ) : (
            <Square className="w-5 h-5 text-[var(--color-muted-foreground)]" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-[var(--color-foreground)] truncate">
              {email.subject || '(no subject)'}
            </h4>
            <StatusBadge status={email.status} />
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)] truncate mt-1">
            {email.from_email}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(email.received_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}

// Desktop table row
function EmailRow({ email, isSelected, onToggle, disabled }) {
  return (
    <tr className={`transition-colors hover:bg-[var(--color-muted)] ${isSelected ? 'bg-blue-50/50' : ''}`}>
      <td className="px-4 py-4 whitespace-nowrap">
        <button
          onClick={() => onToggle(email.id)}
          disabled={disabled}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-[var(--color-primary)]" />
          ) : (
            <Square className="w-5 h-5 text-[var(--color-muted-foreground)]" />
          )}
        </button>
      </td>
      <td className="px-4 py-4">
        <Link href={`/emails/${email.id}`} className="block group">
          <div className="font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors">
            {email.subject || '(no subject)'}
          </div>
          <div className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
            {email.from_email}
          </div>
        </Link>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <StatusBadge status={email.status} />
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-[var(--color-muted-foreground)]">
        {formatDate(email.received_at)}
      </td>
    </tr>
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

export function Inbox() {
  const toast = useContext(ToastContext);
  const [emails, setEmails] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 });
  const [filters, setFilters] = useState({
    from_email: '',
    status: '',
    account_id: '',
  });
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadData();
  }, [pagination.page]);

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
    setBulkProcessing(true);
    const ids = [...selectedEmails];

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

    setBulkProcessing(false);
    clearSelection();
    loadData();
  };

  const handleBulkIgnore = async () => {
    if (selectedEmails.size === 0) return;
    setBulkProcessing(true);
    const ids = [...selectedEmails];

    for (const id of ids) {
      const email = emails.find(e => e.id === id);
      const label = email?.subject || email?.from_email || `Email #${id}`;
      try {
        await api.updateEmailStatus(id, 'ignored');
        toast.success(`Ignored: ${label}`);
      } catch (e) {
        toast.error(`Failed: ${label} - ${e.message}`);
      }
    }

    setBulkProcessing(false);
    clearSelection();
    loadData();
  };

  const isSelectedAll = emails.length > 0 && selectedEmails.size === emails.length;
  const isSomeSelected = selectedEmails.size > 0 && selectedEmails.size < emails.length;

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-foreground)]">Inbox</h1>
            <p className="text-[var(--color-muted-foreground)] mt-1">
              {pagination.total} emails total
            </p>
          </div>
          <Button
            onClick={handleSync}
            loading={syncing}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted-foreground)]" />
                  <input
                    type="text"
                    name="from_email"
                    value={filters.from_email}
                    onChange={handleFilterChange}
                    placeholder="Filter by sender..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="px-4 py-2.5 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  >
                    <option value="">All Status</option>
                    <option value="new">New</option>
                    <option value="extracted">Extracted</option>
                    <option value="ignored">Ignored</option>
                    <option value="pushed">Pushed</option>
                  </select>
                  <Button variant="secondary" onClick={applyFilters}>
                    <Filter className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Apply</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedEmails.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-blue-900">
              {selectedEmails.size} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                onClick={handleBulkExtract}
                loading={bulkProcessing}
              >
                <Sparkles className="w-4 h-4" />
                Extract
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkIgnore}
                loading={bulkProcessing}
              >
                <EyeOff className="w-4 h-4" />
                Ignore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={bulkProcessing}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-[var(--color-muted-foreground)]">Loading emails...</p>
            </CardContent>
          </Card>
        ) : emails.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-[var(--color-muted)] rounded-full flex items-center justify-center mx-auto mb-4">
                <InboxIcon className="w-8 h-8 text-[var(--color-muted-foreground)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--color-foreground)] mb-2">No emails yet</h3>
              <p className="text-[var(--color-muted-foreground)] mb-6">Sync your email accounts to get started</p>
              <Button onClick={handleSync} loading={syncing}>
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {/* Mobile View */}
            <div className="md:hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <button
                  onClick={toggleSelectAll}
                  disabled={bulkProcessing}
                  className="p-1 -ml-1 rounded hover:bg-gray-200 transition-colors"
                >
                  {isSelectedAll ? (
                    <CheckSquare className="w-5 h-5 text-[var(--color-primary)]" />
                  ) : isSomeSelected ? (
                    <MinusSquare className="w-5 h-5 text-[var(--color-primary)]" />
                  ) : (
                    <Square className="w-5 h-5 text-[var(--color-muted-foreground)]" />
                  )}
                </button>
                <span className="text-sm font-medium text-[var(--color-muted-foreground)]">Select all</span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {emails.map(email => (
                  <EmailCard
                    key={email.id}
                    email={email}
                    isSelected={selectedEmails.has(email.id)}
                    onToggle={toggleSelect}
                    disabled={bulkProcessing}
                  />
                ))}
              </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th className="px-4 py-3.5 w-12">
                      <button
                        onClick={toggleSelectAll}
                        disabled={bulkProcessing}
                        className="p-1 -ml-1 rounded hover:bg-gray-200 transition-colors"
                      >
                        {isSelectedAll ? (
                          <CheckSquare className="w-5 h-5 text-[var(--color-primary)]" />
                        ) : isSomeSelected ? (
                          <MinusSquare className="w-5 h-5 text-[var(--color-primary)]" />
                        ) : (
                          <Square className="w-5 h-5 text-[var(--color-muted-foreground)]" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider w-32">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider w-40">
                      Received
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {emails.map(email => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      isSelected={selectedEmails.has(email.id)}
                      onToggle={toggleSelect}
                      disabled={bulkProcessing}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-4 border-t border-[var(--color-border)] bg-[var(--color-muted)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Showing <span className="font-medium text-[var(--color-foreground)]">{((pagination.page - 1) * pagination.per_page) + 1}</span> to{' '}
                <span className="font-medium text-[var(--color-foreground)]">{Math.min(pagination.page * pagination.per_page, pagination.total)}</span> of{' '}
                <span className="font-medium text-[var(--color-foreground)]">{pagination.total}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page * pagination.per_page >= pagination.total}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
