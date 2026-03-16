import { ButtonItem, DialogButton, Focusable, Navigation } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useState } from 'react';
import { Section } from './Section';

type AuthState = {
  authenticated: boolean;
};

export const SettingsPage = () => {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [headersRaw, setHeadersRaw] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const state = await call<[], AuthState>('get_auth_state');
      setAuthState(state);
    })();
  }, []);

  const handleSaveHeaders = async () => {
    if (!headersRaw.trim()) {
      setError('Please paste your request headers.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const result = await call<[string], { success?: boolean; error?: string }>('save_browser_headers', headersRaw.trim());
      if (result.error) {
        setError(result.error);
      } else {
        const state = await call<[], AuthState>('get_auth_state');
        setAuthState(state);
        setHeadersRaw('');
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await call<[], { success: boolean }>('sign_out');
    const state = await call<[], AuthState>('get_auth_state');
    setAuthState(state);
  };

  if (!authState) {
    return (
      <Section>
        <div style={{ padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>Loading...</div>
      </Section>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* Back button + title */}
      <Focusable flow-children="horizontal" style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: '8px' }}>
        <DialogButton
          style={{ width: '40px', minWidth: '40px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => Navigation.NavigateBack()}
        >
          ←
        </DialogButton>
        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>YouTube Music Settings</span>
      </Focusable>

      {/* Error display */}
      {error && (
        <Section>
          <div style={{ padding: '8px 16px', color: '#ff6b6b', fontSize: '12px' }}>{error}</div>
        </Section>
      )}

      {authState.authenticated ? (
        /* Authenticated state */
        <Section>
          <Focusable flow-children="horizontal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
            <span style={{ color: '#4caf50', fontSize: '13px' }}>Authenticated ✓</span>
            <DialogButton
              style={{ width: 'auto', minWidth: '80px', padding: '4px 12px', fontSize: '12px' }}
              onClick={() => void handleSignOut()}
            >
              Sign Out
            </DialogButton>
          </Focusable>
        </Section>
      ) : (
        /* Not authenticated — show instructions + header paste */
        <>
          <Section title="Setup Instructions">
            <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--gpSystemLighterGrey)', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '8px' }}>1. Open a browser and go to <span style={{ color: 'white' }}>music.youtube.com</span></div>
              <div style={{ marginBottom: '8px' }}>2. Log in to your account</div>
              <div style={{ marginBottom: '8px' }}>3. Open Developer Tools (F12) → Network tab</div>
              <div style={{ marginBottom: '8px' }}>4. Click around in YouTube Music (e.g. click Library)</div>
              <div style={{ marginBottom: '8px' }}>5. Find a request to <span style={{ color: 'white' }}>/browse</span> with status 200</div>
              <div style={{ marginBottom: '8px' }}>6. Copy the request headers (Firefox: right-click → Copy → Copy Request Headers)</div>
              <div>7. Paste them below and click Save</div>
            </div>
          </Section>

          <Section title="Request Headers">
            <div style={{ padding: '8px 16px' }}>
              <textarea
                value={headersRaw}
                onChange={(e) => setHeadersRaw(e.target.value)}
                placeholder="Paste request headers here..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  padding: '8px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ marginTop: '8px' }}>
                <ButtonItem onClick={() => void handleSaveHeaders()}>
                  {saving ? 'Saving...' : 'Save & Connect'}
                </ButtonItem>
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
};
