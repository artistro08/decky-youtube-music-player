import type { PlayerState, WSMessage, WSMessageType } from '../types';
import { getToken } from './apiClient';
import { clearAuthListeners } from './authEvents';

const WS_URL = 'ws://127.0.0.1:26538/api/v1/ws';
const RECONNECT_DELAY_MS = 5000;

type StateListener = (state: Partial<PlayerState>) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: StateListener[] = [];
let destroyed = false;

export const addStateListener = (fn: StateListener): (() => void) => {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
};

export { addAuthListener } from './authEvents';

const notify = (state: Partial<PlayerState>) =>
  listeners.forEach((l) => l(state));

const buildUrl = (): string => {
  const token = getToken();
  return token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
};

export const connect = (): void => {
  if (destroyed) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  socket = new WebSocket(buildUrl());

  socket.onopen = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    notify({ connected: true, authRequired: false });
  };

  socket.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as WSMessage;
      handleMessage(msg);
    } catch {
      // ignore malformed messages
    }
  };

  socket.onclose = () => {
    notify({ connected: false });
    if (!destroyed) {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  };

  socket.onerror = () => {
    socket?.close();
  };
};

export const disconnect = (): void => {
  destroyed = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  socket?.close();
  socket = null;
  listeners = [];
  clearAuthListeners();
};

export const resetAndConnect = (): void => {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  destroyed = false;
  connect();
};

const handleMessage = (msg: WSMessage): void => {
  const type = msg.type as WSMessageType;

  switch (type) {
    case 'PLAYER_INFO': {
      // Only include volume/muted if the server actually sent them.
      // `?? 100` / `?? false` would silently reset to defaults when the field
      // is absent, corrupting whatever the user last set.
      const playerInfo: Partial<PlayerState> = {
        song: msg.song,
        isPlaying: msg.isPlaying ?? false,
        position: msg.position ?? 0,
        repeat: msg.repeat ?? 'NONE',
        shuffle: msg.shuffle ?? false,
        connected: true,
        authRequired: false,
      };
      if (msg.volume !== undefined) playerInfo.volume = msg.volume;
      if (msg.muted !== undefined) playerInfo.muted = msg.muted;
      notify(playerInfo);
      break;
    }
    case 'VIDEO_CHANGED':
      notify({ song: msg.song, position: 0 });
      break;
    case 'PLAYER_STATE_CHANGED':
      notify({ isPlaying: msg.isPlaying ?? false, position: msg.position ?? 0 });
      break;
    case 'POSITION_CHANGED':
      notify({ position: msg.position ?? 0 });
      break;
    case 'VOLUME_CHANGED': {
      const update: Partial<PlayerState> = {};
      if (msg.volume !== undefined) update.volume = msg.volume;
      if (msg.muted !== undefined) update.muted = msg.muted;
      if (Object.keys(update).length > 0) notify(update);
      break;
    }
    case 'REPEAT_CHANGED':
      notify({ repeat: msg.repeat ?? 'NONE' });
      break;
    case 'SHUFFLE_CHANGED':
      notify({ shuffle: msg.shuffle ?? false });
      break;
  }
};
