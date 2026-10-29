import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, PhoneOff, Video } from 'lucide-react';
import { socket, connectSocketWithToken } from '../../services/socket';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../utils/toast';
import { getInitials } from '../../utils/initials';
import { playNotificationSound, startPhoneRingtone, stopPhoneRingtone } from '../../utils/sound';

// ── Ringtone: Audio file with Web Audio synthesizer fallback ──
let ringtoneAudio: HTMLAudioElement | null = null;

const startRingtone = () => {
  stopRingtone();
  let audioPlayed = false;
  try {
    ringtoneAudio = new Audio('/mixkit-waiting-ringtone-1354.wav');
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = 0.8;
    const p = ringtoneAudio.play();
    if (p) {
      p.then(() => { audioPlayed = true; }).catch((err) => {
        console.warn('[Ringtone] File playback failed/blocked. Triggering Web Audio synth:', err);
        startPhoneRingtone();
      });
    }
  } catch (e) {
    console.warn('[Ringtone] Audio element error:', e);
    startPhoneRingtone();
  }

  // Backup check: if HTMLAudio is not playing within 250ms, start Web Audio ringtone
  setTimeout(() => {
    if (!audioPlayed && (!ringtoneAudio || ringtoneAudio.paused)) {
      startPhoneRingtone();
    }
  }, 250);
};

const stopRingtone = () => {
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
    ringtoneAudio = null;
  }
  stopPhoneRingtone();
};


// ── Pulsing ring animation helper ─────────────────────────────
const PulseRings = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    {[0, 1, 2].map(i => (
      <div
        key={i}
        className="absolute rounded-full border-2 border-emerald-400/40"
        style={{
          width: `${120 + i * 50}px`,
          height: `${120 + i * 50}px`,
          animation: `ping 1.8s cubic-bezier(0,0,0.2,1) ${i * 0.4}s infinite`,
          opacity: 1 - i * 0.3,
        }}
      />
    ))}
  </div>
);

// ── Get avatar gradient from name ─────────────────────────────
const getGradient = (name: string) => {
  const gradients = [
    'from-violet-500 to-purple-700',
    'from-blue-500 to-indigo-700',
    'from-emerald-500 to-teal-700',
    'from-rose-500 to-pink-700',
    'from-amber-500 to-orange-700',
  ];
  return gradients[(name.charCodeAt(0) || 0) % gradients.length];
};

type IncomingCallData = {
  id: string;
  title: string;
  meetingLink: string;
  meeting_link?: string;
  organizerName?: string;
};

