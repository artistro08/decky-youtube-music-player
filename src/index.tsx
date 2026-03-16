import { ButtonItem, Tabs, staticClasses, DialogButton, Focusable, Navigation } from '@decky/ui';
import { definePlugin, routerHook } from '@decky/api';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { BsGearFill } from 'react-icons/bs';

import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { PlayerView } from './components/PlayerView';
import { QueueView } from './components/QueueView';
import { LibraryView } from './components/LibraryView';
import { Section } from './components/Section';
import { SettingsPage } from './components/SettingsPage';
import { SearchPage } from './components/SearchPage';
import { initAudio, destroyAudio } from './services/audioManager';

const SETTINGS_ROUTE = '/youtube-music-settings';
const SEARCH_ROUTE = '/youtube-music-search';

const PaddedButtonItem = (props: React.ComponentProps<typeof ButtonItem>) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.firstElementChild as HTMLElement | null;
    if (first) {
      first.style.paddingLeft = '16px';
      first.style.paddingRight = '16px';
    }
  }, []);
  return <div ref={ref}><ButtonItem {...props} /></div>;
};

const TabsContainer = memo(() => {
  const [activeTab, setActiveTab] = useState<string>('player');
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(500);

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

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `
      #ytm-container > * {
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      #ytm-container [class*="TabHeaderRowWrapper"] {
        flex-shrink: 0 !important;
        min-height: 32px !important;
        padding-left: 18px !important;
        padding-right: 18px !important;
      }
      #ytm-container [class*="TabContentsScroll"] {
        flex: 1 !important;
        min-height: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      #ytm-container [class*="Glyphs"] {
        transform: scale(0.65) !important;
        transform-origin: center center !important;
      }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const tabItems = useMemo(() => [
    { id: 'player', title: 'Player', content: <PlayerView /> },
    { id: 'queue', title: 'Queue', content: <QueueView /> },
    { id: 'library', title: 'Library', content: <LibraryView onSwitchToPlayer={() => setActiveTab('player')} /> },
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

const Content = () => {
  useEffect(() => {
    const titleEl = document.querySelector(`.${staticClasses.Title}`);
    if (titleEl?.parentElement) {
      titleEl.parentElement.style.gap = '0';
    }
  }, []);

  return (
    <PlayerProvider>
      <PluginContentWrapper />
    </PlayerProvider>
  );
};

const PluginContentWrapper = () => {
  const { authenticated } = usePlayer();
  const [activeTab, setActiveTab] = useState<string>('player');

  // If not authenticated, prompt user to go to settings
  if (!authenticated) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '24px 32px 12px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ marginBottom: '8px' }}><FaMusic size={32} /></div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Not Authenticated</div>
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            Set up your YouTube Music credentials in <strong>Settings</strong> to get started.
          </div>
        </div>
        <PaddedButtonItem onClick={() => {
          Navigation.CloseSideMenus();
          Navigation.Navigate(SETTINGS_ROUTE);
        }}>
          Open Settings
        </PaddedButtonItem>
        <div style={{ height: '16px' }} />
      </div>
    );
  }

  if (!Tabs) {
    return (
      <>
        <Section>
          {(['player', 'queue', 'library'] as const).map((id) => (
            <ButtonItem key={id} onClick={() => setActiveTab(id)}>
              {activeTab === id
                ? `▶ ${id.charAt(0).toUpperCase() + id.slice(1)}`
                : id.charAt(0).toUpperCase() + id.slice(1)}
            </ButtonItem>
          ))}
        </Section>
        {activeTab === 'player' && <PlayerView />}
        {activeTab === 'queue' && <QueueView />}
        {activeTab === 'library' && <LibraryView onSwitchToPlayer={() => setActiveTab('player')} />}
      </>
    );
  }

  return <TabsContainer />;
};

const onSettingsClick = () => {
  Navigation.CloseSideMenus();
  Navigation.Navigate(SETTINGS_ROUTE);
};

export default definePlugin(() => {
  initAudio();
  routerHook.addRoute(SETTINGS_ROUTE, () => <SettingsPage />);
  routerHook.addRoute(SEARCH_ROUTE, () => <SearchPage />);

  return {
    name: 'YouTube Music',
    titleView: (
      <Focusable
        style={{
          display: 'flex',
          padding: '0',
          width: '100%',
          boxShadow: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        className={staticClasses.Title}
      >
        <div>YouTube Music</div>
        <DialogButton
          style={{ height: '28px', width: '40px', minWidth: 0, padding: '10px 12px' }}
          onClick={onSettingsClick}
          onOKActionDescription="Settings"
        >
          <BsGearFill style={{ marginTop: '-4px', display: 'block' }} />
        </DialogButton>
      </Focusable>
    ),
    content: <Content />,
    icon: <FaMusic />,
    onDismount() {
      destroyAudio();
      routerHook.removeRoute(SETTINGS_ROUTE);
      routerHook.removeRoute(SEARCH_ROUTE);
    },
  };
});
