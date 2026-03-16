import { createContext, useContext, useEffect, useReducer, type FC, type ReactNode } from 'react';
import { call } from '@decky/api';
import type { PlayerState } from '../types';
import {
  addTrackChangeListener,
  addPlayStateListener,
  getCurrentTrack,
  getIsPlaying,
  type TrackInfo,
} from '../services/audioManager';

const defaultState: PlayerState = {
  track: null,
  isPlaying: false,
  volume: 100,
  repeat: 'NONE',
  shuffle: false,
  authenticated: false,
  hasCredentials: false,
};

type Action =
  | { type: 'UPDATE'; payload: Partial<PlayerState> }
  | { type: 'SET_TRACK'; payload: TrackInfo | null }
  | { type: 'SET_PLAYING'; payload: boolean };

const reducer = (state: PlayerState, action: Action): PlayerState => {
  switch (action.type) {
    case 'UPDATE':
      return { ...state, ...action.payload };
    case 'SET_TRACK':
      return { ...state, track: action.payload };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    default:
      return state;
  }
};

const PlayerContext = createContext<PlayerState>(defaultState);

export const PlayerProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, defaultState);

  // Sync with audio manager on mount (panel open)
  useEffect(() => {
    // Restore state from audio manager (survives panel close/open)
    const track = getCurrentTrack();
    const playing = getIsPlaying();
    if (track) dispatch({ type: 'SET_TRACK', payload: track });
    if (playing) dispatch({ type: 'SET_PLAYING', payload: playing });

    // Fetch playback state from backend
    void (async () => {
      try {
        const ps = await call<[], {
          is_playing: boolean;
          shuffle: boolean;
          repeat: string;
          volume: number;
        }>('get_playback_state');
        dispatch({
          type: 'UPDATE',
          payload: {
            shuffle: ps.shuffle,
            repeat: ps.repeat as PlayerState['repeat'],
            volume: ps.volume * 100, // backend stores 0-1, UI uses 0-100
          },
        });
      } catch (e) {
        console.error('[YTM] Failed to fetch playback state:', e);
      }

      // Fetch auth state
      try {
        const auth = await call<[], { authenticated: boolean }>('get_auth_state');
        dispatch({
          type: 'UPDATE',
          payload: {
            authenticated: auth.authenticated,
          },
        });
      } catch (e) {
        console.error('[YTM] Failed to fetch auth state:', e);
      }
    })();

    // Subscribe to audio manager events
    const removeTrack = addTrackChangeListener((t) => dispatch({ type: 'SET_TRACK', payload: t }));
    const removePlay = addPlayStateListener((p) => dispatch({ type: 'SET_PLAYING', payload: p }));

    return () => {
      removeTrack();
      removePlay();
    };
  }, []);

  return <PlayerContext.Provider value={state}>{children}</PlayerContext.Provider>;
};

export const usePlayer = (): PlayerState => useContext(PlayerContext);
