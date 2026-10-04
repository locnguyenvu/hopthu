import { useState, useContext } from "preact/hooks";
import { Link, useLocation } from "wouter";
import { ArrowLeft, AlertCircle } from "lucide-react";
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
			class="w-full px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
		/>
	);
}

export function EmailAccountNewSettings() {
	const toast = useContext(ToastContext);
	const [, setLocation] = useLocation();

	const [form, setForm] = useState({
		email: "",
		host: "",
		port: 993,
		is_ssl: true,
		timezone: APP_TZ,
		password: "",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);

	const setField = (key) => (e) => {
		const value =
			e.target.type === "checkbox" ? e.target.checked : e.target.value;
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError(null);
		if (!form.email || !form.host || !form.password) {
			setError("Email, host and password are required");
			return;
		}
		setSaving(true);
		try {
			await api.createAccount({
				...form,
				port: Number(form.port) || form.port,
			});
			toast.success("Account created");
			setLocation("/settings/email-accounts");
		} catch (e) {
			setError(e.message);
			toast.error("Failed to create account: " + e.message);
		} finally {
			setSaving(false);
		}
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
						Add email account
					</h2>
				</div>
			</div>
			<div class="rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
				<div class="p-6">
					<form onSubmit={handleSubmit}>
						{error && (
							<div class="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
								<AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
							<div>
								<Label>Email</Label>
								<TextInput
									type="email"
									value={form.email}
									onInput={setField("email")}
									placeholder="your-email@example.com"
									required
								/>
							</div>
							<div>
								<Label>Timezone</Label>
								<TextInput
									value={form.timezone}
									onInput={setField("timezone")}
									placeholder={`Default: ${APP_TZ}`}
								/>
								<p class="mt-1 text-xs italic text-gray-500">
									e.g. Asia/Ho_Chi_Minh, UTC
								</p>
							</div>
							<div>
								<Label>IMAP Host</Label>
								<TextInput
									value={form.host}
									onInput={setField("host")}
									placeholder="imap.example.com"
									required
								/>
							</div>
							<div>
								<Label>Port</Label>
								<TextInput
									type="number"
									value={form.port}
									onInput={setField("port")}
									required
								/>
							</div>
							<div class="flex items-center gap-2 md:col-span-2">
								<input
									id="new-acct-is-ssl"
									type="checkbox"
									checked={form.is_ssl}
									onInput={setField("is_ssl")}
									class="h-4 w-4 rounded border-gray-300 accent-gray-700 text-gray-700 focus:ring-gray-600"
								/>
								<label
									for="new-acct-is-ssl"
									class="text-xs font-semibold text-gray-600"
								>
									Use SSL/TLS
								</label>
							</div>
							<div class="md:col-span-2">
								<Label>Password</Label>
								<input
									type="password"
									autocomplete="new-password"
									value={form.password}
									onInput={setField("password")}
									placeholder="Your email password"
									required
									class="w-full px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
								/>
								<p class="mt-1 text-xs italic text-gray-500">
									The credentials are verified against the IMAP server
									before the account is saved.
								</p>
							</div>
						</div>

						<div class="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
							<Link
								href="/settings/email-accounts"
								class="p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs"
							>
								Cancel
							</Link>
							<button
								type="submit"
								disabled={saving}
								class="p-1 px-2 rounded-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50 disabled:hover:bg-gray-700"
							>
								{saving ? "Creating…" : "Create account"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</SettingsLayout>
	);
}
