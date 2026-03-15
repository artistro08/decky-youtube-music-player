import { DialogButton, Field, Focusable } from '@decky/ui';
import { useEffect, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { IoVolumeMedium } from 'react-icons/io5';
import { getQueue, removeFromQueue, setQueueIndex } from '../services/apiClient';
import type { QueueItem, QueueResponse } from '../types';
import { Section } from './Section';
import { usePlayer } from '../context/PlayerContext';

const getRenderer = (item: QueueItem) =>
  item.playlistPanelVideoRenderer ??
  item.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;

export const QueueView = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { connected } = usePlayer();

  const loadQueue = async (silent = false) => {
    if (!silent) setLoading(true);
    const data: QueueResponse | null = await getQueue();
    setQueue(data?.items ?? []);
    if (!silent) setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (connected) void loadQueue(); }, [connected]);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `.yt-queue-active:not(:focus):not(:focus-within) { background: rgba(255,255,255,0) !important; }`;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const handleJump = async (index: number) => {
    await setQueueIndex(index);
    void loadQueue(true);
  };

  const handleRemove = async (index: number) => {
    await removeFromQueue(index);
    void loadQueue(true);
  };

  if (loading) {
    return (
      <Section>
        <div style={{ padding: '16px 12px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
          Loading queue...
        </div>
      </Section>
    );
  }

  if (queue.length === 0) {
    return (
      <Section>
        <div style={{ padding: '8px 12px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
          Queue is empty
        </div>
      </Section>
    );
  }

  return (
    <Section>
      {queue.map((item, index) => {
        const r = getRenderer(item);
        const title = r?.title?.runs?.[0]?.text ?? 'Unknown';
        const artist = r?.shortBylineText?.runs?.[0]?.text ?? '';
        const isSelected = r?.selected ?? false;

        if (DialogButton) {
          return (
            <Focusable
              key={r?.videoId ?? `q-${index}`}
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
                  {r?.thumbnail?.thumbnails?.[0]?.url ? (
                    <img
                      src={r.thumbnail.thumbnails[0].url}
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
            key={r?.videoId ?? `q-${index}`}
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
