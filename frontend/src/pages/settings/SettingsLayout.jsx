import { Link } from "wouter";
import { Mail, Link as LinkIcon } from "lucide-react";
import { Layout2 } from "../../components/Layout2";

export const SETTINGS_MENU = [
	{ path: "/settings/email-accounts", label: "Email accounts", icon: Mail },
	{ path: "/settings/connections", label: "Connections", icon: LinkIcon },
];

export function SettingsLayout({ active, breadcrumbs, children }) {
	return (
		<Layout2 title="Settings" breadcrumbs={breadcrumbs}>
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
												? "bg-[#d3e3fd] text-[#041e49]"
												: "text-[#444746] hover:bg-[#e9eef6]"
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
		</Layout2>
	);
}
