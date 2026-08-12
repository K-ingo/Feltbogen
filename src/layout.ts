import type { CSSProperties } from 'react';

// Ligger adskilt fra ui.tsx, så den fil kun eksporterer komponenter og
// fast refresh virker under udvikling.
export const layout = {
  container: {
    padding: '20px',
    maxWidth: '640px',
    margin: '0 auto',
    // Holder indhold fri af hakket i toppen og home-baren i bunden når appen
    // kører installeret. Der skal ikke længere gøres plads til
    // bundnavigationen: den ligger som en række i skallen og lægger sig ikke
    // hen over indholdet.
    paddingTop: 'calc(20px + env(safe-area-inset-top))',
    paddingBottom: 'calc(28px + env(safe-area-inset-bottom))'
  } as CSSProperties
};
