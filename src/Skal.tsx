import type { ReactNode } from 'react';
import { useErDesktop } from './useMedie';

export type Fane = 'dashboard' | 'inventar' | 'grupper' | 'ture' | 'statistik' | 'indstillinger';

// `kort` bruges i bundnavigationen, hvor fanerne skal dele skærmbredden.
// Indstillinger står kun i sidebaren på PC; på mobil er der ikke plads til en
// sjette fane, og den nås i stedet fra tandhjulet i topbaren.
const FANER: { id: Fane; label: string; kort: string; iBundnav: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', kort: 'Hjem', iBundnav: true },
  { id: 'inventar', label: 'Inventar', kort: 'Inventar', iBundnav: true },
  { id: 'grupper', label: 'Grupper', kort: 'Grupper', iBundnav: true },
  { id: 'ture', label: 'Ture', kort: 'Ture', iBundnav: true },
  { id: 'statistik', label: 'Statistik', kort: 'Stat', iBundnav: true },
  { id: 'indstillinger', label: 'Indstillinger', kort: 'Mere', iBundnav: false }
];

const BUNDFANER = FANER.filter((f) => f.iBundnav);

interface Props {
  fane: Fane;
  skift: (fane: Fane) => void;
  // Udelades af detaljeskærme, der har deres egen header — så beholder de
  // sidebaren på PC uden at få to overskrifter.
  titel?: string;
  // Linjen under titlen, fx "34 items · 21.400 kr".
  undertitel?: ReactNode;
  // Knapper i headeren på PC. På mobil er den primære handling en FAB.
  handlinger?: ReactNode;
  // Vises som flydende + nederst til højre på mobil.
  fab?: () => void;
  children: ReactNode;
}

// Rammen om listeskærmene: sidebar på PC, topbar + bundnavigation på mobil.
// Detaljeskærme har deres egen header og bruger ikke Skal.
export function Skal({ fane, skift, titel, undertitel, handlinger, fab, children }: Props) {
  const erDesktop = useErDesktop();

  if (erDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar fane={fane} skift={skift} />
        <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 60px', maxWidth: '1100px' }}>
          {titel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0 }}>{titel}</h2>
                {undertitel && (
                  <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
                    {undertitel}
                  </div>
                )}
              </div>
              {handlinger && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {handlinger}
                </div>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    );
  }

  return (
    <>
      {titel && <Topbar titel={titel} tilIndstillinger={() => skift('indstillinger')} />}
      <div style={{
        padding: '16px 20px',
        maxWidth: '640px',
        margin: '0 auto',
        paddingBottom: 'calc(90px + env(safe-area-inset-bottom))'
      }}>
        {undertitel && (
          <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '14px' }}>
            {undertitel}
          </div>
        )}
        {children}
      </div>
      {fab && <Fab onClick={fab} />}
      <BundNav fane={fane} skift={skift} />
    </>
  );
}

function Topbar({ titel, tilIndstillinger }: { titel: string; tilIndstillinger: () => void }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 15,
      background: 'var(--bg-topbar)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(8px)',
      paddingTop: 'env(safe-area-inset-top)'
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--tekst)'
        }}>
          {titel}
        </span>
        <button
          onClick={tilIndstillinger}
          aria-label="Indstillinger"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '2px 4px', color: 'var(--tekst-dæmpet)' }}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}

function Sidebar({ fane, skift }: { fane: Fane; skift: (f: Fane) => void }) {
  return (
    <nav style={{
      width: '220px',
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg-topbar)',
      padding: '24px 12px',
      position: 'sticky',
      top: 0,
      alignSelf: 'flex-start',
      height: '100vh'
    }}>
      <div style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '19px',
        padding: '0 10px 20px',
        color: 'var(--tekst)'
      }}>
        Feltbogen
      </div>

      {FANER.map(({ id, label }) => {
        const erAktiv = fane === id;
        return (
          <button
            key={id}
            onClick={() => skift(id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '9px 10px',
              marginBottom: '2px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: erAktiv ? 600 : 500,
              background: erAktiv ? 'var(--accent-bg)' : 'transparent',
              color: erAktiv ? 'var(--accent)' : 'var(--tekst-dæmpet)'
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function BundNav({ fane, skift }: { fane: Fane; skift: (f: Fane) => void }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      background: 'var(--bg-topbar)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -4px 12px var(--skygge)',
      backdropFilter: 'blur(8px)',
      // Holder knapperne fri af home-baren når appen kører installeret på iOS.
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 20
    }}>
      {BUNDFANER.map(({ id, kort }) => {
        const erAktiv = fane === id;
        return (
          <button
            key={id}
            onClick={() => skift(id)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '14px 2px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '10px',
              color: erAktiv ? 'var(--accent)' : 'var(--tekst-dæmpet)',
              fontWeight: erAktiv ? 600 : 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderTop: erAktiv ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s'
            }}
          >
            {kort}
          </button>
        );
      })}
    </div>
  );
}

function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Tilføj"
      style={{
        position: 'fixed',
        right: '20px',
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        width: '54px',
        height: '54px',
        borderRadius: '50%',
        border: 'none',
        background: 'var(--accent)',
        color: 'var(--accent-tekst)',
        fontSize: '26px',
        lineHeight: 1,
        cursor: 'pointer',
        boxShadow: '0 4px 14px var(--skygge)',
        zIndex: 21
      }}
    >
      +
    </button>
  );
}
