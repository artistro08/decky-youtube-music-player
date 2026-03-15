import { ButtonItem, Tabs, staticClasses } from '@decky/ui';
import { definePlugin } from '@decky/api';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaMusic } from 'react-icons/fa';

import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { NotConnectedView } from './components/NotConnectedView';
import { AuthTokenView } from './components/AuthTokenView';
import { PlayerView } from './components/PlayerView';
import { QueueView } from './components/QueueView';
import { Section } from './components/Section';

const TabsContainer = memo(() => {
  const [activeTab, setActiveTab] = useState<string>('player');
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(500);

  // Height measurement — run once on mount. Also locks the outer scroll
  // container (overflow-y: hidden) so touch-scrolling cannot move the entire
  // plugin panel — only TabContentsScroll scrolls independently.
  useEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    let scrollEl: HTMLElement | null = null;
    let el: Element | null = containerRef.current.parentElement;
    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if (oy === 'scroll' || oy === 'auto' || oy === 'overlay') {
        const elRect = el.getBoundingClientRect();
        setHeight(elRect.bottom - containerRect.top);
        scrollEl = el as HTMLElement;
        break;
      }
      el = el.parentElement;
    }
    if (!scrollEl) {
      setHeight(window.innerHeight - containerRect.top);
      return;
    }
    const prev = scrollEl.style.overflowY;
    scrollEl.style.overflowY = 'hidden';
    return () => { (scrollEl as HTMLElement).style.overflowY = prev; };
  }, []);

  // Inject CSS on mount to fix tab bar layout and prevent touch scroll jank.
  // Replaces the per-tab-switch querySelectorAll DOM patches.
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `
      /* Cascade flex-column through Decky's wrapper between our div and Tabs DOM. */
      #ytm-container > * {
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      /* Tab bar: scoped, never shrinks. */
      #ytm-container [class*="TabHeaderRowWrapper"] {
        flex-shrink: 0 !important;
        min-height: 32px !important;
        padding-left: 18px !important;
        padding-right: 18px !important;
      }
      /* Content scroll area: scoped, takes remaining height. overflow-y left alone. */
      #ytm-container [class*="TabContentsScroll"] {
        flex: 1 !important;
        min-height: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      /* L1/R1 glyph icons: scoped. */
      #ytm-container [class*="Glyphs"] {
        transform: scale(0.65) !important;
        transform-origin: center center !important;
      }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // Memoize tab content so @decky/ui's Tabs sees a stable array reference
  // and does not unmount/remount content on every re-render.
  const tabItems = useMemo(() => [
    { id: 'player', title: 'Player', content: <PlayerView /> },
    { id: 'queue', title: 'Queue', content: <QueueView /> },
  ], []);

  return (
    <div id="ytm-container" ref={containerRef} style={{ height, overflow: 'hidden' }}>
      <Tabs
        activeTab={activeTab}
        onShowTab={(tabID: string) => setActiveTab(tabID)}
        tabs={tabItems}
      />
    </div>
  );
});
TabsContainer.displayName = 'TabsContainer';

const PluginContent = () => {
  const { connected, authRequired } = usePlayer();
  const [activeTab, setActiveTab] = useState<string>('player');

  if (!connected) return <NotConnectedView />;
  if (authRequired) return <AuthTokenView />;

  if (!Tabs) {
    return (
      <>
        <Section>
          {(['player', 'queue'] as const).map((id) => (
            <ButtonItem key={id} onClick={() => setActiveTab(id)}>
              {activeTab === id
                ? `▶ ${id.charAt(0).toUpperCase() + id.slice(1)}`
                : id.charAt(0).toUpperCase() + id.slice(1)}
            </ButtonItem>
          ))}
        </Section>
        {activeTab === 'player' && <PlayerView />}
        {activeTab === 'queue' && <QueueView />}
      </>
    );
  }

  return <TabsContainer />;
};

const Content = () => {
  useEffect(() => {
    const titleEl = document.querySelector(`.${staticClasses.Title}`);
    if (titleEl?.parentElement) {
      titleEl.parentElement.style.gap = '0';
    }
  }, []);
  return (
    <PlayerProvider>
      <PluginContent />
    </PlayerProvider>
  );
};

export default definePlugin(() => ({
  name: 'YouTube Music',
  titleView: <div className={staticClasses.Title} style={{ paddingTop: '0', boxShadow: 'none' }}>YouTube Music</div>,
  content: <Content />,
  icon: <FaMusic />,
  onDismount() {},
}));
