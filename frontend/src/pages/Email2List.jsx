import { EmailList2 } from "../components/EmailList2";
import { EmailViewer2 } from "../components/EmailViewer2";
import { Layout2 } from "../components/Layout2";
import { api } from "../api";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useLocation } from "wouter";

// Matches Tailwind's lg breakpoint
const MOBILE_QUERY = "(max-width: 1023px)";

const STATUS_OPTIONS = ["new", "extracted", "pushed", "ignored", "archived"];

export function Email2List() {
	const [, setLocation] = useLocation();
	const [isMobile, setIsMobile] = useState(() =>
		window.matchMedia(MOBILE_QUERY).matches,
	);
	const [emails, setEmails] = useState([]);
  const [filterStatus, setFilterStatus] = useState(['new', 'extracted'])
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [pagination, setPagination] = useState({
		page: 1,
		per_page: 25,
		total: 0,
	});
	const [selectedEmailId, setSelectedEmailId] = useState(null);
	const [statusMenuOpen, setStatusMenuOpen] = useState(false);
	const statusMenuRef = useRef(null);

	const loadEmails = useCallback(async () => {
		try {
			setLoading(true);
			const response = await api.listEmails({
				page: pagination.page,
				per_page: pagination.per_page,
        status: filterStatus.join(',')
			});
			setEmails(response.data || []);
			setPagination((prev) => ({ ...prev, ...response.pagination }));
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	}, [pagination.page, filterStatus]);

	useEffect(() => {
		loadEmails();
	}, [loadEmails]);

	useEffect(() => {
		const mq = window.matchMedia(MOBILE_QUERY);
		const onChange = (e) => setIsMobile(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	useEffect(() => {
		if (!statusMenuOpen) return;
		const onClickOutside = (e) => {
			if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
				setStatusMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, [statusMenuOpen]);

	const statusLabel = () =>
		filterStatus.length === 0
			? "all"
			: STATUS_OPTIONS.filter((s) => filterStatus.includes(s)).join(", ");

	const handleStatusToggle = (status) => {
		setPagination((prev) => ({ ...prev, page: 1 }));
		setFilterStatus((prev) =>
			prev.includes(status)
				? prev.filter((s) => s !== status)
				: [...prev, status],
		);
	};

	const handleSelect = (id) => {
		if (isMobile) {
			setLocation(`/emails2/${id}`);
		} else {
			setSelectedEmailId(id);
		}
	};

	return (
		<Layout2>
			<div className="flex flex-col gap-3 mx-3 h-[calc(100vh-5rem)]">
				<div className="shrink-0 relative bg-white border border-gray-200 rounded px-3 py-2 flex items-center">
					<div ref={statusMenuRef} className="relative">
						<button
							type="button"
							onClick={() => setStatusMenuOpen((open) => !open)}
							className="text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-3 py-1 cursor-pointer"
						>
							Status: {statusLabel()}
						</button>
						{statusMenuOpen && (
							<div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-40">
								{STATUS_OPTIONS.map((status) => (
									<label
										key={status}
										className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 cursor-pointer select-none hover:bg-gray-50"
									>
										<input
											type="checkbox"
											checked={filterStatus.includes(status)}
											onChange={() => handleStatusToggle(status)}
											className="accent-gray-700 cursor-pointer"
										/>
										{status}
									</label>
								))}
							</div>
						)}
					</div>
				</div>
				<div className="flex gap-3 flex-1 min-h-0">
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
			</div>
		</Layout2>
	);
}
