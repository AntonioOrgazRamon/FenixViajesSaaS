import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadSession = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      if (hadSession && typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (!path.startsWith('/login') && !path.startsWith('/forgot-password') && !path.startsWith('/reset-password')) {
          window.location.assign('/session-expired');
        }
      }
    }
    return Promise.reject(error);
  }
);
