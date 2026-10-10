import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Bell, Search, LogOut, User, Settings, ChevronRight, Download, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useActivity, type ActivityState } from '../../contexts/ActivityContext';
import { NotificationInbox } from '../notifications/NotificationInbox';
import { getNotifications } from '../../api/notifications.api';
import { CommandPalette } from '../ui/CommandPalette';
import { AppUpdaterModal } from '../common/AppUpdaterModal';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getInitials } from '../../utils/initials';
import { Avatar } from '../ui/Avatar';

export interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ sidebarCollapsed, onToggleSidebar }) => {
  const { role, user, logout } = useAuthStore();
  const { activityState } = useActivity();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showUpdaterModal, setShowUpdaterModal] = useState(false);
  const [hasUpdateReady, setHasUpdateReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const navigate = useNavigate();
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await getNotifications();
      const count = Array.isArray(data) ? data.filter((n: any) => !n.isRead).length : 0;
      setUnreadCount(count);
    } catch (e) {}
  }, []);

  useEffect(() => {
    refreshUnread();
    const handleNotificationUpdate = () => {
      refreshUnread();
    };
    window.addEventListener('ems:notification', handleNotificationUpdate);
    window.addEventListener('ems:notifications-read', handleNotificationUpdate);
    return () => {
      window.removeEventListener('ems:notification', handleNotificationUpdate);
      window.removeEventListener('ems:notifications-read', handleNotificationUpdate);
    };
  }, [refreshUnread]);

  // Listen for background desktop update status
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const removeListener = window.electronAPI.onUpdaterStatus((data) => {
        if (data.status === 'downloaded' || data.status === 'available') {
          setHasUpdateReady(true);
        }
      });
      return () => {
        if (typeof removeListener === 'function') removeListener();
      };
    }
  }, []);

  // Ctrl + K / Cmd + K Hotkey Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format breadcrumbs from pathname
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
    const name = segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { name, url };
  });

  const getActivityColor = (state: ActivityState) => {
    switch (state) {
      case 'Active': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
      case 'LongInactive': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  const getActivityLabel = (state: ActivityState) => {
    switch (state) {
      case 'Active': return 'Active';
      case 'LongInactive': return 'Away >1hr';
      default: return 'Inactive';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className={`novynth-topbar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button 
            onClick={onToggleSidebar}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all duration-200"
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Link to="/dashboard" className="hover:text-indigo-600 transition-colors">
              Novynth Workflow
            </Link>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.url}>
                <ChevronRight size={12} className="text-slate-300 shrink-0" />
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                    {b.name}
                  </span>
                ) : (
                  <Link to={b.url} className="hover:text-indigo-600 transition-colors truncate max-w-[120px]">
                    {b.name}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Search Launcher */}
          <div className="flex-1 max-w-md ml-2">
            <button 
              onClick={() => setShowCommandPalette(true)}
              className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-slate-400 px-3.5 py-2 rounded-xl border border-slate-200/80 transition-all text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <Search size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                <span className="font-medium text-slate-400 group-hover:text-slate-600">Search pages, people, tasks...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs">
                <span>Ctrl</span> K
              </kbd>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* App Update Button */}
          <button
            onClick={() => setShowUpdaterModal(true)}
            className={`relative p-2.5 rounded-xl transition-all duration-200 ${
              hasUpdateReady 
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 animate-pulse' 
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Check for Application Updates"
            aria-label="App Updates"
          >
            <Download size={20} />
            {hasUpdateReady && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2.5 rounded-xl transition-all duration-200 ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center animate-pulse shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
            
            {showNotifications && (
              <NotificationInbox onClose={() => setShowNotifications(false)} />
            )}
          </div>

          <div className="flex items-center gap-3 pl-3 ml-2 border-l border-slate-200">
            <div className="flex items-center gap-2" title="Live Activity Status">
              <div className={`w-2.5 h-2.5 rounded-full ${getActivityColor(activityState)}`} />
              <span className="text-xs font-medium text-slate-500 hidden sm:block">
                {getActivityLabel(activityState)}
              </span>
            </div>

            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="User menu"
              >
                <Avatar 
                  name={user?.name} 
                  avatarUrl={user?.avatarUrl} 
                  size="sm" 
                  className="rounded-lg shadow-xs" 
                  fallbackRole={role?.substring(0, 2).toUpperCase() || 'US'} 
                />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 animate-scale-in">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email || ''}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">
                      {role || 'N/A'}
                    </span>
                  </div>
                  <div className="p-1">
                    <button 
                      onClick={() => { navigate(`/employees/${user?.id}`); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <User size={16} />
                      My Profile
                    </button>
                    <button 
                      onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    <button 
                      onClick={() => { setShowUpdaterModal(true); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium rounded-lg transition-colors"
                    >
                      <Sparkles size={16} />
                      Check for Updates
                    </button>
                  </div>
                  <div className="border-t border-slate-100 p-1">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Command Palette Modal */}
      <CommandPalette 
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* Application Auto-Updater Modal */}
      <AppUpdaterModal 
        isOpen={showUpdaterModal}
        onClose={() => setShowUpdaterModal(false)}
      />
    </>
  );
};