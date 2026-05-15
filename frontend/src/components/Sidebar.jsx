import { Link } from 'preact-router';
import { useState, useEffect } from 'preact/hooks';
import {
  Inbox,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import { bp, getBase } from '../lib/base';

// Navigation items configuration
const navItems = [
  { path: '/', label: 'Inbox', icon: Inbox },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/connections', label: 'Connections', icon: LinkIcon },
];

export function Sidebar({ collapsed, onToggle, mobile, onActiveChange }) {
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

  // Notify parent of active item
  useEffect(() => {
    if (onActiveChange) {
      const base = getBase();
      const normalizedCurrent = currentPath || '/';
      const normalizedBase = base || '/';

      const activeItem = navItems.find((item) => {
        if (item.path === '/') {
          return normalizedCurrent === normalizedBase || normalizedCurrent === normalizedBase + '/';
        }
        return normalizedCurrent.startsWith(normalizedBase + item.path);
      });
      onActiveChange(activeItem?.label || 'Settings');
    }
  }, [currentPath, onActiveChange]);

  const isActivePath = (path) => {
    const base = getBase();
    const normalizedCurrent = currentPath || '/';
    const normalizedBase = base || '/';

    if (path === '/') {
      return normalizedCurrent === normalizedBase || normalizedCurrent === normalizedBase + '/';
    }
    const basePath = normalizedBase + path;
    return normalizedCurrent.startsWith(basePath);
  };

  if (mobile) {
    return (
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);
          return (
            <Link
              key={item.path}
              href={bp(item.path)}
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
            </Link>
          );
        })}
      </nav>
    );
  }

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
              href={bp(item.path)}
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
    </aside>
  );
}
