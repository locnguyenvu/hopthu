import { useEffect, useRef, useState, useContext } from "preact/hooks";
import { Link } from "wouter";
import { ToastContext } from "../app";
import { api } from "../api";

export function EmailViewer2({ id }) {
	const toast = useContext(ToastContext);
	const [email, setEmail] = useState(null);
	const [activeSection, setActiveSection] = useState("emailContent");
	const [templateDryRunResult, setTremplateDryRunResult] = useState("");
	const [templates, setTemplates] = useState([]);
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
	}, [activeSection]);

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

	const runTemplateDryRun = async (template_id) => {
		try {
			const response = await api.templateDryrun(email.id, template_id);
			setTremplateDryRunResult(JSON.stringify(response.data, null, 4));
			if (!dryRunDialog.current) return;
			dryRunDialog.current.showModal();
		} catch (e) {
			console.error(e);
			toast.error(e.message);
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
					<pre class="p-2 text-xs bg-gray-300 font-mono">
						<code>{templateDryRunResult}</code>
					</pre>
					<div class="w-full flex justify-end">
						<button
							commandfor="dryRunDialog"
							command="request-close"
							class="bg-gray-700 text-white text-xs p-1 rounded-md"
						>
							Close
						</button>
					</div>
				</div>
			</dialog>
			<div class="w-full flex flex-col gap-2 pr-3">
				<div class="flex justify-center">
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
				<div class="p-2">
					{activeSection === "emailContent" && (
						<>
							<div class="w-full flex flex-col">
								<iframe srcDoc={email.body} class="w-full min-h-svw" />
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
														<div>
															<button
																onclick={() => runTemplateDryRun(tpl.id)}
																class="text-xs"
															>
																dry run
															</button>
														</div>
													</div>
													{extractedFromTemplate() === tpl.id && (
														<div>
															<pre class="text-xs font-mono bg-gray-100 p-1">
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
						</div>
					)}
				</div>
			</div>
		</>
	) : (
		<div>loading...</div>
	);
}
