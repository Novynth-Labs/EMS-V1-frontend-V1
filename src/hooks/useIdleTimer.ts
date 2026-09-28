import { useEffect, useRef, useCallback } from 'react';

interface UseIdleTimerOptions {
  /** How many milliseconds of inactivity before the warn callback fires */
  warnAfterMs?: number;
  /** How many milliseconds of inactivity before the expire callback fires */
  expireAfterMs?: number;
  /** Called when user is about to be logged out (show warning dialog) */
  onWarn: () => void;
  /** Called when session has fully expired (do logout + redirect) */
  onExpire: () => void;
  /** Set to false to disable the timer entirely */
  enabled?: boolean;
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

/**
 * FR-AUTH-004 — Global idle timer.
 *
 * Tracks user activity. After `warnAfterMs` ms of inactivity, calls `onWarn`.
 * After `expireAfterMs` ms of inactivity, calls `onExpire`.
 *
 * Resets on any user interaction event.
 */
export const useIdleTimer = ({
  warnAfterMs  = 23 * 60 * 60 * 1000,  // 23 hours → show warning dialog
  expireAfterMs = 24 * 60 * 60 * 1000, // 24 hours (1 day) → force logout
  onWarn,
  onExpire,
  enabled = true,
}: UseIdleTimerOptions) => {
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef      = useRef(false);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    warnedRef.current = false;

    warnTimerRef.current = setTimeout(() => {
      warnedRef.current = true;
      onWarn();
    }, warnAfterMs);

    expireTimerRef.current = setTimeout(() => {
      onExpire();
    }, expireAfterMs);
  }, [enabled, warnAfterMs, expireAfterMs, onWarn, onExpire, clearTimers]);

  useEffect(() => {
    if (!enabled) return;

    // Start timers on mount
    resetTimers();

    const handleActivity = () => {
      // Only reset if not in the warn phase (let SessionExpiryDialog handle it)
      if (!warnedRef.current) resetTimers();
    };

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, handleActivity)
      );
    };
  }, [enabled, resetTimers, clearTimers]);

  /** Call this when the user explicitly continues the session from the warning dialog */
  const continueSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return { continueSession };
};
