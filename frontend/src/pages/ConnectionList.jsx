import { useState, useEffect, useContext } from 'preact/hooks';
import { Link } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { ToastContext } from '../app';

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
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
          <Link
            href="/connections/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            New Connection
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No connections yet. Create one to integrate with external systems.
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggers</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {connections.map((conn) => (
                  <tr key={conn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/connections/${conn.id}`} className="text-blue-600 hover:underline font-medium">
                        {conn.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{conn.endpoint}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {conn.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {conn.trigger_count > 0 ? conn.trigger_count : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleTest(conn.id)}
                        disabled={testingId === conn.id}
                        className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 mr-2"
                      >
                        {testingId === conn.id ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => handleDelete(conn.id, conn.name)}
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
    </Layout>
  );
}