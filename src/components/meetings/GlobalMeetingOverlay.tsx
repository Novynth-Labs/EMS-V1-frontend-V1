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

  // Determine if the user is currently on the full meeting view route
  const isMeetingRoute =
    (location.pathname.startsWith('/meeting/') || location.pathname.startsWith('/meetings/')) &&
    location.pathname.includes(activeMeetingId);

  // Full view is shown when user is explicitly on the meeting route and has not minimized it
  const showFullView = isMeetingRoute && !isMinimized;

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
