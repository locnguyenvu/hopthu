import { useState, useEffect, useCallback } from 'preact/hooks';
import { Sidebar } from './Sidebar';
import { EmailList } from './EmailList';
import { EmailViewer } from './EmailViewer';
import { Menu } from 'lucide-react';
import { Header } from './Header';
import { api } from '../api';

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
      <Header
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebar={toggleSidebar}
        showUserDropdown={true}
      />

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
