import { useEffect, useState } from "preact/hooks";
import { Link } from "wouter";
import { api } from "../../api";
import { SettingsLayout } from "./SettingsLayout";

export function TemplatesSettings() {
	const [templates, setTemplates] = useState(null);

	useEffect(() => {
		// hook on enter the screen
		const fetchTemplates = async () => {
			const response = await api.listTemplates();
			setTemplates(response.data || []);
		};
		fetchTemplates();
	}, []);

	const groupByFromEmail = (templates) => {
		const groups = new Map();
		for (const t of templates) {
			if (!groups.has(t.from_email)) {
				groups.set(t.from_email, []);
			}
			groups.get(t.from_email).push(t);
		}
		return new Map(
			[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)),
		);
	};

	return (
		<SettingsLayout active="/settings/templates">
			<div class="rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
				<div class="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
					<p class="text-sm text-gray-500">
						Email parsing templates, grouped by sender.
					</p>
				</div>

				<div class="p-6">
					{!templates ? (
						<div class="text-sm text-gray-500 py-6 text-center">
							Loading templates…
						</div>
					) : templates.length === 0 ? (
						<div class="text-sm text-gray-500 py-6 text-center">
							No templates yet. Create one from an email's detail view.
						</div>
					) : (
						<div class="space-y-6">
							{[...groupByFromEmail(templates).entries()].map(
								([fromEmail, groupTemplates]) => (
									<div key={fromEmail}>
										<h2 class="text-sm font-semibold text-gray-700 mb-2">
											{fromEmail}
										</h2>
										<div class="rounded-md border border-[var(--color-border)] divide-y divide-gray-100 overflow-hidden">
											{groupTemplates.map((t) => (
												<Link
													key={t.id}
													href={`/settings/templates/${t.id}`}
													class="flex items-center justify-between gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors"
												>
													<span class="text-sm text-gray-900 truncate">
														{t.subject ?? "Any subject"}
													</span>
													<span class="text-xs text-gray-500 whitespace-nowrap">
														{t.priority ?? "Auto"}
													</span>
												</Link>
											))}
										</div>
									</div>
								),
							)}
						</div>
					)}
				</div>
			</div>
		</SettingsLayout>
	);
}
