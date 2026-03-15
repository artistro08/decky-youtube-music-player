import { ButtonItem, TextField } from '@decky/ui';
import { useState } from 'react';
import { setToken } from '../services/apiClient';
import { disconnect, resetAndConnect } from '../services/websocketService';
import { Section } from './Section';

export const AuthTokenView = () => {
  const [token, setTokenInput] = useState('');

  const handleSave = () => {
    if (!token.trim()) return;
    setToken(token.trim());
    disconnect();
    setTimeout(resetAndConnect, 100);
  };

  return (
    <Section title="Authentication Required">
      <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--gpSystemLighterGrey)' }}>
        The YouTube Music API server requires a token. Find it in the API Server plugin settings.
      </div>
      <TextField
        label="API Token"
        value={token}
        onChange={(e) => setTokenInput(e.target.value)}
      />
      <ButtonItem layout="below" onClick={handleSave} disabled={!token.trim()}>
        Save & Connect
      </ButtonItem>
    </Section>
  );
};
