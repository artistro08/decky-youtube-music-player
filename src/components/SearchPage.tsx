import { ButtonItem, DialogButton, TextField, Focusable, Navigation, QuickAccessTab } from '@decky/ui';
import { call } from '@decky/api';
import { useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { playTrack, type TrackInfo } from '../services/audioManager';
import { Section } from './Section';

interface SearchResult {
  videoId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: string;
}

export const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingSong, setLoadingSong] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setError('');
    setSearching(true);
    setHasSearched(true);
    try {
      const result = await call<[string], { results?: SearchResult[]; error?: string }>('search_songs', query.trim());
      if (result.error) {
        setError(result.error);
        setResults([]);
      } else {
        setResults(result.results ?? []);
      }
    } catch (e) {
      setError(String(e));
    }
    setSearching(false);
  };

  const handleSongTap = async (videoId: string) => {
    setLoadingSong(videoId);
    setError('');
    try {
      const result = await call<[string], TrackInfo & { error?: string }>('play_song_radio', videoId);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        await playTrack(result as TrackInfo);
        Navigation.NavigateBack();
        Navigation.OpenQuickAccessMenu(QuickAccessTab.Decky);
        return;
      }
    } catch (e) {
      setError(String(e));
    }
    setLoadingSong(null);
  };

  return (
    <div style={{ padding: '52px 28px 16px' }}>
      {/* Back button + title */}
      <Focusable flow-children="horizontal" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <DialogButton
          style={{ width: '40px', minWidth: '40px', height: '40px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => Navigation.NavigateBack()}
        >
          ←
        </DialogButton>
        <span style={{ fontWeight: 'bold', fontSize: '20px' }}>Search</span>
      </Focusable>

      {/* Search input */}
      <Section>
        <div style={{ padding: '8px 16px' }}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ marginTop: '8px' }}>
            <ButtonItem onClick={() => { void handleSearch(); }}>
              {searching ? 'Searching...' : 'Search'}
            </ButtonItem>
          </div>
        </div>
      </Section>

      {/* Error */}
      {error && (
        <Section>
          <div style={{ padding: '8px 12px', color: '#ff6b6b', fontSize: '12px' }}>{error}</div>
        </Section>
      )}

      {/* No results */}
      {hasSearched && !searching && results.length === 0 && !error && (
        <Section>
          <div style={{ padding: '8px 12px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
            No results found
          </div>
        </Section>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Section>
          {results.map((song) => {
            const isLoading = loadingSong === song.videoId;
            return (
              <Focusable
                key={song.videoId}
                style={{ display: 'flex', alignItems: 'stretch', marginTop: '2px', marginBottom: '2px' }}
              >
                <DialogButton
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    height: 'auto',
                    minHeight: '44px',
                    padding: '0',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    borderRadius: '0',
                    overflow: 'hidden',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                  onClick={() => { if (!isLoading) void handleSongTap(song.videoId); }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: '62px', height: '62px', flexShrink: 0, alignSelf: 'center', background: 'rgba(255,255,255,0.05)' }}>
                    {song.albumArt ? (
                      <img src={song.albumArt} alt="" style={{ width: '62px', height: '62px', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '62px', height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gpSystemLighterGrey)' }}>
                        <FaMusic size={18} />
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0, maskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)' }}>
                        {isLoading ? 'Loading...' : song.title}
                      </span>
                    </div>
                    {song.artist && (
                      <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', maskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)' }}>
                        {song.artist}
                      </div>
                    )}
                  </div>
                </DialogButton>
              </Focusable>
            );
          })}
        </Section>
      )}
    </div>
  );
};
