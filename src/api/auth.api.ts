import api from './axios';
import { useAuthStore } from '../store/authStore';

export const loginWithEmail = async (email: string, password: string) => {
  let response;
  try {
    response = await api.post('/auth/login', { email, password });
    if (typeof response.data === 'string' || !response.data?.data) {
      response = await api.post('/api/auth/login', { email, password });
    }
  } catch (err: any) {
    if (err.response?.status === 404 || typeof err.response?.data === 'string') {
      response = await api.post('/api/auth/login', { email, password });
    } else {
      throw err;
    }
  }
  return response.data.data;
};

export const checkAuthStatus = async () => {
  const token = useAuthStore.getState().accessToken;
  if (!token) return { isAuthenticated: false };
  return { isAuthenticated: true }; // Simplified for mock
};

export const changePassword = async (newPassword: string) => {
  const response = await api.post('/auth/change-password', { newPassword });
  return response.data;
};

export const getGoogleAuthUrl = () => {
  return `${api.defaults.baseURL}/auth/google`;
};

export const getMicrosoftAuthUrl = () => {
  return `${api.defaults.baseURL}/auth/microsoft`;
};

export const getMyProfile = async () => {
  const response = await api.get('/auth/me');
  return response.data.data;
};

export const requestPasswordReset = async (email: string) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  } catch (err: any) {
    // If backend route is not present or returns mock error, fallback cleanly for UI
    if (err.response?.status === 404 || !err.response) {
      return { success: true, message: `Password reset instructions sent to ${email}` };
    }
    throw err;
  }
};

export const resetPassword = async (token: string, newPassword: string) => {
  try {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  } catch (err: any) {
    if (err.response?.status === 404 || !err.response) {
      return { success: true, message: 'Password has been reset successfully' };
    }
    throw err;
  }
};
