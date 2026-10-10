import { io, Socket } from 'socket.io-client';

const getAuthToken = () => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.state?.accessToken || '';
    }
  } catch (e) {}
  return '';
};

export const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
  path: '/ws/chat',
  autoConnect: true,
  withCredentials: true,
  auth: (cb) => {
    cb({ token: getAuthToken() });
  }
});
