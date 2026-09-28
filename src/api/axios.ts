import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { toast } from '../utils/toast';

const DEV_API_URL = import.meta.env.VITE_DEV_API_URL || 'http://localhost:5000';
const resolvedBaseURL = import.meta.env.VITE_API_URL || DEV_API_URL;

const api = axios.create({
  baseURL: resolvedBaseURL,
  withCredentials: true,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = useAuthStore.getState();
    if (state.accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${state.accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data as any;
    
    // Extract standard error message if available
    const errorMessage = data?.error?.message || data?.message || error.message || 'An unexpected error occurred';

    if (status === 401) {
      const configUrl = error.config?.url || '';
      const isAuthEndpoint = configUrl.includes('/auth/login') || 
                             configUrl.includes('/auth/2fa') || 
                             configUrl.includes('/auth/forgot-password') || 
                             configUrl.includes('/auth/reset-password');
      
      if (!isAuthEndpoint) {
        const wasAuthenticated = useAuthStore.getState().isAuthenticated;
        if (wasAuthenticated) {
          toast.error('Session expired (1 day limit reached). Please log in again.');
          useAuthStore.getState().logout();
          if (window.location.hash !== '#/login') {
            window.location.hash = '#/login';
          }
        }
      }
    } else if (status === 403) {
      // Handle Forbidden
      toast.error('You do not have permission to perform this action.');
    } else if (status === 500) {
      // Handle Internal Server Error globally
      toast.error('Server error. Our team has been notified.');
      console.error('Critical API Error:', error);
    } else if (status === 503) {
      // Handle Service Unavailable
      toast.error('Service Unavailable (503). Ensure backend server is running on http://localhost:5000.');
    } else if (error.code === 'ECONNABORTED') {
      // Handle Timeout
      toast.error('Request timed out. Please check your internet connection.');
    } else if (!error.response) {
      // Handle Network Error (Server Down / CORS)
      toast.error('Network error. Cannot connect to backend at ' + resolvedBaseURL);
    }

    return Promise.reject(error);
  }
);

export default api;
