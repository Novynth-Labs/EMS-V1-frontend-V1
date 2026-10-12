import api from './axios';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  meetingLink?: string;
  notes?: string;
  organizerId: string;
  organizer: { id: string; name: string; email: string };
  participants: {
    meetingId: string;
    userId: string;
    status: 'invited' | 'accepted' | 'declined' | 'tentative';
    user: { id: string; name: string; email: string };
  }[];
}

export const getMeetingNotes = async (meetingId: string) => {
  const response = await api.get(`/meetings/${meetingId}/notes`);
  return response.data.data;
};

export const saveMeetingNotes = async (meetingId: string, notes: string) => {
  const response = await api.post(`/meetings/${meetingId}/notes`, { notes });
  return response.data;
};

export const getMyMeetings = async (): Promise<Meeting[]> => {
  const response = await api.get('/meetings');
  return response.data.data;
};

export const createMeeting = async (data: {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  meetingLink?: string;
  participants: string[];
}) => {
  const response = await api.post('/meetings', data);
  return response.data.data;
};

export const updateParticipantStatus = async (meetingId: string, status: 'invited' | 'accepted' | 'declined' | 'tentative') => {
  const response = await api.patch(`/meetings/${meetingId}/participant/status`, { status });
  return response.data;
};

export const updateMeetingStatus = async (id: string, status: string) => {
  const response = await api.patch(`/meetings/${id}/status`, { status });
  return response.data;
};

export const uploadRecording = async (id: string, blob: Blob) => {
  const formData = new FormData();
  formData.append('file', blob, `meeting_${id}_recording.webm`);
  const response = await api.post(`/meetings/${id}/recording`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const startInstantMeeting = async (data: { type: 'team_lead' | 'all_hands' | 'channel', channelId?: string }) => {
  const response = await api.post('/meetings/instant', data);
  return response.data.data;
};

export const downloadCalendarInvite = async (id: string) => {
  const response = await api.get(`/meetings/${id}/calendar`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meeting_${id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

export const getMeetingToken = async (id: string) => {
  const response = await api.get(`/meetings/${id}/token`);
  return response.data;
};

