import type { ReactNode } from 'react';
import { useErDesktop, useSynligHoejde } from './useMedie';
import { markerSet, useErSet, FAB_TIP_SET } from './indstillinger';
import { FortrydToast } from './FortrydToast';

export type Fane = 'dashboard' | 'inventar' | 'grupper' | 'ture' | 'steder' | 'statistik' | 'indstillinger';

// `kort` bruges i bundnavigationen, hvor fanerne skal dele skærmbredden.
//
// Seks faner deler bredden. På den smalleste telefon der er værd at regne med
// (360 px) bliver hver fane 60 px — bredere end de 44 px en finger skal have,
// og "Inventar" er stadig det længste ord der kan stå på én linje. Flere end
// seks kan der ikke være: indstillinger nås fra tandhjulet i topbaren.
const FANER: { id: Fane; label: string; kort: string; iBundnav: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', kort: 'Hjem', iBundnav: true },
  { id: 'inventar', label: 'Inventar', kort: 'Inventar', iBundnav: true },
  { id: 'grupper', label: 'Grupper', kort: 'Grupper', iBundnav: true },
  { id: 'ture', label: 'Ture', kort: 'Ture', iBundnav: true },
  { id: 'steder', label: 'Steder', kort: 'Steder', iBundnav: true },
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
  const synligHoejde = useSynligHoejde();

  if (erDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar fane={fane} skift={skift} />
        {/* Loftet er der for læsbarhedens skyld — en linje der løber tværs
            over en bred skærm er svær at følge. Men 1100 px lod en tredjedel
            af skærmen stå tom på en almindelig PC-skærm. */}
        <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 60px', maxWidth: '1600px' }}>
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
        <FortrydToast bund="24px" />
      </div>
    );
  }

  // Skallen er en kasse på præcis skærmens højde: topbar, et indhold der
  // scroller for sig selv, og bundnavigationen nederst som en helt almindelig
  // række. Før lå navigationen og FAB'en som `position: fixed` og hang dermed
  // på browserens mål af vinduet — og målte den forkert, som iOS kan finde på,
  // lagde de sig midt inde i listen mens indholdet blev tegnet hele vejen ned
  // bag dem. Nu er der ikke noget at måle forkert: navigationen er bunden af
  // kassen, og indholdet kan ikke nå uden om den.
  return (
    <div style={{
      height: synligHoejde ? `${synligHoejde}px` : '100dvh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      // Containing block for FAB'en og dens tip.
      position: 'relative'
    }}>
      {titel && <Topbar titel={titel} tilIndstillinger={() => skift('indstillinger')} />}

      <div style={{
        flex: 1,
        // Uden den her kan et flex-barn ikke blive lavere end sit indhold, og
        // så scroller kassen i stedet for indholdet.
        minHeight: 0,
        overflowY: 'auto',
        // Elastikken i enderne bliver inde i indholdet og trækker ikke hele
        // skallen med.
        overscrollBehaviorY: 'contain',
        WebkitOverflowScrolling: 'touch'
      }}>
        <div style={{
          padding: '16px 20px',
          maxWidth: '640px',
          margin: '0 auto',
          // Kun FAB'en skal der gøres plads til nu — den svæver 72 px over
          // bunden og er 54 px høj, og lå ellers oven på den sidste linje.
          paddingBottom: fab ? '140px' : '24px'
        }}>
          {undertitel && (
            <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '14px' }}>
              {undertitel}
            </div>
          )}
          {children}
        </div>
      </div>

      {fab && <Fab onClick={fab} />}
      {fab && <FabTip />}
      <FortrydToast bund="calc(136px + env(safe-area-inset-bottom))" />
      <BundNav fane={fane} skift={skift} />
    </div>
  );
}

function Topbar({ titel, tilIndstillinger }: { titel: string; tilIndstillinger: () => void }) {
  return (
    <div style={{
      // Ikke længere sticky: topbaren er en række i skallen, og indholdet
      // scroller under den af sig selv.
      flexShrink: 0,
      background: 'var(--bg-topbar)',
      borderBottom: '1px solid var(--border)',
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
      display: 'flex',
      flexShrink: 0,
      background: 'var(--bg-topbar)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -4px 12px var(--skygge)',
      // Ingen backdrop-filter mere. `--bg-topbar` er uigennemsigtig, så
      // sløringen var alligevel ikke til at se — men den tvang baren op i sit
      // eget kompositionslag, og dem tegner iOS ikke altid det rigtige sted.
      // Holder knapperne fri af home-baren når appen kører installeret på iOS.
      paddingBottom: 'env(safe-area-inset-bottom)'
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
              // Var 0,5. Med seks faner står "INVENTAR" og "GRUPPER" næsten op
              // ad hinanden på en 360 px skærm, og de her to tiendedele er
              // luften imellem dem.
              letterSpacing: '0.3px',
              // Bliver det alligevel for trangt, skal ordet hellere klippes end
              // brække om på to linjer og gøre baren høj og ujævn.
              whiteSpace: 'nowrap',
              overflow: 'hidden',
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

// Peger på FAB'en første gang man ser den. Wireframets rundtur er fire trin;
// her er kun det ene, fordi det er det eneste sted knappen ikke forklarer sig
// selv — resten af appen har almindelige knapper med tekst på.
function FabTip() {
  const set = useErSet(FAB_TIP_SET);
  if (set !== false) return null;

  return (
    <div style={{
      // Absolut og ikke fast: den hører til i skallen, ikke i vinduet.
      position: 'absolute',
      right: '20px',
      bottom: 'calc(150px + env(safe-area-inset-bottom))',
      maxWidth: '230px',
      padding: '12px 14px',
      borderRadius: '10px',
      background: 'var(--tekst)',
      color: 'var(--bg)',
      boxShadow: '0 4px 16px var(--skygge)',
      zIndex: 25,
      fontSize: '12px',
      lineHeight: 1.5
    }}>
      <div style={{ fontWeight: 600, marginBottom: '3px' }}>Tilføj her</div>
      <div style={{ opacity: 0.85 }}>
        Tryk på + for at oprette. Du kan altid rette det bagefter.
      </div>
      <button
        onClick={() => void markerSet(FAB_TIP_SET)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px 0 0',
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.85,
          fontSize: '12px',
          textDecoration: 'underline'
        }}
      >
        Forstået
      </button>
    </div>
  );
}

function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Tilføj"
      style={{
        position: 'absolute',
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
