import { DialogButton, Field, Focusable } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { IoVolumeMedium } from 'react-icons/io5';
import { playTrack, type TrackInfo } from '../services/audioManager';
import { Section } from './Section';

export const QueueView = () => {
  const [queue, setQueue] = useState<TrackInfo[]>([]);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadQueue = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await call<[], { tracks: TrackInfo[]; position: number }>('get_queue');
      setQueue(data.tracks ?? []);
      setPosition(data.position ?? 0);
    } catch (e) {
      console.error('[YTM] Failed to load queue:', e);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { void loadQueue(); }, []);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `.yt-queue-active:not(:focus):not(:focus-within) { background: rgba(255,255,255,0) !important; }`;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const handleJump = async (index: number) => {
    try {
      const result = await call<[number], TrackInfo & { error?: string }>('jump_to_queue', index);
      if (!result.error && result.url) {
        await playTrack(result as TrackInfo);
      }
      void loadQueue(true);
    } catch (e) {
      console.error('[YTM] Jump to queue failed:', e);
    }
  };

  const handleRemove = async (index: number) => {
    try {
      await call<[number], { success?: boolean }>('remove_from_queue', index);
      void loadQueue(true);
    } catch (e) {
      console.error('[YTM] Remove from queue failed:', e);
    }
  };

  if (loading) {
    return (
      <Section>
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ fontSize: '12px' }}>Loading queue...</div>
        </div>
      </Section>
    );
  }

  if (queue.length === 0) {
    return (
      <Section>
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ marginBottom: '8px' }}><FaMusic size={32} /></div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Queue is Empty</div>
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            Load a playlist from the <strong>Library</strong> tab or use <strong>Search</strong> to find a song.
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      {queue.map((track, index) => {
        const title = track.title ?? 'Unknown';
        const artist = track.artist ?? '';
        const isSelected = index === position;
        const thumbnail = track.albumArt;

        if (DialogButton) {
          return (
            <Focusable
              key={track.videoId ?? `q-${index}`}
              style={{ display: 'flex', alignItems: 'stretch', marginTop: '2px', marginBottom: '2px' }}
              flow-children="horizontal"
            >
              <DialogButton
                className={isSelected ? 'yt-queue-active' : undefined}
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
                }}
                onClick={() => { void handleJump(index); }}
              >
                {/* Thumbnail */}
                <div style={{ width: '62px', height: '62px', flexShrink: 0, alignSelf: 'center', position: 'relative', background: 'rgba(255,255,255,0.05)' }}>
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      style={{ width: '62px', height: '62px', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '62px', height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gpSystemLighterGrey)' }}>
                      <FaMusic size={18} />
                    </div>
                  )}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IoVolumeMedium size={20} color="white" />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: isSelected ? 'bold' : 'normal', fontSize: '13px', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0, maskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)' }}>{title}</span>
                  </div>
                  {artist && (
                    <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', maskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)' }}>
                      {artist}
                    </div>
                  )}
                </div>
              </DialogButton>
              <DialogButton
                className={isSelected ? 'yt-queue-active' : undefined}
                onClick={() => { void handleRemove(index); }}
                style={{
                  width: '36px',
                  minWidth: '0',
                  padding: '0',
                  marginLeft: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  borderRadius: '0',
                  borderLeft: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                ✕
              </DialogButton>
            </Focusable>
          );
        }

        // Fallback when DialogButton unavailable
        return (
          <Field
            key={track.videoId ?? `q-${index}`}
            label={<span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>{title}</span>}
            description={artist || undefined}
            onActivate={() => { void handleJump(index); }}
            onClick={() => { void handleJump(index); }}
            highlightOnFocus
            focusable
            bottomSeparator="none"
          />
        );
      })}
    </Section>
  );
};
