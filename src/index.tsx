import { ButtonItem, Tabs, staticClasses, DialogButton, Focusable, Navigation } from '@decky/ui';
import { definePlugin, routerHook, call } from '@decky/api';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { BsGearFill } from 'react-icons/bs';

import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { PlayerView } from './components/PlayerView';
import { QueueView } from './components/QueueView';
import { Section } from './components/Section';
import { SettingsPage } from './components/SettingsPage';
import { initAudio, destroyAudio, playTrack, type TrackInfo } from './services/audioManager';

const SETTINGS_ROUTE = '/youtube-music-settings';

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
  const [testResults, setTestResults] = useState<Record<string, unknown> | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // If not authenticated, prompt user to go to settings
  if (!authenticated) {
    return (
      <Section>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--gpSystemLighterGrey)', fontSize: '13px', marginBottom: '12px' }}>
            Not authenticated. Set up your YouTube Music credentials in Settings.
          </div>
          <ButtonItem onClick={() => {
            Navigation.CloseSideMenus();
            Navigation.Navigate(SETTINGS_ROUTE);
          }}>
            Open Settings
          </ButtonItem>
        </div>
      </Section>
    );
  }

  // Temporary: diagnostic test
  const handleTestApi = async () => {
    setTestLoading(true);
    setTestResults(null);
    try {
      const result = await call<[], Record<string, unknown>>('test_api');
      setTestResults(result);
    } catch (e) {
      setTestResults({ error: String(e) });
    }
    setTestLoading(false);
  };

  // Temporary: test button to load a playlist
  const handleLoadLikedSongs = async () => {
    try {
      const result = await call<[string], TrackInfo & { error?: string }>('load_playlist', 'LM');
      if (!result.error && result.url) {
        await playTrack(result);
      } else {
        setTestResults({ load_error: result.error || 'No URL returned' });
      }
    } catch (e) {
      setTestResults({ load_error: String(e) });
    }
  };

  // Load a specific playlist by ID from test results
  const handleLoadPlaylist = async (playlistId: string) => {
    try {
      const result = await call<[string], TrackInfo & { error?: string }>('load_playlist', playlistId);
      if (!result.error && result.url) {
        await playTrack(result);
        setTestResults(null);
      } else {
        setTestResults({ load_error: result.error || 'No URL returned' });
      }
    } catch (e) {
      setTestResults({ load_error: String(e) });
    }
  };

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

  return (
    <>
      {/* Temporary test buttons — removed when Library tab is added in Phase 6 */}
      <Section>
        <ButtonItem onClick={() => { void handleTestApi(); }}>
          {testLoading ? 'Testing...' : 'Test API'}
        </ButtonItem>
        <ButtonItem onClick={() => { void handleLoadLikedSongs(); }}>
          Load Liked Songs
        </ButtonItem>
        {testResults && (
          <div style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--gpSystemLighterGrey)', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
            {JSON.stringify(testResults, null, 2)}
            {testResults.first_playlist ? (
              <ButtonItem onClick={() => { void handleLoadPlaylist(String((testResults.first_playlist as Record<string, unknown>).playlistId)); }}>
                {'Load: ' + String((testResults.first_playlist as Record<string, unknown>).title)}
              </ButtonItem>
            ) : null}
          </div>
        )}
      </Section>
      <TabsContainer />
    </>
  );
};

const onSettingsClick = () => {
  Navigation.CloseSideMenus();
  Navigation.Navigate(SETTINGS_ROUTE);
};

export default definePlugin(() => {
  initAudio();
  routerHook.addRoute(SETTINGS_ROUTE, () => <SettingsPage />);

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
    },
  };
});
