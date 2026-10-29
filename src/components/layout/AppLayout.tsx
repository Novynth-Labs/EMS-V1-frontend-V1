import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import { ConnectionStatusBanner } from './ConnectionStatusBanner';
import { CommandPaletteModal } from '../common/CommandPaletteModal';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/authStore';
import { ToastContainer as NewToastContainer } from '../ui/ToastNotification';

export const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useSocket(); // Initialize real-time WebSocket connection

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-canvas)]">
      <ConnectionStatusBanner />
      <NewToastContainer />
      <IncomingCallOverlay />
      <CommandPaletteModal 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
      />
      <Sidebar collapsed={sidebarCollapsed} />
      {!sidebarCollapsed && (
        <div 
          className="novynth-sidebar-backdrop" 
          onClick={() => setSidebarCollapsed(true)} 
        />
      )}
      <Topbar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} sidebarCollapsed={sidebarCollapsed} />
      
      <main className={`novynth-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};
