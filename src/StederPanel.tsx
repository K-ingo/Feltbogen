import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { formatterPeriode } from './datotekst';
import {
  stederMedBesoeg,
  stedtal,
  turkarakter,
  besoegstal
} from './friluftshistorik';
import type { Stedlinje } from './friluftshistorik';
import { Knap, TomListe } from './ui';

interface Props {
  aabnSted: (id: number) => void;
  nytSted: () => void;
}

// Steder-fanen på Friluftshistorik.
//
// Den var sin egen skærm med en flad liste og en fyldt "+ Nyt sted" øverst —
// et register, man skulle vedligeholde. Men man skriver ikke steder ind i et
// register; man skriver dem på en tur. Listen kommer derfor af turene nu
// (`stederMedBesoeg` i friluftshistorik.ts), og et sted er en linje med det,
// turene siger om det: hvor mange gange, hvor mange nætter, og hvornår sidst.
//
// "+ Nyt sted" er blevet en tekstknap nederst. Den kan stadig det, den kunne,
// men den er ikke længere skærmens forslag til, hvad man skal: det er at læse
// listen. Referencen har den slet ikke — og at fjerne den ville tage den
// eneste vej til at oprette et sted, man vil hen, før man har været der.
function StederPanel({ aabnSted, nytSted }: Props) {
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

  const linjer = stederMedBesoeg(steder, ture);
  const tal = stedtal(linjer);

  return (
    <section>
      {linjer.length > 0 && (
        <div className="historik-note">
          <p className="historik-note-titel">Fra dine ture</p>
          {/* Tre tal og ikke ét. Et sted, man har gemt uden at have været
              der, er ikke et sted fra en tur, og ét besøg er ikke et gensyn —
              summen ville sige noget andet end listen nedenunder. */}
          <p className="historik-note-tekst">
            {[
              `${tal.fra_ture} ${tal.fra_ture === 1 ? 'sted' : 'steder'} fra dine ture`,
              tal.gensyn === 0
                ? 'ingen du er kommet tilbage til endnu'
                : `${tal.gensyn} du er kommet tilbage til`,
              tal.uden_ture > 0
                ? `${tal.uden_ture} gemt uden ture endnu`
                : null
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      {linjer.length === 0 && (
        <TomListe>
          Ingen steder endnu. Skriv et sted på en tur, så står det her næste
          gang — med det, turene har lært dig om det.
        </TomListe>
      )}

      <div className="historik-steder">
        {linjer.map((linje) => (
          <Stedkort
            key={linje.noegle}
            linje={linje}
            aabn={linje.id !== undefined ? () => aabnSted(linje.id!) : undefined}
          />
        ))}
      </div>

      <div className="historik-tilfoej">
        <Knap variant="tekst" onClick={nytSted}>+ Nyt sted</Knap>
      </div>
    </section>
  );
}

// Et sted som en linje i en journal: navnet, hvad turen var, og hvad det blev
// til. Gemte steder kan åbnes; et sted, der kun står som fritekst på en tur,
// kan ikke — og så siger kortet dét frem for at se ud som en knap, der ikke
// virker.
function Stedkort({ linje, aabn }: { linje: Stedlinje; aabn?: () => void }) {
  const karakter = turkarakter(linje.sidste);
  const sidst = linje.sidste
    ? formatterPeriode(linje.sidste.startdato, linje.sidste.slutdato)
    : '';

  return (
    // Div og ikke button: kortet indeholder en overskrift og to afsnit, og
    // dem må en knap ikke have inden i sig. Samme greb som `Kort` og
    // `ListeRaekke` i ui.tsx — rollen og tastaturet følger med.
    <div
      className={aabn ? 'historik-sted is-clickable' : 'historik-sted'}
      role={aabn ? 'button' : undefined}
      tabIndex={aabn ? 0 : undefined}
      onKeyDown={aabn ? (e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          aabn();
        }
      } : undefined}
      onClick={aabn}
    >
      <div className="historik-sted-tekst">
        <h2 className="historik-sted-navn">{linje.navn}</h2>
        {(karakter || sidst || linje.adresse) && (
          <p className="historik-sted-meta">
            {[karakter || linje.adresse, sidst && `sidst ${sidst}`].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="historik-sted-tal">
          {besoegstal(linje)}
          {/* En kladde er en tur, man har skrevet ned og ikke taget endnu.
              Den tæller med i linjen — stedet skal kunne findes igen — men
              tallet skal kunne læses med det forbehold. */}
          {linje.kladde && <span className="historik-kladde"> · kladde</span>}
          {!linje.gemt && <span className="historik-sted-fritekst"> · kun skrevet på turen</span>}
        </p>
      </div>
      {aabn && <span className="historik-sted-pil" aria-hidden="true">›</span>}
    </div>
  );
}

export default StederPanel;
