import axios from 'axios';
import { useAuthStore } from '../store/auth';

// Use environment variable for API URL in production, or proxy in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper to get the correct URL for uploaded assets (images, etc.)
export const getUploadUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}/uploads/${path}`;
};

const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
    isArtist?: boolean;
  }) => api.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  
  me: () => api.get('/auth/me'),
  
  // Magic link authentication
  magicLink: (email: string) =>
    api.post('/auth/magic-link', { email }),
  
  // Get available auth providers
  getProviders: () =>
    api.get('/auth/providers'),
};

// Tracks API
export const tracksApi = {
  getTrending: () => api.get('/tracks/trending'),
  getNew: () => api.get('/tracks/new'),
  getOne: (id: string) => api.get(`/tracks/${id}`),
  like: (id: string) => api.post(`/tracks/${id}/like`),
  getLiked: (page = 1, limit = 20) =>
    api.get(`/tracks/liked/me?page=${page}&limit=${limit}`),
  update: (id: string, data: any) => api.patch(`/tracks/${id}`, data),
  delete: (id: string) => api.delete(`/tracks/${id}`),
};

// Upload API - now using base64 for serverless compatibility
export const uploadApi = {
  track: (data: {
    audio: string;
    audioMimeType: string;
    audioFileName: string;
    title: string;
    genre?: string;
    isPublic?: boolean;
    isExplicit?: boolean;
    coverUrl?: string;
    duration?: number;
  }) => api.post('/upload/track', data),
  
  cover: (data: { image: string; mimeType: string }) =>
    api.post('/upload/cover', data),
  
  avatar: (data: { image: string; mimeType: string }) =>
    api.post('/upload/avatar', data),
    
  getFormats: () => api.get('/upload/formats'),
};

// Genres API
export const genresApi = {
  getAll: () => api.get('/genres'),
  create: (name: string) => api.post('/genres', { name }),
};

// Users API
export const usersApi = {
  getProfile: (username: string) => api.get(`/users/${username}`),
  getTracks: (username: string, page = 1, limit = 20) =>
    api.get(`/users/${username}/tracks?page=${page}&limit=${limit}`),
  follow: (username: string) => api.post(`/users/${username}/follow`),
  updateProfile: (data: any) => api.patch('/users/me', data),
};

// Albums API
export const albumsApi = {
  getOne: (id: string) => api.get(`/albums/${id}`),
  create: (data: any) => api.post('/albums', data),
  update: (id: string, data: any) => api.patch(`/albums/${id}`, data),
  delete: (id: string) => api.delete(`/albums/${id}`),
};

// Playlists API
export const playlistsApi = {
  getOne: (id: string) => api.get(`/playlists/${id}`),
  getUserPlaylists: (username: string) => api.get(`/playlists/user/${username}`),
  create: (data: any) => api.post('/playlists', data),
  addTrack: (playlistId: string, trackId: string) =>
    api.post(`/playlists/${playlistId}/tracks`, { trackId }),
  removeTrack: (playlistId: string, trackId: string) =>
    api.delete(`/playlists/${playlistId}/tracks/${trackId}`),
  update: (id: string, data: any) => api.patch(`/playlists/${id}`, data),
  delete: (id: string) => api.delete(`/playlists/${id}`),
};

// Search API
export const searchApi = {
  search: (query: string, type?: string, limit = 10) =>
    api.get(`/search?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}&limit=${limit}`),
  suggestions: (query: string) =>
    api.get(`/search/suggestions?q=${encodeURIComponent(query)}`),
};

// Stream API
export const streamApi = {
  getStreamUrl: (trackId: string, quality: 'low' | 'medium' | 'high' = 'medium') => {
    // Use full backend URL for streaming (not relative path)
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return `${baseUrl}/api/stream/${trackId}?quality=${quality}`;
  },
  complete: (trackId: string, duration: number) =>
    api.post(`/stream/${trackId}/complete`, { duration }),
  getWaveform: (trackId: string) => api.get(`/stream/${trackId}/waveform`),
};

export default api;
