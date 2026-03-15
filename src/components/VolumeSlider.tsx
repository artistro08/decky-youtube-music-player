import { SliderField } from '@decky/ui';
import type { SliderFieldProps } from '@decky/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaVolumeUp } from 'react-icons/fa';
import { getVolume, setVolume } from '../services/apiClient';
import { usePlayer } from '../context/PlayerContext';

// Module-level cache — survives tab switches (component remounts) so the
// slider shows the last known value immediately instead of flashing to 0.
let cachedVolume: number | null = null;

const PaddedSlider = (props: SliderFieldProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const firstChild = ref.current.firstElementChild as HTMLElement | null;
    if (firstChild) {
      firstChild.style.paddingLeft = '19px';
      firstChild.style.paddingRight = '19px';
    }
    ref.current.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (parseFloat(window.getComputedStyle(el).minWidth) >= 270)
        el.style.minWidth = '0';
    });
  }, []);
  return (
    <div ref={ref}>
      <SliderField {...props} />
    </div>
  );
};

export const VolumeSlider = () => {
  const { connected } = usePlayer();
  // Initialise from cache so remounts show the last known value instantly.
  const [displayVolume, setDisplayVolume] = useState<number | null>(cachedVolume);

  const apiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch from YTM only when we genuinely have no cached value (first connect
  // or after a real disconnect cleared the cache). On remounts while already
  // connected, cachedVolume is non-null so we skip and preserve the known value.
  useEffect(() => {
    if (!connected) {
      // Real disconnect — invalidate cache so the next reconnect fetches fresh.
      cachedVolume = null;
      setDisplayVolume(null);
      return;
    }
    if (cachedVolume !== null) return;
    void getVolume().then((res) => {
      if (res !== null) {
        cachedVolume = res.state;
        setDisplayVolume(res.state);
      }
    });
  }, [connected]);

  // Clear pending timer on unmount to avoid stale callbacks.
  useEffect(() => {
    return () => {
      if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
    };
  }, []);

  const handleChange = useCallback((val: number) => {
    setDisplayVolume(val);
    cachedVolume = val; // keep cache in sync so remounts reflect the drag

    // Debounce the actual API call.
    if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
    apiDebounceRef.current = setTimeout(() => {
      void setVolume(val);
    }, 300);
  }, []);

  return (
    <PaddedSlider
      icon={<FaVolumeUp size={18} />}
      value={displayVolume ?? 0}
      min={0}
      max={100}
      step={1}
      onChange={handleChange}
      showValue={false}
      disabled={!connected || displayVolume === null}
    />
  );
};
