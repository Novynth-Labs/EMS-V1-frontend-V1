import { io, Socket } from 'socket.io-client';

export const getAuthToken = (): string => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.state?.accessToken || '';
    }
  } catch (e) {}
  return '';
};

export const socket: Socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
  path: '/ws/chat',
  autoConnect: true,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  auth: (cb) => {
    cb({ token: getAuthToken() });
  }
});

export const connectSocketWithToken = (token?: string) => {
  const activeToken = token || getAuthToken();
  if (!activeToken) return;
  socket.auth = { token: activeToken };
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