// ── Component ─────────────────────────────────────────────────
export const IncomingCallOverlay: React.FC = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const missedCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdown, setCountdown] = useState(30);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Identify user on socket connect ───────────────────────
  useEffect(() => {
    connectSocketWithToken();
    const identifyUser = () => {
      if (user?.id) {
        socket.emit('identify', user.id.toString());
      }
    };
    if (socket.connected) {
      identifyUser();
    }
    socket.on('connect', identifyUser);
    return () => {
      socket.off('connect', identifyUser);
    };
  }, [user]);

  // ── Countdown tick ────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // ── Socket listener for incoming_call ─────────────────────
  useEffect(() => {
    const handleIncomingCall = (data: any) => {
      setIncomingCall(data);
      startRingtone();
      startCountdown();

      // ── Native OS notification (Electron) ──────────────────
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.showIncomingCallNotification) {
        const link = data.meetingLink || data.meeting_link || '';
        const match = link.match(/(?:ems:\/\/|https?:\/\/[^\/]+\/?)(?:meeting|meeting\/)([a-zA-Z0-9_-]+)/);
        const route = match?.[1] ? `/meeting/${match[1]}` : '/meetings';
        electronAPI.showIncomingCallNotification({
          title: `[Incoming Call] ${data.title}`,
          body: `${data.organizerName || 'Someone'} is calling you. Click to join.`,
          route,
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        // Fallback: browser Notification API
        new Notification(`[Incoming Call] ${data.title}`, {
          body: `${data.organizerName || 'Someone'} is calling you.`,
          icon: '/favicon.ico',
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            new Notification(`[Incoming Call] ${data.title}`, {
              body: `${data.organizerName || 'Someone'} is calling you.`,
            });
          }
        });
      }

      // Auto-dismiss after 30 seconds
      if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
      missedCallTimeoutRef.current = setTimeout(() => {
        handleMissedCall(data);
      }, 30000);
    };


    const handleGlobalNewMessage = (data: { channelId: string; senderName: string; content: string }) => {
      const isOnMessagesPage = window.location.pathname.startsWith('/messages');

      // Play audio chime
      playNotificationSound();

      // Always show in-app toast when not on messages page
      if (!isOnMessagesPage) {
        toast.info(`New message from ${data.senderName}: ${data.content}`);
      }

      // Native OS notification via Electron IPC
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.showNotification) {
        electronAPI.showNotification({
          title: `[New Message] ${data.senderName}`,
          body: data.content.length > 80 ? data.content.substring(0, 80) + '…' : data.content,
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`[New Message] ${data.senderName}`, {
          body: data.content.length > 80 ? data.content.substring(0, 80) + '…' : data.content,
          icon: '/favicon.ico',
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            new Notification(`[New Message] ${data.senderName}`, {
              body: data.content.length > 80 ? data.content.substring(0, 80) + '…' : data.content,
            });
          }
        });
      }
    };


    socket.on('incoming_call', handleIncomingCall);
    socket.on('global_new_message', handleGlobalNewMessage);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('global_new_message', handleGlobalNewMessage);
      if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
      clearCountdown();
    };
  }, [user, startCountdown, clearCountdown]);

  const dismiss = useCallback(() => {
    stopRingtone();
    clearCountdown();
    if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
    // Tell Electron to stop flashing the taskbar
    const electronAPI = (window as any).electronAPI;
    electronAPI?.dismissIncomingCall?.();
  }, [clearCountdown]);

  const handleMissedCall = useCallback((data: any) => {
    dismiss();
    setIncomingCall(null);
    toast.error(`Missed call from ${data.organizerName || 'Unknown'} — ${data.title}`);
  }, [dismiss]);

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;
    dismiss();
    const callData = incomingCall as IncomingCallData;
    const link = callData.meetingLink || (callData as any).meeting_link || '';
    const match = link.match(/(?:ems:\/\/|https?:\/\/[^\/]+\/?)(?:meeting|meeting\/)\/?([a-zA-Z0-9_-]+)/);
    if (match?.[1]) {
      navigate(`/meeting/${match[1]}`);
    } else {
      try {
        const url = new URL(link);
        navigate(url.pathname);
      } catch {
        navigate('/meetings');
      }
    }
    setIncomingCall(null);
  }, [incomingCall, navigate, dismiss]);

  const handleDecline = useCallback(() => {
    dismiss();
    setIncomingCall(null);
  }, [dismiss]);

  if (!incomingCall) return null;

  const initial = getInitials(incomingCall.organizerName, '??');
  const gradient = getGradient(incomingCall.organizerName || '');
  const strokeDasharray = 2 * Math.PI * 44; // circumference for r=44
  const strokeDashoffset = strokeDasharray * (1 - countdown / 30);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)' }}
    >
      {/* Card */}
      <div
        className="relative w-80 flex flex-col items-center text-center overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(30,32,50,0.98) 0%, rgba(15,17,35,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '32px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
          padding: '40px 32px 36px',
        }}
      >
        {/* Status label */}
        <div
          className="mb-8 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-2"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#6ee7b7' }}
        >
          <PhoneCall size={12} className="animate-bounce" />
          Incoming Meeting Call
        </div>

        {/* Avatar with pulse rings */}
        <div className="relative flex items-center justify-center mb-8" style={{ width: 120, height: 120 }}>
          <PulseRings />

          {/* Countdown ring */}
          <svg
            width="120" height="120"
            className="absolute inset-0"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke="rgba(52,211,153,0.8)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 54}
              strokeDashoffset={2 * Math.PI * 54 * (1 - countdown / 30)}
              style={{ transition: 'stroke-dashoffset 0.9s linear' }}
            />
          </svg>

          {/* Avatar circle */}
          <div
            className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-2xl font-extrabold text-white bg-gradient-to-br ${gradient} shadow-xl`}
          >
            {initial}
          </div>
        </div>

        {/* Caller info */}
        <h3 className="text-xl font-extrabold text-white leading-tight mb-1">
          {incomingCall.organizerName || 'Unknown'}
        </h3>
        <p className="text-sm text-white/50 mb-2 font-medium">is inviting you to a meeting</p>

        <div
          className="flex items-center gap-2 px-4 py-2 rounded-2xl mb-10 text-sm font-bold"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}
        >
          <Video size={14} />
          {incomingCall.title}
        </div>

        {/* Countdown text */}
        <p className="text-[11px] text-white/25 mb-6 font-medium">
          Auto-declining in {countdown}s
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8 w-full">
          {/* Decline */}
          <button
            onClick={handleDecline}
            className="flex flex-col items-center gap-2.5 group"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '2px solid rgba(239,68,68,0.3)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.8)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.15)'; }}
            >
              <PhoneOff size={24} className="text-rose-400 group-hover:text-white transition-colors" />
            </div>
            <span className="text-xs font-bold text-white/40 group-hover:text-white/70 transition-colors">Decline</span>
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-2.5 group"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(16,185,129,0.6)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(16,185,129,0.4)'; }}
            >
              <PhoneCall size={24} className="text-white" />
            </div>
            <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">Accept</span>
          </button>
        </div>
      </div>

      {/* Inline keyframe for ping animation */}
      <style>{`
        @keyframes ping {
          0% { transform: scale(0.8); opacity: 0.7; }
          80%, 100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
