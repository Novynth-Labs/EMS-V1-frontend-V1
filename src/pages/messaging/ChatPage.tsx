import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getChannels, getChannelMessages, createMessage, toggleReaction, createGroup, joinGroup, getGroupMembers, addMember, removeMember, leaveGroup, generateInviteLink, pinMessage, deleteMessageForEveryone, deleteMessageForMe, searchChat, getAllUsersList, type Channel, type ChatMessage } from '../../api/messaging.api';
import { startInstantMeeting } from '../../api/meetings.api';
import { useAuthStore } from '../../store/authStore';
import { socket } from '../../services/socket';
import { Hash, Lock, Megaphone, Send, Paperclip, AlertCircle, Image as ImageIcon, File, X, Search, Users, MessageCircle, Video, SmilePlus, Smile, Wifi, WifiOff, Phone } from 'lucide-react';
import { FileUploader, type AttachmentData } from '../../components/messaging/FileUploader';
import { Modal } from '../../components/ui/Modal';
import EmojiPicker from 'emoji-picker-react';
import { toast } from '../../utils/toast';
import { getInitials } from '../../utils/initials';
import { Avatar } from '../../components/ui/Avatar';
import { MediaLightboxModal } from '../../components/common/MediaLightboxModal';

const playSendSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
};

const playReceiveSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
};

const getChannelTypeColor = (type: string) => {
  switch (type) {
    case 'Direct': return 'text-violet-400';
    case 'Private': return 'text-rose-400';
    case 'Announcement': return 'text-amber-400';
    case 'Project': return 'text-emerald-400';
    default: return 'text-sky-400';
  }
};

const getAvatarColor = (name: string) => {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-sky-600',
  ];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[idx];
};

const renderLastMessagePreview = (channel: Channel) => {
  if (!channel.lastMessage) return <span className="text-slate-500 italic">No messages yet</span>;

  switch (channel.lastMessageType) {
    case 'image':
      return <span className="flex items-center gap-1 text-sky-400 font-medium"><ImageIcon size={11} /> Photo</span>;
    case 'video':
      return <span className="flex items-center gap-1 text-purple-400 font-medium"><Video size={11} /> Video</span>;
    case 'file':
      return <span className="flex items-center gap-1 text-emerald-400 font-medium"><File size={11} /> Document</span>;
    default:
      return <span className="truncate">{channel.lastMessage}</span>;
  }
};

const formatConversationTime = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  } catch (e) {
    return '';
  }
};


