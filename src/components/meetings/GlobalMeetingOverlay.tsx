import React, { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { useMeetingStore } from '../../store/meetingStore';

const LiveKitMeetingRoom = lazy(() =>
  import('../../pages/meetings/LiveKitMeetingRoom').then((m) => ({ default: m.LiveKitMeetingRoom }))
);

export const GlobalMeetingOverlay: React.FC = () => {
  const { activeMeetingId, isMinimized } = useMeetingStore();
  const location = useLocation();

  if (!activeMeetingId) {
    return null;
  }

  // When user is directly on the meeting route, MeetingRoomPage is actively rendering the full MeetingRoom
  const isMeetingRoute =
    location.pathname.startsWith('/meeting/') || location.pathname.startsWith('/meetings/');

  if (!activeMeetingId || isMeetingRoute) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-200 ${
        showFullView ? 'pointer-events-auto bg-gray-950' : 'pointer-events-none'
      }`}
    >
      <Suspense fallback={<div />}>
        <LiveKitMeetingRoom roomId={activeMeetingId} isFullPage={showFullView} />
      </Suspense>
    </div>
  );
};
