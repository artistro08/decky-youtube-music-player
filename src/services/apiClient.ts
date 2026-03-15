import { toaster } from '@decky/api';
import type { QueueResponse, SearchResultItem, SongInfo } from '../types';
import { notifyAuthRequired } from './authEvents';

const BASE_URL = 'http://127.0.0.1:26538/api/v1';
const TOKEN_KEY = 'ytmusic_api_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

const headers = (): Record<string, string> => {
  const token = getToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

// Returns true on success, false on 401 (triggers auth prompt), throws on other errors
const post = async (path: string, body?: object): Promise<boolean> => {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      notifyAuthRequired();
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const get = async <T>(path: string, signal?: AbortSignal): Promise<T | null> => {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: headers(), signal });
    if (res.status === 401) {
      notifyAuthRequired();
      return null;
    }
    if (res.status === 204) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
};

const del = async (path: string): Promise<boolean> => {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: headers() });
    if (res.status === 401) { notifyAuthRequired(); return false; }
    return true;
  } catch {
    return false;
  }
};

const patch = async (path: string, body: object): Promise<boolean> => {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) { notifyAuthRequired(); return false; }
    return true;
  } catch {
    return false;
  }
};

// Playback controls
export const play = () => post('/play');
export const pause = () => post('/pause');
export const togglePlay = () => post('/toggle-play');
export const next = () => post('/next');
export const previous = () => post('/previous');
export const seekTo = (seconds: number) => post('/seek-to', { seconds });
export const setVolume = (volume: number) => post('/volume', { volume });
export const toggleMute = () => post('/toggle-mute');
export const shuffle = () => post('/shuffle');
export const switchRepeat = (iteration: number) => post('/switch-repeat', { iteration });

// Song & state
export const getSongInfo = async (signal?: AbortSignal): Promise<SongInfo | null> => {
  const info = await get<SongInfo>('/song', signal);
  if (!info) return null;
  // Companion API uses imageSrc; normalise to albumArt for internal use.
  if (!info.albumArt && info.imageSrc) info.albumArt = info.imageSrc;
  return info;
};
export const getVolume = () => get<{ state: number; isMuted: boolean }>('/volume');

// Queue
export const getQueue = () => get<QueueResponse>('/queue');
export const addToQueue = (videoId: string, insertPosition?: string) =>
  post('/queue', { videoId, insertPosition });
export const removeFromQueue = (index: number) => del(`/queue/${index}`);
export const clearQueue = () => del('/queue');
export const setQueueIndex = (index: number) => patch('/queue', { index });

// Search
export const search = async (query: string): Promise<SearchResultItem[]> => {
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        notifyAuthRequired();
      } else {
        toaster.toast({ title: 'Search failed', body: `Status ${res.status}` });
      }
      return [];
    }
    const data = await res.json() as { results?: SearchResultItem[] } | SearchResultItem[];
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch {
    toaster.toast({ title: 'Search error', body: 'Could not reach YouTube Music' });
    return [];
  }
};
