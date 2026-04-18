import { Link } from 'preact-router';
import { useState, useEffect } from 'preact/hooks';
import {
  Inbox,
  FileText,
  Link as LinkIcon,
  Settings,
  LogOut,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api';

// Navigation items configuration
const navItems = [
  { path: '/', label: 'Inbox', icon: Inbox },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/connections', label: 'Connections', icon: LinkIcon },
];

export function Sidebar({ collapsed, onToggle }) {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [hoveredItem, setHoveredItem] = useState(null);

  // Update current path on navigation
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', updatePath);
    const observer = new MutationObserver(updatePath);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('popstate', updatePath);
      observer.disconnect();
    };
  }, []);

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

  return (
    <aside
      className={`
        flex flex-col bg-[#f6f8fc] transition-all duration-200 ease-out
        ${collapsed ? 'w-[72px]' : 'w-[256px]'}
      `}
    >

      {/* Navigation Items */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);

          return (
            <Link
              key={item.path}
              href={item.path}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`
                flex items-center gap-4 px-3 py-3 rounded-full
                transition-all duration-150 relative group
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-[#d3e3fd] text-[#041e49] font-medium'
                  : 'hover:bg-[#e9eef6] text-[#444746]'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#041e49]' : 'text-[#444746]'}`} />
              {!collapsed && (
                <span className="text-sm">{item.label}</span>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && hoveredItem === item.path && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section - Settings & Logout */}
      <div className="p-2 border-t border-gray-200 mt-auto">
        {/* Settings */}
        <Link
          href="/accounts"
          className={`
            flex items-center gap-4 px-3 py-3 rounded-full
            transition-all duration-150 relative group
            ${collapsed ? 'justify-center' : ''}
            ${isActivePath('/accounts')
              ? 'bg-[#d3e3fd] text-[#041e49] font-medium'
              : 'hover:bg-[#e9eef6] text-[#444746]'
            }
          `}
        >
          <Settings className={`w-5 h-5 ${isActivePath('/accounts') ? 'text-[#041e49]' : 'text-[#444746]'}`} />
          {!collapsed && (
            <span className="text-sm">Settings</span>
          )}
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`
            flex items-center gap-4 px-3 py-3 rounded-full w-full
            transition-all duration-150 relative group mt-1
            hover:bg-red-50 text-[#444746] hover:text-red-600
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && (
            <span className="text-sm">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}
