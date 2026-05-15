import { useState, useEffect } from 'preact/hooks';
import { Menu, X } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('Settings');

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

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
        pageTitle={pageTitle}
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
        <div className="hidden md:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            onActiveChange={setPageTitle}
          />
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 z-40 bg-[#f6f8fc]">
            <Sidebar
              mobile={true}
              onActiveChange={(title) => {
                setPageTitle(title);
                setMobileMenuOpen(false);
              }}
            />
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
