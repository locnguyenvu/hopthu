import { Router, Route } from 'preact-router';
import { useState, useCallback } from 'preact/hooks';
import { createContext } from 'preact';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { Inbox } from './pages/Inbox';
import { AccountList } from './pages/AccountList';
import { AccountForm } from './pages/AccountForm';
import { AccountDetail } from './pages/AccountDetail';
import { EmailDetail } from './pages/EmailDetail';
import { TemplateList } from './pages/TemplateList';
import { TemplateEditor } from './pages/TemplateEditor';

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

  return (
    <ToastContext.Provider value={toast}>
      <Router>
        <Route path="/" component={Inbox} />
        <Route path="/accounts" component={AccountList} />
        <Route path="/accounts/new" component={AccountForm} />
        <Route path="/accounts/:id" component={AccountDetail} />
        <Route path="/emails/:id" component={EmailDetail} />
        <Route path="/templates" component={TemplateList} />
        <Route path="/templates/new" component={TemplateEditor} />
        <Route path="/templates/:id" component={TemplateEditor} />
        <Route path="/emails/:emailId/new-template" component={TemplateEditor} />
      </Router>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