const renderFormattedMessage = (content: string) => {
  if (!content) return null;
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'code', value: match[1].trim() });
    lastIndex = codeBlockRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.substring(lastIndex) });
  }

  return (
    <div className="whitespace-pre-wrap break-words space-y-1 font-sans">
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return (
            <pre key={idx} className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto my-1 border border-slate-700 leading-normal">
              <code>{part.value}</code>
            </pre>
          );
        }
        return <span key={idx}>{part.value}</span>;
      })}
    </div>
  );
};

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentData | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionPickerId, setShowReactionPickerId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentData | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore(state => state.user);

  // --- Enterprise Messaging UI States ---
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [inviteLinkCode, setInviteLinkCode] = useState('');
  const [showAddMemberDropdown, setShowAddMemberDropdown] = useState(false);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);

  const [showSearchPane, setShowSearchPane] = useState(false);
  const [searchQueryLocal, setSearchQueryLocal] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const [selectedNewGroupMembers, setSelectedNewGroupMembers] = useState<(string | number)[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      const newGroup = await createGroup(groupName, groupDescription, selectedNewGroupMembers);
      toast.success(`Group "${groupName}" created with ${selectedNewGroupMembers.length} member(s)!`);
      setShowCreateGroupModal(false);
      setGroupName('');
      setGroupDescription('');
      setSelectedNewGroupMembers([]);
      setMemberSearchQuery('');
      const data = await getChannels();
      setChannels(data);
      if (newGroup?.groupId) {
        setActiveChannel(newGroup.groupId.toString());
      }
    } catch (err) {
      toast.error('Failed to create group');
    }
  };

  const handleJoinGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    try {
      const joinedGroupId = await joinGroup(inviteCode);
      toast.success('Joined group successfully!');
      setShowJoinGroupModal(false);
      setInviteCode('');
      const data = await getChannels();
      setChannels(data);
      setActiveChannel(joinedGroupId.toString());
    } catch (err) {
      toast.error('Invalid or expired invite code');
    }
  };

  const loadGroupSettings = async () => {
    if (!activeChannel || activeChannel.startsWith('dm_')) return;
    try {
      const members = await getGroupMembers(activeChannel);
      setGroupMembers(members);
      const users = await getAllUsersList();
      setAllUsersList(users);
    } catch (err) {
      console.error('Failed to load group details', err);
    }
  };

  const handleGenerateInvite = async () => {
    if (!activeChannel) return;
    try {
      const code = await generateInviteLink(activeChannel);
      setInviteLinkCode(code);
      toast.success('Invite link code generated!');
    } catch (err) {
      toast.error('Failed to generate invite code');
    }
  };

  const handleAddGroupMember = async (userId: string) => {
    if (!activeChannel) return;
    try {
      const newMember = await addMember(activeChannel, userId);
      toast.success('Member added successfully!');
      setShowAddMemberDropdown(false);
      if (newMember) {
        setGroupMembers(prev => {
          if (prev.find(m => m.UserId?.toString() === userId.toString())) return prev;
          return [...prev, newMember];
        });
      }
      loadGroupSettings();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || err?.message || 'Failed to add member';
      toast.error(errorMsg);
    }
  };

  const handleRemoveGroupMember = async (userId: string) => {
    if (!activeChannel) return;
    try {
      await removeMember(activeChannel, userId);
      toast.success('Member removed successfully!');
      loadGroupSettings();
    } catch (err) {
      toast.error('Failed to remove member');
    }
  };

  const handleLeaveGroupAction = async () => {
    if (!activeChannel) return;
    try {
      await leaveGroup(activeChannel);
      toast.success('Left the group.');
      setShowGroupSettingsModal(false);
      const data = await getChannels();
      setChannels(data);
      if (data.length > 0) setActiveChannel(data[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave group');
    }
  };

  const handlePinToggle = async (messageId: string) => {
    try {
      await pinMessage(messageId);
      toast.success('Message pin state toggled');
      if (activeChannel) {
        getChannelMessages(activeChannel).then(data => setMessages(data));
      }
    } catch (err) {
      toast.error('Failed to toggle pin state');
    }
  };

  const handleDeleteMessage = async (messageId: string, forEveryone: boolean) => {
    try {
      if (forEveryone) {
        await deleteMessageForEveryone(messageId);
        toast.success('Message deleted for everyone');
      } else {
        await deleteMessageForMe(messageId);
        toast.success('Message deleted for you');
      }
      if (activeChannel) {
        getChannelMessages(activeChannel).then(data => setMessages(data));
      }
    } catch (err) {
      toast.error('Failed to delete message');
    }
  };

  const handleSearchAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQueryLocal.trim()) return;
    setSearching(true);
    try {
      const results = await searchChat(searchQueryLocal);
      setSearchResults(results);
    } catch (err) {
      toast.error('Failed to execute search');
    } finally {
      setSearching(false);
    }
  };

  const importAllEmsFunctions = () => {
    // Helper to reference imported methods and avoid unused imports lints
    console.log(createGroup, joinGroup, getGroupMembers, addMember, removeMember, leaveGroup, generateInviteLink, pinMessage, deleteMessageForEveryone, deleteMessageForMe, searchChat);
  };

  useEffect(() => {
    getChannels().then(data => {
      setChannels(data);
      const target = searchParams.get('channel') || (location.state as any)?.channelId;
      if (target && data.some(c => c.id.toString() === target.toString())) {
        setActiveChannel(target.toString());
      } else if (data.length > 0) {
        setActiveChannel(data[0].id);
      }
    });
  }, [searchParams, location.state]);

  useEffect(() => {
    const target = searchParams.get('channel');
    if (target) {
      setActiveChannel(target);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeChannel) {
      getChannelMessages(activeChannel).then(data => setMessages(data));
    }
  }, [activeChannel]);

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleNewMessage = (msg: any) => {
      setMessages(prev => {
        if (msg.type === 'reaction') {
          return prev.map(m => m.id === msg.message.id ? { ...m, reactions: msg.message.reactions } : m);
        }
        const tempIndex = prev.findIndex(m => m.id.startsWith('temp_') && m.senderId === msg.senderId && m.content === msg.content);
        if (tempIndex !== -1) {
          const updated = [...prev];
          updated[tempIndex] = { ...msg, isSelf: msg.senderId === user?.id };
          return updated;
        }
        if (prev.find(m => m.id === msg.id)) return prev;
        if (msg.senderId !== user?.id) {
          playReceiveSound();
        }
        return [...prev, { ...msg, isSelf: msg.senderId === user?.id }];
      });
    };

    const handleConversationUpdated = (data: any) => {
      const channelId = (data.channelId || data.chatId || data.groupId)?.toString();
      if (!channelId) return;

      const lastMsg = data.lastMessage || 'New message';
      const msgTime = data.lastMessageTime || new Date().toISOString();
      const msgType = data.lastMessageType || 'text';
      const senderId = data.lastMessageSenderId;

      setChannels(prevChannels => {
        const existingIndex = prevChannels.findIndex(c => c.id.toString() === channelId);
        if (existingIndex === -1) return prevChannels;

        const target = prevChannels[existingIndex];
        const isCurrentActive = activeChannel?.toString() === channelId;

        const updated: Channel = {
          ...target,
          lastMessage: lastMsg,
          lastMessageTime: msgTime,
          lastMessageType: msgType,
          lastMessageSenderId: senderId,
          unreadCount: isCurrentActive ? 0 : (senderId?.toString() !== user?.id?.toString() ? target.unreadCount + 1 : target.unreadCount)
        };

        const filtered = prevChannels.filter(c => c.id.toString() !== channelId);
        return [updated, ...filtered];
      });
    };

    const handleGroupMemberAdded = (data: { groupId: string; member: any; addedByUserId: string }) => {
      if (data.groupId?.toString() === activeChannel?.toString()) {
        setGroupMembers(prev => {
          if (prev.find(m => m.UserId?.toString() === data.member?.UserId?.toString())) return prev;
          return [...prev, data.member];
        });
      }
      getChannels().then(ch => setChannels(ch));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('new_message', handleNewMessage);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('group_member_added', handleGroupMemberAdded);
    socket.on('reaction', handleNewMessage);

    if (activeChannel) {
      socket.emit('join_channel', activeChannel);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('group_member_added', handleGroupMemberAdded);
      socket.off('reaction', handleNewMessage);
      if (activeChannel) {
        socket.emit('leave_channel', activeChannel);
      }
    };
  }, [activeChannel, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    if (!inputText.trim() && !pendingAttachment) return;
    if (!activeChannel) return;

    setIsSending(true);
    const content = inputText;
    setInputText('');
    const attachment = pendingAttachment ?? undefined;
    setPendingAttachment(null);

    const tempId = 'temp_' + Math.random().toString();
    const tempMessage: ChatMessage = {
      id: tempId,
      senderId: user?.id || 'me',
      senderName: user?.name || 'Me',
      content,
      attachment,
      timestamp: new Date().toISOString(),
      isSelf: true
    };
    setMessages(prev => [...prev, tempMessage]);

    // Optimistically update conversation sidebar preview and move to top
    setChannels(prevChannels => {
      const existingIndex = prevChannels.findIndex(c => c.id.toString() === activeChannel.toString());
      if (existingIndex === -1) return prevChannels;

      const target = prevChannels[existingIndex];
      const updated: Channel = {
        ...target,
        lastMessage: content || (attachment ? attachment.name : 'Attachment'),
        lastMessageTime: new Date().toISOString(),
        lastMessageType: attachment ? (attachment.type as any) : 'text',
        lastMessageSenderId: user?.id,
        unreadCount: 0
      };

      const filtered = prevChannels.filter(c => c.id.toString() !== activeChannel.toString());
      return [updated, ...filtered];
    });

    playSendSound();

    try {
      await createMessage(activeChannel, content, attachment);
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error('Message failed to send.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannel) return;
    setShowReactionPickerId(null);
    try {
      await toggleReaction(activeChannel, messageId, emoji);
    } catch (err) {
      toast.error('Failed to add reaction');
    }
  };

  const handleStartChannelMeeting = async () => {
    if (!activeChannel) return;
    setIsStartingMeeting(true);
    try {
      const meeting = await startInstantMeeting({ type: 'channel', channelId: activeChannel });
      if (meeting.meetingLink) {
        const content = `Join my meeting here: ${meeting.meetingLink}`;
        const tempId = Math.random().toString();
        setMessages(prev => [...prev, {
          id: tempId,
          senderId: user?.id || 'me',
          senderName: user?.name || 'Me',
          content,
          timestamp: new Date().toISOString(),
          isSelf: true
        }]);
        await createMessage(activeChannel, content, null);
        const link = meeting.meetingLink;
        const match = link.match(/(?:ems:\/\/|https?:\/\/[^\/]+\/?)(?:meeting|meeting\/)([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          navigate(`/meeting/${match[1]}`);
        } else {
          window.open(link, '_blank');
        }
      }
    } catch (error) {
      console.error('Failed to start channel meeting', error);
      toast.error('Failed to start meeting.');
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedChannels = filteredChannels.reduce((acc, channel) => {
    if (!acc[channel.type]) acc[channel.type] = [];
    acc[channel.type].push(channel);
    return acc;
  }, {} as Record<string, Channel[]>);

  const renderChannelIcon = (type: string) => {
    const cls = `w-4 h-4 ${getChannelTypeColor(type)}`;
    if (type === 'Private') return <Lock className={cls} />;
    if (type === 'Announcement') return <Megaphone className={cls} />;
    if (type === 'Direct') return <Users className={cls} />;
    return <Hash className={cls} />;
  };
  const activeChannelData = channels.find(c => c.id === activeChannel);
  const activeChannelName = activeChannelData?.name || '';

  const ChannelSidebar = () => (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80">
      {/* Sidebar Header */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-sm tracking-tight">Messages</h2>
              <p className="text-[10px] font-semibold text-slate-400">Enterprise Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/60 rounded-full border border-slate-700/50">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-[10px] font-bold text-slate-300">{channels.length}</span>
          </div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search channels & DMs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 text-xs text-slate-200 pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 outline-none focus:border-indigo-500 focus:bg-slate-900/90 transition-all placeholder:text-slate-500 font-medium"
          />
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-5 custom-scrollbar">
        {['Direct', 'Public', 'Project', 'Announcement', 'Private'].map((type) => (
          (groupedChannels[type] && groupedChannels[type].length > 0 || type === 'Private') && (
            <div key={type}>
              <div className="flex items-center justify-between px-3 mb-2">
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  {type === 'Direct' ? 'Direct Messages' : type === 'Private' ? 'Private Groups' : `${type} Channels`}
                </h3>
                {type === 'Private' && (
                  <div className="flex items-center gap-2 text-indigo-400">
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (allUsersList.length === 0) {
                          getAllUsersList().then(users => setAllUsersList(users || [])).catch(() => {});
                        }
                        setShowCreateGroupModal(true); 
                      }}
                      className="hover:text-indigo-300 transition-colors text-xs font-extrabold cursor-pointer"
                      title="Create Group"
                    >
                      + Create
                    </button>
                    <span className="text-[9px] opacity-30">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowJoinGroupModal(true); }}
                      className="hover:text-indigo-300 transition-colors text-[10px] font-bold cursor-pointer"
                      title="Join with Code"
                    >
                      Join Code
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                {groupedChannels[type] && groupedChannels[type].map(channel => {
                  const isActive = activeChannel === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setActiveChannel(channel.id);
                        setChannels(prev => prev.map(c => c.id.toString() === channel.id.toString() ? { ...c, unreadCount: 0 } : c));
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/20 text-white font-extrabold border-l-4 border-indigo-500 shadow-2xs pl-2.5'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {channel.type === 'Direct' ? (
                          <Avatar name={channel.name} avatarUrl={allUsersList.find(u => u.name === channel.name)?.avatarUrl} size="sm" />
                        ) : (
                          <span className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-900 text-slate-400'}`}>
                            {renderChannelIcon(channel.type)}
                          </span>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-xs tracking-tight font-semibold text-slate-200">{channel.name}</span>
                            {channel.lastMessageTime && (
                              <span className="text-[10px] text-slate-400 shrink-0">{formatConversationTime(channel.lastMessageTime)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="text-[11px] text-slate-400 truncate max-w-[130px]">
                              {renderLastMessagePreview(channel)}
                            </p>
                            {channel.unreadCount > 0 && (
                              <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-indigo-500 text-white text-[9px] font-extrabold shadow-xs shadow-indigo-500/50">
                                {channel.unreadCount > 9 ? '9+' : channel.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ))}
        {filteredChannels.length === 0 && (
          <div className="py-8 flex flex-col items-center justify-center text-slate-500">
            <Search size={24} className="mb-2 opacity-40" />
            <p className="text-xs font-semibold">No channels found</p>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="shrink-0 p-3 m-2 bg-slate-900/80 rounded-2xl border border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white bg-gradient-to-br ${getAvatarColor(user?.name || '')} shadow-xs`}>
              {getInitials(user?.name) || 'ME'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">{user?.name || 'Me'}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                {isConnected ? <><Wifi size={10} className="text-emerald-400" /> Online</> : <><WifiOff size={10} className="text-rose-400" /> Offline</>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-[calc(100vh-7.5rem)] rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 animate-fade-in bg-white">
      {/* Desktop Sidebar */}
      <div className="w-68 flex flex-col hidden md:flex shrink-0">
        <ChannelSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 shadow-2xl">
            <ChannelSidebar />
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/60 relative">

        {/* Header */}
        <div className="h-16 border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 bg-white shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <Hash size={18} />
            </button>
            {activeChannelData && (
              activeChannelData.type === 'Direct' ? (
                <Avatar name={activeChannelName} avatarUrl={allUsersList.find(u => u.name === activeChannelName)?.avatarUrl} size="md" />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-indigo-400 flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
                  {renderChannelIcon(activeChannelData.type)}
                </div>
              )
            )}
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base truncate flex items-center gap-2">
                {activeChannel ? activeChannelName : 'Select a channel'}
              </h3>
              {activeChannel && (
                <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Channel · {messages.length} message{messages.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isConnected && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-200 animate-pulse">
                <AlertCircle size={14} /> Reconnecting
              </div>
            )}
            {activeChannel && (
              <>
                <button
                  onClick={() => setShowSearchPane(!showSearchPane)}
                  className={`p-2.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    showSearchPane ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Search Chat"
                >
                  <Search size={16} />
                </button>
                {activeChannel && !activeChannel.startsWith('dm_') && (
                  <button
                    onClick={() => { setShowGroupSettingsModal(true); loadGroupSettings(); }}
                    className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all shrink-0 cursor-pointer"
                    title="Group settings & Members"
                  >
                    <Users size={16} />
                  </button>
                )}
                <button
                  onClick={handleStartChannelMeeting}
                  disabled={isStartingMeeting}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-500/20 transition-all hover:scale-102 active:scale-98 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Phone size={14} />
                  {isStartingMeeting ? 'Starting…' : 'Start Call'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-500 border border-indigo-100 flex items-center justify-center shadow-xs">
                <MessageCircle size={32} />
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-slate-800">No messages in this chat yet</p>
                <p className="text-xs text-slate-400 mt-1">Start the conversation by sending a message below 👋</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const showName = i === 0 || messages[i - 1].senderId !== msg.senderId;
            const showTime = i === messages.length - 1 || messages[i + 1].senderId !== msg.senderId;
            const isTemp = msg.id.startsWith('temp_');

            return (
              <div key={msg.id} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'} group w-full ${showName ? 'mt-4' : 'mt-1'}`}>
                {/* Sender name + avatar */}
                {showName && !msg.isSelf && (
                  <div className="flex items-center gap-2 mb-1.5 ml-1">
                    <Avatar 
                      name={msg.senderName} 
                      avatarUrl={allUsersList.find(u => u.name === msg.senderName)?.avatarUrl} 
                      size="sm" 
                    />
                    <span className="text-xs font-bold text-slate-700">{msg.senderName}</span>
                  </div>
                )}

                <div className={`flex items-end gap-2.5 ${msg.isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Self avatar */}
                  {showName && msg.isSelf && (
                    <Avatar 
                      name={user?.name || 'ME'} 
                      avatarUrl={user?.avatarUrl} 
                      size="sm" 
                    />
                  )}
                  {!showName && <div className="w-7 shrink-0" />}

                  <div className="flex flex-col gap-1">
                    {/* Bubble */}
                    <div className={`max-w-[460px] px-4 py-3 text-sm leading-relaxed break-words transition-all ${
                      isTemp ? 'opacity-60' : 'opacity-100'
                    } ${
                      msg.isSelf
                        ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-xs shadow-md shadow-indigo-500/15'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-2xl rounded-tl-xs shadow-2xs'
                    }`}>
                      {msg.isPinned && (
                        <div className="flex items-center gap-1 text-[9px] font-extrabold opacity-75 mb-1.5 uppercase tracking-wider">
                          📌 Pinned Message
                        </div>
                      )}
                      {msg.attachment && (
                        <div className="mb-2">
                          {msg.attachment.type === 'image' ? (
                            <button
                              type="button"
                              onClick={() => msg.attachment && setPreviewAttachment(msg.attachment)}
                              className="block relative group/img w-full text-left cursor-pointer"
                            >
                              <img src={msg.attachment.url} alt="Attachment" className="max-w-full h-auto rounded-xl max-h-48 object-cover transition-opacity group-hover/img:opacity-90" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <span className="bg-black/60 text-white text-xs px-2.5 py-1 rounded-lg font-medium">Click to view</span>
                              </div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => msg.attachment && setPreviewAttachment(msg.attachment)}
                              className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl transition-colors cursor-pointer ${msg.isSelf ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'}`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${msg.isSelf ? 'bg-white/20' : 'bg-indigo-50'}`}>
                                <File size={14} className={msg.isSelf ? 'text-white' : 'text-indigo-500'} />
                              </div>
                              <div className="min-w-0">
                                <span className="truncate text-xs font-bold block">{msg.attachment.name}</span>
                                <span className="text-[10px] opacity-70">{msg.attachment.size}</span>
                              </div>
                            </button>
                          )}
                        </div>
                      )}
                      {msg.content && (
                        <div className="flex flex-col gap-2">
                          {msg.content.match(/(?:ems:\/\/meeting\/|https?:\/\/[^\/]+\/meeting\/)([a-zA-Z0-9_-]+)/) ? (
                            <div className="bg-slate-900/90 p-4 rounded-2xl border border-indigo-500/30 text-white space-y-3 shadow-lg">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                                  <Video size={16} />
                                </div>
                                <div>
                                  <p className="text-xs font-extrabold text-white tracking-wide">Video Meeting Room</p>
                                  <p className="text-[10px] text-slate-300">Click below to join the video conference</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const match = msg.content.match(/(?:ems:\/\/meeting\/|https?:\/\/[^\/]+\/meeting\/)([a-zA-Z0-9_-]+)/);
                                  if (match?.[1]) navigate(`/meeting/${match[1]}`);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
                              >
                                <Video size={15} /> Join Meeting Now
                              </button>
                            </div>
                          ) : (
                            renderFormattedMessage(msg.content)
                          )}
                        </div>
                      )}
                      {isTemp && <span className="ml-2 text-[10px] opacity-60 italic">Sending…</span>}
                    </div>

                    {/* Reactions */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                          const hasReacted = userIds.includes(user?.id?.toString() || '');
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all hover:scale-105 cursor-pointer ${
                                hasReacted
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-bold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {emoji} <span className="font-bold">{userIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Timestamp */}
                    {showTime && (
                      <span className={`text-[10px] text-slate-400 font-medium px-1 ${msg.isSelf ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.timestamp)}
                      </span>
                    )}
                  </div>

                  {/* Action triggers on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center flex items-center gap-1 bg-white p-1 rounded-xl shadow-xs border border-slate-200 relative">
                    <button
                      onClick={() => handlePinToggle(msg.id)}
                      className={`p-1 text-xs rounded hover:bg-slate-100 transition-all cursor-pointer ${msg.isPinned ? 'grayscale-0' : 'grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}
                      title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                    >
                      📌
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(msg.id, true)}
                      className="p-1 text-xs rounded hover:bg-rose-50 hover:text-rose-600 transition-all opacity-40 hover:opacity-100 cursor-pointer"
                      title="Delete message"
                    >
                      🗑️
                    </button>
                    <button
                      onClick={() => setShowReactionPickerId(showReactionPickerId === msg.id ? null : msg.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                      title="Add reaction"
                    >
                      <Smile size={14} />
                    </button>

                    {showReactionPickerId === msg.id && (
                      <div className={`absolute z-40 bottom-full mb-2 ${msg.isSelf ? 'right-0' : 'left-0'}`}>
                        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden" style={{ width: '300px', height: '350px' }}>
                          <EmojiPicker
                            width="100%"
                            height="100%"
                            onEmojiClick={(e) => handleToggleReaction(msg.id, e.emoji)}
                            skinTonesDisabled
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-100">
          {/* Pending attachment preview */}
          {pendingAttachment && (
            <div className="mb-2.5 inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl border border-indigo-100 shadow-sm">
              {pendingAttachment.type === 'image' ? <ImageIcon size={14} /> : <File size={14} />}
              <span className="text-xs font-semibold truncate max-w-[180px]">{pendingAttachment.name}</span>
              <button onClick={() => setPendingAttachment(null)} className="ml-1 p-0.5 rounded-md hover:bg-indigo-100 transition-colors">
                <X size={13} />
              </button>
            </div>
          )}

          {/* File Uploader Popover */}
          {showUploader && (
            <div className="absolute bottom-20 left-4 z-20">
              <FileUploader
                onUploadComplete={(data) => {
                  setPendingAttachment(data);
                  setShowUploader(false);
                }}
                onCancel={() => setShowUploader(false)}
              />
            </div>
          )}

          {/* Input Row */}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Attach */}
            <button
              type="button"
              onClick={() => setShowUploader(!showUploader)}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${showUploader ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`}
              title="Attach File"
            >
              <Paperclip size={18} />
            </button>

            {/* Emoji */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2.5 rounded-xl transition-all ${showEmojiPicker ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`}
                title="Add Emoji"
              >
                <SmilePlus size={18} />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-3 z-30 shadow-2xl rounded-2xl overflow-hidden border border-slate-100" style={{ width: '300px', height: '400px' }}>
                  <EmojiPicker
                    width="100%"
                    height="100%"
                    onEmojiClick={(e) => {
                      setInputText(prev => prev + e.emoji);
                      setShowEmojiPicker(false);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Text input */}
            <div className={`flex-1 bg-slate-50 border rounded-2xl overflow-hidden transition-all duration-200 ${
              inputText ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100'
            }`}>
              <textarea
                ref={inputRef as any}
                rows={1}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if ((inputText.trim() || pendingAttachment) && !isSending) {
                      handleSend(e);
                    }
                  }
                }}
                placeholder={activeChannel ? `Message #${activeChannelName} (Shift+Enter for line break)` : 'Select a channel first…'}
                disabled={!activeChannel}
                className="w-full bg-transparent px-4 py-2.5 outline-none text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed resize-none max-h-32 leading-relaxed"
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !pendingAttachment) || isSending}
              className={`p-2.5 rounded-xl text-white transition-all shrink-0 ${
                (inputText.trim() || pendingAttachment) && !isSending
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send size={18} className={isSending ? 'animate-pulse' : ''} />
            </button>
          </form>
          </div>
      </div>

      {/* Search Pane */}
      {showSearchPane && (
        <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <h3 className="font-bold text-slate-800 text-sm">Search Messages & Files</h3>
            <button onClick={() => setShowSearchPane(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSearchAction} className="p-3 bg-white border-b border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="Search keyword..."
              value={searchQueryLocal}
              onChange={e => setSearchQueryLocal(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 text-xs px-3 py-1.5 rounded-xl outline-none focus:border-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-indigo-700">
              Go
            </button>
          </form>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {searching ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : searchResults ? (
              <div className="space-y-4">
                {searchResults.messages && searchResults.messages.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Messages</h4>
                    <div className="space-y-2">
                      {searchResults.messages.map((m: any) => (
                        <div key={m.Id} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm text-xs">
                          <p className="font-semibold text-slate-700">{m.SenderName || 'User'}</p>
                          <p className="text-slate-600 mt-0.5">{m.Content}</p>
                          <span className="text-[9px] text-slate-400 block mt-1">{new Date(m.CreatedDate).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {searchResults.files && searchResults.files.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Files & Attachments</h4>
                    <div className="space-y-2">
                      {searchResults.files.map((f: any) => (
                        <a key={f.Id} href={f.FileUrl} target="_blank" rel="noreferrer" className="block bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm text-xs hover:border-indigo-500">
                          <p className="font-semibold text-slate-700 truncate">{f.FileName}</p>
                          <span className="text-[9px] text-indigo-600 block mt-1">Download ({Math.round(f.FileSize / 1024)} KB)</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(!searchResults.messages || searchResults.messages.length === 0) && (!searchResults.files || searchResults.files.length === 0) && (
                  <p className="text-center text-xs text-slate-400 py-8">No results found</p>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 py-8">Enter a query to search chat content</p>
            )}
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      <Modal isOpen={showCreateGroupModal} onClose={() => setShowCreateGroupModal(false)} title="Create New Channel">
        <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Group Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Design Team"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-2.5 rounded-xl outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
            <textarea
              placeholder="What this channel is about..."
              value={groupDescription}
              onChange={e => setGroupDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-2.5 rounded-xl outline-none focus:border-indigo-500 h-20 resize-none"
            />
          </div>

          {/* Add Members Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Add Initial Members ({selectedNewGroupMembers.length} selected)
              </label>
              {selectedNewGroupMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedNewGroupMembers([])}
                  className="text-[10px] text-indigo-600 font-bold hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Selected Member Chips */}
            {selectedNewGroupMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {selectedNewGroupMembers.map((id) => {
                  const u = allUsersList.find(user => String(user.id) === String(id));
                  return (
                    <span key={id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-xs px-2.5 py-1 rounded-lg font-medium">
                      {u ? u.name : `User ${id}`}
                      <button
                        type="button"
                        onClick={() => setSelectedNewGroupMembers(prev => prev.filter(mId => String(mId) !== String(id)))}
                        className="hover:text-indigo-950 font-bold ml-1 text-sm leading-none"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Member Search Bar */}
            <input
              type="text"
              placeholder="Search employees to add..."
              value={memberSearchQuery}
              onChange={e => setMemberSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-indigo-500 mb-2"
            />

            {/* Scrollable Member Checklist */}
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/40 space-y-1 custom-scrollbar">
              {allUsersList.filter(u => 
                !memberSearchQuery.trim() || 
                u.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                u.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
              ).map((u) => {
                const isSelected = selectedNewGroupMembers.some(id => String(id) === String(u.id));
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      isSelected ? 'bg-indigo-50/80 text-indigo-900 font-semibold border border-indigo-200/60' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 text-xs truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedNewGroupMembers(prev => [...prev, u.id]);
                        } else {
                          setSelectedNewGroupMembers(prev => prev.filter(id => String(id) !== String(u.id)));
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                    />
                  </label>
                );
              })}
              {allUsersList.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-400 font-medium">
                  Loading employee directory...
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateGroupModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 shadow-sm"
            >
              Create Group
            </button>
          </div>
        </form>
      </Modal>

      {/* Join Group Modal */}
      <Modal isOpen={showJoinGroupModal} onClose={() => setShowJoinGroupModal(false)} title="Join Channel via Invite Link">
        <form onSubmit={handleJoinGroupSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invite Code</label>
            <input
              type="text"
              required
              placeholder="Enter 16-character code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-2.5 rounded-xl outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowJoinGroupModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700"
            >
              Join Channel
            </button>
          </div>
        </form>
      </Modal>

      {/* Group Settings & Members Modal */}
      <Modal isOpen={showGroupSettingsModal} onClose={() => setShowGroupSettingsModal(false)} title="Channel Settings & Members">
        <div className="space-y-6">
          {/* Invite Link Generation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Invite Code</h4>
            {inviteLinkCode ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={inviteLinkCode}
                  className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-lg flex-1 outline-none text-center font-mono font-bold"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteLinkCode); toast.success('Copied!'); }}
                  className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700"
                >
                  Copy
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateInvite}
                className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Generate Invite Link Code
              </button>
            )}
          </div>

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Channel Members</h4>
              <div className="relative">
                <button
                  onClick={() => setShowAddMemberDropdown(!showAddMemberDropdown)}
                  className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700"
                >
                  + Add Member
                </button>
                {showAddMemberDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {allUsersList.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleAddGroupMember(u.id)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 truncate"
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-100 rounded-xl px-3 bg-white">
              {groupMembers.map(member => (
                <div key={member.UserId} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{member.name || `User ${member.UserId}`}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 ml-2 font-bold uppercase">{member.roleName}</span>
                  </div>
                  {member.roleName !== 'Owner' && (
                    <button
                      onClick={() => handleRemoveGroupMember(member.UserId)}
                      className="text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Leave Button */}
          <div className="pt-2 flex justify-between">
            <button
              onClick={handleLeaveGroupAction}
              className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-xl"
            >
              Leave Channel
            </button>
            <button
              onClick={() => setShowGroupSettingsModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
        title={previewAttachment ? previewAttachment.name : 'Attachment preview'}
        size={previewAttachment?.type === 'image' ? 'lg' : 'md'}
      >
        {previewAttachment && (
          <div className="space-y-4">
            {previewAttachment.type === 'image' ? (
              <img src={previewAttachment.url} alt={previewAttachment.name} className="w-full rounded-2xl object-contain max-h-[70vh]" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 text-center">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                  <File size={32} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{previewAttachment.name}</p>
                  <p className="text-sm text-slate-500">{previewAttachment.size}</p>
                </div>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
                >
                  Open file in new tab
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      <MediaLightboxModal 
        isOpen={!!previewAttachment} 
        onClose={() => setPreviewAttachment(null)} 
        attachment={previewAttachment} 
      />
    </div>
  );
};