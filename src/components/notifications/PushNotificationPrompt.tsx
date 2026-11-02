import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, AlertCircle, Send, X } from 'lucide-react';
import { webPushService, type WebPushStatus } from '../../services/webPush.service';
import { toast } from '../../utils/toast';

export const PushNotificationPrompt: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [status, setStatus] = useState<WebPushStatus>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const checkStatus = async () => {
    const s = await webPushService.getStatus();
    setStatus(s);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (!status.isSupported) {
    if (compact) {
      return (
        <div className="text-xs text-gray-500 flex items-center gap-1.5 p-2 bg-gray-50 rounded">
          <BellOff size={14} className="text-gray-400" />
          <span>Web Push is not supported in this browser environment.</span>
        </div>
      );
    }
    return null;
  }

  // If already dismissed floating banner and not in compact mode
  if (dismissed && !compact) {
    return null;
  }

  // If already granted and subscribed, don't show the floating banner (only show in compact settings)
  if (!compact && status.isSubscribed) {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    try {
      const sub = await webPushService.subscribe();
      if (sub) {
        toast.success('Background notifications enabled! You will receive calls and messages even when the app is closed.');
        await checkStatus();
      } else {
        toast.error('Notification permission was denied. Please allow notifications in your browser settings.');
        await checkStatus();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to enable background push notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await webPushService.unsubscribe();
      toast.info('Background push notifications disabled.');
      await checkStatus();
    } catch (err: any) {
      toast.error('Failed to unsubscribe');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    try {
      await webPushService.sendTestNotification();
      toast.success('Test notification dispatched! Check your system notification tray.');
    } catch (err: any) {
      toast.error('Failed to dispatch test notification: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${status.isSubscribed ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
              <Bell size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Background Web Push</div>
              <div className="text-[11px] text-slate-500">
                {status.isSubscribed 
                  ? 'Active (Alerts deliver when app is closed)' 
                  : status.permission === 'denied' 
                    ? 'Blocked in browser permissions' 
                    : 'Not enabled'}
              </div>
            </div>
          </div>
          <div>
            {status.isSubscribed ? (
              <button
                onClick={handleDisable}
                disabled={loading}
                className="text-xs px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded transition font-medium"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={handleEnable}
                disabled={loading || status.permission === 'denied'}
                className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition font-medium disabled:opacity-50"
              >
                {loading ? 'Enabling...' : 'Enable'}
              </button>
            )}
          </div>
        </div>

        {status.isSubscribed && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle size={12} /> Ready for Calls, Messages & Invites
            </span>
            <button
              onClick={handleTest}
              disabled={loading}
              className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
            >
              <Send size={11} /> Test Push
            </button>
          </div>
        )}
      </div>
    );
  }

  // Floating banner for first-time visitors / users who haven't enabled push yet
  if (status.permission === 'granted' && status.isSubscribed) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-white border border-indigo-200 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
          <Bell size={20} className="animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Enable Background Alerts</h4>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Receive incoming calls, meeting invites, and chat messages even when this application is closed or minimized.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? 'Activating...' : 'Enable Notifications'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

