import type { CSSProperties } from 'react';

// Ligger adskilt fra ui.tsx, så den fil kun eksporterer komponenter og
// fast refresh virker under udvikling.
export const layout = {
  // Bundpolstringen holder indhold fri af den faste bundnavigation.
  container: {
    padding: '20px',
    maxWidth: '640px',
    margin: '0 auto',
    paddingBottom: '90px'
  } as CSSProperties
};
