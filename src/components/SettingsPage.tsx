import { ButtonItem, TextField, DialogButton, Focusable, SidebarNavigation } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useState } from 'react';

type AuthState = {
  authenticated: boolean;
};

const AuthContent = () => {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [filePath, setFilePath] = useState('/home/deck/headers.txt');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const state = await call<[], AuthState>('get_auth_state');
      setAuthState(state);
    })();
  }, []);

  const handleLoadFile = async () => {
    if (!filePath.trim()) {
      setError('Please enter a file path.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const result = await call<[string], { success?: boolean; error?: string }>('load_headers_from_file', filePath.trim());
      if (result.error) {
        setError(result.error);
      } else {
        const state = await call<[], AuthState>('get_auth_state');
        setAuthState(state);
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    try {
      await call<[], { success: boolean }>('sign_out');
      const state = await call<[], AuthState>('get_auth_state');
      setAuthState(state);
    } catch (e) {
      setError(`Sign out failed: ${String(e)}`);
    }
  };

  if (!authState) {
    return <div style={{ padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>Loading...</div>;
  }

  return (
    <div>
      {/* Error display */}
      {error && (
        <div style={{ padding: '8px 0', color: '#ff6b6b', fontSize: '12px' }}>{error}</div>
      )}

      {authState.authenticated ? (
        /* Authenticated state */
        <Focusable flow-children="horizontal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <span style={{ color: '#4caf50', fontSize: '13px' }}>Authenticated ✓</span>
          <DialogButton
            style={{ width: 'auto', minWidth: '80px', padding: '4px 12px', fontSize: '12px' }}
            onClick={() => void handleSignOut()}
          >
            Sign Out
          </DialogButton>
        </Focusable>
      ) : (
        /* Not authenticated — show instructions + file path */
        <>
          <div style={{ fontSize: '12px', color: 'var(--gpSystemLighterGrey)', lineHeight: '1.5', marginBottom: '16px' }}>
            <div style={{ marginBottom: '8px' }}>1. On your PC, open a browser and go to <span style={{ color: 'white' }}>music.youtube.com</span></div>
            <div style={{ marginBottom: '8px' }}>2. Log in to your account</div>
            <div style={{ marginBottom: '8px' }}>3. Open Developer Tools (F12) → Network tab</div>
            <div style={{ marginBottom: '8px' }}>4. Click around in YouTube Music (e.g. click Library)</div>
            <div style={{ marginBottom: '8px' }}>5. Find a POST request to <span style={{ color: 'white' }}>/browse</span> with status 200</div>
            <div style={{ marginBottom: '8px' }}>6. Copy the request headers to a text file</div>
            <div style={{ marginBottom: '8px' }}>   Firefox: right-click → Copy → Copy Request Headers</div>
            <div style={{ marginBottom: '8px' }}>7. Transfer the text file to your Steam Deck</div>
            <div style={{ marginBottom: '16px' }}>8. Enter the file path below and click Load</div>
          </div>

          <div>
            <TextField
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
            <div style={{ marginTop: '8px' }}>
              <ButtonItem onClick={() => void handleLoadFile()}>
                {saving ? 'Loading...' : 'Load & Connect'}
              </ButtonItem>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const SettingsPage = () => {
  return (
    <SidebarNavigation
      title="YouTube Music"
      pages={[
        {
          title: "Settings",
          content: <AuthContent />,
        },
      ]}
    />
  );
};
