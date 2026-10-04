import { Link } from "wouter";
import { Mail, Link as LinkIcon, FileText } from "lucide-react";
import { Layout } from "../../components/Layout";

export const SETTINGS_MENU = [
	{ path: "/settings/email-accounts", label: "Email accounts", icon: Mail },
	{ path: "/settings/connections", label: "Connections", icon: LinkIcon },
	{ path: "/settings/templates", label: "Templates", icon: FileText },
];

export function SettingsLayout({ active, title = "Settings", breadcrumbs, children }) {
	return (
		<Layout title={title} breadcrumbs={breadcrumbs}>
			<div class="mx-auto min-w-4xl max-w-8xl px-3 pb-10 flex gap-6">
				{/* Left: menu bar */}
				<aside class="w-56 shrink-0">
					<nav class="flex flex-col gap-1">
						{SETTINGS_MENU.map((item) => {
							const Icon = item.icon;
							const isActive = item.path === active;
							return (
								<Link
									key={item.path}
									href={item.path}
									className={`
										flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
										${
											isActive
												? "bg-gray-200 text-gray-900"
												: "text-gray-700 hover:bg-gray-100"
										}
									`}
								>
									<Icon className="w-4 h-4" />
									{item.label}
								</Link>
							);
						})}
					</nav>
				</aside>

				{/* Right: display content */}
				<section class="flex-1 min-w-0">{children}</section>
			</div>
		</Layout>
	);
}
