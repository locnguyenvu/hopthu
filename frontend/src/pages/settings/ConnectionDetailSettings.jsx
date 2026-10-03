import { useState, useEffect, useContext } from "preact/hooks";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, AlertCircle, X, Plus } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { CONNECTION_METHODS, FIELD_TYPES } from "./connectionUtils";
import { api } from "../../api";
import { ToastContext } from "../../app";

const EMPTY_HEADER = { key: "", value: "", encrypted: false };
const EMPTY_FIELD = { name: "", type: "string", required: false };

function Label({ children }) {
	return (
		<label class="block text-xs font-semibold text-gray-600 mb-1">
			{children}
		</label>
	);
}

const inputClass =
	"w-full px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";
const rowInputClass =
	"px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";
const addBtnClass =
	"inline-flex items-center gap-1 p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs hover:bg-neutral-300";
const removeBtnClass =
	"p-1 rounded-sm text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0";
const checkboxClass =
	"h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500";

export function ConnectionDetailSettings() {
	const params = useParams();
	const id = Number(params.id);
	const toast = useContext(ToastContext);
	const [, setLocation] = useLocation();

	const [connection, setConnection] = useState(null);
	const [form, setForm] = useState({
		name: "",
		endpoint: "",
		method: "POST",
	});
	const [headers, setHeaders] = useState([{ ...EMPTY_HEADER }]);
	const [fields, setFields] = useState([{ ...EMPTY_FIELD }]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);

	const rowsFromConnection = (c) => ({
		headers: c.headers?.length
			? c.headers.map((h) => ({ ...h }))
			: [{ ...EMPTY_HEADER }],
		fields: c.fields?.length
			? c.fields.map((f) => ({ ...f }))
			: [{ ...EMPTY_FIELD }],
	});

	const load = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.getConnection(id);
			const found = res.data || null;
			setConnection(found);
			if (found) {
				setForm((prev) => ({
					...prev,
					name: found.name ?? "",
					endpoint: found.endpoint ?? "",
					method: found.method ?? "POST",
				}));
				const rows = rowsFromConnection(found);
				setHeaders(rows.headers);
				setFields(rows.fields);
			} else {
				setError(`Connection #${id} not found`);
			}
		} catch (e) {
			setError(e.message);
			toast.error("Failed to load connection: " + e.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, [id]);

	const setField = (key) => (e) =>
		setForm((prev) => ({ ...prev, [key]: e.target.value }));

	const updateRow = (setter) => (index, prop, value) =>
		setter((prev) =>
			prev.map((r, i) => (i === index ? { ...r, [prop]: value } : r)),
		);
	const addRow = (setter, empty) => () =>
		setter((prev) => [...prev, { ...empty }]);
	const removeRow = (setter, empty) => (index) =>
		setter((prev) => {
			const next = prev.filter((_, i) => i !== index);
			return next.length ? next : [{ ...empty }];
		});

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		try {
			const res = await api.updateConnection(id, {
				name: form.name,
				endpoint: form.endpoint,
				method: form.method,
				headers: headers
					.filter((h) => h.key)
					.map((h) => ({
						key: h.key,
						value: h.value,
						encrypted: Boolean(h.encrypted),
					})),
				fields: fields
					.filter((f) => f.name)
					.map((f) => ({
						name: f.name,
						type: f.type,
						required: Boolean(f.required),
					})),
			});
			const saved = res.data;
			setConnection(saved);
			// Reload from the masked server response so encrypted values render as ••••••.
			const rows = rowsFromConnection(saved);
			setHeaders(rows.headers);
			setFields(rows.fields);
			toast.success("Connection updated");
		} catch (e) {
			setError(e.message);
			toast.error("Failed to update: " + e.message);
		} finally {
			setSaving(false);
		}
	};

	const handleCancel = () => {
		if (!connection) return;
		setForm((prev) => ({
			...prev,
			name: connection.name ?? "",
			endpoint: connection.endpoint ?? "",
			method: connection.method ?? "POST",
		}));
		const rows = rowsFromConnection(connection);
		setHeaders(rows.headers);
		setFields(rows.fields);
	};

	const handleDelete = async () => {
		if (!confirm(`Delete connection "${connection?.name}"?`)) return;
		try {
			await api.deleteConnection(id);
			toast.success("Connection deleted");
			setLocation("/settings/connections");
		} catch (e) {
			toast.error("Failed to delete: " + e.message);
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
						{connection?.name || "Connection"}
					</h2>
				</div>
			</div>
			<div class="rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
				<div class="p-6">
					{error && !connection && (
						<div class="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
							<AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{loading && !connection && (
						<div class="text-sm text-gray-500 py-6 text-center">
							Loading connection…
						</div>
					)}

					{connection && (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSave();
							}}
						>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
								<div>
									<Label>Name</Label>
									<input
										type="text"
										value={form.name}
										onInput={setField("name")}
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
										required
										class={inputClass}
									/>
								</div>
							</div>

							{/* Headers */}
							<div class="mt-6">
								<div class="flex items-baseline gap-2">
									<Label>Headers</Label>
									<span class="text-xs text-gray-400">
										sent with each webhook request
									</span>
								</div>
								<div class="space-y-2">
									{headers.map((header, i) => (
										<div key={i} class="flex items-center gap-2">
											<input
												type="text"
												value={header.key}
												onInput={(e) =>
													updateRow(setHeaders)(i, "key", e.target.value)
												}
												placeholder="Header name (e.g. Authorization)"
												class={`${rowInputClass} flex-1 min-w-0`}
											/>
											<input
												type="text"
												value={header.value}
												onInput={(e) =>
													updateRow(setHeaders)(i, "value", e.target.value)
												}
												placeholder="Value"
												class={`${rowInputClass} flex-1 min-w-0`}
											/>
											<label class="flex items-center gap-1 text-xs font-semibold text-gray-600 shrink-0">
												<input
													type="checkbox"
													checked={header.encrypted}
													onInput={(e) =>
														updateRow(setHeaders)(
															i,
															"encrypted",
															e.target.checked,
														)
													}
													class={checkboxClass}
												/>
												Encrypt
											</label>
											<button
												type="button"
												onClick={() => removeRow(setHeaders, EMPTY_HEADER)(i)}
												class={removeBtnClass}
												aria-label="Remove header"
											>
												<X class="w-3 h-3" />
											</button>
										</div>
									))}
								</div>
								<button
									type="button"
									onClick={addRow(setHeaders, EMPTY_HEADER)}
									class={`${addBtnClass} mt-3`}
								>
									<Plus class="w-3 h-3" />
									Add header
								</button>
							</div>

							{/* Payload fields */}
							<div class="mt-6">
								<div class="flex items-baseline gap-2">
									<Label>Payload fields</Label>
									<span class="text-xs text-gray-400">
										expected payload structure
									</span>
								</div>
								<div class="space-y-2">
									{fields.map((field, i) => (
										<div key={i} class="flex items-center gap-2">
											<input
												type="text"
												value={field.name}
												onInput={(e) =>
													updateRow(setFields)(i, "name", e.target.value)
												}
												placeholder="Field name (e.g. amount)"
												class={`${rowInputClass} flex-1 min-w-0`}
											/>
											<select
												value={field.type}
												onInput={(e) =>
													updateRow(setFields)(i, "type", e.target.value)
												}
												class={`${rowInputClass} shrink-0`}
											>
												{FIELD_TYPES.map((t) => (
													<option key={t} value={t}>
														{t}
													</option>
												))}
											</select>
											<label class="flex items-center gap-1 text-xs font-semibold text-gray-600 shrink-0">
												<input
													type="checkbox"
													checked={field.required}
													onInput={(e) =>
														updateRow(setFields)(
															i,
															"required",
															e.target.checked,
														)
													}
													class={checkboxClass}
												/>
												Required
											</label>
											<button
												type="button"
												onClick={() => removeRow(setFields, EMPTY_FIELD)(i)}
												class={removeBtnClass}
												aria-label="Remove field"
											>
												<X class="w-3 h-3" />
											</button>
										</div>
									))}
								</div>
								<button
									type="button"
									onClick={addRow(setFields, EMPTY_FIELD)}
									class={`${addBtnClass} mt-3`}
								>
									<Plus class="w-3 h-3" />
									Add field
								</button>
							</div>

							<div class="mt-6 pt-4 border-t border-[var(--color-border)] flex justify-between gap-2">
								<div class="flex text-xs italic text-gray-500 leading-relaxed shrink-0 gap-3 items-center">
									<div>Created: {connection.created_at || "—"}</div>
									<div>Updated: {connection.updated_at || "—"}</div>
								</div>
								<div class="flex gap-2">
									<button
										type="button"
										onClick={handleDelete}
										class="p-1 px-2 rounded-sm font-semibold bg-red-500 hover:bg-red-400 text-white text-xs"
									>
										Delete
									</button>
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
		</SettingsLayout>
	);
}
