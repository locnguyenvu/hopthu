import { useEffect, useRef, useState, useContext } from "preact/hooks";
import { Link } from "wouter";
import { ToastContext } from "../app";
import { api } from "../api";

export function EmailViewer2({ id }) {
	const toast = useContext(ToastContext);
	const [email, setEmail] = useState(null);
	const [activeSection, setActiveSection] = useState("emailContent");
	const [templateDryRunResult, setTremplateDryRunResult] = useState("");
	const [dryRunTemplateId, setDryRunTemplateId] = useState(null);
	const [dryRunData, setDryRunData] = useState(null);
	const [savingDryRun, setSavingDryRun] = useState(false);
	const [templates, setTemplates] = useState([]);
	const [triggerLogs, setTriggerLogs] = useState(null);
	const dryRunDialog = useRef(null);

	useEffect(() => {
		const getEmail = async () => {
			const response = await api.getEmail(id);
			setEmail(response.data);
		};
		getEmail();
	}, []);

	useEffect(() => {
		const fetchTemplate = async () => {
			const response = await api.listTemplates({
				from_email: email.from_email,
			});
			setTemplates(response.data);
		};

		if (activeSection == "metaData" && templates.length === 0) fetchTemplate();
		if (activeSection == "metaData" && triggerLogs === null) fetchTriggerLogs();
	}, [activeSection]);

	const fetchTriggerLogs = async () => {
		try {
			const response = await api.listAllTriggerLogs({
				email_id: email.id,
			});
			setTriggerLogs(response.data.logs);
		} catch (e) {
			console.error(e);
			toast.error(e.message);
		}
	};

	const runTriggers = async () => {
		try {
			const response = await api.runEmailTriggers(email.id);
			const logs = response.data || [];
			toast.success(
				logs.length
					? `Ran ${logs.length} trigger(s): ${logs
							.map((l) => l.status)
							.join(", ")}`
					: "No active triggers for this template",
			);
			// Refresh email (status may change to pushed) and trigger logs
			const emailResponse = await api.getEmail(email.id);
			setEmail(emailResponse.data);
			fetchTriggerLogs();
		} catch (e) {
			console.error(e);
			toast.error(e.message);
		}
	};

	const logStatusClass = (status) => {
		if (status === "success") return "bg-green-100 text-green-800";
		if (status === "failed") return "bg-red-100 text-red-800";
		return "bg-gray-100 text-gray-800";
	};

	const className = (section) => {
		let classes = [
			"px-2",
			"py-1",
			"text-xs",
			"font-semibold",
			"cursor-default",
			"border-gray-300",
			"border-1",
			"rounded-xs",
		];
		if (activeSection === section) {
			classes.push(...["bg-gray-700", "text-white"]);
		}
		return classes.join(" ");
	};

	const extractedFromTemplate = () => {
		if (
			email.email_data &&
			email.email_data.data &&
			email.email_data.data.extracted_data
		)
			return email.email_data.template_id;
		return null;
	};

	const archived = async () => {
		try {
			const response = await api.updateEmailStatus(email.id, "archived");
			setEmail(response.data);
			toast.success("Email archived");
		} catch (e) {
			console.error(e);
			toast.error(e.message);
		}
	};

	const runTemplateDryRun = async (template_id) => {
		try {
			const response = await api.templateDryrun(email.id, template_id);
			setTremplateDryRunResult(JSON.stringify(response.data, null, 4));
			setDryRunTemplateId(template_id);
			setDryRunData(response.data);
			if (!dryRunDialog.current) return;
			dryRunDialog.current.showModal();
		} catch (e) {
			console.error(e);
			toast.error(e.message);
		}
	};

	const saveExtractAndRunTrigger = async () => {
		if (!dryRunTemplateId || !dryRunData) return;
		setSavingDryRun(true);
		try {
			// (1) Create/update email_data with the dry-run payload
			await api.saveEmailData(email.id, dryRunTemplateId, dryRunData);
			toast.success("Extracted data saved");

			// (2) Run the triggers for this email
			const response = await api.runEmailTriggers(email.id);
			const logs = response.data || [];
			toast.success(
				logs.length
					? `Ran ${logs.length} trigger(s): ${logs
							.map((l) => l.status)
							.join(", ")}`
					: "No active triggers for this template",
			);

			// Refresh email (status + email_data) and trigger logs, then close
			const emailResponse = await api.getEmail(email.id);
			setEmail(emailResponse.data);
			fetchTriggerLogs();
			dryRunDialog.current?.close();
		} catch (e) {
			console.error(e);
			toast.error(e.message);
		} finally {
			setSavingDryRun(false);
		}
	};

	return email ? (
		<>
			{" "}
			<dialog
				ref={dryRunDialog}
				id="dryRunDialog"
				class="rounded-md p-5 shadow-xl backdrop:bg-black/50 open:animate-in open:fade-in w-2xl"
				style={{
					left: "50%",
					transform: "translateX(-50%) translateY(-10%)",
					top: "10%",
				}}
			>
				<div class="flex flex-col gap-3">
					<div>Dry run result</div>
					<pre class="p-2 text-xs bg-gray-300 font-mono overflow-x-auto">
						<code>{templateDryRunResult}</code>
					</pre>
					<div class="w-full flex justify-end gap-2">
						<button
							onclick={saveExtractAndRunTrigger}
							disabled={savingDryRun || !dryRunData}
							class="bg-gray-700 text-white text-xs p-1 px-2 rounded-md disabled:opacity-50"
						>
							{savingDryRun ? "Saving..." : "Save & run trigger"}
						</button>
						<button
							commandfor="dryRunDialog"
							command="request-close"
							class="bg-gray-200 text-black text-xs p-1 px-2 rounded-md"
						>
							Close
						</button>
					</div>
				</div>
			</dialog>
			<div class="w-full flex flex-col gap-2 pr-3">
				<div class="flex justify-between">
          <div class="flex">
            <div
              class={className("emailContent")}
              onclick={() => setActiveSection("emailContent")}
            >
              Email
            </div>
            <div
              class={className("metaData")}
              onclick={() => setActiveSection("metaData")}
            >
              Meta data
            </div>
          </div>
          <div class="flex">
            {email.status !== "archived" && <button
              onclick={archived}
              class="text-xs py-1 px-2 rounded-sm bg-gray-200"
            >Archive</button>}
          </div>
				</div>
				<div class="p-2">
					{activeSection === "emailContent" && (
						<>
							<div class="w-full flex flex-col">
								<iframe srcDoc={email.body} class="w-full h-svh" />
							</div>
						</>
					)}
					{activeSection === "metaData" && (
						<div class="w-full flex flex-col gap-3">
							<div class="w-full flex flex-col gap-2 p-2 shadow-md">
								<div class="flex justify-between">
									<div class="font-semibold text-xl">Templates</div>
									<Link
										class="text-xs font-semibold"
										href={`/templates2/new?email_id=${email.id}`}
									>
										Add new
									</Link>
								</div>
								{templates.length && (
									<div class="flex flex-col">
										{templates.map((tpl) => {
											return (
												<div class="p-1 px-2 border-b-1 border-gray-300 flex flex-col gap-2">
													<div class="flex justify-between">
														<div>
															<Link key={tpl.id} href={`/templates2/${tpl.id}`}>
																<span
																	class={
																		tpl.id === extractedFromTemplate()
																			? "font-semibold"
																			: ""
																	}
																>
																	{tpl.subject}
																</span>
															</Link>
														</div>
														<div class="flex gap-2">
															<button
																onclick={() => runTemplateDryRun(tpl.id)}
																class="text-xs px-2 py-0.5 border-1 border-gray-200 rounded-xs"
															>
																run extract
															</button>
														</div>
													</div>
													{extractedFromTemplate() === tpl.id && (
														<div>
															<pre class="text-xs font-mono bg-gray-100 p-1 overflow-x-auto">
																<code>
																	{JSON.stringify(
																		email.email_data.data.extracted_data,
																		null,
																		4,
																	)}
																</code>
															</pre>
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>
							{extractedFromTemplate() && (
							<div class="w-full flex flex-col gap-2 p-2 shadow-md">
								<div class="flex justify-between">
									<div class="font-semibold text-xl">Trigger logs</div>
									<button
										onclick={runTriggers}
										class="text-xs px-2 py-0.5 rounded-xs bg-gray-700 text-white self-start"
									>
										run trigger
									</button>
								</div>
								{triggerLogs === null ? (
									<div class="text-xs text-gray-500">Loading...</div>
								) : triggerLogs.length === 0 ? (
									<div class="text-xs text-gray-500">No trigger logs</div>
								) : (
									<div class="flex flex-col">
										{triggerLogs.map((log) => (
											<details
												key={log.id}
												class="p-1 px-2 border-b-1 border-gray-300 text-xs"
											>
												<summary class="flex justify-between items-center cursor-pointer gap-2">
													<span class="font-semibold truncate">
														{log.trigger_name || `Trigger #${log.trigger_id}`}
													</span>
													<span class="flex items-center gap-2 shrink-0">
														{log.response_status && (
															<span class="text-gray-500">HTTP {log.response_status}</span>
														)}
														<span
															class={`px-1.5 py-0.5 rounded-xs ${logStatusClass(log.status)}`}
														>
															{log.status}
														</span>
														<span class="text-gray-500">
															{log.executed_at
																? new Date(log.executed_at).toLocaleString()
																: ""}
														</span>
													</span>
												</summary>
												<div class="flex flex-col gap-2 mt-2">
													<div class="font-semibold">
														{log.request_method} {log.request_url}
													</div>
													{log.request_body && (
														<div>
															<div class="font-semibold text-gray-500">Request body</div>
															<pre class="font-mono bg-gray-100 p-1 overflow-x-auto">
																<code>
																	{typeof log.request_body === "string"
																		? log.request_body
																		: JSON.stringify(log.request_body, null, 2)}
																</code>
															</pre>
														</div>
													)}
													{log.response_body && (
														<div>
															<div class="font-semibold text-gray-500">Response body</div>
															<pre class="font-mono bg-gray-100 p-1 overflow-x-auto">
																<code>{log.response_body}</code>
															</pre>
														</div>
													)}
												</div>
											</details>
										))}
									</div>
								)}
							</div>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	) : (
		<div>loading...</div>
	);
}
