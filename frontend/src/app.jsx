import { Router, Route, Switch } from "wouter";
import { useState, useCallback } from "preact/hooks";
import { createContext } from "preact";
import { ToastContainer } from "./components/Toast";
import { AccountList } from "./pages/AccountList";
import { AccountForm } from "./pages/AccountForm";
import { AccountDetail } from "./pages/AccountDetail";
import { EmailDetail } from "./pages/EmailDetail";
import { TemplateList } from "./pages/TemplateList";
import { TemplateEditor } from "./pages/TemplateEditor";
import { Template2New } from "./pages/Template2New";
import { Template2List } from "./pages/Template2List";
import { Template2Detail } from "./pages/Template2Detail";
import { Template2DetailEditor } from "./pages/Template2DetailEditor";
import { ConnectionList } from "./pages/ConnectionList";
import { ConnectionForm } from "./pages/ConnectionForm";
import { ConnectionDetail } from "./pages/ConnectionDetail";
import { Trigger2Detail } from "./pages/Trigger2Detail";
import { Email2Detail } from "./pages/Email2Detail";
import { Email2List } from "./pages/Email2List";
import { TriggerEditor } from "./pages/TriggerEditor";
import { TriggerDetail } from "./pages/TriggerDetail";
import { getBase } from "./lib/base";

export const ToastContext = createContext();
let toastId = 0;

export function App() {
	const [toasts, setToasts] = useState([]);

	const addToast = useCallback((message, type = "info", duration = 3000) => {
		const id = ++toastId;
		setToasts((prev) => [...prev, { id, message, type }]);
		if (duration > 0) {
			setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== id));
			}, duration);
		}
	}, []);

	const removeToast = useCallback((id) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const toast = useCallback(
		{
			success: (message, opts) => addToast(message, "success", opts?.duration),
			error: (message, opts) => addToast(message, "error", opts?.duration),
			info: (message, opts) => addToast(message, "info", opts?.duration),
		},
		[addToast],
	);

	const base = getBase();

	return (
		<ToastContext.Provider value={toast}>
			<Router base={base}>
				<Switch>
					<Route path="/" component={Email2List} />
					<Route path="/accounts" component={AccountList} />
					<Route path="/accounts/new" component={AccountForm} />
					<Route path="/accounts/:id/edit" component={AccountForm} />
					<Route path="/accounts/:id" component={AccountDetail} />
					<Route path="/emails/:id" component={EmailDetail} />
					<Route path="/templates" component={TemplateList} />
					<Route path="/templates/new" component={TemplateEditor} />
					<Route path="/templates2" component={Template2List} />
					<Route path="/templates2/new" component={Template2New} />
					<Route path="/templates2/:id" component={Template2Detail} />
					<Route
						path="/templates2/:id/editor"
						component={Template2DetailEditor}
					/>
					<Route path="/templates/:id" component={TemplateEditor} />
					<Route
						path="/emails/:emailId/new-template"
						component={TemplateEditor}
					/>
					<Route path="/emails2" component={Email2List} />
					<Route path="emails2/:id" component={Email2Detail} />
					<Route path="/connections" component={ConnectionList} />
					<Route path="/connections/new" component={ConnectionForm} />
					<Route path="/connections/:id" component={ConnectionDetail} />
					<Route path="/triggers/new" component={TriggerEditor} />
					<Route path="/triggers/:id/edit" component={TriggerEditor} />
					<Route path="/triggers/:id" component={TriggerDetail} />
					<Route path="/triggers2/:id" component={Trigger2Detail} />
				</Switch>
			</Router>
			<ToastContainer toasts={toasts} onRemove={removeToast} />
		</ToastContext.Provider>
	);
}
