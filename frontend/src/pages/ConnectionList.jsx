import { useState, useEffect, useContext } from 'preact/hooks';
import { Link } from 'preact-router';
import {
  Plus,
  Link as LinkIcon,
  Trash2,
  Play,
  Loader2,
  AlertCircle,
  Globe,
  Zap,
  Server
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, CardContent } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { api } from '../api';
import { ToastContext } from '../app';
import { bp } from '../lib/base';

// Method badge component
function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-emerald-100 text-emerald-700',
    PUT: 'bg-amber-100 text-amber-700',
    PATCH: 'bg-purple-100 text-purple-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${colors[method] || 'bg-gray-100 text-gray-700'}`}>
      {method}
    </span>
  );
}

// Mobile card component
function ConnectionCard({ conn, onTest, onDelete, testing }) {
  return (
    <div className="p-4 border-b border-[var(--color-border)] last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={bp(`/connections/${conn.id}`)}
            className="font-semibold text-[var(--color-primary)] hover:underline block truncate"
          >
            {conn.name}
          </Link>
          <div className="flex items-center gap-2 mt-2 text-sm text-[var(--color-muted-foreground)]">
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{conn.endpoint}</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <MethodBadge method={conn.method} />
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
              <Zap className="w-3.5 h-3.5" />
              <span>{conn.trigger_count || 0} triggers</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onTest(conn.id)}
          loading={testing === conn.id}
          className="flex-1"
        >
          {testing === conn.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Test
        </Button>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => onDelete(conn.id, conn.name)}
          className="text-[var(--color-destructive)] hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </IconButton>
      </div>
    </div>
  );
}

// Desktop table row
function ConnectionRow({ conn, onTest, onDelete, testing }) {
  return (
    <tr className="transition-colors hover:bg-[var(--color-muted)]">
      <td className="px-4 py-4">
        <Link
          href={bp(`/connections/${conn.id}`)}
          className="font-medium text-[var(--color-primary)] hover:underline"
        >
          {conn.name}
        </Link>
      </td>
      <td className="px-4 py-4 text-sm text-[var(--color-muted-foreground)] truncate max-w-xs">
        {conn.endpoint}
      </td>
      <td className="px-4 py-4">
        <MethodBadge method={conn.method} />
      </td>
      <td className="px-4 py-4 text-sm text-[var(--color-foreground)]">
        {conn.trigger_count > 0 ? conn.trigger_count : <span className="text-[var(--color-muted-foreground)]">0</span>}
      </td>
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTest(conn.id)}
            loading={testing === conn.id}
          >
            {testing === conn.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Test
          </Button>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => onDelete(conn.id, conn.name)}
            className="text-[var(--color-destructive)] hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

export function ConnectionList() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const toast = useContext(ToastContext);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const result = await api.listConnections();
      setConnections(result.data || []);
    } catch (e) {
      toast.error('Failed to load connections: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id) => {
    try {
      setTestingId(id);
      const result = await api.testConnection(id);
      if (result.data.success) {
        toast.success(`Connection test passed (${result.data.response_status})`);
      } else {
        toast.error(`Connection test failed (${result.data.response_status})`);
      }
    } catch (e) {
      toast.error('Test failed: ' + e.message);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete connection "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteConnection(id);
      toast.success('Connection deleted');
      loadConnections();
    } catch (e) {
      toast.error('Failed to delete: ' + e.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-foreground)]">Connections</h1>
            <p className="text-[var(--color-muted-foreground)] mt-1">
              Manage external API integrations
            </p>
          </div>
          <Link href={bp('/connections/new')}>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              New Connection
            </Button>
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-[var(--color-muted-foreground)]">Loading connections...</p>
            </CardContent>
          </Card>
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-[var(--color-muted)] rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-[var(--color-muted-foreground)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--color-foreground)] mb-2">No connections yet</h3>
              <p className="text-[var(--color-muted-foreground)] mb-6">Create a connection to integrate with external systems</p>
              <Link href={bp('/connections/new')}>
                <Button>
                  <Plus className="w-4 h-4" />
                  Create Connection
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {/* Mobile View */}
            <div className="md:hidden divide-y divide-[var(--color-border)]">
              {connections.map((conn) => (
                <ConnectionCard
                  key={conn.id}
                  conn={conn}
                  onTest={handleTest}
                  onDelete={handleDelete}
                  testing={testingId}
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider w-24">
                      Method
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider w-24">
                      Triggers
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {connections.map((conn) => (
                    <ConnectionRow
                      key={conn.id}
                      conn={conn}
                      onTest={handleTest}
                      onDelete={handleDelete}
                      testing={testingId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
