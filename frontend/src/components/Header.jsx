import { Menu } from 'lucide-react';
import { UserDropdown } from './UserDropdown';
import { bp } from '../lib/base';

export function Header({
  sidebarCollapsed,
  toggleSidebar,
  children = null,
  showPageTitle = false,
  pageTitle = '',
  showUserDropdown = false
}) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src={bp('/icons.svg')} width="64" height="64" alt="Mailbox Logo" />
          </div>
          <span className="text-xl font-semibold text-gray-700">Hopthu</span>
        </div>
      </div>

      {/* Page Title - Desktop */}
      {showPageTitle && (
        <div className="hidden md:flex flex-1 mx-8">
          <h1 className="text-lg font-medium text-gray-700">
            {pageTitle}
          </h1>
        </div>
      )}

      {/* Additional elements can be passed as children */}
      <div className="ml-auto flex items-center gap-2">
        {children}
        {showUserDropdown && <UserDropdown />}
      </div>
    </header>
  );
}
