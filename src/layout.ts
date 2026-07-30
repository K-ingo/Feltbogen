import type { CSSProperties } from 'react';

// Ligger adskilt fra ui.tsx, så den fil kun eksporterer komponenter og
// fast refresh virker under udvikling.
export const layout = {
  container: {
    padding: '20px',
    maxWidth: '640px',
    margin: '0 auto',
    // Holder indhold fri af den faste bundnavigation — plus hakket i toppen og
    // home-baren i bunden når appen kører installeret.
    paddingTop: 'calc(20px + env(safe-area-inset-top))',
    paddingBottom: 'calc(90px + env(safe-area-inset-bottom))'
  } as CSSProperties
};
