import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { aarsopgoerelseAtSe } from './aarsopgoerelse';
import { usendtAntal } from './sync';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { ListeRaekke, SektionsTitel } from './ui';
import type { Indstillingsmaal } from './indstillingsmaal';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnAar: (aar: number) => void;
  // Åbner indstillingerne i det afsnit, rækken handler om. Se
  // indstillingsmaal.ts — en række der bare åbner toppen af en lang skærm er
  // ikke bedre end ingen række.
  aabnIndstillinger: (maal?: Indstillingsmaal) => void;
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
function MereSide({ fane, skift, aabnAar, aabnIndstillinger }: Props) {
  // Tællinger og ikke toArray. Skærmen viser to tal, og at hente hele
  // inventaret ned i hukommelsen for at måle længden af det er spild på en
  // telefon med et par hundrede ting.
  const antalSteder = useLiveQuery(() => db.steder.count(), [], 0);
  const antalItems = useLiveQuery(() => db.items.count(), [], 0);

  // Turene hentes helt: årsopgørelsen skal bruge dem for at afgøre om der er
  // noget at se. Så er antallet gratis, og en tælling ved siden af ville være
  // den samme tabel læst to gange.
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const opgoerelse = aarsopgoerelseAtSe(ture);

  // Tallet står på rækken, så man kan se om der er noget at gå ind efter.
  const usendt = useLiveQuery(usendtAntal, [], 0);
  const syncdetalje = usendt === 0
    ? 'Alt er sendt op'
    : `${usendt} ${usendt === 1 ? 'ændring venter' : 'ændringer venter'}`;

  return (
    <Skal fane={fane} skift={skift} titel="Mere">
      <section>
        <SektionsTitel>Din friluftshistorik</SektionsTitel>
        <ListeRaekke
          titel="Steder"
          detalje={`${antalSteder} ${antalSteder === 1 ? 'sted' : 'steder'} du kommer tilbage til`}
          onClick={() => skift('steder')}
        />
        <ListeRaekke
          titel="Statistik"
          detalje={`${ture.length} ${ture.length === 1 ? 'tur' : 'ture'} · ${antalItems} ting talt op`}
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

      {/* Specens §2.5 og §18 vil have dem som rækker her, og §2 siger direkte,
          at hovedfunktioner ikke må gemmes bag andre hovedfunktioner. De lå
          alle sammen som afsnit inde i Indstillinger — man skulle vide, de var
          der. Nu står de fremme, og hver række lander i sit eget afsnit. */}
      <section style={{ marginTop: 'var(--plads-5)' }}>
        <SektionsTitel>Appen</SektionsTitel>
        <ListeRaekke
          titel="Synkronisering"
          detalje={syncdetalje}
          onClick={() => aabnIndstillinger('synkronisering')}
        />
        <ListeRaekke
          titel="Skabeloner"
          detalje="Afgangs-tjek og pak-af-tjek — det du starter hver tur med"
          onClick={() => aabnIndstillinger('skabeloner')}
        />
        <ListeRaekke
          titel="Backup, eksport og import"
          detalje="Gem en kopi af det hele, eller læs en ind"
          onClick={() => aabnIndstillinger('data')}
        />
        <ListeRaekke
          titel="Indstillinger"
          detalje="Konto, din krop og resten af det, der gælder hele appen"
          onClick={() => aabnIndstillinger()}
        />
        <ListeRaekke
          titel="Hjælp og om Feltbogen"
          detalje="Rundvisningen, versionen og hvad appen gemmer"
          onClick={() => aabnIndstillinger('om')}
        />
      </section>
    </Skal>
  );
}

export default MereSide;
