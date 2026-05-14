import { Router, Route } from 'preact-router';
import { useState, useCallback } from 'preact/hooks';
import { createContext } from 'preact';
import { Layout } from './components/Layout';
import { GmailLayout } from './components/GmailLayout';
import { ToastContainer } from './components/Toast';
import { Inbox } from './pages/Inbox';
import { AccountList } from './pages/AccountList';
import { AccountForm } from './pages/AccountForm';
import { AccountDetail } from './pages/AccountDetail';
import { EmailDetail } from './pages/EmailDetail';
import { TemplateList } from './pages/TemplateList';
import { TemplateEditor } from './pages/TemplateEditor';
import { ConnectionList } from './pages/ConnectionList';
import { ConnectionForm } from './pages/ConnectionForm';
import { ConnectionDetail } from './pages/ConnectionDetail';
import { TriggerEditor } from './pages/TriggerEditor';
import { TriggerDetail } from './pages/TriggerDetail';
import { getBase } from './lib/base';

export const ToastContext = createContext();
let toastId = 0;

export function App() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback({
    success: (message, opts) => addToast(message, 'success', opts?.duration),
    error: (message, opts) => addToast(message, 'error', opts?.duration),
    info: (message, opts) => addToast(message, 'info', opts?.duration),
  }, [addToast]);

  const base = getBase();

  return (
    <ToastContext.Provider value={toast}>
      <Router>
        <Route path={`${base}/`} component={GmailLayout} />
        <Route path={`${base}/accounts`} component={AccountList} />
        <Route path={`${base}/accounts/new`} component={AccountForm} />
        <Route path={`${base}/accounts/:id/edit`} component={AccountForm} />
        <Route path={`${base}/accounts/:id`} component={AccountDetail} />
        <Route path={`${base}/emails/:id`} component={EmailDetail} />
        <Route path={`${base}/templates`} component={TemplateList} />
        <Route path={`${base}/templates/new`} component={TemplateEditor} />
        <Route path={`${base}/templates/:id`} component={TemplateEditor} />
        <Route path={`${base}/emails/:emailId/new-template`} component={TemplateEditor} />
        <Route path={`${base}/connections`} component={ConnectionList} />
        <Route path={`${base}/connections/new`} component={ConnectionForm} />
        <Route path={`${base}/connections/:id`} component={ConnectionDetail} />
        <Route path={`${base}/triggers/new`} component={TriggerEditor} />
        <Route path={`${base}/triggers/:id/edit`} component={TriggerEditor} />
        <Route path={`${base}/triggers/:id`} component={TriggerDetail} />
      </Router>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
