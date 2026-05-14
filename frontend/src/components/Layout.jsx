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
import { Header } from './Header';
import { bp } from '../lib/base';

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
      <Header
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebar={toggleSidebar}
        showPageTitle={true}
        pageTitle={navItems.find(item => isActivePath(item.path))?.label || 'Settings'}
        showUserDropdown={true}
      >
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
        </button>
      </Header>

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
                  href={bp(item.path)}
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

          {/* Bottom Section - Settings & Logout moved to user dropdown */}
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
