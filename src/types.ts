// Song info returned by GET /api/v1/song and WebSocket VIDEO_CHANGED
export interface SongInfo {
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  imageSrc?: string;   // raw field name returned by the companion API
  videoId?: string;
  isPaused?: boolean;
  elapsedSeconds?: number;
  songDuration?: number;
  url?: string;
  playlistId?: string;
}

// Queue item structure from GET /api/v1/queue
export interface QueueItem {
  playlistPanelVideoRenderer?: {
    title?: { runs?: { text: string }[] };
    shortBylineText?: { runs?: { text: string }[] };
    thumbnail?: { thumbnails?: { url: string }[] };
    videoId?: string;
    selected?: boolean;
    lengthText?: { runs?: { text: string }[] };
  };
  playlistPanelVideoWrapperRenderer?: {
    primaryRenderer?: {
      playlistPanelVideoRenderer?: QueueItem['playlistPanelVideoRenderer'];
    };
  };
}

export interface QueueResponse {
  items?: QueueItem[];
}

// Search result item
export interface SearchResultItem {
  videoId?: string;
  title?: string;
  artists?: { name: string }[];
  album?: { name: string };
  duration?: string;
  thumbnails?: { url: string; width: number; height: number }[];
  resultType?: string;
}

// WebSocket message types
export type RepeatMode = 'NONE' | 'ALL' | 'ONE';

export interface PlayerState {
  song?: SongInfo;
  isPlaying: boolean;
  muted: boolean;
  position: number;
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  connected: boolean;
  authRequired: boolean;
}

export type WSMessageType =
  | 'PLAYER_INFO'
  | 'VIDEO_CHANGED'
  | 'PLAYER_STATE_CHANGED'
  | 'POSITION_CHANGED'
  | 'VOLUME_CHANGED'
  | 'REPEAT_CHANGED'
  | 'SHUFFLE_CHANGED';

export interface WSMessage {
  type: WSMessageType;
  song?: SongInfo;
  isPlaying?: boolean;
  muted?: boolean;
  position?: number;
  volume?: number;
  repeat?: RepeatMode;
  shuffle?: boolean;
}
