// One outline family for navigation; text labels remain visible.
export type IkonNavn = 'hjem' | 'ture' | 'grej' | 'folk' | 'mere' | 'kompas';
export function Ikon({ navn, size = 22 }: { navn: IkonNavn; size?: number }) {
  const paths: Record<IkonNavn, React.ReactNode> = {
    hjem: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
    ture: <><path d="m2 20 7-14 5 9 3-5 5 10Z" /><path d="m6 12 3 2 3-2" /></>,
    grej: <><rect x="5" y="6" width="14" height="15" rx="4" /><path d="M9 6V3h6v3M8 13h8v5H8Z" /></>,
    folk: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3" /></>,
    mere: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    kompas: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[navn]}</svg>;
}
