import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
  useTracks,
  VideoTrack,
  Chat,
  useDataChannel,
} from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { BackgroundBlur } from '@livekit/track-processors';
import { useAuthStore } from '../../store/authStore';
import { useMeetingStore } from '../../store/meetingStore';
import { toast } from '../../utils/toast';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Hand,
  EyeOff,
  Eye,
  Crown,
  FileText,
  BarChart2,
  Maximize2,
  Minimize2,
  PenTool,
  StopCircle,
  UserPlus,
  Search,
  Radio,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Volume2,
} from 'lucide-react';
import { getChannels, createMessage } from '../../api/messaging.api';
import { getMeetingNotes, saveMeetingNotes, getMeetingToken, updateMeetingStatus } from '../../api/meetings.api';
import { Modal } from '../../components/ui/Modal';
import { getInitials } from '../../utils/initials';

// Audio feedback synthesizers using Web Audio API
const playJoinSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = [261.63, 329.63, 392.0];
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
  } catch (e) {
    // AudioContext blocked by browser policy
  }
};

const playLeaveSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = [392.0, 329.63];
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
  } catch (e) {
    // AudioContext blocked
  }
};

const formatSeconds = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// -------------------------------------------------------------
// Meeting Invite Modal Button
// -------------------------------------------------------------
const MeetingInviteButton = ({ roomId }: { roomId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getChannels().then(setChannels).catch(console.error);
    }
  }, [isOpen]);

  const handleInvite = async (channelId: string) => {
    setIsSending(true);
    try {
      await createMessage(channelId, `Join my meeting here: ems://meeting/${roomId}`);
      toast.success('Invite sent to channel!');
      setIsOpen(false);
    } catch (e) {
      toast.error('Failed to send invite.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredChannels = channels.filter((c) =>
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-500 cursor-pointer"
        title="Invite participants via chat channels"
      >
        <UserPlus size={14} /> Invite
      </button>

      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Invite to Meeting">
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search channels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
              {filteredChannels.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No channels found.</p>
              ) : (
                filteredChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{channel.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{channel.type}</p>
                    </div>
                    <button
                      onClick={() => handleInvite(channel.id)}
                      disabled={isSending}
                      className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Send
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// -------------------------------------------------------------
// Raise Hand Controls
// -------------------------------------------------------------
const RaiseHandButton = () => {
  const { localParticipant } = useLocalParticipant();
  const [isRaised, setIsRaised] = useState(false);

  useEffect(() => {
    if (localParticipant?.metadata) {
      try {
        const meta = JSON.parse(localParticipant.metadata);
        setIsRaised(Boolean(meta.handRaised));
      } catch (e) {}
    }
  }, [localParticipant?.metadata]);

  const toggleHand = async () => {
    if (!localParticipant) return;
    try {
      const currentMeta = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {};
      const newMeta = { ...currentMeta, handRaised: !isRaised };
      await localParticipant.setMetadata(JSON.stringify(newMeta));
      setIsRaised(!isRaised);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      onClick={toggleHand}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer ${
        isRaised ? 'bg-amber-500 text-white animate-bounce' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      <Hand size={14} /> {isRaised ? 'Lower Hand' : 'Raise Hand'}
    </button>
  );
};

const RaisedHandsList = () => {
  const participants = useParticipants();
  const raisedHands = participants.filter((p) => {
    if (!p.metadata) return false;
    try {
      return JSON.parse(p.metadata).handRaised;
    } catch (e) {
      return false;
    }
  });

  if (raisedHands.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 bg-gray-900/90 p-3 rounded-xl border border-gray-700 w-64 z-40 backdrop-blur-md shadow-xl">
      <h3 className="text-amber-500 font-semibold mb-2 text-xs flex items-center gap-1.5 uppercase tracking-wide">
        <Hand size={14} /> Raised Hands ({raisedHands.length})
      </h3>
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
        {raisedHands.map((p) => (
          <span key={p.identity} className="text-gray-200 text-xs font-medium truncate">
            {p.name || p.identity}
          </span>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Background Blur Toggle
// -------------------------------------------------------------
const BlurToggle = () => {
  const { localParticipant } = useLocalParticipant();
  const [isBlurred, setIsBlurred] = useState(false);
  const [processor, setProcessor] = useState<any>(null);

  useEffect(() => {
    try {
      setProcessor(BackgroundBlur(10, { delegate: 'GPU' }));
    } catch (e) {
      console.warn('Background blur not supported on this device/browser');
    }
  }, []);

  const toggleBlur = async () => {
    if (!localParticipant || !processor) return;
    const trackPub = localParticipant.getTrackPublication(Track.Source.Camera);
    if (!trackPub || !trackPub.track) {
      toast.error('Please turn on your camera first');
      return;
    }

    try {
      if (isBlurred) {
        await (trackPub.track as any).setProcessor(null);
        setIsBlurred(false);
      } else {
        await (trackPub.track as any).setProcessor(processor);
        setIsBlurred(true);
      }
    } catch (e) {
      console.error('Failed to toggle blur:', e);
      toast.error('Failed to apply background blur');
    }
  };

  return (
    <button
      onClick={toggleBlur}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer ${
        isBlurred ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      {isBlurred ? <Eye size={14} /> : <EyeOff size={14} />} {isBlurred ? 'Blur Off' : 'Blur On'}
    </button>
  );
};

// -------------------------------------------------------------
// Host Controls Dropdown
// -------------------------------------------------------------
const HostControls = ({ roomId }: { roomId: string }) => {
  const participants = useParticipants();
  const [isOpen, setIsOpen] = useState(false);

  const handleRemove = async (identity: string) => {
    try {
      const tokenStr = useAuthStore.getState().accessToken;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      await fetch(`${apiUrl}/meetings/${roomId}/remove-participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStr}` },
        body: JSON.stringify({ identity }),
      });
      toast.success('Participant removed');
    } catch (e) {
      toast.error('Failed to remove participant');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 border border-gray-700 cursor-pointer"
      >
        <Crown size={14} className="text-amber-400" /> Host
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl w-64 z-50">
          <h3 className="text-white font-semibold text-xs mb-3 uppercase tracking-wider">Manage Participants</h3>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto custom-scrollbar">
            {participants
              .filter((p) => !p.isLocal)
              .map((p) => (
                <div key={p.identity} className="flex justify-between items-center text-xs text-gray-300 bg-gray-800/60 p-2 rounded-lg">
                  <span className="truncate pr-2 font-medium">{p.name || p.identity}</span>
                  <button
                    onClick={() => handleRemove(p.identity)}
                    className="px-2 py-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded text-[10px] transition font-bold shrink-0 cursor-pointer"
                  >
                    Kick
                  </button>
                </div>
              ))}
            {participants.filter((p) => !p.isLocal).length === 0 && (
              <span className="text-gray-500 text-xs italic text-center py-2">No other participants</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Collaborative Shared Notes
// -------------------------------------------------------------
const SharedNotes = ({ roomId }: { roomId?: string }) => {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { send, message } = useDataChannel('meeting-notes');
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (!roomId) return;
    getMeetingNotes(roomId)
      .then((data) => {
        if (data && typeof data.notes === 'string' && data.notes.trim()) {
          setText(data.notes);
        }
      })
      .catch(console.error);
  }, [roomId]);

  useEffect(() => {
    if (message) {
      const decoder = new TextDecoder();
      const decoded = decoder.decode(message.payload);
      setText(decoded);
    }
  }, [message]);

  useEffect(() => {
    if (!roomId || !text) return;
    const timer = setTimeout(async () => {
      try {
        setIsSaving(true);
        await saveMeetingNotes(roomId, text);
      } catch (e) {
        console.error('Failed to auto-save notes:', e);
      } finally {
        setIsSaving(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [text, roomId]);

  useEffect(() => {
    return () => {
      if (roomId && textRef.current) {
        saveMeetingNotes(roomId, textRef.current).catch(console.error);
      }
    };
  }, [roomId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    const encoder = new TextEncoder();
    send(encoder.encode(newText), { reliable: true });
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-gray-300 font-semibold flex items-center gap-2 text-sm">
          <FileText size={16} /> Meeting Notes
        </h3>
        {isSaving ? (
          <span className="text-[10px] text-amber-400 font-medium animate-pulse">Saving...</span>
        ) : (
          <span className="text-[10px] text-emerald-400 font-medium">Auto-saved to DB</span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-3">Collaborative notes auto-save in real-time across participants.</p>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Type collaborative meeting minutes & notes here..."
        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono text-xs shadow-inner leading-relaxed"
      />
    </div>
  );
};

// -------------------------------------------------------------
// Live Polls Component
// -------------------------------------------------------------
const LiveMeetingPolls = ({ roomId, isHost }: { roomId: string; isHost: boolean }) => {
  const [polls, setPolls] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const { send, message } = useDataChannel('meeting-polls');

  const fetchPolls = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${apiUrl}/meetings/${roomId}/polls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPolls(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, [roomId]);

  useEffect(() => {
    if (message) {
      const decoder = new TextDecoder();
      if (decoder.decode(message.payload) === 'poll-updated') {
        fetchPolls();
      }
    }
  }, [message]);

  const notifyUpdate = () => {
    const encoder = new TextEncoder();
    send(encoder.encode('poll-updated'), { reliable: true });
  };

  const handleCreatePoll = async () => {
    try {
      const validOptions = newOptions.filter((o) => o.trim() !== '');
      if (!newQuestion.trim() || validOptions.length < 2) {
        toast.error('Enter a question and at least 2 options');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = useAuthStore.getState().accessToken;
      await fetch(`${apiUrl}/meetings/${roomId}/polls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQuestion, options: validOptions }),
      });
      setNewQuestion('');
      setNewOptions(['', '']);
      fetchPolls();
      notifyUpdate();
      toast.success('Poll launched');
    } catch (e) {
      toast.error('Failed to launch poll');
    }
  };

  const handleVote = async (pollId: number, optionIndex: number) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = useAuthStore.getState().accessToken;
      await fetch(`${apiUrl}/meetings/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
      });
      fetchPolls();
      notifyUpdate();
    } catch (e) {
      toast.error('Failed to vote');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 p-4 overflow-y-auto custom-scrollbar">
      <h3 className="text-gray-300 font-semibold mb-4 flex items-center gap-2 text-sm">
        <BarChart2 size={16} /> Live Polls
      </h3>

      {isHost && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Create New Poll</h4>
          <input
            type="text"
            placeholder="Poll question?"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-white mb-2"
          />
          {newOptions.map((opt, idx) => (
            <input
              key={idx}
              type="text"
              placeholder={`Option ${idx + 1}`}
              value={opt}
              onChange={(e) => {
                const updated = [...newOptions];
                updated[idx] = e.target.value;
                setNewOptions(updated);
              }}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-white mb-2"
            />
          ))}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setNewOptions([...newOptions, ''])}
              className="text-xs text-indigo-400 font-semibold hover:underline"
            >
              + Add Option
            </button>
            <button
              onClick={handleCreatePoll}
              className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
            >
              Launch Poll
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 flex-1">
        {polls.length === 0 && <p className="text-gray-500 text-xs text-center py-4">No active polls.</p>}
        {polls.map((poll) => {
          const totalVotes = poll.votes?.reduce((acc: number, v: any) => acc + v.count, 0) || 0;
          return (
            <div key={poll.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-white mb-3">{poll.question}</h4>
              <div className="space-y-2">
                {poll.options.map((opt: string, idx: number) => {
                  const voteData = poll.votes?.find((v: any) => v.option_index === idx);
                  const count = voteData ? voteData.count : 0;
                  const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);

                  return (
                    <div
                      key={idx}
                      className="relative cursor-pointer group"
                      onClick={() => handleVote(poll.id, idx)}
                    >
                      <div className="flex justify-between text-xs text-gray-300 mb-1 relative z-10 px-2 py-1">
                        <span>{opt}</span>
                        <span className="font-semibold text-[10px]">
                          {percentage}% ({count})
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-gray-800 rounded-lg overflow-hidden border border-gray-700 group-hover:border-indigo-500 transition">
                        <div
                          className="h-full bg-indigo-500/20 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Live Session Manager Hook & Global Listeners
// Synchronizes active speaker, connection states, participant joins/leaves
// -------------------------------------------------------------
const SessionSyncManager = ({ roomId }: { roomId: string }) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const navigate = useNavigate();
  const {
    leaveMeeting,
    setActiveSpeaker,
    setParticipantCount,
    setConnectionStatus,
    setIsMuted,
    setIsCameraEnabled,
    setIsPushToTalkActive,
  } = useMeetingStore();

  const { message: controlMessage } = useDataChannel('meeting-control');

  // Handle meeting ended by host via data channel
  useEffect(() => {
    if (controlMessage) {
      try {
        const text = new TextDecoder().decode(controlMessage.payload);
        const data = JSON.parse(text);
        if (data.type === 'MEETING_ENDED') {
          toast.info('The host has ended this meeting.');
          leaveMeeting();
          navigate('/meetings');
        }
      } catch (e) {
        // Ignored
      }
    }
  }, [controlMessage, leaveMeeting, navigate]);

  // Sync connection state
  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      setConnectionStatus('connected');
    } else if (connectionState === ConnectionState.Reconnecting) {
      setConnectionStatus('reconnecting');
      toast.warning('Reconnecting to meeting audio/video...');
    } else if (connectionState === ConnectionState.Connecting) {
      setConnectionStatus('connecting');
    } else if (connectionState === ConnectionState.Disconnected) {
      setConnectionStatus('disconnected');
    }
  }, [connectionState, setConnectionStatus]);

  // Sync participant count
  useEffect(() => {
    setParticipantCount(participants.length);
  }, [participants.length, setParticipantCount]);

  // Sync active speakers & mute status
  useEffect(() => {
    if (!room) return;

    const handleActiveSpeakers = (speakers: any[]) => {
      if (speakers && speakers.length > 0) {
        const primary = speakers[0];
        setActiveSpeaker(primary.name || primary.identity || 'Someone');
      } else {
        setActiveSpeaker(null);
      }
    };

    const handleParticipantConnected = (p: any) => {
      playJoinSound();
      toast.success(`${p.name || 'A participant'} joined the call`);
    };

    const handleParticipantDisconnected = (p: any) => {
      playLeaveSound();
      toast.info(`${p.name || 'A participant'} left the call`);
    };

    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, setActiveSpeaker]);

  // Sync local participant mic & camera status
  useEffect(() => {
    if (localParticipant) {
      setIsMuted(!localParticipant.isMicrophoneEnabled);
      setIsCameraEnabled(localParticipant.isCameraEnabled);
    }
  }, [localParticipant, localParticipant?.isMicrophoneEnabled, localParticipant?.isCameraEnabled, setIsMuted, setIsCameraEnabled]);

  // Global Spacebar Push-To-Talk shortcut
  useEffect(() => {
    let wasMutedBeforePTT = true;
    let isHoldingSpace = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isHoldingSpace) return;
      const target = e.target as HTMLElement;
      // Do not intercept if user is typing in form inputs or textareas
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.tldraw')
      ) {
        return;
      }

      e.preventDefault();
      isHoldingSpace = true;
      if (localParticipant) {
        wasMutedBeforePTT = !localParticipant.isMicrophoneEnabled;
        localParticipant.setMicrophoneEnabled(true);
        setIsPushToTalkActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isHoldingSpace) {
        isHoldingSpace = false;
        if (localParticipant && wasMutedBeforePTT) {
          localParticipant.setMicrophoneEnabled(false);
        }
        setIsPushToTalkActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [localParticipant, setIsPushToTalkActive]);

  return null;
};

// -------------------------------------------------------------
// Floating Persistent Meeting Panel (Draggable & Non-Blocking)
// Displays when user navigates around the application during a call
// -------------------------------------------------------------
interface FloatingWidgetProps {
  roomId: string;
  isHost: boolean;
  onMaximize: () => void;
  onLeave: () => void;
  onEndMeetingForAll: () => void;
}

const FloatingMeetingWidget: React.FC<FloatingWidgetProps> = ({
  roomId,
  isHost,
  onMaximize,
  onLeave,
  onEndMeetingForAll,
}) => {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const {
    activeMeetingTitle,
    activeSpeaker,
    connectionStatus,
    isPiPCollapsed,
    setPiPCollapsed,
    isPushToTalkActive,
    setIsPushToTalkActive,
  } = useMeetingStore();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [callDuration, setCallDuration] = useState(0);

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Drag handling
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // Video track for active speaker or local user preview
  const tracks = useTracks([Track.Source.Camera]);
  const activeVideoTrack = useMemo(() => {
    const activeRemote = tracks.find((t) => t.participant.identity === activeSpeaker && t.publication.isSubscribed);
    if (activeRemote) return activeRemote;
    const anyRemote = tracks.find((t) => !t.participant.isLocal && t.publication.isSubscribed);
    if (anyRemote) return anyRemote;
    return tracks.find((t) => t.participant.isLocal);
  }, [tracks, activeSpeaker]);

  const toggleMic = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
    } catch (e) {
      toast.error('Could not toggle microphone');
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
    } catch (e) {
      toast.error('Could not toggle camera');
    }
  };

  const handlePTTDown = () => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(true);
      setIsPushToTalkActive(true);
    }
  };

  const handlePTTUp = () => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(false);
      setIsPushToTalkActive(false);
    }
  };

  const isMuted = !localParticipant?.isMicrophoneEnabled;
  const isCameraOn = Boolean(localParticipant?.isCameraEnabled);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] pointer-events-auto transition-shadow duration-300 select-none ${
        isDragging ? 'cursor-grabbing shadow-[0_25px_60px_rgba(0,0,0,0.85)]' : ''
      }`}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      {/* ---------------- Slim Pill Mode ---------------- */}
      {isPiPCollapsed ? (
        <div className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-full px-4 py-2.5 shadow-2xl flex items-center gap-3 text-white">
          <div
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing pr-2 border-r border-slate-700"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <GripHorizontal size={14} className="text-slate-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold truncate max-w-[120px]">{activeMeetingTitle}</span>
          </div>

          <span className="text-[11px] font-mono text-slate-400 font-semibold">{formatSeconds(callDuration)}</span>

          <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">
            {participants.length} in call
          </span>

          {/* Quick mic */}
          <button
            onClick={toggleMic}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isMuted ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>

          {/* PTT */}
          <button
            onPointerDown={handlePTTDown}
            onPointerUp={handlePTTUp}
            onPointerCancel={handlePTTUp}
            className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full transition-all cursor-pointer ${
              isPushToTalkActive
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 animate-pulse'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
            title="Press and hold to talk (Spacebar also works)"
          >
            {isPushToTalkActive ? 'Speaking' : 'PTT'}
          </button>

          {/* Expand to Card */}
          <button
            onClick={() => setPiPCollapsed(false)}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Expand Preview"
          >
            <ChevronUp size={15} />
          </button>

          {/* Maximize to full page */}
          <button
            onClick={onMaximize}
            className="p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-md"
            title="Return to Full Meeting"
          >
            <Maximize2 size={13} />
          </button>

          {/* Leave */}
          <button
            onClick={onLeave}
            className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
            title="Leave Call"
          >
            <PhoneOff size={13} />
          </button>
        </div>
      ) : (
        /* ---------------- Expanded Video Card Mode ---------------- */
        <div className="w-[360px] bg-slate-900/95 backdrop-blur-3xl border border-slate-700/80 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col text-white ring-1 ring-white/10">
          {/* Draggable Header */}
          <div
            className="h-11 bg-slate-950/80 border-b border-slate-800 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal size={14} className="text-slate-500 shrink-0" />
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="text-xs font-black truncate text-slate-200">{activeMeetingTitle}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-mono text-slate-400 font-semibold px-2 py-0.5 rounded-md bg-slate-800/80">
                {formatSeconds(callDuration)}
              </span>
              <button
                onClick={() => setPiPCollapsed(true)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Collapse into mini bar"
              >
                <ChevronDown size={15} />
              </button>
              <button
                onClick={onMaximize}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Maximize to Full Screen"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Preview / Speaker Tile */}
          <div className="relative h-44 bg-slate-950 flex items-center justify-center overflow-hidden">
            {activeVideoTrack && activeVideoTrack.publication.isSubscribed && !activeVideoTrack.publication.isMuted ? (
              <VideoTrack trackRef={activeVideoTrack} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <div
                  className={`w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold text-lg flex items-center justify-center shadow-lg transition-all ${
                    activeSpeaker ? 'ring-4 ring-emerald-400 animate-pulse' : 'ring-2 ring-slate-700'
                  }`}
                >
                  {getInitials(activeSpeaker || 'EMS')}
                </div>
                <span className="text-xs font-bold text-slate-300">
                  {activeSpeaker ? activeSpeaker : 'Waiting for speaker...'}
                </span>
              </div>
            )}

            {/* Active speaker status pill */}
            <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-200 flex items-center gap-1.5 border border-slate-700/60">
              {activeSpeaker ? (
                <>
                  <Volume2 size={12} className="text-emerald-400 animate-pulse" />
                  <span className="truncate max-w-[140px] text-emerald-300">{activeSpeaker}</span>
                </>
              ) : (
                <>
                  <Radio size={12} className="text-indigo-400" />
                  <span>{participants.length} Participant{participants.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>

            {/* Push-to-talk live speaking overlay */}
            {isPushToTalkActive && (
              <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex items-center justify-center border-2 border-emerald-500 animate-pulse">
                <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
                  🎙️ Transmitting Audio
                </span>
              </div>
            )}
          </div>

          {/* Quick Action Controls Toolbar */}
          <div className="p-3 bg-slate-900 flex items-center justify-between border-t border-slate-800">
            <div className="flex items-center gap-2">
              {/* Mic Toggle */}
              <button
                onClick={toggleMic}
                className={`p-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Camera Toggle */}
              <button
                onClick={toggleCamera}
                className={`p-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                  isCameraOn
                    ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/40'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                }`}
                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCameraOn ? <VideoIcon size={16} /> : <VideoOff size={16} />}
              </button>

              {/* Push-To-Talk Button */}
              <button
                onPointerDown={handlePTTDown}
                onPointerUp={handlePTTUp}
                onPointerCancel={handlePTTUp}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                  isPushToTalkActive
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 scale-105'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
                title="Hold with mouse or hold SPACEBAR while working"
              >
                <Radio size={14} className={isPushToTalkActive ? 'animate-spin' : ''} />
                {isPushToTalkActive ? 'Speaking' : 'Hold to Talk'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Host end call */}
              {isHost && (
                <button
                  onClick={onEndMeetingForAll}
                  className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/40 transition-colors cursor-pointer"
                  title="End Meeting for All"
                >
                  <StopCircle size={16} />
                </button>
              )}

              {/* Leave Call */}
              <button
                onClick={onLeave}
                className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/30 cursor-pointer"
                title="Leave Meeting"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Full-Screen Meeting Room View
// -------------------------------------------------------------
interface FullViewProps {
  roomId: string;
  isHost: boolean;
  onMinimize: () => void;
  onLeave: () => void;
  onEndMeetingForAll: () => void;
}

const FullMeetingRoomContent: React.FC<FullViewProps> = ({
  roomId,
  isHost,
  onMinimize,
  onLeave,
  onEndMeetingForAll,
}) => {
  const { activeMeetingTitle } = useMeetingStore();
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'notes' | 'polls'>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      const startTime = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const durationSecs = Math.round((Date.now() - startTime) / 1000);
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        stream.getTracks().forEach((t) => t.stop());

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', blob, `meeting-${roomId}-${Date.now()}.webm`);
        formData.append('durationSecs', String(durationSecs));

        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
          const tokenStr = useAuthStore.getState().accessToken;
          await fetch(`${apiUrl}/meetings/${roomId}/recording`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenStr}` },
            body: formData,
          });
          toast.success('Recording saved successfully!');
        } catch (e) {
          toast.error('Failed to upload recording');
        } finally {
          setIsUploading(false);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      toast.success('Meeting recording started');

      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      };
    } catch (e) {
      toast.error('Could not start recording. Screen share permission was denied.');
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Top Meeting Toolbar */}
      <div className="h-16 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-indigo-400 font-black text-lg">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="truncate max-w-[220px] sm:max-w-xs">{activeMeetingTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <MeetingInviteButton roomId={roomId} />

          {/* Minimize / Browse App Button */}
          <button
            onClick={onMinimize}
            className="px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 bg-gray-800 text-gray-200 hover:bg-gray-700 cursor-pointer border border-gray-700"
            title="Browse other pages while continuing audio in background"
          >
            <Minimize2 size={14} /> Browse App
          </button>

          <button
            onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer ${
              isWhiteboardOpen ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <PenTool size={14} /> {isWhiteboardOpen ? 'Close Board' : 'Whiteboard'}
          </button>

          <RaiseHandButton />
          <BlurToggle />

          {isHost && (
            <>
              <div className="w-px h-6 bg-gray-700 mx-1 hidden sm:block" />
              <button
                onClick={toggleRecording}
                disabled={isUploading}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer ${
                  isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-gray-800 text-rose-400 hover:bg-rose-600 hover:text-white'
                }`}
              >
                {isUploading ? (
                  'Uploading...'
                ) : isRecording ? (
                  <>
                    <StopCircle size={14} /> Stop Rec
                  </>
                ) : (
                  <>
                    <VideoIcon size={14} /> Record
                  </>
                )}
              </button>
              <HostControls roomId={roomId} />
              <button
                onClick={onEndMeetingForAll}
                className="px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 bg-rose-700 hover:bg-rose-600 text-white cursor-pointer"
                title="End Meeting for All Participants"
              >
                <StopCircle size={14} /> End for All
              </button>
            </>
          )}

          <button
            onClick={onLeave}
            className="px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
            title="Leave Meeting"
          >
            <PhoneOff size={14} /> Leave
          </button>
        </div>
      </div>

      {/* Main Video & Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-black flex flex-col">
          {isWhiteboardOpen ? (
            <div className="absolute inset-0 z-10 bg-white">
              <Tldraw />
            </div>
          ) : (
            <VideoConference />
          )}
          <RaisedHandsList />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col h-full shrink-0">
          <div className="flex bg-gray-900 border-b border-gray-800 p-2 gap-2">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                sidebarTab === 'chat' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setSidebarTab('notes')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                sidebarTab === 'notes' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setSidebarTab('polls')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                sidebarTab === 'polls' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Polls
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative lk-chat-container">
            {sidebarTab === 'chat' ? (
              <Chat />
            ) : sidebarTab === 'notes' ? (
              <SharedNotes roomId={roomId} />
            ) : (
              <LiveMeetingPolls roomId={roomId} isHost={isHost} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Primary LiveKitMeetingRoom Component
// -------------------------------------------------------------
export const LiveKitMeetingRoom: React.FC<{ roomId?: string; isFullPage?: boolean }> = ({
  roomId: propRoomId,
  isFullPage: propIsFullPage,
}) => {
  const { id: paramRoomId } = useParams<{ id: string }>();
  const roomId = propRoomId || paramRoomId;
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { isMinimized, minimizeMeeting, maximizeMeeting, leaveMeeting, setIsHost } = useMeetingStore();

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHostUser, setIsHostUser] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'wss://ems-pmt0pnyo.livekit.cloud';

  // Fetch token using standardized api
  useEffect(() => {
    let isCancelled = false;
    const fetchToken = async () => {
      if (!roomId || !user) return;
      try {
        const data = await getMeetingToken(roomId);
        if (isCancelled) return;
        if (data.success && data.token) {
          setToken(data.token);
          setIsHostUser(Boolean(data.isHost));
          setIsHost(Boolean(data.isHost));
          setIsWaiting(Boolean(data.isWaiting));
        } else {
          setError(data.error?.message || 'Failed to authenticate meeting token');
          toast.error('Failed to join meeting room');
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Token fetch error:', err);
        setError(err.response?.data?.error?.message || 'Error fetching meeting token');
      }
    };

    fetchToken();
    return () => {
      isCancelled = true;
    };
  }, [roomId, user, setIsHost]);

  // Handle Host ending meeting for everyone
  const handleEndMeetingForAll = async () => {
    if (!roomId) return;
    if (!confirm('Are you sure you want to end this meeting for all participants?')) return;
    try {
      await updateMeetingStatus(roomId, 'completed').catch(() => {});
      toast.success('Meeting completed and ended for all participants.');
    } catch (e) {
      console.warn('Meeting status update notice:', e);
    } finally {
      leaveMeeting();
      navigate('/meetings');
    }
  };

  const handleLeaveMeeting = () => {
    if (!confirm('Leave this meeting?')) return;
    leaveMeeting();
    navigate('/meetings');
  };

  const handleMinimize = () => {
    minimizeMeeting();
    // Navigate back to previous page or dashboard so user can use the app
    navigate('/dashboard');
  };

  const handleMaximize = () => {
    maximizeMeeting();
    if (roomId) {
      navigate(`/meeting/${roomId}`);
    }
  };

  // Determine if full-screen or floating widget
  const showFullView = Boolean(propIsFullPage !== undefined ? propIsFullPage : !isMinimized);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white flex-col gap-4 pointer-events-auto">
        <h2 className="text-2xl font-black text-rose-500">Connection Error</h2>
        <p className="text-gray-400 text-sm max-w-md text-center">{error}</p>
        <button
          onClick={() => {
            leaveMeeting();
            navigate('/meetings');
          }}
          className="px-5 py-2.5 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition cursor-pointer"
        >
          Return to Meetings
        </button>
      </div>
    );
  }

  if (isWaiting) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white flex-col gap-4 pointer-events-auto">
        <div className="animate-pulse bg-indigo-500/20 p-6 rounded-full">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-2xl font-black mt-4">Waiting Room</h2>
        <p className="text-gray-400 text-center max-w-md text-sm">
          The host has enabled the waiting room. Please wait until you are admitted to the meeting.
        </p>
        <button
          onClick={() => {
            leaveMeeting();
            navigate('/meetings');
          }}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold"
        >
          Cancel & Leave
        </button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white pointer-events-auto">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
        <span className="ml-3 text-sm font-semibold text-slate-300">Connecting to Secure Meeting...</span>
      </div>
    );
  }

  return (
    <div className={showFullView ? 'w-full h-full pointer-events-auto' : 'pointer-events-none'}>
      <style>{`
        /* Hide duplicate default LiveKit controls when in custom view */
        .pip-mode .lk-control-bar { display: none !important; }
        .lk-video-conference .lk-chat { display: none !important; }
        .lk-chat-container .lk-chat { display: flex !important; background-color: #030712 !important; border: none !important; height: 100% !important; }
        .lk-chat-header { display: none !important; }
        .lk-chat-toggle-button { display: none !important; }
        .lk-chat-form { padding: 12px !important; background-color: #0b0f19 !important; border-top: 1px solid #1f2937 !important; }
        .lk-chat-form-input { background-color: #111827 !important; border: 1px solid #374151 !important; border-radius: 12px !important; color: #f9fafb !important; font-size: 13px !important; padding: 8px 12px !important; }
        .lk-chat-form-input:focus { border-color: #6366f1 !important; outline: none !important; }
        .lk-chat-form-button { background-color: #6366f1 !important; border-radius: 10px !important; color: #ffffff !important; }
        .lk-chat-messages { padding: 12px !important; }
      `}</style>
      <LiveKitRoom
        video={false}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        onError={(err) => {
          console.error('LiveKit Error:', err);
          toast.error(`Meeting Connection Error: ${err.message}`);
        }}
        onDisconnected={() => {
          leaveMeeting();
          toast.info('Meeting disconnected');
        }}
        data-lk-theme="default"
        style={{ width: '100%', height: '100%' }}
      >
        {/* RoomAudioRenderer guarantees remote audio is decoded and plays continuously */}
        <RoomAudioRenderer />

        {/* Global session sync for speaker detection, PTT Spacebar, and data channel signals */}
        <SessionSyncManager roomId={roomId!} />

        {/* Render either the Full-Screen Room or the Persistent Floating Widget */}
        {showFullView ? (
          <FullMeetingRoomContent
            roomId={roomId!}
            isHost={isHostUser}
            onMinimize={handleMinimize}
            onLeave={handleLeaveMeeting}
            onEndMeetingForAll={handleEndMeetingForAll}
          />
        ) : (
          <FloatingMeetingWidget
            roomId={roomId!}
            isHost={isHostUser}
            onMaximize={handleMaximize}
            onLeave={handleLeaveMeeting}
            onEndMeetingForAll={handleEndMeetingForAll}
          />
        )}
      </LiveKitRoom>
    </div>
  );
};
