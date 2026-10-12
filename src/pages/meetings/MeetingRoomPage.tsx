import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMeetingStore } from '../../store/meetingStore';

export const MeetingRoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const activeMeetingId = useMeetingStore((state) => state.activeMeetingId);
  const joinMeeting = useMeetingStore((state) => state.joinMeeting);
  const maximizeMeeting = useMeetingStore((state) => state.maximizeMeeting);

  useEffect(() => {
    if (id) {
      if (activeMeetingId !== id) {
        joinMeeting(id);
      } else {
        maximizeMeeting();
      }
    }
  }, [id, activeMeetingId, joinMeeting, maximizeMeeting]);

  return (
    <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-semibold tracking-wide">
          Loading Meeting Experience...
        </span>
      </div>
    </div>
  );
};
