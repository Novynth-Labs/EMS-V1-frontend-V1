import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, PhoneOff, Video, MessageSquare, X, ArrowRight } from 'lucide-react';
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

export interface IncomingMessagePopup {
  id: string;
  channelId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

// ── Component ─────────────────────────────────────────────────
export const IncomingCallOverlay: React.FC = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<IncomingMessagePopup | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const missedCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // ── Socket listener for incoming_call and global_new_message ──
  useEffect(() => {
    const handleIncomingCall = (data: any) => {
      setIncomingCall(data);
      startRingtone();
      startCountdown();

      // ── Native OS notification (Electron) with window popup & flash ──
      const electronAPI = (window as any).electronAPI;
      const link = data.meetingLink || data.meeting_link || '';
      const match = link.match(/(?:ems:\/\/|https?:\/\/[^\/]+\/?)(?:meeting|meeting\/)([a-zA-Z0-9_-]+)/);
      const route = match?.[1] ? `/meeting/${match[1]}` : '/meetings';

      if (electronAPI?.showIncomingCallNotification) {
        electronAPI.showIncomingCallNotification({
          title: `[Incoming Call] ${data.title}`,
          body: `${data.organizerName || 'Someone'} is calling you. Click to join.`,
          route,
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(`[Incoming Call] ${data.title}`, {
          body: `${data.organizerName || 'Someone'} is calling you. Click to join.`,
          icon: '/favicon.svg',
        });
        notif.onclick = () => {
          window.focus();
          navigate(route);
        };
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            const notif = new Notification(`[Incoming Call] ${data.title}`, {
              body: `${data.organizerName || 'Someone'} is calling you.`,
              icon: '/favicon.svg',
            });
            notif.onclick = () => {
              window.focus();
              navigate(route);
            };
          }
        });
      }

      // Auto-dismiss after 30 seconds
      if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
      missedCallTimeoutRef.current = setTimeout(() => {
        handleMissedCall(data);
      }, 30000);
    };

    const handleCallCancelled = (data: any) => {
      dismiss();
      setIncomingCall(null);
      toast.info(`Call ended: ${data?.title || 'Meeting'}`);
    };

    const handleGlobalNewMessage = (data: { channelId: string; senderName: string; content: string }) => {
      // Check if user is actively in the messages view
      const isCurrentChat = window.location.hash.includes('/messages');

      // Play audio chime
      playNotificationSound();

      // Pop up in-app interactive message card when outside active chat
      if (!isCurrentChat) {
        setIncomingMessage({
          id: Date.now().toString(),
          channelId: data.channelId,
          senderName: data.senderName,
          content: data.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = setTimeout(() => {
          setIncomingMessage(null);
        }, 6000);
      }

      // Native OS notification via Electron IPC with click-to-navigate
      const electronAPI = (window as any).electronAPI;
      const targetRoute = `/messages?channel=${encodeURIComponent(data.channelId)}`;

      if (electronAPI?.showNotification) {
        electronAPI.showNotification({
          title: `[New Message] ${data.senderName}`,
          body: data.content.length > 80 ? data.content.substring(0, 80) + '…' : data.content,
          route: targetRoute,
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(`[New Message] ${data.senderName}`, {
          body: data.content.length > 80 ? data.content.substring(0, 80) + '…' : data.content,
          icon: '/favicon.svg',
        });
        notif.onclick = () => {
          window.focus();
          navigate(targetRoute);
        };
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            const notif = new Notification(`[New Message] ${data.senderName}`, {
              body: data.content.length > 80 ? data.content.substring(0, 80) + '…' : data.content,
              icon: '/favicon.svg',
            });
            notif.onclick = () => {
              window.focus();
              navigate(targetRoute);
            };
          }
        });
      }
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_cancelled', handleCallCancelled);
    socket.on('meeting_ended', handleCallCancelled);
    socket.on('global_new_message', handleGlobalNewMessage);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_cancelled', handleCallCancelled);
      socket.off('meeting_ended', handleCallCancelled);
      socket.off('global_new_message', handleGlobalNewMessage);
      if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      clearCountdown();
    };
  }, [user, startCountdown, clearCountdown, navigate]);

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

  if (!incomingCall && !incomingMessage) return null;

