import { Section } from './Section';

export const QueueView = () => {
  return (
    <Section>
      <div style={{ padding: '8px 12px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
        Queue is empty — load a playlist from the Library tab
      </div>
    </Section>
  );
};
