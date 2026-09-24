import { useEffect, useState, useRef, useContext } from "preact/hooks";
import { useParams, useLocation, Link } from "wouter";
import { api } from "../api";
import { ToastContext } from "../app";
import { Layout2 } from "../components/Layout2";

export function Template2Detail() {
	const params = useParams();
	const [, setLocation] = useLocation();
	const [template, setTemplate] = useState({ id: null });
	const [triggers, setTriggers] = useState([]);
	const [connections, setConnections] = useState([]);
	const [showTriggerForm, setShowTriggerForm] = useState(false);
	const [selectedConnectionId, setSelectedConnectionId] = useState("");
	const [creating, setCreating] = useState(false);

	const toast = useContext(ToastContext);
	const attributeForm = useRef(null);

	useEffect(() => {
		// hook on enter the screen
		const fetchTemplate = async () => {
			const response = await api.getTemplate(params.id);
			setTemplate(response.data);
		};
		const fetchTriggers = async () => {
			const response = await api.listTriggers({ template_id: params.id });
			setTriggers(response.data || []);
		};
		const fetchConnections = async () => {
			const response = await api.listConnections();
			setConnections(response.data || []);
		};
		fetchTemplate();
		fetchTriggers();
		fetchConnections();
	}, []);

	useEffect(() => {
		if (!template.id) {
			return;
		}
	}, [template]);

	const handleUpdate = async () => {
		const formData = new FormData(attributeForm.current);
		try {
			const result = await api.updateTemplate(template.id, {
				from_email: formData.get("from_email"),
				subject: formData.get("subject"),
				content_type: formData.get("content_type"),
				template: template.template,
			});
			setTemplate(result.data);
			toast.success("Template updated");
		} catch (e) {
			toast.error("Failed to update: " + e.message);
		}
	};

	const handleCreateTrigger = async () => {
		if (!selectedConnectionId) {
			return;
		}
		setCreating(true);
		try {
			const response = await api.createTrigger({
				name: `template:${template.id}`,
				template_id: template.id,
				connection_id: parseInt(selectedConnectionId),
				field_mappings: [],
			});
			toast.success("Trigger created");
			setLocation(`/triggers2/${response.data.id}`);
		} catch (e) {
			toast.error("Failed to create trigger: " + e.message);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Layout2
			title="Templates"
			breadcrumbs={[
				{ label: "Templates", href: "/templates2" },
				{ label: `id: ${template.id}` },
			]}
		>
			<div class="size-full">
				{!template.id ? (
					<div>...loading</div>
				) : (
					<div class="flex flex-col gap-2 h-full px-10 min-w-4xl max-w-8xl mx-auto">
						<div class="flex justify-end gap-2">
							<button
								class="p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs"
								onClick={() => setLocation(`/templates2/${template.id}/editor`)}
							>
								Edit template
							</button>
							<button
								class="p-1 px-2 rounded-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white text-xs"
								onClick={handleUpdate}
							>
								Save
							</button>
						</div>
						<div class="p-3 border-1 border-neutral-100 shadow-sm rounded-sm">
							<h1 class="text-lg font-semibold">Template attributes</h1>
							<form ref={attributeForm} class="flex flex-col gap-3 px-1 mt-2 ">
								<div class="flex flex-col gap-1">
									<label for="fromEmail" class="text-sm">
										From email
									</label>
									<input
										type="text"
										id="fromEmail"
										name="from_email"
										class="border-1 bg-neutral-200 border-neutral-300 p-1"
										disabled
										autocomplete="off"
										value={template.from_email}
									/>
								</div>
								<div class="flex flex-col gap-1">
									<label for="name" class="text-sm">
										Name
									</label>
									<input
										type="text"
										id="name"
										name="subject"
										class="border-1 border-neutral-300 p-1"
										autocomplete="off"
										value={template.subject}
									/>
								</div>
								<div class="flex flex-col gap-1">
									<label for="contentType" class="text-sm">
										Content type
									</label>
									<select
										id="contentType"
										name="content_type"
										class="border-1 bg-neutral-200 border-neutral-300 p-1"
										value={template.content_type}
										disabled
									>
										<option value="text/html">text/html</option>
										<option value="text/plain">text/plain</option>
									</select>
								</div>
								<div class="flex flex-col gap-1">
									<label for="contentType" class="text-sm">
										Triggers
									</label>
									<div class="flex gap-2 mt-2 items-center">
										{triggers.map((trigger) => (
											<div
												key={trigger.id}
												class="cursor-default shadow-sm p-1 px-2 hover:bg-blue-50 rounded-lg"
												onClick={() => {
													setLocation(`/triggers2/${trigger.id}`);
												}}
											>
												<div class="flex items-center justify-between gap-2">
													<span class="text-black text-xs">
														{trigger.connection_name ||
															`Connection #${trigger.connection_id}`}
													</span>
													<span
														class={`p-1 px-2 rounded-sm text-xs ${trigger.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"}`}
													>
														{trigger.is_active ? "Active" : "Inactive"}
													</span>
												</div>
											</div>
										))}
										<div class="flex flex-col gap-2">
											{showTriggerForm ? (
												<div class="flex items-center gap-2">
													<div class="flex flex-col gap-1">
														<select
															id="triggerConnection"
															class="border-1 border-neutral-300 p-1 rounded-sm text-xs"
															value={selectedConnectionId}
															onChange={(e) =>
																setSelectedConnectionId(e.target.value)
															}
														>
															<option value="">Select a connection</option>
															{connections.map((connection) => (
																<option
																	key={connection.id}
																	value={connection.id}
																>
																	{connection.name}
																</option>
															))}
														</select>
													</div>
													<button
														type="button"
														class="p-1 px-2 rounded-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white text-xs disabled:opacity-50 disabled:hover:bg-blue-500"
														disabled={!selectedConnectionId || creating}
														onClick={handleCreateTrigger}
													>
														{creating ? "Creating..." : "Create"}
													</button>
													<button
														type="button"
														class="p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs"
														onClick={() => setShowTriggerForm(false)}
													>
														Cancel
													</button>
												</div>
											) : (
												<div>
													<button
														type="button"
														class="p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs"
														onClick={() => setShowTriggerForm(true)}
													>
														+ Create trigger
													</button>
												</div>
											)}
										</div>
									</div>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</Layout2>
	);
}
