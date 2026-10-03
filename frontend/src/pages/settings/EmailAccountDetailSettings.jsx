import { useState, useEffect, useContext } from "preact/hooks";
import { Link, useParams } from "wouter";
import { ArrowLeft, AlertCircle, FolderOpen } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { api } from "../../api";
import { ToastContext } from "../../app";

function Label({ children }) {
	return (
		<label class="block text-xs font-semibold text-gray-600 mb-1">
			{children}
		</label>
	);
}

function TextInput(props) {
	return (
		<input
			type="text"
			{...props}
			class="w-full px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
		/>
	);
}

export function EmailAccountDetailSettings() {
	const params = useParams();
	const id = Number(params.id);
	const toast = useContext(ToastContext);

	const [account, setAccount] = useState(null);
	const [form, setForm] = useState({
		email: "",
		host: "",
		port: "",
		password: "",
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);

	const [mailboxes, setMailboxes] = useState([]);
	const [mailboxesLoading, setMailboxesLoading] = useState(false);
	const [fetching, setFetching] = useState(false);

	const load = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.listAccounts();
			const found = (res.data || []).find((a) => a.id === id) || null;
			setAccount(found);
			if (found) {
				setForm((prev) => ({
					...prev,
					email: found.email ?? "",
					host: found.host ?? "",
					port: found.port ?? "",
					password: "",
				}));
				loadMailboxes();
			} else {
				setError(`Account #${id} not found`);
			}
		} catch (e) {
			setError(e.message);
			toast.error("Failed to load account: " + e.message);
		} finally {
			setLoading(false);
		}
	};

	const loadMailboxes = async () => {
		setMailboxesLoading(true);
		try {
			const res = await api.listMailboxes(id);
			setMailboxes(res.data || []);
		} catch (e) {
			toast.error("Failed to load mailboxes: " + e.message);
		} finally {
			setMailboxesLoading(false);
		}
	};

	const handleFetchMailboxes = async () => {
		setFetching(true);
		try {
			await api.fetchMailboxes(id);
			await loadMailboxes();
			toast.success("Mailboxes fetched");
		} catch (e) {
			toast.error("Failed to fetch mailboxes: " + e.message);
		} finally {
			setFetching(false);
		}
	};

	const toggleMailbox = async (mailbox) => {
		try {
			await api.updateMailbox(mailbox.id, { is_active: !mailbox.is_active });
			setMailboxes((prev) =>
				prev.map((m) =>
					m.id === mailbox.id ? { ...m, is_active: !m.is_active } : m,
				),
			);
		} catch (e) {
			toast.error("Failed to update mailbox: " + e.message);
		}
	};

	useEffect(() => {
		load();
	}, [id]);

	const setField = (key) => (e) => {
		const value =
			e.target.type === "checkbox" ? e.target.checked : e.target.value;
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleSave = async () => {
		setSaving(true);
		try {
			const res = await api.updateAccount(id, {
				email: form.email,
				host: form.host,
				port: Number(form.port) || form.port,
			});
			let updated = res.data;
			if (form.password) {
				const pwRes = await api.updateAccountPassword(id, {
					password: form.password,
				});
				updated = pwRes.data || updated;
			}
			setAccount(updated);
			setForm((prev) => ({ ...prev, password: "" }));
			toast.success("Account updated");
		} catch (e) {
			toast.error("Failed to update: " + e.message);
		} finally {
			setSaving(false);
		}
	};

	const handleCancel = () => {
		if (!account) return;
		setForm((prev) => ({
			...prev,
			email: account.email ?? "",
			host: account.host ?? "",
			port: account.port ?? "",
			password: "",
		}));
	};

	return (
		<SettingsLayout active="/settings/email-accounts">
      <div class="flex items-center gap-4 min-w-0 mb-1">
        <Link
          href="/settings/email-accounts"
          class="shrink-0 mt-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          aria-label="Back to email accounts"
        >
          <ArrowLeft class="w-4 h-4" />
        </Link>
        <div class="min-w-0">
          <h2 class="text-lg font-semibold text-gray-800 truncate">
            {account?.email || "Email account"}
          </h2>
        </div>
      </div>
			<div class="rounded-lg border border-[var(--color-border)] bg-white shadow-sm">

				<div class="p-6">
					{error && !account && (
						<div class="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
							<AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{loading && !account && (
						<div class="text-sm text-gray-500 py-6 text-center">
							Loading account…
						</div>
					)}

					{account && (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSave();
							}}
						>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
								<div>
									<Label>Email</Label>
									<TextInput
										value={form.email}
										onInput={setField("email")}
									/>
								</div>
								<div>
									<Label>Host</Label>
									<TextInput
										value={form.host}
										onInput={setField("host")}
									/>
								</div>
								<div>
									<Label>Port</Label>
									<TextInput
										type="number"
										value={form.port}
										onInput={setField("port")}
									/>
								</div>
								<div class="md:col-span-2">
									<Label>Password</Label>
									<input
										type="password"
										autocomplete="new-password"
										value={form.password}
										onInput={setField("password")}
										placeholder="Leave blank to keep current password"
										class="w-full px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
									/>
									<p class="mt-1 text-xs italic text-gray-500">
										Only set if you want to change it. The new password
										is verified against the IMAP server before saving.
									</p>
								</div>
							</div>

							<div class="mt-6 pt-4 border-t border-[var(--color-border)] flex justify-between gap-2">
                {account && (
                  <div class="flex text-xs italic text-gray-500 leading-relaxed shrink-0 gap-3 justify-end">
                    <div>Created: {account.created_at || "—"}</div>
                    <div>Updated: {account.updated_at || "—"}</div>
                  </div>
                )}
                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    class="p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    class="p-1 px-2 rounded-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white text-xs disabled:opacity-50 disabled:hover:bg-blue-500"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
							</div>
						</form>
					)}
				</div>
			</div>

			{account && (
				<div class="rounded-lg border border-[var(--color-border)] bg-white shadow-sm mt-6">
					<div class="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
						<p class="text-sm text-gray-500">Manage this account's mailboxes.</p>
						<button
							type="button"
							onClick={handleFetchMailboxes}
							disabled={fetching}
							class="p-1 px-2 rounded-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white text-xs disabled:opacity-50 disabled:hover:bg-blue-500"
						>
							{fetching ? "Fetching…" : "Fetch from IMAP"}
						</button>
					</div>

					<div class="p-6">
						{mailboxesLoading && mailboxes.length === 0 && (
							<div class="text-sm text-gray-500 py-6 text-center">
								Loading mailboxes…
							</div>
						)}

						{!mailboxesLoading && mailboxes.length === 0 && (
							<div class="flex flex-col items-center gap-2 py-8 text-center">
								<FolderOpen class="w-6 h-6 text-gray-300" />
								<p class="text-sm text-gray-500">
									No mailboxes yet. Click "Fetch from IMAP" to load them.
								</p>
							</div>
						)}

						{mailboxes.length > 0 && (
							<div class="divide-y divide-[var(--color-border)]">
								{mailboxes.map((mailbox) => (
									<div
										key={mailbox.id}
										class="flex items-center justify-between py-2"
									>
										<span class="text-sm text-gray-800 truncate">
											{mailbox.name}
										</span>
										<label class="flex items-center gap-2 cursor-pointer shrink-0">
											<input
												type="checkbox"
												checked={mailbox.is_active}
												onChange={() => toggleMailbox(mailbox)}
												class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											/>
											<span class="text-xs font-semibold text-gray-600">
												Sync
											</span>
										</label>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</SettingsLayout>
	);
}
