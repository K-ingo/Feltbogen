import type { ReactNode } from 'react';
import { useErDesktop, useSynligHoejde } from './useMedie';
import { markerSet, useErSet, FAB_TIP_SET } from './indstillinger';
import { FortrydToast } from './FortrydToast';

export type Fane =
  // Hovedfanerne. Fem, og det er loftet: de deler skærmbredden på en telefon.
  | 'dashboard' | 'ture' | 'inventar' | 'folk' | 'mere'
  // Underskærme. De nås inde fra Grej og Mere og står ikke i navigationen —
  // ikke fordi de er mindre vigtige, men fordi navigationen skal kunne læres.
  | 'grupper' | 'steder' | 'statistik' | 'indstillinger';

// `kort` bruges i bundnavigationen, hvor fanerne skal dele skærmbredden.
//
// Fem faner, ikke seks. Før stod Inventar, Grupper, Steder og Statistik alle
// i bunden, og så var der ikke plads til hverken Folk eller et sted at samle
// det tværgående. Nu ligger grejsættene under Grej, hvor de hører til, og
// Steder og Statistik under Mere.
//
// På den smalleste telefon der er værd at regne med (360 px) får hver fane
// 72 px. Alle fem ord kan stå på én linje uden at blive klippet.
const FANER: { id: Fane; label: string; kort: string; iBundnav: boolean }[] = [
  { id: 'dashboard', label: 'Hjem', kort: 'Hjem', iBundnav: true },
  { id: 'ture', label: 'Ture', kort: 'Ture', iBundnav: true },
  { id: 'inventar', label: 'Grej', kort: 'Grej', iBundnav: true },
  { id: 'folk', label: 'Folk', kort: 'Folk', iBundnav: true },
  { id: 'mere', label: 'Mere', kort: 'Mere', iBundnav: false },
  { id: 'grupper', label: 'Grejsæt', kort: 'Grejsæt', iBundnav: false },
  { id: 'steder', label: 'Steder', kort: 'Steder', iBundnav: false },
  { id: 'statistik', label: 'Statistik', kort: 'Stat', iBundnav: false },
  { id: 'indstillinger', label: 'Indstillinger', kort: 'Indstillinger', iBundnav: false }
];

// Mere står i bunden på mobil, men på PC står den for sig under en streg —
// den er ikke et sted man arbejder, den er der hvor det tværgående ligger.
const BUNDFANER = [...FANER.filter((f) => f.iBundnav), FANER.find((f) => f.id === 'mere')!];
const SIDEBARFANER = FANER.filter((f) => f.iBundnav);

// Hvilken hovedfane en underskærm hører til.
//
// Uden den står navigationen uden markering, så snart man er inde i Steder
// eller Grejsæt, og så kan man ikke se hvor i appen man er. Markeringen skal
// pege på den hovedfane man kom fra — det er dén, mentalt, man står i.
const HOERER_TIL: Partial<Record<Fane, Fane>> = {
  grupper: 'inventar',
  steder: 'mere',
  statistik: 'mere',
  indstillinger: 'mere'
};

function hovedfane(fane: Fane): Fane {
  return HOERER_TIL[fane] ?? fane;
}

// Vejen tilbage til den fane, en underskærm hører til.
//
// Den udledes frem for at blive sendt med som prop. Skallen ved allerede hvem
// forælderen er, og en vej tilbage man kan glemme at sende med, er en vej
// tilbage der før eller siden mangler ét sted.
function forael(fane: Fane): { id: Fane; label: string } | null {
  const op = HOERER_TIL[fane];
  if (!op) return null;

  const f = FANER.find((x) => x.id === op);
  return f ? { id: f.id, label: f.label } : null;
}

