import { ButtonItem, DialogButton, Focusable, SliderField, ToggleField } from '@decky/ui';
import { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  clearQueue,
  getQueue,
  next,
  previous,
  removeFromQueue,
  seekTo,
  setQueueIndex,
  setVolume,
  shuffle,
  switchRepeat,
  toggleMute,
  togglePlay,
} from '../services/apiClient';
import type { QueueItem, QueueResponse } from '../types';
import { Section } from './Section';

const REPEAT_LABELS: Record<string, string> = {
  NONE: 'Repeat: Off',
  ALL: 'Repeat: All',
  ONE: 'Repeat: One',
};
const REPEAT_NEXT: Record<string, number> = { NONE: 1, ALL: 1, ONE: 1 };

const rowBtnFirst: React.CSSProperties = {
  marginLeft: '0px',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '0',
  flex: 1,
};

const rowBtn: React.CSSProperties = {
  marginLeft: '5px',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '0',
  flex: 1,
};

const getRenderer = (item: QueueItem) =>
  item.playlistPanelVideoRenderer ??
  item.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;

export const MainView = () => {
  const { song, isPlaying, volume, muted, shuffle: isShuffled, repeat, position } = usePlayer();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  const loadQueue = async (silent = false) => {
    if (!silent) setQueueLoading(true);
    try {
      const data: QueueResponse | null = await getQueue();
      setQueue(data?.items ?? []);
    } finally {
      if (!silent) setQueueLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  const handleJump = async (index: number) => {
    await setQueueIndex(index);
    void loadQueue(true);
  };

  const handleRemove = async (index: number) => {
    await removeFromQueue(index);
    void loadQueue(true);
  };

  const handleClear = async () => {
    await clearQueue();
    setQueue([]);
  };

  const albumArt = song?.albumArt;
  const title = song?.title ?? 'Nothing playing';
  const artist = song?.artist ?? '';
  const duration = song?.songDuration ?? 0;

  return (
    <>
      {/* Album art */}
      {albumArt && (
        <Section>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <img
              src={albumArt}
              alt="Album art"
              style={{ width: '100%', maxWidth: '180px', borderRadius: '8px' }}
            />
          </div>
        </Section>
      )}

      {/* Track info */}
      <Section>
        <div style={{ textAlign: 'center', padding: '8px 16px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {artist && (
            <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px' }}>
              {artist}
            </div>
          )}
        </div>
        {duration > 0 && (
          <SliderField
            label=""
            value={position}
            min={0}
            max={duration}
            step={1}
            onChange={(val) => { void seekTo(val); }}
            showValue={false}
          />
        )}
      </Section>

      {/* Prev / Play / Next */}
      <Section title="Controls">
        {DialogButton ? (
          <>
            <Focusable
              style={{ display: 'flex', marginTop: '4px', marginBottom: '4px' }}
              flow-children="horizontal"
            >
              <DialogButton style={rowBtnFirst} onClick={() => { void previous(); }}>⏮</DialogButton>
              <DialogButton style={rowBtn} onClick={() => { void togglePlay(); }}>
                {isPlaying ? '⏸' : '▶'}
              </DialogButton>
              <DialogButton style={rowBtn} onClick={() => { void next(); }}>⏭</DialogButton>
            </Focusable>
          </>
        ) : (
          <>
            <ButtonItem onClick={() => { void previous(); }}>⏮ Previous</ButtonItem>
            <ButtonItem onClick={() => { void togglePlay(); }}>{isPlaying ? '⏸ Pause' : '▶ Play'}</ButtonItem>
            <ButtonItem onClick={() => { void next(); }}>⏭ Next</ButtonItem>
          </>
        )}
      </Section>

      {/* Volume */}
      <Section title="Volume">
        <SliderField
          label={muted ? 'Muted' : `${Math.round(volume)}%`}
          value={muted ? 0 : volume}
          min={0}
          max={100}
          step={1}
          onChange={(val) => { void setVolume(val); }}
          showValue={false}
        />
        <ButtonItem onClick={() => { void toggleMute(); }}>
          {muted ? '🔇 Unmute' : '🔊 Mute'}
        </ButtonItem>
      </Section>

      {/* Playback options */}
      <Section title="Playback">
        <ToggleField
          label="Shuffle"
          checked={isShuffled}
          onChange={() => { void shuffle(); }}
        />
        <ButtonItem onClick={() => { void switchRepeat(REPEAT_NEXT[repeat] ?? 1); }}>
          {REPEAT_LABELS[repeat] ?? 'Repeat: Off'}
        </ButtonItem>
      </Section>

      {/* Queue */}
      <Section title="Queue">
        {queueLoading ? (
          <div style={{ padding: '8px 16px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
            Loading queue...
          </div>
        ) : queue.length === 0 ? (
          <div style={{ padding: '8px 16px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
            Queue is empty
          </div>
        ) : (
          <>
            <ButtonItem onClick={() => { void handleClear(); }}>Clear Queue</ButtonItem>
            {queue.map((item, index) => {
              const r = getRenderer(item);
              const trackTitle = r?.title?.runs?.[0]?.text ?? 'Unknown';
              const trackArtist = r?.shortBylineText?.runs?.[0]?.text ?? '';
              const isSelected = r?.selected ?? false;

              if (DialogButton) {
                return (
                  <Focusable
                    key={index}
                    style={{ display: 'flex', alignItems: 'center', marginTop: '2px', marginBottom: '2px' }}
                    flow-children="horizontal"
                  >
                    <DialogButton
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        height: 'auto',
                        minHeight: '40px',
                        padding: '4px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                      onClick={() => { void handleJump(index); }}
                    >
                      <div style={{ fontWeight: isSelected ? 'bold' : 'normal', fontSize: '13px' }}>{trackTitle}</div>
                      {trackArtist && (
                        <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px' }}>
                          {trackArtist}
                        </div>
                      )}
                    </DialogButton>
                    <DialogButton
                      onClick={() => { void handleRemove(index); }}
                      style={{
                        width: '28px',
                        height: '28px',
                        minWidth: '0',
                        padding: '0',
                        marginLeft: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </DialogButton>
                  </Focusable>
                );
              }

              return (
                <ButtonItem
                  key={index}
                  onClick={() => { void handleJump(index); }}
                >
                  <span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>{trackTitle}</span>
                  {trackArtist && ` — ${trackArtist}`}
                </ButtonItem>
              );
            })}
          </>
        )}
      </Section>
    </>
  );
};
