import { lazy, Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { aaretAtGoereOp } from './aarsopgoerelse';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap } from './ui';
import { useErDesktop } from './useMedie';
import StederPanel from './StederPanel';

// Statistikken er tung — månedsgraf, mønstre, vurderinger — og ses et par
// gange om året. Den hentes først, når man vælger fanen. Se App.tsx for
// resten af de skærme, der er delt fra startbundtet.
const StatistikPanel = lazy(() => import('./StatistikPanel'));

interface Props {
  // Enten 'steder' eller 'statistik'. Fanen er skærmens tilstand og ligger i
  // appens navigation frem for i skærmens egen useState: Mere-rækkerne peger
  // hver sin vej ind, og en tilbage-knap skal kunne lande det rigtige sted.
  fane: Fane;
  skift: (f: Fane) => void;
  aabnSted: (id: number) => void;
  nytSted: () => void;
  aabnItem: (id: number) => void;
  aabnAar: (aar: number) => void;
}

// Friluftshistorik — Steder og Statistik samlet ét sted.
//
// De var to skærme, og det var to skærme om det samme: hvor man har været, og
// hvad det blev til. Man kom til dem ad hver sin række under Mere, og hver af
// dem sagde kun sin halvdel. `docs/design/desktop/09-steder-statistik.html`
// tegner dem som én skærm med to faneblade, og det er den, det her er.
//
// Tonen er journal og ikke instrumentbræt: en overskrift, to faner og rolige
// tal. Det, der før mødte en på Statistik — et periodevælger-segment, et
// fyldt årsopgørelseskort og fjorten felter i et gitter — er skruet ned til
// det, man faktisk kommer efter.
//
// CTA-reglen afgøres her. Det valgte faneblad er skærmens ene fyldte accent;
// årsopgørelsen er outline, og alt andet er tekst. Referencen tegner også
// årsvælgeren fyldt, men den tegning viser begge faner på én flade "for
// one-canvas review" — i produktet står de aldrig sammen, og den låste regel
// om én fyldt accent pr. skærmbillede vejer tungere end udkastets to.
function FriluftshistorikSide({ fane, skift, aabnSted, nytSted, aabnItem, aabnAar }: Props) {
  const erDesktop = useErDesktop();
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const aar = aaretAtGoereOp(ture);
  const paaSteder = fane === 'steder';

  // Knappen til årsopgørelsen står, så snart der er skrevet en tur ned med en
  // dato på — også når turene stadig er kladder.
  //
  // Den byggede først på `aarMedTure`, der springer kladder over, fordi de
  // ikke tælles med i en opgørelse. Men ture oprettes *som* kladde
  // (`opretTomTur` i opret.ts), og man flytter dem først, når man kommer
  // hjem. Så stod man med fire ture i bogen og ingen knap — og ingen
  // forklaring på hvorfor. Opgørelsen for et år uden talte ture er tom, men
  // den siger selv hvorfor ("Kladder tælles ikke med"), og det er dét svar,
  // den manglende knap holdt tilbage. Se `aaretAtGoereOp`.
  //
  // Outline og ikke fyldt: det valgte faneblad er skærmens ene fyldte accent.
  const aarsknap = aar !== null && (
    <Knap onClick={() => aabnAar(aar)}>Årsopgørelse {aar}</Knap>
  );

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Friluftshistorik"
      undertitel="Steder du har været · rolige tal fra dine ture"
      handlinger={aarsknap}
    >
      <div className="historik-faner" role="group" aria-label="Friluftshistorik">
        <button type="button" aria-pressed={paaSteder} onClick={() => skift('steder')}>Steder</button>
        <button type="button" aria-pressed={!paaSteder} onClick={() => skift('statistik')}>Statistik</button>
      </div>

      {/* På PC står årsopgørelsen i headeren, hvor referencen tegner den. På
          telefonen er der ingen header at stå i, og så hører den her — under
          fanerne, hvor den gælder dem begge. */}
      {!erDesktop && aarsknap && <div className="historik-aarsknap">{aarsknap}</div>}

      {paaSteder ? (
        <StederPanel aabnSted={aabnSted} nytSted={nytSted} />
      ) : (
        <Suspense fallback={<div className="historik-henter">Henter tallene …</div>}>
          <StatistikPanel aabnItem={aabnItem} />
        </Suspense>
      )}
    </Skal>
  );
}

export default FriluftshistorikSide;
