import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';

export function AccountForm({ id }) {
  const [form, setForm] = useState({
    email: '',
    host: '',
    port: 993,
    is_ssl: true,
    password: '',
    timezone: APP_TZ,
  });
  const [appTimezone, setAppTimezone] = useState(APP_TZ);
  const [loading, setLoading] = useState(true); // Start with loading state
  const isEdit = Boolean(id);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form and load account details if editing
  useEffect(() => {
    const loadAccountDetails = async () => {
      if (isEdit) {
        try {
          // If editing, load the account details
          const accounts = await api.listAccounts();
          const account = accounts.data.find(acc => acc.id == id);
          if (account) {
            // Don't include password when loading for editing
            setForm({
              email: account.email,
              host: account.host,
              port: account.port,
              is_ssl: account.is_ssl,
              timezone: account.timezone || APP_TZ,
              password: '', // Don't populate password field for security reasons
            });
          }
        } catch (err) {
          setError(err.message);
        }
      }
      // Stop showing loading state after initialization
      setLoading(false);
    };

    loadAccountDetails();
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTest = async () => {
    if (!form.email || !form.host) {
      setError('Please fill in email and host');
      return;
    }
    
    setTesting(true);
    setError(null);
    try {
      if (isEdit) {
        // For editing, only test if a new password is provided
        if (!form.password) {
          setError('Enter a new password to test connection');
          return;
        }
        await api.updateAccountPassword(id, { password: form.password });
      } else {
        // For creating, password is required
        if (!form.password) {
          setError('Password is required when creating an account');
          return;
        }
        await api.createAccount(form);
      }
      alert('Connection successful!');
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        // For editing, exclude password from the general update
        const updateData = { ...form };
        delete updateData.password; // Don't send password with general account update
        
        // Update the account details
        await api.updateAccount(id, updateData);
        
        // If password was provided, update it separately
        if (form.password) {
          await api.updateAccountPassword(id, { password: form.password });
        }
      } else {
        await api.createAccount(form);
      }
      route('/accounts');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Email Account</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your-email@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
                IMAP Host
              </label>
              <input
                type="text"
                id="host"
                name="host"
                value={form.host}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="imap.example.com"
              />
            </div>

            <div>
              <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
                Port
              </label>
              <input
                type="number"
                id="port"
                name="port"
                value={form.port}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_ssl"
              name="is_ssl"
              checked={form.is_ssl}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_ssl" className="ml-2 block text-sm text-gray-700">
              Use SSL/TLS
            </label>
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <input
              type="text"
              id="timezone"
              name="timezone"
              value={form.timezone}
              onChange={handleChange}
              placeholder={`Default: ${APP_TZ}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter a valid timezone identifier (e.g., Asia/Ho_Chi_Minh, America/New_York, UTC)
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required={!isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isEdit ? "Leave blank to keep current password" : "Your email password"}
            />
            {isEdit && (
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to keep the current password unchanged.
              </p>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || saving}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={testing || saving}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
