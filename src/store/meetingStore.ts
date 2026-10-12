import { create } from 'zustand';

export type MeetingConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface MeetingState {
  activeMeetingId: string | null;
  activeMeetingTitle: string;
  isHost: boolean;
  isMinimized: boolean;
  isPiPCollapsed: boolean;
  connectionStatus: MeetingConnectionStatus;
  activeSpeaker: string | null;
  participantCount: number;
  isMuted: boolean;
  isCameraEnabled: boolean;
  isPushToTalkActive: boolean;

  joinMeeting: (id: string, title?: string, isHost?: boolean) => void;
  leaveMeeting: () => void;
  minimizeMeeting: () => void;
  maximizeMeeting: () => void;
  setPiPCollapsed: (collapsed: boolean) => void;
  setConnectionStatus: (status: MeetingConnectionStatus) => void;
  setActiveSpeaker: (speaker: string | null) => void;
  setParticipantCount: (count: number) => void;
  setIsHost: (isHost: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setIsCameraEnabled: (enabled: boolean) => void;
  setIsPushToTalkActive: (active: boolean) => void;
}

// Restore active meeting ID if previously in a session
const initialMeetingId = (() => {
  try {
    return sessionStorage.getItem('ems_active_meeting_id') || null;
  } catch {
    return null;
  }
})();

const initialMeetingTitle = (() => {
  try {
    return sessionStorage.getItem('ems_active_meeting_title') || 'Active Meeting';
  } catch {
    return 'Active Meeting';
  }
})();

export const useMeetingStore = create<MeetingState>((set) => ({
  activeMeetingId: initialMeetingId,
  activeMeetingTitle: initialMeetingTitle,
  isHost: false,
  isMinimized: false,
  isPiPCollapsed: false,
  connectionStatus: initialMeetingId ? 'connecting' : 'disconnected',
  activeSpeaker: null,
  participantCount: 1,
  isMuted: false,
  isCameraEnabled: false,
  isPushToTalkActive: false,

  joinMeeting: (id: string, title?: string, isHost = false) => {
    const meetingTitle = title || `Meeting: ${id}`;
    try {
      sessionStorage.setItem('ems_active_meeting_id', id);
      sessionStorage.setItem('ems_active_meeting_title', meetingTitle);
    } catch (e) {
      console.warn('SessionStorage unavailable for meeting persistence:', e);
    }
    set({
      activeMeetingId: id,
      activeMeetingTitle: meetingTitle,
      isHost,
      isMinimized: false,
      isPiPCollapsed: false,
      connectionStatus: 'connecting',
    });
  },

  leaveMeeting: () => {
    try {
      sessionStorage.removeItem('ems_active_meeting_id');
      sessionStorage.removeItem('ems_active_meeting_title');
    } catch (e) {
      console.warn('SessionStorage cleanup error:', e);
    }
    set({
      activeMeetingId: null,
      activeMeetingTitle: 'Active Meeting',
      isHost: false,
      isMinimized: false,
      isPiPCollapsed: false,
      connectionStatus: 'disconnected',
      activeSpeaker: null,
      participantCount: 1,
      isMuted: false,
      isCameraEnabled: false,
      isPushToTalkActive: false,
    });
  },

  minimizeMeeting: () => set({ isMinimized: true }),
  maximizeMeeting: () => set({ isMinimized: false }),
  setPiPCollapsed: (collapsed: boolean) => set({ isPiPCollapsed: collapsed }),
  setConnectionStatus: (status: MeetingConnectionStatus) => set({ connectionStatus: status }),
  setActiveSpeaker: (speaker: string | null) => set({ activeSpeaker: speaker }),
  setParticipantCount: (count: number) => set({ participantCount: count }),
  setIsHost: (isHost: boolean) => set({ isHost }),
  setIsMuted: (muted: boolean) => set({ isMuted: muted }),
  setIsCameraEnabled: (enabled: boolean) => set({ isCameraEnabled: enabled }),
  setIsPushToTalkActive: (active: boolean) => set({ isPushToTalkActive: active }),
}));
