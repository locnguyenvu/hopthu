import { useState, useEffect } from 'preact/hooks';
import { Link } from 'preact-router';
import { Layout } from '../components/Layout';
import { api } from '../api';
import { bp } from '../lib/base';

export function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templatesWithTriggers, setTemplatesWithTriggers] = useState(new Set());

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.listTemplates();
      const templatesData = response.data || [];
      setTemplates(templatesData);
      
      // Check for triggers for each template
      const templatesWithTriggerIds = new Set();
      for (const template of templatesData) {
        try {
          const triggerResponse = await api.listTriggers({ template_id: template.id });
          if (triggerResponse.data && triggerResponse.data.length > 0) {
            templatesWithTriggerIds.add(template.id);
          }
        } catch (err) {
          console.error(`Error checking triggers for template ${template.id}:`, err);
        }
      }
      setTemplatesWithTriggers(templatesWithTriggerIds);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      await loadTemplates();
    } catch (e) {
      alert('Failed to delete: ' + e.message);
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
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <Link
          href={bp('/templates/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + New Template
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">No templates yet</p>
          <p className="text-sm text-gray-400">
            Create templates from email details to extract structured data
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Has Trigger
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={bp(`/templates/${template.id}`)}
                      className="text-blue-600 hover:text-blue-900 block"
                    >
                      <div className="font-medium text-gray-900">
                        {template.subject || 'Any subject'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {template.from_email}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {template.priority ?? 'Auto'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {templatesWithTriggers.has(template.id) ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={bp(`/templates/${template.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600 hover:text-red-900"
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
    </Layout>
  );
}
