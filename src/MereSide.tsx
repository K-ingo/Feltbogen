import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { aarsopgoerelseAtSe } from './aarsopgoerelse';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { ListeRaekke, SektionsTitel } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnAar: (aar: number) => void;
}

// Det tværgående.
//
// Steder, statistik og indstillinger blev brugt sjældnere end ture og grej,
// men fyldte lige så meget i navigationen. Her ligger de samlet, så
// hovednavigationen kan være kort og forudsigelig — uden at noget bliver
// gemt væk: alt på skærmen står som en linje man kan se, ikke bag en menu.
//
// Kommer der nye tværgående funktioner til, er det her de hører hjemme. En
// ny top-level fane kræver en stærk begrundelse.
function MereSide({ fane, skift, aabnAar }: Props) {
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const items = useLiveQuery(() => db.items.toArray()) ?? [];

  const opgoerelse = aarsopgoerelseAtSe(ture);

  return (
    <Skal fane={fane} skift={skift} titel="Mere">
      <section>
        <SektionsTitel>Din friluftshistorik</SektionsTitel>
        <ListeRaekke
          titel="Steder"
          detalje={`${steder.length} ${steder.length === 1 ? 'sted' : 'steder'} du kommer tilbage til`}
          onClick={() => skift('steder')}
        />
        <ListeRaekke
          titel="Statistik"
          detalje={`${ture.length} ${ture.length === 1 ? 'tur' : 'ture'} · ${items.length} ${items.length === 1 ? 'ting' : 'ting'} talt op`}
          onClick={() => skift('statistik')}
        />
        {opgoerelse !== null && (
          <ListeRaekke
            titel={`Sådan gik ${opgoerelse}`}
            detalje="Årsopgørelsen er klar"
            onClick={() => aabnAar(opgoerelse)}
          />
        )}
      </section>

      <section style={{ marginTop: 'var(--plads-5)' }}>
        <SektionsTitel>Appen</SektionsTitel>
        <ListeRaekke
          titel="Indstillinger"
          detalje="Konto, synkronisering, skabeloner, backup og om appen"
          onClick={() => skift('indstillinger')}
        />
      </section>
    </Skal>
  );
}

export default MereSide;
