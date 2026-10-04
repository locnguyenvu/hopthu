import {
	Router,
	Route,
	Switch,
	useLocation,
	useRouter,
	matchRoute,
} from "wouter";
import { useState, useCallback, useEffect } from "preact/hooks";
import { createContext } from "preact";
import { ToastContainer } from "./components/Toast";
import { TemplateNew } from "./pages/TemplateNew";
import { TemplateDetailEditor } from "./pages/TemplateDetailEditor";
import { EmailDetail } from "./pages/EmailDetail";
import { Emails } from "./pages/Emails";
import {
	EmailAccountsSettings,
	EmailAccountDetailSettings,
	EmailAccountNewSettings,
	ConnectionsSettings,
	ConnectionNewSettings,
	ConnectionDetailSettings,
	TemplatesSettings,
	TemplateDetailSettings,
	TriggerDetailSettings,
} from "./pages/settings";
import { getBase } from "./lib/base";

export const ToastContext = createContext();
let toastId = 0;

const APP_NAME = "Hopthu";
const BRAND_TITLE = `${APP_NAME} — Mailbox & Workflow Automation`;

const routes = [
	{ path: "/", title: "Inbox", component: Emails },
	{ path: "/settings/templates", title: "Templates", component: TemplatesSettings },
	{ path: "/settings/templates/new", title: "New Template", component: TemplateNew },
	{ path: "/settings/templates/:id", title: "Template", component: TemplateDetailSettings },
	{
		path: "/settings/templates/:id/editor",
		title: "Template Editor",
		component: TemplateDetailEditor,
	},
	{ path: "/emails", title: "Emails", component: Emails },
	{ path: "/emails/:id", title: "Email", component: EmailDetail },
	{ path: "/settings/triggers/:id", title: "Trigger", component: TriggerDetailSettings },
	{
		path: "/settings",
		title: "Settings",
		component: EmailAccountsSettings,
	},
	{
		path: "/settings/email-accounts",
		title: "Email accounts",
		component: EmailAccountsSettings,
	},
	{
		path: "/settings/email-accounts/new",
		title: "Add email account",
		component: EmailAccountNewSettings,
	},
	{
		path: "/settings/email-accounts/:id",
		title: "Email account",
		component: EmailAccountDetailSettings,
	},
	{
		path: "/settings/connections",
		title: "Connections",
		component: ConnectionsSettings,
	},
	{
		path: "/settings/connections/new",
		title: "Add connection",
		component: ConnectionNewSettings,
	},
	{
		path: "/settings/connections/:id",
		title: "Connection",
		component: ConnectionDetailSettings,
	},
];

function TitleSync() {
	const [location] = useLocation();
	const { parser } = useRouter();
	useEffect(() => {
		const match = routes.find((r) => matchRoute(parser, r.path, location)[0]);
		document.title = match ? `${match.title} · ${APP_NAME}` : BRAND_TITLE;
	}, [location, parser]);
	return null;
}

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
				<TitleSync />
				<Switch>
					{routes.map((r) => (
						<Route key={r.path} path={r.path} component={r.component} />
					))}
				</Switch>
			</Router>
			<ToastContainer toasts={toasts} onRemove={removeToast} />
		</ToastContext.Provider>
	);
}
