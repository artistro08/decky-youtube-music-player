import { SliderField } from '@decky/ui';
import type { SliderFieldProps } from '@decky/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaVolumeUp } from 'react-icons/fa';
import { setAudioVolume } from '../services/audioManager';

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
  return <div ref={ref}><SliderField {...props} /></div>;
};

export const VolumeSlider = () => {
  const [displayVolume, setDisplayVolume] = useState<number>(cachedVolume ?? 100);
  const apiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current); };
  }, []);

  const handleChange = useCallback((val: number) => {
    setDisplayVolume(val);
    cachedVolume = val;
    setAudioVolume(val / 100); // <audio> volume only — PulseAudio added in Phase 4
  }, []);

  return (
    <PaddedSlider
      icon={<FaVolumeUp size={18} />}
      value={displayVolume}
      min={0}
      max={100}
      step={1}
      onChange={handleChange}
      showValue={false}
    />
  );
};
