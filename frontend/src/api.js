/**
 * API client for the Hopthu backend.
 */

const API_BASE = '';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle 401 by redirecting to login
  if (response.status === 401) {
    window.location.href = '/login';
    return null;
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Unknown error');
  }

  return data;
}

export const api = {
  // Auth
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  // Accounts
  listAccounts: () => request('/api/accounts'),
  createAccount: (data) => request('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateAccount: (id, data) => request(`/api/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteAccount: (id) => request(`/api/accounts/${id}`, {
    method: 'DELETE',
  }),
  testAccount: (id) => request(`/api/accounts/${id}/test`, {
    method: 'POST',
  }),

  // Mailboxes
  listMailboxes: (accountId) => request(`/api/accounts/${accountId}/mailboxes`),
  fetchMailboxes: (accountId) => request(`/api/accounts/${accountId}/mailboxes/fetch`, {
    method: 'POST',
  }),
  updateMailbox: (id, data) => request(`/api/mailboxes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Emails
  listEmails: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/emails${query ? '?' + query : ''}`);
  },
  getEmail: (id) => request(`/api/emails/${id}`),
  updateEmailStatus: (id, status) => request(`/api/emails/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
  syncAll: () => request('/api/sync', { method: 'POST' }),
  syncAccount: (id) => request(`/api/accounts/${id}/sync`, { method: 'POST' }),

  // Templates
  listTemplates: () => request('/api/templates'),
  extractTemplateFields: (data) => request('/api/templates/extract-fields', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createTemplate: (data) => request('/api/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getTemplate: (id) => request(`/api/templates/${id}`),
  updateTemplate: (id, data) => request(`/api/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, {
    method: 'DELETE',
  }),
  testTemplate: (id, emailId) => request(`/api/templates/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ email_id: emailId }),
  }),
  getEmailTemplates: (emailId) => request(`/api/emails/${emailId}/templates`),
  reparseEmail: (id) => request(`/api/emails/${id}/reparse`, {
    method: 'POST',
  }),
};
