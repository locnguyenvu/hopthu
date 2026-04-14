import { Link } from 'preact-router';
import { useState, useEffect } from 'preact/hooks';
import {
  Inbox,
  FileText,
  Link as LinkIcon,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';

// Navigation items
const navItems = [
  { path: '/', label: 'Inbox', icon: Inbox },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/connections', label: 'Connections', icon: LinkIcon },
];

export function Layout({ children, sidebar, collapsibleSidebar = false }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  // Update current path on navigation
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', updatePath);
    // Also listen for clicks on links
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
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[var(--color-muted)]">
      {/* Desktop Header */}
      <header className="hidden md:block bg-white border-b border-[var(--color-border)] sticky top-0 z-40">
        <div className="px-4 lg:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
                <Inbox className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-[var(--color-foreground)]">Hopthu</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="flex gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/accounts"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPath.startsWith('/accounts')
                    ? 'bg-[var(--color-muted)] text-[var(--color-foreground)]'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden lg:inline">Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
              <Inbox className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-[var(--color-foreground)]">Hopthu</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="relative z-50 p-2 -mr-2 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            type="button"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 bg-white">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            <hr className="my-4 border-[var(--color-border)]" />
            <Link
              href="/accounts"
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
                currentPath.startsWith('/accounts')
                  ? 'bg-[var(--color-muted)] text-[var(--color-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
              }`}
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-[var(--color-destructive)] hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </nav>
        </div>
      )}

      {/* Main content area */}
      <div className="flex">
        {/* Desktop Sidebar */}
        {sidebar && !isMobile && (
          <aside
            className={`${
              sidebarCollapsed ? 'w-14' : 'w-72'
            } min-h-[calc(100vh-4rem)] bg-white border-r border-[var(--color-border)] transition-all duration-300 ease-out flex flex-col shrink-0`}
          >
            {collapsibleSidebar && (
              <div className="flex justify-end p-2 border-b border-[var(--color-border)]">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded-lg transition-colors"
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
            )}
            <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
              {sidebar}
            </div>
          </aside>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className={`${isMobile ? 'p-4 pb-24' : 'p-6'} max-w-none`}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                  isActive
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-muted-foreground)]'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/accounts"
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
              currentPath.startsWith('/accounts')
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-muted-foreground)]'
            }`}
          >
            <Settings className="w-5 h-5" strokeWidth={currentPath.startsWith('/accounts') ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
