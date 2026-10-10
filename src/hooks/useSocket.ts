import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { playNotificationSound } from '../utils/sound';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { user, accessToken } = useAuthStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (!user) return;

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const socketUrl = baseUrl.replace(/\/api$/, '');

    socketRef.current = io(socketUrl, {
      path: '/ws/chat',
      withCredentials: true,
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current.on('connect', () => {
      console.log('Global Socket connected');
      socketRef.current?.emit('identify', user.id);
    });

    // Listen for system notifications
    socketRef.current.on('system_notification', (notification) => {
      console.log('Received real-time system notification:', notification);
      
      // Play audio chime
      playNotificationSound();

      addToast({
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        link: notification.link,
      });

      // Dispatch global window event so Topbar and NotificationInbox update instantly
      window.dispatchEvent(new CustomEvent('ems:notification', { detail: notification }));
      
      // Trigger native notification API if permissions granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.message });
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('Global Socket disconnected');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, addToast]);

  return socketRef.current;
};
