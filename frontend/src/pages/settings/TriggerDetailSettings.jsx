import { useState, useEffect, useContext } from "preact/hooks";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { api } from "../../api";
import { ToastContext } from "../../app";
import { SettingsLayout } from "./SettingsLayout";

const EMAIL_FIELDS = ["from_email", "received_at", "subject", "to_email"];

const toMappingDict = (mappings) =>
	Object.fromEntries(mappings.map((elem) => [elem.target, elem.source]));

const SOURCE_NAMESPACES = [
	{
		prefix: "$extracted_data.",
		label: "extracted_data",
		badge: "bg-indigo-100 text-indigo-700",
	},
	{ prefix: "$email.", label: "email", badge: "bg-amber-100 text-amber-700" },
];

function SourceValue({ source }) {
	const ns = SOURCE_NAMESPACES.find((elem) => source.startsWith(elem.prefix));
	if (!ns) return <div>{source}</div>;
	return (
		<div class="flex items-center gap-2 min-w-0" title={source}>
			<span
				class={`px-1.5 py-0.5 rounded-sm text-xs font-semibold whitespace-nowrap ${ns.badge}`}
			>
				{ns.label}
			</span>
			<span class="truncate">{source.slice(ns.prefix.length)}</span>
		</div>
	);
}

export function TriggerDetailSettings() {
	const params = useParams();
	const [, setLocation] = useLocation();
	const [trigger, setTrigger] = useState({ id: null });
	const [templateFields, setTemplateFields] = useState({ unmapped: [] });
	const [emailFields, setEmailFields] = useState({ unmapped: [] });
	const [fieldMappings, setFieldMappings] = useState({});
	const toast = useContext(ToastContext);

	useEffect(() => {
		const fetchTrigger = async () => {
			const response = await api.getTrigger(params.id);
			setTrigger(response.data);
			setFieldMappings(toMappingDict(response.data.field_mappings));
		};
		fetchTrigger();
	}, []);

	// Available source options for the select inputs (only not-yet-used sources)
	useEffect(() => {
		if (!trigger.id) return;

		const mappedFields = Object.values(fieldMappings);

		const unmappedTemplateFields = trigger.template.fields.filter(
			(ele) => !mappedFields.includes(`\$extracted_data.${ele.name}`),
		);
		unmappedTemplateFields.sort((a, b) => a.name > b.name);
		setTemplateFields({ unmapped: unmappedTemplateFields });

		const unmappedEmailFields = EMAIL_FIELDS.filter(
			(field) => !mappedFields.includes(`\$email.${field}`),
		);
		unmappedEmailFields.sort();
		setEmailFields({ unmapped: unmappedEmailFields });
	}, [fieldMappings]);

	const handleUpdateFieldMappings = async () => {
		const missingRequired = trigger.connection.fields.filter(
			(field) => field.required && !fieldMappings[field.name],
		);
		if (missingRequired.length > 0) {
			toast.error(`${missingRequired.length} required field(s) are not mapped`);
			return;
		}

		const field_mappings = Object.entries(fieldMappings)
			.filter(([, source]) => Boolean(source))
			.map(([target, source]) => ({ source, target }));

		try {
			const response = await api.updateTrigger(trigger.id, { field_mappings });
			setFieldMappings(toMappingDict(response.data.field_mappings));
			toast.success("Field mappings updated");
		} catch (e) {
			toast.error("Failed to update: " + e.message);
		}
	};

	const handleToggleActive = async () => {
		if (!trigger.is_active) {
			const missingRequired = trigger.connection.fields.filter(
				(field) => field.required && !fieldMappings[field.name],
			);
			if (missingRequired.length > 0) {
				toast.error(
					`${missingRequired.length} required field(s) are not mapped`,
				);
				return;
			}
		}
		try {
			const response = await api.updateTrigger(trigger.id, {
				is_active: !trigger.is_active,
			});
			setTrigger((pre) => ({ ...pre, is_active: response.data.is_active }));
			toast.success(
				response.data.is_active ? "Trigger enabled" : "Trigger disabled",
			);
		} catch (e) {
			toast.error("Failed to update: " + e.message);
		}
	};

	const handleDelete = async () => {
		if (
			!confirm(
				`Delete trigger "${trigger.connection.name}"? This cannot be undone.`,
			)
		)
			return;
		try {
			await api.deleteTrigger(trigger.id);
			toast.success("Trigger deleted");
			setLocation(`/settings/templates/${trigger.template_id}`);
		} catch (e) {
			toast.error("Failed to delete: " + e.message);
		}
	};

	return (
		<SettingsLayout active="/settings/templates">
			<div class="flex items-center gap-4 min-w-0 mb-1">
				<Link
					href={`/settings/templates/${trigger.template_id}`}
					class="shrink-0 mt-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
					aria-label="Back to template"
				>
					<ArrowLeft class="w-4 h-4" />
				</Link>
				<div class="min-w-0 flex-1">
					<h2 class="text-lg font-semibold text-gray-800 truncate">
						{trigger.id
							? trigger.connection.name
							: "Trigger"}
					</h2>
				</div>
				{trigger.id && (
					<div class="shrink-0 flex items-center gap-2">
						<button
							class={`p-1 px-2 rounded-sm text-xs font-semibold ${trigger.is_active ? "bg-neutral-200 text-black hover:bg-neutral-300" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
							onClick={handleToggleActive}
						>
							{trigger.is_active ? "Deactivate" : "Activate"}
						</button>
						<button
							class="p-1 px-2 rounded-sm bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold"
							onClick={handleUpdateFieldMappings}
						>
							Save
						</button>
						<button
							class="p-1 px-2 rounded-sm bg-red-500 hover:bg-red-400 text-white text-xs font-semibold"
							onClick={handleDelete}
						>
							Delete
						</button>
					</div>
				)}
			</div>
			{trigger.id ? (
				<div class="flex flex-col gap-3">
					<div class="shadow-sm p-3 flex flex-col gap-1">
						<h1 class="text-lg font-semibold">Field mapping</h1>
						<div class="flex flex-col">
							{trigger.connection.fields.map((field) => {
								return (
									<div class="flex gap-2 items-center py-2 border-b-1 border-gray-300">
										<div class="flex flex-col">
											<div class="font-semibold">
												{field.name}{" "}
												{field.required && <span class="text-red-500">*</span>}:
											</div>
										</div>
										<div class="flex gap-1 p-1 border-dashed border-1 border-gray-300 bg-gray-50">
											{!fieldMappings[field.name] && (
												<select
													class="border-1 border-color-gray-200 p-1 w-full rounded-sm"
													onChange={(e) => {
														const value = e.target.value;
														if (!value) return;
														setFieldMappings((pre) => {
															return { ...pre, [field.name]: value };
														});
													}}
												>
													<option value=""> -- Select a field -- </option>
													{templateFields.unmapped.length > 0 && (
														<optgroup label="extracted_data">
															{templateFields.unmapped.map((elem) => {
																return (
																	<option
																		value={`\$extracted_data.${elem.name}`}
																	>
																		{elem.name}
																	</option>
																);
															})}
														</optgroup>
													)}
													{emailFields.unmapped.length > 0 && (
														<optgroup label="email">
															{emailFields.unmapped.map((elem) => {
																return (
																	<option value={`\$email.${elem}`}>
																		{elem}
																	</option>
																);
															})}
														</optgroup>
													)}
												</select>
											)}
											{fieldMappings[field.name] && (
												<>
													<SourceValue source={fieldMappings[field.name]} />
													<div>
														<a
															href="#"
															class="text-sm text-red-400 font-bold"
															role="button"
															aria-label="clear"
															onClick={(e) => {
																e.preventDefault();
																setFieldMappings((pre) => {
																	return { ...pre, [`${field.name}`]: null };
																});
															}}
														>
															x
														</a>
													</div>
												</>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			) : (
				<div>Loading...</div>
			)}
		</SettingsLayout>
	);
}
