import { useState, useContext } from "preact/hooks";
import { Link, useLocation } from "wouter";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { CONNECTION_METHODS } from "./connectionUtils";
import { api } from "../../api";
import { ToastContext } from "../../app";

function Label({ children }) {
	return (
		<label class="block text-xs font-semibold text-gray-600 mb-1">
			{children}
		</label>
	);
}

const inputClass =
	"w-full px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";

export function ConnectionNewSettings() {
	const toast = useContext(ToastContext);
	const [, setLocation] = useLocation();

	const [form, setForm] = useState({
		name: "",
		endpoint: "",
		method: "POST",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);

	const setField = (key) => (e) =>
		setForm((prev) => ({ ...prev, [key]: e.target.value }));

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError(null);
		if (!form.name || !form.endpoint) {
			setError("Name and endpoint are required");
			return;
		}
		setSaving(true);
		try {
			await api.createConnection({
				name: form.name,
				endpoint: form.endpoint,
				method: form.method,
			});
			toast.success("Connection created");
			setLocation("/settings/connections");
		} catch (e) {
			setError(e.message);
			toast.error("Failed to create connection: " + e.message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsLayout active="/settings/connections">
			<div class="flex items-center gap-4 min-w-0 mb-1">
				<Link
					href="/settings/connections"
					class="shrink-0 mt-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
					aria-label="Back to connections"
				>
					<ArrowLeft class="w-4 h-4" />
				</Link>
				<div class="min-w-0">
					<h2 class="text-lg font-semibold text-gray-800 truncate">
						Add connection
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
								<Label>Name</Label>
								<input
									type="text"
									value={form.name}
									onInput={setField("name")}
									placeholder="My webhook"
									required
									class={inputClass}
								/>
							</div>
							<div>
								<Label>Method</Label>
								<select
									value={form.method}
									onInput={setField("method")}
									class={inputClass}
								>
									{CONNECTION_METHODS.map((m) => (
										<option key={m} value={m}>
											{m}
										</option>
									))}
								</select>
							</div>
							<div class="md:col-span-2">
								<Label>Endpoint</Label>
								<input
									type="text"
									value={form.endpoint}
									onInput={setField("endpoint")}
									placeholder="https://example.com/api"
									required
									class={inputClass}
								/>
							</div>
						</div>

						<div class="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
							<Link
								href="/settings/connections"
								class="p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs"
							>
								Cancel
							</Link>
							<button
								type="submit"
								disabled={saving}
								class="p-1 px-2 rounded-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white text-xs disabled:opacity-50 disabled:hover:bg-blue-500"
							>
								{saving ? "Creating…" : "Create connection"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</SettingsLayout>
	);
}
