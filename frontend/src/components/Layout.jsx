import { Link } from 'preact-router';
import { useState, useEffect } from 'preact/hooks';
import { api } from '../api';

export function Layout({ children, sidebar, collapsibleSidebar = false }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

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

  const navItems = [
    { path: '/', label: 'Inbox', icon: '📧' },
    { path: '/accounts', label: 'Accounts', icon: '⚙️' },
    { path: '/templates', label: 'Templates', icon: '📝' },
  ];

  // Get current path from window location
  const currentPath = window.location.pathname;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-blue-600">Hopthu</span>
            </div>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPath === item.path
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex">
        {/* Sidebar */}
        {sidebar && (
          <aside
            className={`${
              sidebarCollapsed ? 'w-12' : 'w-64'
            } min-h-[calc(100vh-3.5rem)] bg-white border-r border-gray-200 transition-all duration-200 flex flex-col`}
          >
            {collapsibleSidebar && (
              <div className="flex justify-end p-2">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {sidebarCollapsed ? '→' : '←'}
                </button>
              </div>
            )}
            <div className={`flex-1 ${sidebarCollapsed ? 'hidden' : 'p-4'}`}>
              {sidebar}
            </div>
          </aside>
        )}

        {/* Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
