import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Knap } from './ui';
import { Ikon } from './Ikon';
import { startskridt, knapvariant } from './komIGang';
import type { Startskridt } from './komIGang';

interface Props {
  // Overskriften siger, hvad skærmen er tom for — resten er det samme på alle
  // tre skærme. Se komIGang.ts.
  overskrift: string;
  tekst: string;
  opretTur: () => void;
  tilfoejGrej: () => void;
  // Skridtet, skærmen selv handler om. Det får outline, så længe det mangler.
  fokus: Startskridt;
  // Skridt, skærmen allerede har en knap til lige ovenover. Skridtet står
  // stadig på listen, men uden en knap nummer to til det samme.
  udenKnap?: Startskridt[];
}

// Den tomme tilstand på Hjem, Ture og Grej: to konkrete skridt og ikke en
// rundvisning. Der står ingen eksempeldata — tallene er dem, der ligger i
// basen, og et gjort skridt siger kun det, der er sandt.
export function KomIGang({ overskrift, tekst, opretTur, tilfoejGrej, fokus, udenKnap = [] }: Props) {
  const antalTure = useLiveQuery(() => db.ture.count(), [], 0);
  const antalEjet = useLiveQuery(() => db.items.where('status').equals('ejer').count(), [], 0);

  const skridt = startskridt(antalTure, antalEjet);
  const handling: Record<Startskridt, () => void> = { tur: opretTur, grej: tilfoejGrej };

  return (
    <section className="kom-i-gang" aria-label="Kom i gang">
      <h2 className="kom-i-gang-titel">{overskrift}</h2>
      <p className="kom-i-gang-tekst">{tekst}</p>
      <ol className="kom-i-gang-liste">
        {skridt.map((s, i) => (
          <li key={s.id} className={s.gjort ? 'kom-i-gang-skridt is-gjort' : 'kom-i-gang-skridt'}>
            <span className="kom-i-gang-maerke" aria-hidden="true">
              {s.gjort ? '✓' : <Ikon navn={s.id === 'tur' ? 'ture' : 'grej'} size={20} />}
            </span>
            <span className="kom-i-gang-indhold">
              <span className="kom-i-gang-skridttitel">
                <span className="kom-i-gang-nr">{i + 1}.</span> {s.titel}
                {s.gjort && <span className="sr-only"> — gjort</span>}
              </span>
              <span className="kom-i-gang-detalje">{s.detalje}</span>
            </span>
            {!s.gjort && !udenKnap.includes(s.id) && (
              <Knap variant={knapvariant(skridt, s.id, fokus, udenKnap)} onClick={handling[s.id]}>{s.knap}</Knap>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
