import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { aarsopgoerelseAtSe } from './aarsopgoerelse';
import { stederMedBesoeg, stedtal } from './friluftshistorik';
import { turtal } from './laering';
import { usendtAntal } from './sync';
import { syncstatus } from './dashboard';
import type { Syncstatus } from './dashboard';
import { useSyncfejl } from './syncfejl';
import { useAuth } from './useAuth';
import { useErDesktop, useErOnline } from './useMedie';
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
//
// PC-udgaven følger `docs/design/desktop/08-mere.html`: to sektioner, hver
// samlet i ét kort med rækker, og ikke én knap. Skærmen *er* navigation, og
// en fyldt accent-knap her ville trække øjet væk fra de døre, den består af.
function MereSide({ fane, skift, aabnAar, aabnIndstillinger }: Props) {
  const { erLoggetInd } = useAuth();
  const online = useErOnline();
  const erDesktop = useErDesktop();

  // Turene hentes helt: årsopgørelsen skal bruge dem for at afgøre om der er
  // noget at se, og de to historik-rækker regner deres tal af dem. Stederne
  // hentes med, fordi en tælling af stedbogen ikke er det, rækken siger — se
  // nedenfor. Begge tabeller er små; inventaret hentes ikke, for rækkerne
  // taler ikke længere om det.
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const opgoerelse = aarsopgoerelseAtSe(ture);

  // Rækkerne siger nu det samme som skærmen, de fører hen til.
  //
  // "Steder" talte stedbogen op og kaldte tallet "steder du kommer tilbage
  // til". Det var to fejl i én linje: et sted, man har oprettet, er ikke et
  // sted, man har været, og et sted, man har været én gang, er ikke et, man
  // kommer tilbage til. Nu er tallet stederne fra turene, og gensynene står
  // for sig. "Statistik" talte grej op ("4 ting talt op") på en skærm, der
  // handler om ture — den siger ture og nætter, som referencen skriver.
  const steds = stedtal(stederMedBesoeg(steder, ture));
  const tal = turtal(ture);

  // Rækken siger det samme som linjen på startskærmen, og af samme kilde.
  // Den sagde først "Alt er sendt op" ud fra antallet alene — også uden en
  // konto, hvor der ikke er noget at sende op til. To steder der siger
  // forskellige ting om den samme tilstand, er præcis det, forslagene skulle
  // af med.
  //
  // Den seneste fejl hører med til den kilde. Uden den kunne rækken stå og
  // sige "Alt er sendt op", fordi køen var tom — også når det, der lige var
  // blevet prøvet, blev afvist af serveren. Startskærmen har haft fejlen med
  // hele tiden; her manglede den, og så sagde de to linjer hver sit om den
  // samme tilstand. Se syncfejl.ts.
  const syncfejl = useSyncfejl();
  const usendt = useLiveQuery(usendtAntal, [], 0);
  const sync = syncstatus(usendt, online, erLoggetInd, syncfejl);

  return (
    // Telefonen har sin egen header efter docs/design/mobile/05-mere.html:
    // "Mere" i indholdet som på Ture, Grej og Folk, ingen topbar, ingen knap
    // og ingen FAB. Rækkerne er skærmens eneste handlinger.
    <Skal fane={fane} skift={skift} titel={erDesktop ? 'Mere' : undefined}>
      {!erDesktop && (
        <header className="mere-mobil-hoved">
          <h1>Mere</h1>
        </header>
      )}
      <section className="mere-sektion">
        <SektionsTitel>Din friluftshistorik</SektionsTitel>
        <div className="hub-kort">
          <ListeRaekke
            titel="Steder"
            detalje={`${steds.i_alt} ${steds.i_alt === 1 ? 'sted' : 'steder'} · ${steds.gensyn} du er kommet tilbage til`}
            onClick={() => skift('steder')}
          />
          <ListeRaekke
            titel="Statistik"
            detalje={`${tal.ture} ${tal.ture === 1 ? 'tur' : 'ture'} · ${tal.naetter} ${tal.naetter === 1 ? 'nat' : 'nætter'}`}
            onClick={() => skift('statistik')}
          />
          {/* Årsopgørelsen står ikke i referencen, fordi den kun findes, når
              der er et år at gøre op. Den hører til her og ikke i Appen: det
              er historik, og den skal se ud som de to rækker over sig — ikke
              som en kampagne. */}
          {opgoerelse !== null && (
            <ListeRaekke
              titel={`Sådan gik ${opgoerelse}`}
              detalje="Årsopgørelsen er klar"
              onClick={() => aabnAar(opgoerelse)}
            />
          )}
        </div>
      </section>

      {/* Specens §2.5 og §18 vil have dem som rækker her, og §2 siger direkte,
          at hovedfunktioner ikke må gemmes bag andre hovedfunktioner. De lå
          alle sammen som afsnit inde i Indstillinger — man skulle vide, de var
          der. Nu står de fremme, og hver række lander i sit eget afsnit. */}
      <section className="mere-sektion" style={{ marginTop: 'var(--plads-6)' }}>
        <SektionsTitel>Appen</SektionsTitel>
        <div className="hub-kort">
          <ListeRaekke
            titel="Synkronisering"
            detalje={<Syncdetalje status={sync} />}
            onClick={() => aabnIndstillinger('synkronisering')}
          />
          <ListeRaekke
            titel="Skabeloner"
            detalje="Afgangs-tjek og pak-af-tjek"
            onClick={() => aabnIndstillinger('skabeloner')}
          />
          <ListeRaekke
            titel="Backup, eksport og import"
            detalje="Gem en kopi, eller læs en ind"
            onClick={() => aabnIndstillinger('data')}
          />
          <ListeRaekke
            titel="Indstillinger"
            detalje="Konto, din krop og resten af appen"
            onClick={() => aabnIndstillinger()}
          />
          <ListeRaekke
            titel="Hjælp og om Feltbogen"
            detalje="Rundvisning, version og data"
            onClick={() => aabnIndstillinger('om')}
          />
        </div>
      </section>

      {/* Telefonens tegning har ikke fodnoten: der er sync-rækken selv nok. */}
      {erDesktop && (
        <p className="hub-fodnote">
          Sync-rækken siger, hvad der faktisk skete. Er der noget, der ikke kom op,
          står det dér — i stedet for «Alt er sendt op».
        </p>
      )}
    </Skal>
  );
}

