function formatDate(dateStr) {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	const now = new Date();

	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	}
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function EmailList2({ emails, loading, selectedEmailId, onSelect }) {
	if (loading) {
		return (
			<div className="flex items-center justify-center h-32">
				<div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
			</div>
		);
	}

	if (emails.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
				No emails
			</div>
		);
	}

	return (
		<div className="divide-y divide-gray-100">
			{emails.map((email) => {
				const isSelected = selectedEmailId === String(email.id);

				return (
					<div
						key={email.id}
						onClick={() => onSelect?.(String(email.id))}
						className={`px-3 py-2 cursor-pointer transition-colors ${
							isSelected
								? "bg-[#c2dbff]"
								: "hover:bg-[#f2f6fc]"
						}`}
					>
						<div
							className={`truncate text-sm ${
								email.status === "new"
									? "font-medium text-gray-900"
									: "text-gray-700"
							}`}
						>
							{email.subject || "(no subject)"}
						</div>
						<div className="flex items-center justify-between gap-2 mt-0.5">
							<span className="truncate text-xs text-gray-500">
								{email.from_email}
							</span>
							<span className="text-xs text-gray-500 whitespace-nowrap">
								{formatDate(email.received_at)}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}
