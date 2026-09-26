import { EmailList2 } from "../components/EmailList2";
import { EmailViewer2 } from "../components/EmailViewer2";
import { Layout2 } from "../components/Layout2";
import { api } from "../api";
import { useCallback, useEffect, useState } from "preact/hooks";
import { useLocation } from "wouter";

// Matches Tailwind's lg breakpoint
const MOBILE_QUERY = "(max-width: 1023px)";

export function Email2List() {
	const [, setLocation] = useLocation();
	const [isMobile, setIsMobile] = useState(() =>
		window.matchMedia(MOBILE_QUERY).matches,
	);
	const [emails, setEmails] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [pagination, setPagination] = useState({
		page: 1,
		per_page: 100,
		total: 0,
	});
	const [selectedEmailId, setSelectedEmailId] = useState(null);

	const loadEmails = useCallback(async () => {
		try {
			setLoading(true);
			const response = await api.listEmails({
				page: pagination.page,
				per_page: pagination.per_page,
			});
			setEmails(response.data || []);
			setPagination((prev) => ({ ...prev, ...response.pagination }));
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	}, [pagination.page]);

	useEffect(() => {
		loadEmails();
	}, [loadEmails]);

	useEffect(() => {
		const mq = window.matchMedia(MOBILE_QUERY);
		const onChange = (e) => setIsMobile(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	const handleSelect = (id) => {
		if (isMobile) {
			setLocation(`/emails2/${id}`);
		} else {
			setSelectedEmailId(id);
		}
	};

	return (
		<Layout2>
			<div className="flex gap-3 mx-3 h-[calc(100vh-5rem)]">
				<div className="w-full lg:w-1/4 shrink-0 bg-white border border-gray-200 rounded overflow-y-auto">
					{error ? (
						<div className="p-4 text-sm text-red-600">{error}</div>
					) : (
						<EmailList2
							emails={emails}
							loading={loading}
							selectedEmailId={selectedEmailId}
							onSelect={handleSelect}
						/>
					)}
				</div>
				<div className="hidden lg:block w-3/4 bg-white border border-gray-200 rounded overflow-y-auto p-3">
					{selectedEmailId ? (
						<EmailViewer2
							key={selectedEmailId}
							id={selectedEmailId}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-gray-400 text-sm">
							Select an email to view
						</div>
					)}
				</div>
			</div>
		</Layout2>
	);
}
