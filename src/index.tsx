import { ButtonItem, Tabs, staticClasses, DialogButton, Focusable } from '@decky/ui';
import { definePlugin } from '@decky/api';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { IoSettingsSharp } from 'react-icons/io5';

import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { NotConnectedView } from './components/NotConnectedView';
import { AuthTokenView } from './components/AuthTokenView';
import { PlayerView } from './components/PlayerView';
import { QueueView } from './components/QueueView';
import { Section } from './components/Section';
import { SettingsPage } from './components/SettingsPage';

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

// Module-scoped ref for settings toggle — accessible from titleView
let setShowSettingsGlobal: ((show: boolean) => void) | null = null;

const Content = () => {
  const [showSettings, setShowSettings] = useState(false);

  // Register the global setter so titleView can toggle it
  useEffect(() => {
    setShowSettingsGlobal = setShowSettings;
    return () => { setShowSettingsGlobal = null; };
  }, []);

  useEffect(() => {
    const titleEl = document.querySelector(`.${staticClasses.Title}`);
    if (titleEl?.parentElement) {
      titleEl.parentElement.style.gap = '0';
    }
  }, []);

  return (
    <PlayerProvider>
      <PluginContentWrapper showSettings={showSettings} setShowSettings={setShowSettings} />
    </PlayerProvider>
  );
};

const PluginContentWrapper = ({ showSettings, setShowSettings }: { showSettings: boolean; setShowSettings: (v: boolean) => void }) => {
  const { connected, authRequired } = usePlayer();
  const [activeTab, setActiveTab] = useState<string>('player');

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />;
  }

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

export default definePlugin(() => ({
  name: 'YouTube Music',
  titleView: (
    <Focusable flow-children="horizontal" style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0' }}>
      <div className={staticClasses.Title} style={{ paddingTop: '0', boxShadow: 'none', flex: 1 }}>YouTube Music</div>
      <DialogButton
        style={{
          width: '32px', minWidth: '32px', height: '32px', padding: '0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent',
        }}
        onClick={() => setShowSettingsGlobal?.(true)}
        onOKActionDescription="Settings"
      >
        <IoSettingsSharp size={18} />
      </DialogButton>
    </Focusable>
  ),
  content: <Content />,
  icon: <FaMusic />,
  onDismount() {},
}));