// Statuslinjen inde i sync-rækken.
//
// Den skal kunne aflæses uden at man åbner rækken, og den skal kunne aflæses
// rigtigt: en fejl står i advarselsfarven med en prik foran, så den kan ses
// i en kolonne af ens grå undertitler. Resten holder sig i den dæmpede tekst
// — ændringer, der ligger og venter uden dækning, er den normale tilstand for
// en app, man bruger i skoven, og ikke noget, der er gået galt.
//
// Farven er advarsel og ikke fejl. Fejlfarven hører til det, der er tabt;
// her er der ikke noget tabt — det ligger stadig på enheden og skal op.
// Referencen tegner den samme: #A06000 med prik.
//
// Forklaringen står der ikke. Den fylder to linjer og hører hjemme dér, hvor
// man kan gøre noget ved den, og rækken fører derhen — se
// IndstillingerSide.tsx.
function Syncdetalje({ status }: { status: Syncstatus }) {
  const erFejl = status.tilstand === 'fejl';
  // "Alt er sendt op" er den eneste tilstand, hvor der ikke er noget
  // udestående. Den får ingen prik: en markering, der altid er der, er ikke
  // en markering.
  const rolig = status.tilstand === 'synkroniseret';

  const prikfarve = {
    synkroniseret: 'var(--succes)',
    venter: 'var(--accent)',
    offline: 'var(--tekst-svag)',
    kun_lokalt: 'var(--tekst-svag)',
    fejl: 'var(--advarsel)'
  }[status.tilstand];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      color: erFejl ? 'var(--advarsel)' : undefined,
      fontWeight: erFejl ? 500 : undefined
    }}>
      {!rolig && (
        <span className="hub-sync-prik" aria-hidden="true" style={{ background: prikfarve }} />
      )}
      {status.tekst}
    </span>
  );
}

export default MereSide;