// "‹ Grej" over titlen på en underskærm. Bundnavigationen viser godt nok
// hvilken hovedfane man står i, men den siger ikke at man står et niveau
// nede — og så er der ingen vej tilbage der ligner en vej tilbage.
function Tilbagelinje({ til, skift }: { til: { id: Fane; label: string }; skift: (f: Fane) => void }) {
  return (
    <button
      onClick={() => skift(til.id)}
      style={{
        minHeight: 'var(--roerehoejde)',
        display: 'inline-flex',
        alignItems: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 'var(--skrift-knap)',
        color: 'var(--tekst-dæmpet)',
        padding: '0 var(--plads-2) 0 0'
      }}
    >
      ‹ {til.label}
    </button>
  );
}

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
  const op = forael(fane);

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
                {op && <Tilbagelinje til={op} skift={skift} />}
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
      {titel && <Topbar titel={titel} tilbage={op && <Tilbagelinje til={op} skift={skift} />} />}

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

// Topbaren havde et tandhjul, dengang indstillinger kun kunne nås derfra. Nu
// ligger de under Mere i navigationen, og en genvej ved siden af titlen ville
// være en anden dør til det samme rum. Strukturen skal kunne læres ét sted.
function Topbar({ titel, tilbage }: { titel: string; tilbage?: ReactNode }) {
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
        padding: 'var(--plads-2) var(--plads-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--plads-3)'
      }}>
        {tilbage}
        <span style={{
          fontSize: 'var(--skrift-detalje)',
          fontWeight: 600,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--tekst)'
        }}>
          {titel}
        </span>
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
      padding: 'var(--plads-5) var(--plads-3)',
      position: 'sticky',
      top: 0,
      alignSelf: 'flex-start',
      height: '100vh'
    }}>
      <div style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '19px',
        padding: '0 10px var(--plads-5)',
        color: 'var(--tekst)'
      }}>
        Feltbogen
      </div>

      {SIDEBARFANER.map(({ id, label }) => {
        const erAktiv = hovedfane(fane) === id;
        return (
          <button
            key={id}
            onClick={() => skift(id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              minHeight: 'var(--roerehoejde)',
              padding: '0 10px',
              marginBottom: '2px',
              borderRadius: 'var(--runding-lille)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--skrift-knap)',
              fontWeight: erAktiv ? 600 : 500,
              background: erAktiv ? 'var(--accent-bg)' : 'transparent',
              color: erAktiv ? 'var(--accent)' : 'var(--tekst-dæmpet)'
            }}
          >
            {label}
          </button>
        );
      })}

      {/* Stregen skiller det man arbejder i fra det man administrerer. */}
      <div style={{
        borderTop: '1px solid var(--border)',
        margin: 'var(--plads-3) 10px'
      }} />

      <button
        onClick={() => skift('mere')}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          minHeight: 'var(--roerehoejde)',
          padding: '0 10px',
          borderRadius: 'var(--runding-lille)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--skrift-knap)',
          fontWeight: hovedfane(fane) === 'mere' ? 600 : 500,
          background: hovedfane(fane) === 'mere' ? 'var(--accent-bg)' : 'transparent',
          color: hovedfane(fane) === 'mere' ? 'var(--accent)' : 'var(--tekst-dæmpet)'
        }}
      >
        Mere
      </button>
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
        const erAktiv = hovedfane(fane) === id;
        return (
          <button
            key={id}
            onClick={() => skift(id)}
            style={{
              flex: 1,
              minWidth: 0,
              // Baren er det man rammer flest gange om dagen, og tit med
              // tommelen uden at kigge. Rørehøjden er gulvet under den.
              minHeight: 'var(--roerehoejde)',
              padding: 'var(--plads-4) 2px var(--plads-3)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--skrift-mikro)',
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
      padding: 'var(--plads-3) var(--plads-4)',
      borderRadius: 'var(--runding-lille)',
      background: 'var(--tekst)',
      color: 'var(--bg)',
      boxShadow: '0 4px 16px var(--skygge)',
      zIndex: 25,
      fontSize: 'var(--skrift-detalje)',
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
