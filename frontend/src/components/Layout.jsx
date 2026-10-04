import { Link, useLocation } from "wouter";
import { Settings } from "lucide-react";
import { getBase } from "../lib/base";

export function Layout({ children, title, breadcrumbs }) {
  const [location, setLocation] = useLocation()

	return (
		<>
			<div class="w-full p-3 shadow-sm mb-5 flex items-center gap-2">
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 flex items-center justify-center">
						<img
							src={`${getBase()}/icons.svg`}
							width="64"
							height="64"
							alt="Mailbox Logo"
              class="cursor-pointer"
              onclick={() => setLocation('/')}
						/>
					</div>
					<span className="text-lg font-semibold text-gray-700">Hopthu</span>
				</div>

				{title && <h1>{title}</h1>}

				<div className="ml-auto flex items-center gap-2">
					<Link
						href="/settings"
						aria-label="Settings"
						title="Settings"
						className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
					>
						<Settings className="w-5 h-5" />
					</Link>
				</div>
			</div>
			{breadcrumbs && (
				<div class="flex items-center gap-1 text-sm text-neutral-500 mb-5 py-2 pl-2 mx-3 min-w-4xl max-w-8xl bg-neutral-100 shadow-sm">
					{breadcrumbs.map((crumb, i) => (
						<span key={i} class="flex items-center gap-1">
							{i > 0 && <span>›</span>}
							{crumb.href ? (
								<Link href={crumb.href} class="hover:text-neutral-800">
									{crumb.label}
								</Link>
							) : (
								<span class="text-neutral-800">{crumb.label}</span>
							)}
						</span>
					))}
				</div>
			)}
			{children}
		</>
	);
}
