import { ButtonItem, DialogButton, Focusable } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useState } from 'react';
import { FaHeart, FaMusic } from 'react-icons/fa';
import type { TrackInfo } from '../types';
import { playTrack } from '../services/audioManager';
import { Section } from './Section';

interface PlaylistEntry {
  playlistId: string;
  title: string;
  count: number | null;
  thumbnail: string | null;
}

export const LibraryView = ({ onSwitchToPlayer }: { onSwitchToPlayer?: () => void }) => {
  const [playlists, setPlaylists] = useState<PlaylistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const fetchPlaylists = async (limit = 25) => {
    setLoading(true);
    setError('');
    try {
      const result = await call<[number], { playlists?: PlaylistEntry[]; error?: string }>('get_library_playlists', limit);
      if (result.error) {
        setError(result.error);
      } else {
        const fetched = result.playlists ?? [];
        setPlaylists(fetched);
        // If we got fewer than requested (minus 1 for the manual Liked Songs entry), no more to load
        setHasMore(fetched.length - 1 >= limit);
      }
    } catch (e) {
      setError('Failed to load playlists');
    }
    setLoading(false);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const newLimit = playlists.length + 25;
      const result = await call<[number], { playlists?: PlaylistEntry[]; error?: string }>('get_library_playlists', newLimit);
      if (!result.error) {
        const fetched = result.playlists ?? [];
        setPlaylists(fetched);
        setHasMore(fetched.length - 1 >= newLimit);
      }
    } catch (e) {
      // silently fail
    }
    setLoadingMore(false);
  };

  useEffect(() => { void fetchPlaylists(); }, []);

  const handlePlaylistClick = async (playlistId: string) => {
    setLoadingPlaylist(playlistId);
    setError('');
    try {
      const result = await call<[string], TrackInfo & { error?: string }>('load_playlist', playlistId);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        await playTrack(result as TrackInfo);
        onSwitchToPlayer?.();
      }
    } catch (e) {
      setError('Failed to load playlist');
    }
    setLoadingPlaylist(null);
  };

  if (loading) {
    return (
      <Section>
        <div style={{ padding: '16px 12px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
          Loading playlists...
        </div>
      </Section>
    );
  }

  if (error && playlists.length === 0) {
    return (
      <Section>
        <div style={{ padding: '8px 12px', color: '#ff6b6b', fontSize: '12px' }}>{error}</div>
      </Section>
    );
  }

  if (playlists.length === 0) {
    return (
      <Section>
        <div style={{ padding: '8px 12px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
          No playlists found
        </div>
      </Section>
    );
  }

  return (
    <Section>
      {error && (
        <div style={{ padding: '8px 12px', color: '#ff6b6b', fontSize: '12px' }}>{error}</div>
      )}
      {playlists.map((playlist) => {
        const isLiked = playlist.playlistId === 'LM';
        const isLoading = loadingPlaylist === playlist.playlistId;

        return (
          <Focusable key={playlist.playlistId}>
            <DialogButton
              style={{
                width: '100%',
                textAlign: 'left',
                height: 'auto',
                minHeight: '48px',
                padding: '8px 16px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: '0',
                gap: '12px',
                opacity: isLoading ? 0.6 : 1,
              }}
              onClick={() => { if (!isLoading) void handlePlaylistClick(playlist.playlistId); }}
            >
              {/* Thumbnail / Icon */}
              {isLiked ? (
                <div style={{
                  width: '40px', height: '40px', flexShrink: 0,
                  background: 'rgba(255, 80, 80, 0.15)',
                  borderRadius: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ff5050',
                }}>
                  <FaHeart size={16} />
                </div>
              ) : playlist.thumbnail ? (
                <img
                  src={playlist.thumbnail}
                  alt=""
                  style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: '40px', height: '40px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--gpSystemLighterGrey)',
                }}>
                  <FaMusic size={16} />
                </div>
              )}

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: isLiked ? 'bold' : 'normal',
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {isLoading ? 'Loading...' : playlist.title}
                </div>
                {playlist.count !== null && (
                  <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px' }}>
                    {playlist.count} tracks
                  </div>
                )}
              </div>
            </DialogButton>
          </Focusable>
        );
      })}
      {hasMore && (
        <ButtonItem onClick={() => { void handleLoadMore(); }}>
          {loadingMore ? 'Loading...' : 'Load More'}
        </ButtonItem>
      )}
    </Section>
  );
};
