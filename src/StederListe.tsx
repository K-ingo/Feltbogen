import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { besoegPrSted, besoegstekst } from './steder';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, TagChips, ListeRaekke, TomListe } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnSted: (id: number, nyOprettet?: boolean) => void;
  nytSted: () => void;
}

// De steder man kommer mest, står øverst. Et sted man har været fem gange er
// mere værd at finde igen end et man kiggede på én gang.
function StederListe({ fane, skift, aabnSted, nytSted }: Props) {
  const steder = useLiveQuery(() => db.steder.toArray());
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

  const besoeg = besoegPrSted(ture);
  const sorteret = [...(steder ?? [])].sort((a, b) => {
    const forskel = (besoeg.get(b.uid) ?? 0) - (besoeg.get(a.uid) ?? 0);
    return forskel !== 0 ? forskel : a.navn.localeCompare(b.navn, 'da');
  });

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Steder"
      undertitel={`${sorteret.length} ${sorteret.length === 1 ? 'sted' : 'steder'}`}
      handlinger={<Knap variant="primaer" onClick={nytSted}>+ Nyt sted</Knap>}
      fab={nytSted}
    >
      {sorteret.length === 0 && (
        <TomListe>
          Ingen steder endnu. Gem et sted fra en tur, eller opret et her — så står
          noterne klar næste gang du kommer forbi.
        </TomListe>
      )}

      {sorteret.map((sted) => (
        <ListeRaekke
          key={sted.uid}
          titel={sted.navn || 'Uden navn'}
          detalje={[besoegstekst(besoeg.get(sted.uid) ?? 0), sted.adresse]
            .filter(Boolean)
            .join(' · ')}
          onClick={() => sted.id !== undefined && aabnSted(sted.id)}
        >
          <TagChips tags={sted.tags} maks={5} />
        </ListeRaekke>
      ))}
    </Skal>
  );
}

export default StederListe;