  return (
    <>
      {/* ── 1. IN-APP FLOATING MESSAGE POPUP BANNER ─────────────────── */}
      {incomingMessage && !incomingCall && (
        <aside
          role="status"
          aria-label="New message notification"
          className="fixed top-5 right-5 z-[9998] w-96 max-w-[calc(100vw-32px)] animate-slide-in cursor-pointer select-none"
          onClick={() => {
            const channelId = incomingMessage.channelId;
            setIncomingMessage(null);
            navigate(`/messages?channel=${encodeURIComponent(channelId)}`);
          }}
        >
          <div className="relative overflow-hidden bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/40 hover:border-indigo-400/80 rounded-2xl p-4 shadow-2xl shadow-indigo-950/60 transition-all duration-200 group">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400" />

            <div className="flex gap-3.5 items-start mt-0.5">
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getGradient(
                  incomingMessage.senderName
                )} flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-lg shadow-black/30 border border-white/10`}
              >
                {getInitials(incomingMessage.senderName, '??')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-sm text-white truncate">
                      {incomingMessage.senderName}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
                      New Message
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIncomingMessage(null);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {incomingMessage.content}
                </p>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
                  <span className="text-indigo-400 group-hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors">
                    <MessageSquare size={12} />
                    Click to view & reply
                    <ArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="text-slate-400 text-[10px]">{incomingMessage.timestamp}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── 2. FULL-SCREEN INCOMING MEETING CALL OVERLAY ─────────── */}
      {incomingCall && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(20px)' }}
        >
          {/* Card */}
          <div
            className="relative w-84 flex flex-col items-center text-center overflow-hidden animate-scale-in"
            style={{
              background: 'linear-gradient(160deg, rgba(30,32,50,0.98) 0%, rgba(15,17,35,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '32px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05) inset',
              padding: '40px 32px 36px',
            }}
          >
            {/* Status label */}
            <div
              className="mb-8 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-2"
              style={{
                background: 'rgba(52,211,153,0.12)',
                border: '1px solid rgba(52,211,153,0.25)',
                color: '#6ee7b7',
              }}
            >
              <PhoneCall size={12} className="animate-bounce" />
              Incoming Meeting Call
            </div>

            {/* Avatar with pulse rings */}
            <div
              className="relative flex items-center justify-center mb-8"
              style={{ width: 120, height: 120 }}
            >
              <PulseRings />

              {/* Countdown ring */}
              <svg
                width="120"
                height="120"
                className="absolute inset-0"
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="3"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
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
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-2xl font-extrabold text-white bg-gradient-to-br ${getGradient(
                  incomingCall.organizerName || ''
                )} shadow-xl`}
              >
                {getInitials(incomingCall.organizerName, '??')}
              </div>
            </div>

            {/* Caller info */}
            <h3 className="text-xl font-extrabold text-white leading-tight mb-1">
              {incomingCall.organizerName || 'Unknown'}
            </h3>
            <p className="text-sm text-white/50 mb-2 font-medium">is calling you for a meeting</p>

            <div
              className="flex items-center gap-2 px-4 py-2 rounded-2xl mb-8 text-sm font-bold"
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#a5b4fc',
              }}
            >
              <Video size={14} />
              {incomingCall.title}
            </div>

            {/* Countdown text */}
            <p className="text-[11px] text-white/35 mb-6 font-medium">
              Auto-declining in {countdown}s
            </p>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-8 w-full">
              {/* Decline */}
              <button
                type="button"
                onClick={handleDecline}
                className="flex flex-col items-center gap-2.5 group cursor-pointer"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '2px solid rgba(239,68,68,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.85)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.15)';
                  }}
                >
                  <PhoneOff size={24} className="text-rose-400 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-bold text-white/40 group-hover:text-white/80 transition-colors">
                  Decline
                </span>
              </button>

              {/* Accept */}
              <button
                type="button"
                onClick={handleAccept}
                className="flex flex-col items-center gap-2.5 group cursor-pointer"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 12px 32px rgba(16,185,129,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 8px 24px rgba(16,185,129,0.4)';
                  }}
                >
                  <PhoneCall size={24} className="text-white" />
                </div>
                <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                  Accept
                </span>
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
      )}
    </>
  );
};
