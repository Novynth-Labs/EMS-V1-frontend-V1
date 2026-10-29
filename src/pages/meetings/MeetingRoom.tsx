import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Pin, PinOff,
  Disc, MessageSquare, Send, X, Users, Clock, Wifi
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { uploadRecording } from '../../api/meetings.api';
import { toast } from '../../utils/toast';
import { Avatar } from '../../components/ui/Avatar';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const playJoinSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = [261.63, 329.63, 392.00];
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.05);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + index * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.05 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + index * 0.05);
      osc.stop(ctx.currentTime + index * 0.05 + 0.25);
    });
  } catch (e) {}
};

const playLeaveSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = [392.00, 329.63];
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + index * 0.08 + 0.25);
    });
  } catch (e) {}
};

const getAvatarGradient = (seed: string) => {
  const gradients = [
    'from-violet-500 to-purple-700',
    'from-blue-500 to-indigo-700',
    'from-emerald-500 to-teal-700',
    'from-rose-500 to-pink-700',
    'from-amber-500 to-orange-700',
    'from-cyan-500 to-sky-700',
  ];
  const idx = seed.charCodeAt(0) % gradients.length;
  return gradients[idx];
};

// Pill-shaped control button
const CtrlBtn = ({
  onClick, active, danger, disabled, title, children, wide = false
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      flex items-center justify-center gap-2 transition-all duration-200
      font-semibold text-sm rounded-2xl
      hover:-translate-y-0.5 active:translate-y-0 focus:outline-none
      ${wide ? 'px-5 py-3' : 'w-12 h-12'}
      ${danger
        ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/30'
        : active
        ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30'
        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
      }
      ${disabled ? 'opacity-40 cursor-not-allowed hover:translate-y-0' : ''}
    `}
  >
    {children}
  </button>
);

export const MeetingRoom: React.FC = () => {
  const { id: roomId } = useParams<{ id: string }>();
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [remoteMediaStates, setRemoteMediaStates] = useState<Record<string, {
    isMuted: boolean; isVideoOff: boolean; isHandRaised?: boolean; isScreenSharing?: boolean;
  }>>({});

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState<{
    senderId: string; senderName: string; text: string; timestamp: string;
  }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remoteParticipantLabels, setRemoteParticipantLabels] = useState<Record<string, string>>({});
  const [joinedMember, setJoinedMember] = useState<string | null>(null);
  const joinTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (joinTimeoutRef.current) {
        window.clearTimeout(joinTimeoutRef.current);
      }
    };
  }, []);

  const localMediaStateRef = useRef({ isMuted: false, isVideoOff: false, isHandRaised: false, isScreenSharing: false });
  useEffect(() => {
    localMediaStateRef.current = { isMuted, isVideoOff, isHandRaised, isScreenSharing };
  }, [isMuted, isVideoOff, isHandRaised, isScreenSharing]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!user || !roomId) return;

    const authToken = useAuthStore.getState().accessToken || localStorage.getItem('token');

    socketRef.current = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
      path: '/ws/meeting',
      transports: ['polling', 'websocket'],
      auth: { token: authToken },
      query: { token: authToken || '' },
      autoConnect: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    const initMedia = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (dualErr) {
          console.warn('[MeetingRoom] Dual audio+video failed, trying video only:', dualErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (videoOnlyErr) {
            console.warn('[MeetingRoom] Video only failed, trying audio only:', videoOnlyErr);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            } catch (audioOnlyErr) {
              console.warn('[MeetingRoom] No camera/mic found, creating empty stream:', audioOnlyErr);
              stream = new MediaStream();
              toast.warn('No active camera or microphone found. Joined as viewer.');
            }
          }
        }

        setLocalStream(stream);
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        if (stream.getVideoTracks().length === 0) {
          setIsVideoOff(true);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const socket = socketRef.current!;
        socket.emit('join-room', roomId, user.id, user.name);

        socket.on('user-connected', async (userId: string, targetSocketId: string, userName?: string) => {
          playJoinSound();
          if (userName) {
            setRemoteParticipantLabels(prev => ({ ...prev, [targetSocketId]: userName }));
            setJoinedMember(userName);
            if (joinTimeoutRef.current) window.clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = window.setTimeout(() => setJoinedMember(null), 4000);
          }
          const peer = createPeer(targetSocketId, stream);
          peersRef.current[targetSocketId] = peer;
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('offer', targetSocketId, offer, user.name);
          socket.emit('toggle-media', localMediaStateRef.current);
        });

        socket.on('offer', async (senderSocketId: string, _senderUserId: string, offer: RTCSessionDescriptionInit, senderName?: string) => {
          if (senderName) {
            setRemoteParticipantLabels(prev => ({ ...prev, [senderSocketId]: senderName }));
          }
          let peer = peersRef.current[senderSocketId];
          if (!peer) { peer = createPeer(senderSocketId, stream); peersRef.current[senderSocketId] = peer; }
          await peer.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('answer', senderSocketId, answer);
          socket.emit('toggle-media', localMediaStateRef.current);
          if (pendingCandidatesRef.current[senderSocketId]) {
            for (const c of pendingCandidatesRef.current[senderSocketId])
              await peer.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
            pendingCandidatesRef.current[senderSocketId] = [];
          }
        });

        socket.on('answer', async (senderSocketId: string, answer: RTCSessionDescriptionInit) => {
          const peer = peersRef.current[senderSocketId];
          if (peer) {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
            if (pendingCandidatesRef.current[senderSocketId]) {
              for (const c of pendingCandidatesRef.current[senderSocketId])
                await peer.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
              pendingCandidatesRef.current[senderSocketId] = [];
            }
          }
        });

        socket.on('ice-candidate', async (senderSocketId: string, candidate: RTCIceCandidateInit) => {
          const peer = peersRef.current[senderSocketId];
          if (peer?.remoteDescription?.type) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
          } else {
            if (!pendingCandidatesRef.current[senderSocketId]) pendingCandidatesRef.current[senderSocketId] = [];
            pendingCandidatesRef.current[senderSocketId].push(candidate);
          }
        });

        socket.on('media-toggled', (senderSocketId: string, state: any) => {
          setRemoteMediaStates(prev => ({ ...prev, [senderSocketId]: state }));
          if (state.isScreenSharing) setSpotlightId(senderSocketId);
          else if (state.isScreenSharing === false)
            setSpotlightId(prev => prev === senderSocketId ? null : prev);
        });

        socket.on('chat-message', (message: any) => {
          setChatMessages(prev => [...prev, message]);
        });

        socket.on('user-disconnected', (targetSocketId: string) => {
          playLeaveSound();
          if (peersRef.current[targetSocketId]) {
            peersRef.current[targetSocketId].close();
            delete peersRef.current[targetSocketId];
          }
          setRemoteStreams(prev => { const n = { ...prev }; delete n[targetSocketId]; return n; });
          setRemoteMediaStates(prev => { const n = { ...prev }; delete n[targetSocketId]; return n; });
          setRemoteParticipantLabels(prev => { const n = { ...prev }; delete n[targetSocketId]; return n; });
          if (spotlightId === targetSocketId) setSpotlightId(null);
        });

      } catch (error) {
        console.error('Failed to get local stream', error);
        toast.error('Could not access camera or microphone.');
      }
    };

    const createPeer = (targetSocketId: string, stream: MediaStream) => {
      const peer = new RTCPeerConnection(ICE_SERVERS);
      const currentStream = localVideoRef.current?.srcObject as MediaStream;
      const videoTrack = (currentStream?.getVideoTracks().length > 0)
        ? currentStream.getVideoTracks()[0] : stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack) peer.addTrack(videoTrack, stream);
      if (audioTrack) peer.addTrack(audioTrack, stream);
      peer.onicecandidate = e => {
        if (e.candidate) socketRef.current?.emit('ice-candidate', targetSocketId, e.candidate);
      };
      peer.ontrack = e => {
        const remoteStream = e.streams[0];
        if (remoteStream) {
          setRemoteStreams(prev => ({ ...prev, [targetSocketId]: new MediaStream(remoteStream.getTracks()) }));
          remoteStream.onaddtrack = () => {
            setRemoteStreams(prev => ({ ...prev, [targetSocketId]: new MediaStream(remoteStream.getTracks()) }));
          };
        }
      };
      peer.onconnectionstatechange = () => {
        console.log(`[WebRTC] Peer ${targetSocketId}: ${peer.connectionState}`);
      };
      return peer;
    };

    initMedia();
    return () => {
      localStream?.getTracks().forEach(t => t.stop());
      cameraTrackRef.current?.stop();
      Object.values(peersRef.current).forEach(p => p.close());
      socketRef.current?.disconnect();
    };
  }, [roomId, user]);

  // Keep local video element synchronized whenever layout or stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, spotlightId, isVideoOff, isScreenSharing]);

  const toggleMute = () => {
    if (localStream) {
      const newMuted = !isMuted;
      localStream.getAudioTracks().forEach(t => (t.enabled = !newMuted));
      setIsMuted(newMuted);
      socketRef.current?.emit('toggle-media', { isMuted: newMuted, isVideoOff, isHandRaised, isScreenSharing });
    }
  };

  const toggleVideo = async () => {
    if (!cameraTrackRef.current || cameraTrackRef.current.readyState === 'ended') {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = camStream.getVideoTracks()[0];
        cameraTrackRef.current = newTrack;
        if (localStream) {
          localStream.getVideoTracks().forEach(t => {
            localStream.removeTrack(t);
            t.stop();
          });
          localStream.addTrack(newTrack);
        } else {
          setLocalStream(camStream);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream || camStream;
        }
        setIsVideoOff(false);
        socketRef.current?.emit('toggle-media', { isMuted, isVideoOff: false, isHandRaised, isScreenSharing });
        Object.values(peersRef.current).forEach(peer => {
          const sender = peer.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(newTrack);
          } else if (localStream) {
            peer.addTrack(newTrack, localStream);
          }
        });
        return;
      } catch (err) {
        toast.error('Could not access camera.');
        return;
      }
    }
    const newVideoOff = !isVideoOff;
    cameraTrackRef.current.enabled = !newVideoOff;
    setIsVideoOff(newVideoOff);
    socketRef.current?.emit('toggle-media', { isMuted, isVideoOff: newVideoOff, isHandRaised, isScreenSharing });
  };

  const toggleHandRaise = () => {
    const newHandRaised = !isHandRaised;
    setIsHandRaised(newHandRaised);
    socketRef.current?.emit('toggle-media', { isMuted, isVideoOff, isHandRaised: newHandRaised, isScreenSharing });
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) { stopScreenShare(); return; }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (localVideoRef.current && localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const ns = new MediaStream();
        ns.addTrack(screenTrack);
        if (audioTrack) ns.addTrack(audioTrack);
        localVideoRef.current.srcObject = ns;
      }
      setIsScreenSharing(true);
      setSpotlightId('local');
      socketRef.current?.emit('toggle-media', { isMuted, isVideoOff, isHandRaised, isScreenSharing: true });
      screenTrack.onended = () => stopScreenShare();
      Object.entries(peersRef.current).forEach(async ([, peer]) => {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video' || s.track === null);
        if (sender) await sender.replaceTrack(screenTrack).catch(console.error);
      });
    } catch (e) { console.error('Failed to share screen', e); }
  };

  const stopScreenShare = () => {
    if (!isScreenSharing) return;
    setIsScreenSharing(false);
    setSpotlightId(prev => prev === 'local' ? null : prev);
    socketRef.current?.emit('toggle-media', { isMuted, isVideoOff, isHandRaised, isScreenSharing: false });
    const camTrack = cameraTrackRef.current;
    if (localVideoRef.current && localStream && camTrack) {
      const audioTrack = localStream.getAudioTracks()[0];
      const ns = new MediaStream();
      ns.addTrack(camTrack);
      if (audioTrack) ns.addTrack(audioTrack);
      localVideoRef.current.srcObject = ns;
    }
    Object.entries(peersRef.current).forEach(async ([, peer]) => {
      const sender = peer.getSenders().find(s => s.track?.kind === 'video' || s.track === null);
      if (sender && camTrack) await sender.replaceTrack(camTrack).catch(console.error);
    });
  };

  const toggleRecording = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); return; }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as any, audio: true
      });
      const mediaRecorder = new MediaRecorder(displayStream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsUploading(true);
        displayStream.getTracks().forEach(t => t.stop());
        try {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          await uploadRecording(roomId as string, blob);
          toast.error('Recording uploaded successfully!');
        } catch (e) {
          toast.error('Recording upload failed.');
        } finally {
          setIsUploading(false);
          recordedChunksRef.current = [];
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      };
    } catch (e) {
      console.error('Failed to start recording', e);
      toast.error('Could not start recording.');
    }
  };

  const leaveMeeting = () => navigate('/meetings');
  const togglePin = (id: string) => setSpotlightId(prev => prev === id ? null : id);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    const message = {
      senderId: user.id.toString(), senderName: user.name,
      text: newMessage.trim(), timestamp: new Date().toISOString()
    };
    socketRef.current?.emit('chat-message', message);
    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const remoteIds = Array.from(new Set([
    ...Object.keys(remoteStreams),
    ...Object.keys(remoteParticipantLabels),
    ...Object.keys(remoteMediaStates),
  ]));

  const allParticipants = [
    {
      id: 'local',
      stream: localVideoRef.current?.srcObject as MediaStream,
      label: user?.name || 'You',
      isMuted, isVideoOff, isHandRaised
    },
    ...remoteIds.map(id => ({
      id,
      stream: remoteStreams[id] as MediaStream | undefined,
      label: remoteParticipantLabels[id] || `Colleague (${id.slice(0, 4)})`,
      isMuted: remoteMediaStates[id]?.isMuted || false,
      isVideoOff: remoteMediaStates[id]?.isVideoOff ?? (remoteStreams[id] ? false : true),
      isHandRaised: remoteMediaStates[id]?.isHandRaised || false,
    }))
  ];

  const spotlightedItem = spotlightId ? allParticipants.find(p => p.id === spotlightId) : null;
  const gridItems = spotlightedItem ? allParticipants.filter(p => p.id !== spotlightId) : allParticipants;

  const gridCount = gridItems.length;
  let gridCols = 1;
  if (gridCount === 2) gridCols = 2;
  else if (gridCount <= 4) gridCols = 2;
  else if (gridCount <= 9) gridCols = 3;
  else gridCols = Math.ceil(Math.sqrt(gridCount));

  const participantCount = allParticipants.length;

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden font-sans"
      style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1327 50%, #0a0f1e 100%)' }}
    >
      {/* ── Top Header ─────────────────────────────────────── */}
      <div className="relative z-20 px-6 py-3 flex flex-col gap-2 shrink-0"
        style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}
      >
        {joinedMember && (
          <div className="px-4 py-2 rounded-2xl text-sm font-semibold text-emerald-100 bg-emerald-500/15 border border-emerald-400/20">
            {joinedMember} joined the meeting
          </div>
        )}
        {/* Left: Room info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Video size={18} className="text-white" />
            </div>
            {isRecording && (
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-950 animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight tracking-tight">Team Meeting</h2>
            <p className="text-[11px] text-white/40 font-mono">{roomId?.substring(0, 12)}…</p>
          </div>
        </div>

        {/* Center: Timer & participant count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Clock size={12} className="text-white/50" />
            <span className="text-white/70 font-mono">{formatElapsed(elapsedSeconds)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <Users size={12} className="text-white/50" />
            <span className="text-white/70">{participantCount}</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
              <span className="text-rose-400 uppercase tracking-wider">REC</span>
            </div>
          )}
        </div>

        {/* Right: Network */}
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-emerald-400" />
          <span className="text-xs text-white/40 font-medium hidden sm:block">Encrypted</span>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <div className="flex-1 flex gap-3 overflow-hidden p-4">

          {/* Spotlight */}
          {spotlightedItem && (
            <div className="flex-1 rounded-3xl overflow-hidden relative group transition-all duration-500"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.4)' }}
            >
              {spotlightedItem.id === 'local' ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
              ) : spotlightedItem.stream ? (
                <VideoPlayer stream={spotlightedItem.stream} className="w-full h-full object-contain" isRemoteMuted={spotlightedItem.isMuted} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950/80">
                  <Avatar name={spotlightedItem.label} className="w-20 h-20 text-xl rounded-3xl bg-indigo-600 ring-2 ring-white/10" />
                  <span className="text-sm text-white/80 mt-3 font-medium">{spotlightedItem.label}</span>
                </div>
              )}

              {/* Gradient overlay bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
              />

              {/* Name label */}
              <div className="absolute bottom-5 left-5 flex items-center gap-2.5 transition-all duration-300">
                <Avatar name={spotlightedItem.label} className="w-9 h-9 text-xs rounded-2xl bg-gradient-to-br ring-2 ring-white/10" />
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{spotlightedItem.label}</p>
                  {joinedMember && spotlightedItem.id !== 'local' && spotlightedItem.label === joinedMember && (
                    <p className="text-[11px] text-emerald-300/90">Joined the meeting</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {spotlightedItem.isMuted && (
                      <span className="flex items-center gap-0.5 text-[10px] text-rose-400 font-semibold">
                        <MicOff size={10} /> Muted
                      </span>
                    )}
                    {spotlightedItem.isVideoOff && (
                      <span className="flex items-center gap-0.5 text-[10px] text-rose-400 font-semibold">
                        <VideoOff size={10} /> No Video
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hand raised */}
              {spotlightedItem.isHandRaised && (
                <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-2 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 backdrop-blur-md z-10">
                  <span className="text-xl">✋</span>
                  <span className="text-xs font-bold text-yellow-400">Hand Raised</span>
                </div>
              )}

              {/* Unpin button */}
              <button
                onClick={() => togglePin(spotlightedItem.id)}
                className="absolute top-5 right-5 p-2.5 rounded-2xl text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              >
                <PinOff size={18} />
              </button>
            </div>
          )}

          {/* Grid / strip */}
          <div
            className={`${spotlightedItem ? 'w-56 flex-col overflow-y-auto' : 'flex-1 grid place-content-center'} flex gap-3 p-1`}
            style={!spotlightedItem ? {
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              width: '100%', height: '100%'
            } : {}}
          >
            {gridItems.map((item) => (
              <div
                key={item.id}
                className={`relative rounded-3xl overflow-hidden group transition-all duration-300
                  ${spotlightedItem ? 'h-40 shrink-0' : 'w-full h-full'}
                `}
                style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.5)' }}
              >
                {item.id === 'local' ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : item.stream ? (
                  <VideoPlayer stream={item.stream} className="w-full h-full object-cover" isRemoteMuted={item.isMuted} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950/80">
                    <Avatar name={item.label} className="w-14 h-14 text-base rounded-2xl bg-indigo-600 ring-2 ring-white/10" />
                    <span className="text-xs text-white/80 mt-2 font-medium">{item.label}</span>
                  </div>
                )}

                {/* Bottom gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
                />

                {/* Name tag */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  <Avatar name={item.label} className="w-6 h-6 text-[9px] rounded-xl bg-gradient-to-br ring-1 ring-white/10" />
                  <span className="text-[11px] font-bold text-white/90 max-w-[80px] truncate">{item.label}</span>
                  {item.isMuted && <MicOff size={11} className="text-rose-400 shrink-0" />}
                </div>

                {/* Hand raised */}
                {item.isHandRaised && (
                  <div className="absolute top-2 left-2 w-8 h-8 rounded-xl bg-yellow-500/30 border border-yellow-500/40 flex items-center justify-center text-base">
                    ✋
                  </div>
                )}

                {/* Pin button */}
                <button
                  onClick={() => togglePin(item.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-xl text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)' }}
                >
                  <Pin size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat Sidebar ─────────────────────────────────── */}
        {isChatOpen && (
          <div className="w-80 flex flex-col shrink-0 overflow-hidden"
            style={{
              background: 'rgba(13,19,39,0.95)',
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)'
            }}
          >
            {/* Chat header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <MessageSquare size={15} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Meeting Chat</h3>
                  <p className="text-[10px] text-white/30">{chatMessages.length} messages</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/8 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white/20 py-12">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-sm font-semibold">No messages yet</p>
                  <p className="text-xs mt-1 text-white/15">Say hi to the group!</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.senderId === user?.id?.toString();
                  return (
                    <div key={i} className={`flex flex-col max-w-[88%] gap-1 ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                      {!isMe && (
                        <div className="flex items-center gap-1.5 px-1">
                          <Avatar name={msg.senderName} className="w-5 h-5 text-[8px] rounded-lg" />
                          <span className="text-[10px] text-white/40 font-medium">{msg.senderName}</span>
                        </div>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed font-medium ${
                        isMe
                          ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-md shadow-lg shadow-indigo-500/20'
                          : 'text-white/80 rounded-tl-md'
                      }`}
                        style={!isMe ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' } : {}}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-white/20 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <div className="flex-1 rounded-2xl px-3 py-2 flex items-center"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Message everyone…"
                    className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/25 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30"
                  style={{ background: newMessage.trim() ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'rgba(255,255,255,0.06)' }}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Control Bar ──────────────────────────────────────── */}
      <div className="pb-6 pt-3 w-full flex justify-center items-center pointer-events-none absolute bottom-0 left-0 z-30">
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-3xl pointer-events-auto"
          style={{
            background: 'rgba(10,15,30,0.85)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(32px)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset'
          }}
        >
          {/* Mic */}
          <CtrlBtn onClick={toggleMute} danger={isMuted} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </CtrlBtn>

          {/* Video */}
          <CtrlBtn onClick={toggleVideo} danger={isVideoOff && !isScreenSharing} title={isVideoOff ? 'Turn On Camera' : 'Turn Off Camera'}>
            {isVideoOff && !isScreenSharing ? <VideoOff size={20} /> : <Video size={20} />}
          </CtrlBtn>

          <div className="w-px h-8 mx-1" style={{ background: 'rgba(255,255,255,0.10)' }} />

          {/* Screen Share */}
          <CtrlBtn onClick={toggleScreenShare} active={isScreenSharing} title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'} wide>
            <MonitorUp size={18} />
            <span className="hidden md:inline text-xs">{isScreenSharing ? 'Stop' : 'Share'}</span>
          </CtrlBtn>

          {/* Raise Hand */}
          <CtrlBtn
            onClick={toggleHandRaise}
            title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            wide
            active={isHandRaised}
          >
            <span className="text-base leading-none">✋</span>
            <span className="hidden md:inline text-xs">{isHandRaised ? 'Lower' : 'Hand'}</span>
          </CtrlBtn>

          <div className="w-px h-8 mx-1" style={{ background: 'rgba(255,255,255,0.10)' }} />

          {/* Chat */}
          <CtrlBtn onClick={() => setIsChatOpen(!isChatOpen)} active={isChatOpen} title="Chat">
            <div className="relative">
              <MessageSquare size={20} />
              {chatMessages.length > 0 && !isChatOpen && (
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500 border border-slate-950 text-[7px] flex items-center justify-center text-white font-bold">
                  {chatMessages.length > 9 ? '9+' : chatMessages.length}
                </div>
              )}
            </div>
          </CtrlBtn>

          {/* Record */}
          <CtrlBtn
            onClick={toggleRecording}
            disabled={isUploading}
            danger={isRecording}
            title={isRecording ? 'Stop Recording' : 'Record Meeting'}
          >
            <Disc size={20} className={isRecording ? 'animate-spin' : ''} />
          </CtrlBtn>

          <div className="w-px h-8 mx-1" style={{ background: 'rgba(255,255,255,0.10)' }} />

          {/* Leave */}
          <CtrlBtn onClick={leaveMeeting} danger title="Leave Meeting">
            <PhoneOff size={20} />
          </CtrlBtn>
        </div>
      </div>
    </div>
  );
};

// ── VideoPlayer ───────────────────────────────────────────────
const VideoPlayer = ({ stream, className, isRemoteMuted = false }: {
  stream: MediaStream; className?: string; isRemoteMuted?: boolean;
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (v && stream) {
      v.srcObject = stream;
      v.muted = isRemoteMuted;
      const p = v.play();
      if (p !== undefined) {
        p.catch(() => {
          v.muted = true;
          v.play().catch(console.error);
          setIsAudioBlocked(true);
        });
      }
    }
  }, [stream, isRemoteMuted]);

  return (
    <div className="relative w-full h-full">
      <video ref={ref} autoPlay playsInline className={className || 'w-full h-full object-cover'} />
      {isAudioBlocked && (
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => { if (ref.current) { ref.current.muted = isRemoteMuted; setIsAudioBlocked(false); } }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-400 transition-all animate-pulse shadow-lg shadow-rose-500/30"
          >
            Unmute Audio
          </button>
        </div>
      )}
    </div>
  );
};
