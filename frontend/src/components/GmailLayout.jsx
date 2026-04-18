import { useState, useEffect, useCallback } from 'preact/hooks';
import { Sidebar } from './Sidebar';
import { EmailList } from './EmailList';
import { EmailViewer } from './EmailViewer';
import { Menu, Search } from 'lucide-react';

export function GmailLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [selectedEmailId, setSelectedEmailId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || null;
  });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'detail'
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Used to trigger email list refresh

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileView('list');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  // Sync selected email with URL
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const emailId = params.get('email');
      setSelectedEmailId(emailId);
      if (isMobile && emailId) {
        setMobileView('detail');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile]);

  const handleEmailSelect = useCallback((emailId) => {
    setSelectedEmailId(emailId);
    const params = new URLSearchParams(window.location.search);
    if (emailId) {
      params.set('email', emailId);
    } else {
      params.delete('email');
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.pushState({}, '', newUrl);
    if (isMobile) {
      setMobileView('detail');
    }
  }, [isMobile]);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
    setSelectedEmailId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('email');
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.pushState({}, '', newUrl);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleEmailStatusChange = useCallback(() => {
    // Trigger email list refresh when status changes
    setRefreshTrigger(prev => prev + 1);
  }, []);

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

        {/* Search Bar - Desktop */}
        <div className="hidden md:flex flex-1 max-w-2xl mx-8">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search mail"
              className="w-full pl-12 pr-4 py-2.5 bg-[#eaf1fb] border-none rounded-full text-sm focus:outline-none focus:bg-white focus:shadow-md transition-all"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Placeholder for user avatar/actions */}
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
            U
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Email List Column */}
        <div
          className={`
            flex-shrink-0 border-r border-gray-200 bg-white
            ${isMobile
              ? mobileView === 'list' ? 'w-full' : 'hidden'
              : 'w-[400px] min-w-[320px] max-w-[500px]'
            }
          `}
        >
          <EmailList
            selectedEmailId={selectedEmailId}
            onEmailSelect={handleEmailSelect}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Email Detail Column */}
        <div
          className={`
            flex-1 bg-white overflow-hidden
            ${isMobile
              ? mobileView === 'detail' ? 'w-full' : 'hidden'
              : ''
            }
          `}
        >
          <EmailViewer
            emailId={selectedEmailId}
            onBack={isMobile ? handleBackToList : null}
            onStatusChange={handleEmailStatusChange}
          />
        </div>
      </div>
    </div>
  );
}
