import { useState, useEffect } from 'preact/hooks';
import {
  Inbox,
  FileText,
  Link as LinkIcon,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { api } from '../api';

// Navigation items configuration
const navItems = [
  { path: '/', label: 'Inbox', icon: Inbox },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/connections', label: 'Connections', icon: LinkIcon },
];

export function Layout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Update current path on navigation
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', updatePath);
    const observer = new MutationObserver(updatePath);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('popstate', updatePath);
      observer.disconnect();
    };
  }, []);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const handleLogout = async () => {
    try {
      await api.logout();
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  const isActivePath = (path) => {
    if (path === '/') {
      return currentPath === '/' || currentPath === '';
    }
    return currentPath.startsWith(path);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="h-screen flex flex-col bg-[#f6f8fc] overflow-hidden">
      {/* Top Bar */}
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
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-gray-700">Hopthu</span>
          </div>
        </div>

        {/* Page Title - Desktop */}
        <div className="hidden md:flex flex-1 mx-8">
          <h1 className="text-lg font-medium text-gray-700">
            {navItems.find(item => isActivePath(item.path))?.label || 'Settings'}
          </h1>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside
          className={`
            hidden md:flex flex-col bg-[#f6f8fc] transition-all duration-200 ease-out border-r border-gray-200
            ${sidebarCollapsed ? 'w-[72px]' : 'w-[256px]'}
          `}
        >
          {/* Navigation Items */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);

              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`
                    flex items-center gap-4 px-3 py-3 rounded-full
                    transition-all duration-150
                    ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-[#d3e3fd] text-[#041e49] font-medium'
                      : 'hover:bg-[#e9eef6] text-[#444746]'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#041e49]' : 'text-[#444746]'}`} />
                  {!sidebarCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                </a>
              );
            })}
          </nav>

          {/* Bottom Section - Settings & Logout */}
          <div className="p-2 border-t border-gray-200">
            {/* Settings */}
            <a
              href="/accounts"
              className={`
                flex items-center gap-4 px-3 py-3 rounded-full
                transition-all duration-150
                ${sidebarCollapsed ? 'justify-center' : ''}
                ${isActivePath('/accounts')
                  ? 'bg-[#d3e3fd] text-[#041e49] font-medium'
                  : 'hover:bg-[#e9eef6] text-[#444746]'
                }
              `}
            >
              <Settings className={`w-5 h-5 ${isActivePath('/accounts') ? 'text-[#041e49]' : 'text-[#444746]'}`} />
              {!sidebarCollapsed && (
                <span className="text-sm">Settings</span>
              )}
            </a>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className={`
                flex items-center gap-4 px-3 py-3 rounded-full w-full
                transition-all duration-150 mt-1
                hover:bg-red-50 text-[#444746] hover:text-red-600
                ${sidebarCollapsed ? 'justify-center' : ''}
              `}
            >
              <LogOut className="w-5 h-5" />
              {!sidebarCollapsed && (
                <span className="text-sm">Logout</span>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 z-40 bg-[#f6f8fc]">
            <nav className="p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors
                      ${isActive
                        ? 'bg-[#d3e3fd] text-[#041e49]'
                        : 'text-[#444746] hover:bg-[#e9eef6]'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </a>
                );
              })}
              <hr className="my-4 border-gray-200" />
              <a
                href="/accounts"
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors
                  ${isActivePath('/accounts')
                    ? 'bg-[#d3e3fd] text-[#041e49]'
                    : 'text-[#444746] hover:bg-[#e9eef6]'
                  }
                `}
              >
                <Settings className="w-5 h-5" />
                Settings
              </a>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </nav>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-white">
          <div className="p-6 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
