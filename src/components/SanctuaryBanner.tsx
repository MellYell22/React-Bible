import React from 'react';

export default function SanctuaryBanner({ variant = 'peace' }: { variant?: 'peace' | 'bible' | 'scripture' }) {
  const bible = variant === 'bible';
  const heading = bible
    ? <>REAL CONVERSATIONS.<br />TIMELESS TRUTH.<br />A BRIGHTER YOU.</>
    : variant === 'scripture'
      ? <>YOUR WORD IS A LAMP TO MY FEET<br />AND A LIGHT TO MY PATH.</>
      : <>PEACE.<br />PERSPECTIVE.<br /><span style={{ color: '#fff' }}>A STRONGER YOU.</span></>;
  const sub = bible
    ? 'Faith. Comfort. Guidance. Anytime you need it.'
    : variant === 'scripture'
      ? 'PSALM 119:105'
      : 'Scripture for real life — whenever you need it.';

  return (
    <section style={{
      width: '100%', minHeight: 190, marginTop: 28, border: '1px solid rgba(239,199,68,.7)',
      backgroundImage: 'linear-gradient(90deg,rgba(0,15,31,.78),rgba(0,20,38,.24)),url(/images/sanctuary-mountains.svg)',
      backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '24px 28px', boxSizing: 'border-box', overflow: 'hidden'
    }}>
      <h2 style={{ margin: 0, color: '#efc744', fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600,
        fontSize: 'clamp(23px,3vw,38px)', lineHeight: 1.08, letterSpacing: '.5px', textShadow: '0 2px 14px rgba(0,0,0,.45)' }}>
        {heading}
      </h2>
      <p style={{ margin: '12px 0 0', color: '#f4e8c2', fontFamily: 'Cinzel, Georgia, serif', fontSize: 11,
        letterSpacing: '1.2px', textTransform: 'uppercase', textShadow: '0 1px 8px rgba(0,0,0,.65)' }}>
        {sub}
      </p>
    </section>
  );
}
