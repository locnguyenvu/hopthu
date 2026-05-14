import { useState, useEffect } from 'preact/hooks';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { route } from 'preact-router';
import { bp } from '../lib/base';

export function AccountDetail({ id }) {
  const [account, setAccount] = useState(null);
  const [mailboxes, setMailboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountRes, mailboxesRes] = await Promise.all([
        api.listAccounts().then(r => r.data.find(a => a.id == id)),
        api.listMailboxes(id),
      ]);
      setAccount(accountRes);
      setMailboxes(mailboxesRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchMailboxes = async () => {
    setFetching(true);
    try {
      await api.fetchMailboxes(id);
      await loadData();
    } catch (e) {
      alert('Failed to fetch mailboxes: ' + e.message);
    } finally {
      setFetching(false);
    }
  };

  const toggleMailbox = async (mailboxId, isActive) => {
    try {
      await api.updateMailbox(mailboxId, { is_active: !isActive });
      await loadData();
    } catch (e) {
      alert('Failed to update mailbox: ' + e.message);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{account?.email}</h1>
        <button
          onClick={() => route(bp(`/accounts/${id}/edit`))}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Edit Account
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Mailboxes</h2>
        <button
          onClick={handleFetchMailboxes}
          disabled={fetching}
          className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {fetching ? 'Fetching...' : 'Fetch Mailboxes'}
        </button>

        {mailboxes.length === 0 ? (
          <p className="text-gray-500">No mailboxes found. Click "Fetch Mailboxes" to load them.</p>
        ) : (
          <div className="space-y-2">
            {mailboxes.map((mailbox) => (
              <div
                key={mailbox.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
              >
                <span className="font-medium">{mailbox.name}</span>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mailbox.is_active}
                    onChange={() => toggleMailbox(mailbox.id, mailbox.is_active)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">Active</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
