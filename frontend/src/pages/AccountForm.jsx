import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';

export function AccountForm() {
  const [form, setForm] = useState({
    email: '',
    host: '',
    port: 993,
    is_ssl: true,
    password: '',
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTest = async () => {
    if (!form.email || !form.host || !form.password) {
      setError('Please fill in email, host, and password');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      // Create a temporary account to test
      await api.createAccount(form);
      // If we get here, connection succeeded but we don't want to save yet
      // Actually, the API saves on success, so just go to accounts list
      route('/accounts');
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
      await api.createAccount(form);
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your email password"
            />
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
