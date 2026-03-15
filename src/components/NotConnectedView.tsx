import { FaMusic } from 'react-icons/fa';
import { Section } from './Section';

export const NotConnectedView = () => (
  <Section>
    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}><FaMusic size={32} /></div>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Not Connected</div>
      <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
        Open YouTube Music and enable the <strong>API Server</strong> plugin in its settings.
        The plugin will connect automatically.
      </div>
    </div>
  </Section>
);
