import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { aarMedTure } from './aarsopgoerelse';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap } from './ui';
import StederPanel from './StederPanel';
import StatistikPanel from './StatistikPanel';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnSted: (id: number, nyOprettet?: boolean) => void;
  aabnItem: (id: number, nyOprettet?: boolean) => void;
  aabnAar: (aar: number) => void;
  nytSted: () => void;
}

// Friluftshistorik — Steder og Statistik under ét.
//
// De var to faner under Mere og stillede det samme spørgsmål hver for sig:
// hvor har jeg været, og hvad blev det til. Referencen
// (docs/design/desktop/09-steder-statistik.html) lægger dem under én titel med
// to faneblade, fordi svaret er det samme materiale læst to måder — stederne
// som en liste man kommer tilbage til, tallene som rolig optælling.
//
// Fanerne er stadig `steder` og `statistik` i skallen. Det er dem, Mere-rækkerne
// peger på, og det er dem, navigationen kender — skærmen er samlet, uden at
// vejen dertil har flyttet sig.
//
// Den ene fyldte accent på skærmen er det valgte faneblad. Derfor er
// «Årsopgørelse» outline og årsvælgeren tonet; se docs/design/TOKENS.md.
const BLADE: { id: Fane; label: string }[] = [
  { id: 'steder', label: 'Steder' },
  { id: 'statistik', label: 'Statistik' }
];

function FriluftshistorikSide({ fane, skift, aabnSted, aabnItem, aabnAar, nytSted }: Props) {
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];

  // Årsopgørelsen findes kun, når der er et år at gøre op. Knappen står ikke
  // der og lover en skærm, der ville være tom.
  const aarene = aarMedTure(ture);

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Friluftshistorik"
      undertitel="Steder du har været · rolige tal fra dine ture"
      handlinger={aarene.length > 0 && (
        <Knap variant="sekundaer" onClick={() => aabnAar(aarene[0])}>
          Årsopgørelse {aarene[0]}
        </Knap>
      )}
    >
      <div role="tablist" aria-label="Friluftshistorik" className="hist-faner">
        {BLADE.map((blad) => (
          <button
            key={blad.id}
            type="button"
            role="tab"
            aria-selected={fane === blad.id}
            tabIndex={fane === blad.id ? 0 : -1}
            onKeyDown={(e) => {
              const i = BLADE.findIndex((b) => b.id === fane);
              const naeste = e.key === 'ArrowRight' ? (i + 1) % BLADE.length
                : e.key === 'ArrowLeft' ? (i - 1 + BLADE.length) % BLADE.length
                  : -1;
              if (naeste < 0) return;
              e.preventDefault();
              skift(BLADE[naeste].id);
            }}
            onClick={() => skift(blad.id)}
          >
            {blad.label}
          </button>
        ))}
      </div>

      {fane === 'steder' ? (
        <StederPanel ture={ture} steder={steder} aabnSted={aabnSted} nytSted={nytSted} />
      ) : (
        <StatistikPanel
          ture={ture}
          items={items}
          grupper={grupper}
          steder={steder}
          aabnItem={aabnItem}
        />
      )}
    </Skal>
  );
}

export default FriluftshistorikSide;
