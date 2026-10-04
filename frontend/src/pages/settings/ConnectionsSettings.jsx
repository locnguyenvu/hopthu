import { useState, useEffect, useContext } from "preact/hooks";
import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { METHOD_COLORS } from "./connectionUtils";
import { api } from "../../api";
import { ToastContext } from "../../app";

function MethodBadge({ method }) {
	return (
		<span
			class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
				METHOD_COLORS[method] || "bg-gray-100 text-gray-700"
			}`}
		>
			{method}
		</span>
	);
}

function ConnectionCard({ conn }) {
	return (
		<div class="flex items-start gap-4 p-4 rounded-lg border border-[var(--color-border)] bg-white shadow-sm hover:shadow transition-shadow">
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 flex-wrap">
					<Link
						href={`/settings/connections/${conn.id}`}
						class="font-semibold text-[var(--color-primary)] hover:underline truncate"
					>
						{conn.name}
					</Link>
					<MethodBadge method={conn.method} />
				</div>
				<div class="mt-1 text-sm text-gray-500 truncate">{conn.endpoint}</div>
			</div>
		</div>
	);
}

export function ConnectionsSettings() {
	const [connections, setConnections] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const toast = useContext(ToastContext);

	const loadConnections = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.listConnections();
			setConnections(res.data || []);
		} catch (e) {
			setError(e.message);
			toast.error("Failed to load connections: " + e.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadConnections();
	}, []);

	return (
		<SettingsLayout active="/settings/connections">
			<div class="rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
				<div class="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
					<p class="text-sm text-gray-500">
						Manage webhook connections.
					</p>
					<Link
						href="/settings/connections/new"
						class="p-1 px-2 rounded-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white text-xs"
					>
						+ Add connection
					</Link>
				</div>

				<div class="p-6 space-y-3">
					{error && (
						<div class="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
							<AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{loading && connections.length === 0 && (
						<div class="text-sm text-gray-500 py-6 text-center">
							Loading connections…
						</div>
					)}

					{!loading && connections.length === 0 && !error && (
						<div class="text-sm text-gray-500 py-6 text-center">
							No connections yet.{" "}
							<Link
								href="/settings/connections/new"
								class="text-[var(--color-primary)] hover:underline"
							>
								Add your first connection
							</Link>
						</div>
					)}

					{connections.map((conn) => (
						<ConnectionCard key={conn.id} conn={conn} />
					))}
				</div>
			</div>
		</SettingsLayout>
	);
}
