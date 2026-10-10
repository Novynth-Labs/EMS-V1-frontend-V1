import React, { useEffect, useState } from 'react';
import { getNotifications, markAsRead, markAllAsRead, type AppNotification } from '../../api/notifications.api';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Info, Clock, X, Calendar, CheckSquare, MessageSquare, Shield, Volume2 } from 'lucide-react';
import { playNotificationSound } from '../../utils/sound';

export const NotificationInbox: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifs = () => {
    getNotifications().then(data => {
      setNotifications(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifs();
    const handleNewNotif = () => {
      fetchNotifs();
    };
    window.addEventListener('ems:notification', handleNewNotif);
    return () => {
      window.removeEventListener('ems:notification', handleNewNotif);
    };
  }, []);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      window.dispatchEvent(new CustomEvent('ems:notifications-read'));
    }
    if (notif.link) {
      navigate(notif.link);
    }
    onClose();
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent('ems:notifications-read'));
    } catch (e) {}
  };

  const getIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('leave') || t.includes('wfh')) return <Calendar size={16} className="text-amber-500" />;
    if (t.includes('task')) return <CheckSquare size={16} className="text-indigo-500" />;
    if (t.includes('approval') || t.includes('approved')) return <CheckCircle2 size={16} className="text-emerald-500" />;
    if (t.includes('reject') || t.includes('warning') || t.includes('alert')) return <AlertTriangle size={16} className="text-rose-500" />;
    if (t.includes('message') || t.includes('chat')) return <MessageSquare size={16} className="text-sky-500" />;
    if (t.includes('system')) return <Shield size={16} className="text-purple-500" />;
    return <Info size={16} className="text-indigo-400" />;
  };

  const getTimeAgo = (isoString: string) => {
    const minutes = Math.floor((new Date().getTime() - new Date(isoString).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-[var(--color-border)] shadow-xl rounded-lg overflow-hidden z-50 flex flex-col max-h-[400px]">
      <div className="p-3 border-b border-[var(--color-border)] bg-gray-50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-[var(--color-text-primary)] text-sm">Notifications</h3>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); playNotificationSound(); }}
            title="Test notification sound chime"
            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 transition-colors"
          >
            <Volume2 size={13} />
          </button>
        </div>
        <span 
          onClick={handleMarkAllRead}
          className="text-xs text-[var(--color-primary)] font-medium cursor-pointer hover:underline"
        >
          Mark all read
        </span>
      </div>

      <div className="overflow-y-auto flex-1 p-0">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors relative flex gap-3 ${
                  !notif.isRead ? 'bg-indigo-50/30' : ''
                }`}
              >
                {!notif.isRead && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-accent)]" />
                )}
                
                <div className="mt-0.5 shrink-0">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className={`text-sm truncate pr-2 ${!notif.isRead ? 'font-semibold text-[var(--color-text-primary)]' : 'font-medium text-gray-700'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 flex items-center gap-1">
                      <Clock size={10} />
                      {getTimeAgo(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
