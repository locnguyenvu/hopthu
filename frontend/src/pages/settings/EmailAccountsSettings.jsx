import { useState, useEffect, useContext } from "preact/hooks";
import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { api } from "../../api";
import { ToastContext } from "../../app";

function AccountCard({ account }) {
	return (
		<div class="flex items-start gap-4 p-4 rounded-lg border border-[var(--color-border)] bg-white shadow-sm hover:shadow transition-shadow">
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 flex-wrap">
					<Link
						href={`/settings/email-accounts/${account.id}`}
						class="font-semibold text-[var(--color-primary)] hover:underline truncate"
					>
						{account.email}
					</Link>
					<span
						class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
							account.is_ssl
								? "bg-green-100 text-green-800"
								: "bg-yellow-100 text-yellow-800"
						}`}
					>
						{account.is_ssl ? "SSL" : "No SSL"}
					</span>
				</div>
				<div class="mt-1 text-sm text-gray-500">
					{account.host}:{account.port}
					{account.timezone ? ` · ${account.timezone}` : ""}
					{account.authenticated_method
						? ` · ${account.authenticated_method}`
						: ""}
				</div>
			</div>
		</div>
	);
}

export function EmailAccountsSettings() {
	const [accounts, setAccounts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const toast = useContext(ToastContext);

	const loadAccounts = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.listAccounts();
			setAccounts(res.data || []);
		} catch (e) {
			setError(e.message);
			toast.error("Failed to load accounts: " + e.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadAccounts();
	}, []);

	return (
		<SettingsLayout active="/settings/email-accounts">
			<div class="rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
				<div class="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
					<p class="text-sm text-gray-500">
						Manage your IMAP email accounts.
					</p>
					<Link
						href="/settings/email-accounts/new"
						class="p-1 px-2 rounded-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white text-xs"
					>
						+ Add account
					</Link>
				</div>

				<div class="p-6 space-y-3">
					{error && (
						<div class="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
							<AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{loading && accounts.length === 0 && (
						<div class="text-sm text-gray-500 py-6 text-center">
							Loading accounts…
						</div>
					)}

					{!loading && accounts.length === 0 && !error && (
						<div class="text-sm text-gray-500 py-6 text-center">
							No accounts yet.{" "}
							<Link
								href="/settings/email-accounts/new"
								class="text-[var(--color-primary)] hover:underline"
							>
								Add your first account
							</Link>
						</div>
					)}

					{accounts.map((account) => (
						<AccountCard key={account.id} account={account} />
					))}
				</div>
			</div>
		</SettingsLayout>
	);
}
