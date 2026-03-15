import { ButtonItem, DialogButton, TextField, Focusable, Navigation } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useRef, useState } from 'react';
import { Section } from './Section';

type AuthState = {
  has_credentials: boolean;
  authenticated: boolean;
  client_id: string;
  client_secret: string;
};

type OAuthStartResult = {
  url?: string;
  code?: string;
  error?: string;
};

type OAuthCheckResult = {
  status: 'pending' | 'authenticated' | 'timeout' | 'error' | 'no_pending';
  message?: string;
};

export const SettingsPage = () => {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [editing, setEditing] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');
  const [oauthCode, setOauthCode] = useState('');
  const [oauthStatus, setOauthStatus] = useState<string>('');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch auth state on mount
  useEffect(() => {
    void (async () => {
      const state = await call<[], AuthState>('get_auth_state');
      setAuthState(state);
      setClientId(state.client_id);
      setClientSecret(state.client_secret);
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSaveCredentials = async () => {
    setError('');
    await call<[string, string], { success: boolean }>('save_credentials', clientId.trim(), clientSecret.trim());
    const state = await call<[], AuthState>('get_auth_state');
    setAuthState(state);
    setEditing(false);
  };

  const handleStartOAuth = async () => {
    setError('');
    setOauthStatus('starting');
    const result = await call<[], OAuthStartResult>('start_oauth');
    if (result.error) {
      setError(result.error);
      setOauthStatus('');
      return;
    }
    setOauthUrl(result.url ?? '');
    setOauthCode(result.code ?? '');
    setOauthStatus('waiting');

    // Poll every 5 seconds
    pollRef.current = setInterval(async () => {
      const check = await call<[], OAuthCheckResult>('check_oauth_status');
      if (check.status === 'authenticated') {
        if (pollRef.current) clearInterval(pollRef.current);
        setOauthStatus('');
        setOauthUrl('');
        setOauthCode('');
        const state = await call<[], AuthState>('get_auth_state');
        setAuthState(state);
      } else if (check.status === 'timeout') {
        if (pollRef.current) clearInterval(pollRef.current);
        setOauthStatus('');
        setOauthUrl('');
        setOauthCode('');
        setError('Authorization timed out. Please try again.');
      } else if (check.status === 'error') {
        if (pollRef.current) clearInterval(pollRef.current);
        setOauthStatus('');
        setOauthUrl('');
        setOauthCode('');
        setError(check.message ?? 'Unknown error');
      }
    }, 5000);
  };

  const handleSignOut = async () => {
    await call<[], { success: boolean }>('sign_out');
    setOauthStatus('');
    setOauthUrl('');
    setOauthCode('');
    const state = await call<[], AuthState>('get_auth_state');
    setAuthState(state);
  };

  const handleEdit = () => {
    setEditing(true);
    setClientId(authState?.client_id ?? '');
    setClientSecret(authState?.client_secret ?? '');
  };

  if (!authState) {
    return (
      <Section>
        <div style={{ padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>Loading...</div>
      </Section>
    );
  }

  // State 1: No credentials saved (or editing)
  const showCredentialForm = !authState.has_credentials || editing;

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

      {showCredentialForm ? (
        /* Credential entry form */
        <Section title="YouTube Music Setup">
          <div style={{ padding: '8px 16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--gpSystemLighterGrey)', marginBottom: '4px' }}>Client ID</div>
              <TextField
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--gpSystemLighterGrey)', marginBottom: '4px' }}>Client Secret</div>
              <TextField
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            <ButtonItem onClick={() => void handleSaveCredentials()}>
              Save Credentials
            </ButtonItem>
            {editing && (
              <ButtonItem onClick={() => setEditing(false)}>
                Cancel
              </ButtonItem>
            )}
          </div>
        </Section>
      ) : (
        <>
          {/* Credentials saved indicator + Edit button */}
          <Section>
            <Focusable flow-children="horizontal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
              <span style={{ color: '#4caf50', fontSize: '13px' }}>Credentials ✓</span>
              <DialogButton
                style={{ width: 'auto', minWidth: '60px', padding: '4px 12px', fontSize: '12px' }}
                onClick={handleEdit}
              >
                Edit
              </DialogButton>
            </Focusable>
          </Section>

          {/* Auth status */}
          {authState.authenticated ? (
            /* State 4: Fully authenticated */
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
          ) : oauthStatus === 'waiting' ? (
            /* State 3: Sign-in initiated */
            <Section title="Sign In">
              <div style={{ padding: '8px 16px' }}>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  Go to: <span style={{ fontWeight: 'bold', color: 'white' }}>{oauthUrl}</span>
                </div>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  Enter code: <span style={{ fontWeight: 'bold', color: 'white', fontSize: '18px' }}>{oauthCode}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gpSystemLighterGrey)' }}>
                  Waiting for authorization...
                </div>
              </div>
            </Section>
          ) : (
            /* State 2: Credentials saved, not authenticated */
            <Section>
              <div style={{ padding: '8px 16px' }}>
                <ButtonItem onClick={() => void handleStartOAuth()}>
                  Sign In with Google
                </ButtonItem>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
};
