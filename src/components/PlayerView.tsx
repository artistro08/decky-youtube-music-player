import { ButtonItem, DialogButton, Focusable, ToggleField } from '@decky/ui';
import { useEffect, useRef, useState } from 'react';
import { FaPause, FaRandom, FaMusic } from 'react-icons/fa';
import { IoPlay, IoPlaySkipBack, IoPlaySkipForward } from 'react-icons/io5';
import { MdRepeat, MdRepeatOne } from 'react-icons/md';
import { usePlayer } from '../context/PlayerContext';
import {
  next,
  previous,
  shuffle,
  switchRepeat,
  togglePlay,
} from '../services/apiClient';
import { Section } from './Section';
import { VolumeSlider } from './VolumeSlider';

const REPEAT_NEXT: Record<string, number> = { NONE: 1, ALL: 1, ONE: 1 };
const REPEAT_ICONS: Record<string, React.ReactElement> = {
  NONE: <MdRepeat size={18} style={{ opacity: 0.4, margin: '-2px' }} />,
  ALL:  <MdRepeat size={18} style={{ opacity: 1, margin: '-2px' }} />,
  ONE:  <MdRepeatOne size={18} style={{ opacity: 1, margin: '-2px' }} />,
};

const REPEAT_LABELS: Record<string, string> = {
  NONE: 'Off',
  ALL:  'All',
  ONE:  'One',
};

const btnBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '0',
  flex: 1,
  padding: '0 8px',
  marginLeft: '0',
};

const transBtnFirst: React.CSSProperties = { ...btnBase, height: '35px', borderRadius: '4px 0 0 4px' };
const transBtnMid: React.CSSProperties   = { ...btnBase, height: '35px', borderRadius: '0', borderLeft: '1px solid rgba(255,255,255,0.15)' };
const transBtnLast: React.CSSProperties  = { ...btnBase, height: '35px', borderRadius: '0 4px 4px 0', borderLeft: '1px solid rgba(255,255,255,0.15)' };

// Applies padding to Decky item elements (buttons, toggles) and removes
// hardcoded min-width (270px) by finding the offending element at mount.
const applyInnerPadding = (el: HTMLElement) => {
  el.style.paddingLeft = '19px';
  el.style.paddingRight = '19px';
};

const PaddedToggle = (props: React.ComponentProps<typeof ToggleField>) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.firstElementChild as HTMLElement | null;
    if (first) applyInnerPadding(first);
  }, []);
  return <div ref={ref}><ToggleField {...props} /></div>;
};

const RepeatButton = ({ repeat }: { repeat: string }) => {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `
      @keyframes ytm-repeat-focus {
        0%   { background: #5a6270; }
        100% { background: #32373D; }
      }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <Focusable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <DialogButton
        style={{
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '6px',
          paddingLeft: '19px',
          paddingRight: '19px',
          borderRadius: '0',
          color: 'white',
          background: focused ? '#32373D' : '#0d141c',
          animation: focused ? 'ytm-repeat-focus 0.3s ease' : 'none',
          transition: 'background 0.2s ease',
        }}
        onClick={() => { void switchRepeat(REPEAT_NEXT[repeat] ?? 1); }}
      >
        {REPEAT_ICONS[repeat] ?? REPEAT_ICONS.NONE}
        Repeat: {REPEAT_LABELS[repeat] ?? 'Off'}
      </DialogButton>
    </Focusable>
  );
};

export const PlayerView = () => {
  const { song, isPlaying, shuffle: isShuffled, repeat } = usePlayer();

  const albumArt = song?.albumArt;
  const title = song?.title ?? 'Nothing playing';
  const artist = song?.artist ?? '';

  return (
    <>
      {/* Track info: album art + title/artist */}
      {/* Note: Section applies margin: '0 -10px'. The 12px horizontal padding here
          restores alignment (10px offset + 2px visual inset). Do not remove it. */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px' }}>
          {albumArt ? (
            <img
              src={albumArt}
              alt="Album art"
              style={{ width: '72px', height: '72px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: '72px', height: '72px', borderRadius: '4px', flexShrink: 0,
              background: 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gpSystemLighterGrey)',
            }}>
              <FaMusic size={36} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
            {artist && (
              <div style={{ fontSize: '12px', color: 'var(--gpSystemLighterGrey)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {artist}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Prev / Play / Next */}
      <div style={{ marginTop: '10px', marginBottom: '10px', paddingLeft: '5px', paddingRight: '5px' }}>
      <Section noPull>
        {DialogButton ? (
          <Focusable
            style={{ display: 'flex', marginTop: '4px', marginBottom: '4px' }}
            flow-children="horizontal"
          >
            <DialogButton style={transBtnFirst} onClick={() => { void previous(); }}><IoPlaySkipBack /></DialogButton>
            <DialogButton style={transBtnMid} onClick={() => { void togglePlay(); }}>
              {isPlaying ? <FaPause /> : <IoPlay />}
            </DialogButton>
            <DialogButton style={transBtnLast} onClick={() => { void next(); }}><IoPlaySkipForward /></DialogButton>
          </Focusable>
        ) : (
          <>
            <ButtonItem onClick={() => { void previous(); }}><IoPlaySkipBack /> Previous</ButtonItem>
            <ButtonItem onClick={() => { void togglePlay(); }}>{isPlaying ? <><FaPause /> Pause</> : <><IoPlay /> Play</>}</ButtonItem>
            <ButtonItem onClick={() => { void next(); }}><IoPlaySkipForward /> Next</ButtonItem>
          </>
        )}
      </Section>
      </div>

      {/* Volume */}
      <Section>
        <VolumeSlider />
      </Section>

      {/* Playback options */}
      <Section>
        <PaddedToggle
          label={<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FaRandom size={14} /> Shuffle</span>}
          checked={isShuffled}
          onChange={() => { void shuffle(); }}
        />
        <RepeatButton repeat={repeat} />
      </Section>
    </>
  );
};
