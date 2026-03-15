import { createContext, useContext, useEffect, useReducer, type FC, type ReactNode } from 'react';
import type { PlayerState, SongInfo } from '../types';
import { getSongInfo } from '../services/apiClient';
import { addStateListener, addAuthListener, disconnect, resetAndConnect } from '../services/websocketService';

const defaultState: PlayerState = {
  song: undefined,
  isPlaying: false,
  muted: false,
  position: 0,
  volume: 100,
  repeat: 'NONE',
  shuffle: false,
  connected: false,
  authRequired: false,
};

type Action =
  | { type: 'UPDATE'; payload: Partial<PlayerState> }
  | { type: 'SUPPLEMENT_SONG'; payload: SongInfo };

const reducer = (state: PlayerState, action: Action): PlayerState => {
  if (action.type === 'UPDATE') return { ...state, ...action.payload };
  if (action.type === 'SUPPLEMENT_SONG') {
    const existing = state.song;
    // No existing song — use HTTP data as-is.
    if (!existing) return { ...state, song: action.payload };
    // Stale response for a different video (race condition) — ignore.
    if (existing.videoId !== action.payload.videoId) return state;
    // Same song — merge: HTTP fills in fields WS omitted (e.g. albumArt),
    // but does NOT overwrite fields WS already provided.
    const merged: SongInfo = { ...existing };
    (Object.keys(action.payload) as Array<keyof SongInfo>).forEach((k) => {
      const v = action.payload[k];
      if (v !== undefined && merged[k] === undefined) {
        (merged as Record<string, unknown>)[k] = v;
      }
    });
    return { ...state, song: merged };
  }
  return state;
};

const PlayerContext = createContext<PlayerState>(defaultState);

export const PlayerProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, defaultState);

  useEffect(() => {
    resetAndConnect();
    const removeState = addStateListener((partial) =>
      dispatch({ type: 'UPDATE', payload: partial }),
    );
    const removeAuth = addAuthListener(() =>
      dispatch({ type: 'UPDATE', payload: { authRequired: true } }),
    );
    return () => {
      removeState();
      removeAuth();
      disconnect();
    };
  }, []);

  // Supplement WebSocket song data with HTTP response when the song changes.
  // The WS payload often omits albumArt; GET /api/v1/song always includes it.
  useEffect(() => {
    if (!state.connected) return;
    const controller = new AbortController();
    void getSongInfo(controller.signal).then((info) => {
      if (info) dispatch({ type: 'SUPPLEMENT_SONG', payload: info });
    }).catch(() => {});
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.song?.videoId, state.connected]);

  return <PlayerContext.Provider value={state}>{children}</PlayerContext.Provider>;
};

export const usePlayer = (): PlayerState => useContext(PlayerContext);
