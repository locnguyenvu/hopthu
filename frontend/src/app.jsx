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
import { Template2New } from "./pages/Template2New";
import { Template2List } from "./pages/Template2List";
import { Template2Detail } from "./pages/Template2Detail";
import { Template2DetailEditor } from "./pages/Template2DetailEditor";
import { Trigger2Detail } from "./pages/Trigger2Detail";
import { Email2Detail } from "./pages/Email2Detail";
import { Email2List } from "./pages/Email2List";
import {
	EmailAccountsSettings,
	EmailAccountDetailSettings,
	EmailAccountNewSettings,
	ConnectionsSettings,
	ConnectionNewSettings,
	ConnectionDetailSettings,
} from "./pages/settings";
import { getBase } from "./lib/base";

export const ToastContext = createContext();
let toastId = 0;

const APP_NAME = "Hopthu";
const BRAND_TITLE = `${APP_NAME} — Mailbox & Workflow Automation`;

const routes = [
	{ path: "/", title: "Inbox", component: Email2List },
	{ path: "/templates2", title: "Templates", component: Template2List },
	{ path: "/templates2/new", title: "New Template", component: Template2New },
	{ path: "/templates2/:id", title: "Template", component: Template2Detail },
	{
		path: "/templates2/:id/editor",
		title: "Template Editor",
		component: Template2DetailEditor,
	},
	{ path: "/emails2", title: "Emails", component: Email2List },
	{ path: "/emails2/:id", title: "Email", component: Email2Detail },
	{ path: "/triggers2/:id", title: "Trigger", component: Trigger2Detail },
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
