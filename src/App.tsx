import { lazy, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import AuthSide from './AuthSide';
import { useAuth } from './useAuth';
import { fornyLogin } from './pb';
import { afstemMedServer, sendAfventende, sletItem, sletGruppe, sletTur, sletSted, opdaterTur } from './sync';
import type { Sted } from './db';
import type { Indstillingsmaal } from './indstillingsmaal';
import { db } from './db';
import DashboardSide from './DashboardSide';
import InventarSide from './InventarSide';
import ItemDetalje from './ItemDetalje';
import GrupperListe from './GrupperListe';
import GruppeDetalje from './GruppeDetalje';
import TureListe from './TureListe';
import TurDetalje from './TurDetalje';
import StederListe from './StederListe';
import StedDetalje from './StedDetalje';
import DeltTurDetalje from './DeltTurDetalje';

import FolkSide from './FolkSide';
import MereSide from './MereSide';




import GaesteSide from './GaesteSide';
import { tokenFraAdresse } from './gaest';
import TurkortSide from './TurkortSide';
import { turkorttokenFraAdresse } from './turkort';
import type { Turmaal } from './turmaal';
// Kobler friskningen af delte ture på skrivninger. Importeres for sin
// bivirkning — modulet melder sig selv til hos sync.
import './delesnapshot';
import { opretTomtItem, opretTomGruppe, opretTomTur, opretTomtSted } from './opret';
import { markerSet, useErSet, ONBOARDING_SET } from './indstillinger';
// Skærme man sjældent åbner, hentes først når man åbner dem.
//
// De fem her er tilsammen omkring to tusind linjer plus import/eksport, og de
// lå i det bundt, der skulle hentes ned, før appen kunne vise en pakkeliste.
// Statistikken og årsopgørelsen ses et par gange om året, rundvisningen én
// gang i alt, og indstillingerne sjældnere end noget andet.
//
// Det er specens §25, og den advarsel byggeriet har skrevet ved hver eneste
// kørsel: "Some chunks are larger than 500 kB".
const StatistikSide = lazy(() => import('./StatistikSide'));
const AarsopgoerelseSide = lazy(() => import('./AarsopgoerelseSide'));
const FeltbogSide = lazy(() => import('./FeltbogSide'));
const IndstillingerSide = lazy(() => import('./IndstillingerSide'));
const Rundvisning = lazy(() => import('./Rundvisning'));
// Første tur-flowet ses én gang, af dem der ikke har en tur endnu. Det har
// ingen plads i bundtet, alle andre skal hente ned.
const FoersteTur = lazy(() => import('./FoersteTur'));

import { Skal } from './Skal';
import type { Fane } from './Skal';

// null indgår i returtypen: onboardingen kan være uafgjort, og så tegner
// appen ingenting frem for at blinke velkomstskærmen forbi. Uden strengt
// nul-tjek i oversætteren fanges den slags ikke af sig selv.
function App(): ReactElement | null {
  const { erLoggetInd } = useAuth();
  // Et gæstelink afgøres af adresselinjen og læses én gang. Går gæsten videre
  // ind i appen, ryddes den, så et genbesøg ikke lander på turen igen.
  const [gaesteToken, setGaesteToken] = useState(() => tokenFraAdresse());
  // Turkortet er endnu snævrere end gæstelinket: modtageren har ingen konto,
  // og der er ingen vej videre ind i appen herfra.
  const [turkortToken] = useState(() => turkorttokenFraAdresse());
  const onboardingSet = useErSet(ONBOARDING_SET);
  const [viserLogin, setViserLogin] = useState(false);
  // Rundvisningen kan hentes frem igen fra indstillingerne. Den vises da som
  // opslag: uden kontosalg og uden knapper til at komme i gang.
  const [viserRundvisning, setViserRundvisning] = useState(false);
  // Det guidede flow til den første tur. Kladden ligger i basen, så den
  // overlever både at man lukker flowet og at man lukker appen — her holdes
  // kun styr på, om skærmen er fremme. Se foersteTurLogik.ts.
  const [viserFoersteTur, setViserFoersteTur] = useState(false);
  const [fane, setFane] = useState<Fane>('dashboard');
  // Valget ligger her og ikke i listeskærmene, fordi dashboardet også åbner
  // både gear og ture. nyOprettet følger med, så detaljeskærmen kan rydde en
  // navnløs post væk igen hvis man fortryder.
  const [valgtItem, setValgtItem] = useState<{ id: number; ny: boolean } | null>(null);
  const [valgtGruppe, setValgtGruppe] = useState<{ id: number; ny: boolean } | null>(null);
  const [valgtTur, setValgtTur] = useState<{ id: number; ny: boolean; maal?: Turmaal } | null>(null);
  const [valgtSted, setValgtSted] = useState<{ id: number; ny: boolean } | null>(null);
  // En tur en anden har delt. Den kan ikke redigeres og har derfor ingen
  // ny-tilstand at rydde op efter.
  const [valgtDeltTur, setValgtDeltTur] = useState<number | null>(null);
  // Årsopgørelsen er en skærm man åbner og lukker igen, ikke en fane. Året
  // ligger i tilstanden, så man kan bladre mellem årene uden at gå ud først.
  const [valgtAar, setValgtAar] = useState<number | null>(null);
  // Feltbogen ligger uden for Skal: alt der ikke er bogen, ville komme med
  // på papiret.
  const [feltbogAar, setFeltbogAar] = useState<number | null>(null);
  // Afsnittet indstillingerne skal åbne i. Sat af rækkerne under Mere og
  // ryddet igen, når man forlader skærmen — kommer man tilbage ad en anden
  // vej, er man et andet ærinde. Se indstillingsmaal.ts.
  const [indstillingsmaal, setIndstillingsmaal] = useState<Indstillingsmaal | undefined>();
  const aabnItem = (id: number, ny = false) => setValgtItem({ id, ny });
  const aabnGruppe = (id: number, ny = false) => setValgtGruppe({ id, ny });
  // maal er stedet på turen, man skal lande — sat når man kommer fra et
  // forslag eller en mangel. Se turmaal.ts.
  const aabnTur = (id: number, ny = false, maal?: Turmaal) => setValgtTur({ id, ny, maal });
  const aabnSted = (id: number, ny = false) => setValgtSted({ id, ny });
  const aabnDeltTur = (id: number) => setValgtDeltTur(id);

  // Nye poster åbnes med det samme — en tom post man skal lede efter bagefter
  // er ikke til nogen nytte.
  const nytItem = async () => aabnItem(await opretTomtItem(), true);
  const nyGruppe = async () => aabnGruppe(await opretTomGruppe(), true);
  const nyTur = async () => aabnTur(await opretTomTur(), true);

  // En tur på et sted man kender. Stedet, navnet og koordinaterne følger med,
  // så turen åbner med det udfyldt, man kom for — resten er som en ny tur.
  const nyTurPaaSted = async (sted: Sted) => {
    const id = await opretTomTur();
    await opdaterTur(id, {
      sted: sted.navn,
      sted_uid: sted.uid,
      koordinater: sted.koordinater
    });
    setValgtSted(null);
    aabnTur(id, true);
  };
  const nytSted = async () => aabnSted(await opretTomtSted(), true);

  // En navnløs post man lige har oprettet, kan ikke findes igen. Oprydningen
  // ligger her og ikke i detaljeskærmene, fordi man kan forlade dem ad to
  // veje — tilbage-knappen og et tryk i navigationen — og begge skal rydde op.
  const lukDetalje = async () => {
    const aabne = [
      { valgt: valgtItem, tabel: db.items, slet: sletItem },
      { valgt: valgtGruppe, tabel: db.grupper, slet: sletGruppe },
      { valgt: valgtTur, tabel: db.ture, slet: sletTur },
      { valgt: valgtSted, tabel: db.steder, slet: sletSted }
    ];

    setValgtItem(null);
    setValgtGruppe(null);
    setValgtTur(null);
    setValgtSted(null);
    setValgtDeltTur(null);
    setValgtAar(null);
    setFeltbogAar(null);

    for (const { valgt, tabel, slet } of aabne) {
      if (!valgt?.ny) continue;
      const post = await tabel.get(valgt.id);
      if (post && !post.navn.trim()) await slet(valgt.id);
    }
  };

  // Et tryk i navigationen skal føre hen til fanen — også når der ligger en
  // detaljeskærm ovenpå. Ellers skifter markeringen, mens skærmen bliver
  // stående, og man skal trykke tilbage før man kan se hvor man er.
  // Målet ryddes ved hvert fanevalg og sættes kun af den, der vælger fanen.
  // Ellers ville et tryk på "Indstillinger" i navigationen rulle ned til det
  // afsnit, man sidst kom fra Mere for at se — og det er et andet ærinde.
  const skiftFane = (f: Fane, maal?: Indstillingsmaal) => {
    void lukDetalje();
    setIndstillingsmaal(maal);
    setFane(f);
  };

  // Markeringen skrives færdig først, så velkomstskærmen er væk inden den
  // næste skærm kommer op — ellers ville den nå at blinke igennem.
  const efterVelkomst = async (saa?: () => Promise<void>) => {
    await markerSet(ONBOARDING_SET);
    await saa?.();
  };

  // Logger man ind fra velkomsten eller indstillingerne, lukker skærmen sig
  // selv når authStore har kvitteret.
  useEffect(() => {
    if (erLoggetInd) setViserLogin(false);
  }, [erLoggetInd]);

  // Afstem med serveren ved opstart — og igen når forbindelsen kommer tilbage.
  // En tur kan vare timer uden dækning med appen åben hele tiden; uden
  // online-lytteren ville det usendte først gå op ved næste opstart.
  //
  // Sessionen fornys først: udløber tokenet mens appen står åben, sker det på
  // uret og ikke på en hændelse, og så ville afstemningen sende af sted med et
  // dødt token og blive afvist tavst.
  useEffect(() => {
    if (!erLoggetInd) return;

    const afstem = async () => {
      await fornyLogin();
      await afstemMedServer();
    };
    void afstem();

    const naarOnline = () => void afstem();
    window.addEventListener('online', naarOnline);
    return () => window.removeEventListener('online', naarOnline);
  }, [erLoggetInd]);

  // Redigeringer samles i en kort kø før de sendes. Skjules appen, sendes køen
  // med det samme, så en ændring ikke først går op ved næste opstart.
  useEffect(() => {
    const naarSkjult = () => {
      if (document.visibilityState === 'hidden') void sendAfventende();
    };
    document.addEventListener('visibilitychange', naarSkjult);
    return () => document.removeEventListener('visibilitychange', naarSkjult);
  }, []);

  // Turkortet går forud for alt: det er ét opslag for én pårørende, og hun
  // skal hverken se onboarding, login eller resten af appen.
  if (turkortToken) {
    return <TurkortSide token={turkortToken} />;
  }

  // Gæsteruten går forud for resten: den kræver hverken konto eller
  // onboarding, og den viser aldrig noget fra denne enheds egen base.
  if (gaesteToken) {
    return (
      <GaesteSide
        token={gaesteToken}
        tilAppen={() => {
          window.history.replaceState(null, '', window.location.pathname);
          setGaesteToken(null);
          // Man er kommet ind ad en invitation og har allerede set hvad appen
          // kan. Velkomsten ville bede om en konto man lige har brugt.
          void markerSet(ONBOARDING_SET);
        }}
      />
    );
  }

  if (viserLogin) {
    return <AuthSide fortryd={() => setViserLogin(false)} />;
  }

  // Onboardingen er ikke afgjort endnu — vis ingenting frem for at blinke den
  // forbi for en bruger der har set den for længst.
  if (onboardingSet === undefined) return null;

  // Flowet lægger sig over alt andet: der er ét spørgsmål ad gangen, og en
  // bundnavigation ved siden af ville være en femte ting at tage stilling til.
  if (viserFoersteTur) {
    return (
      <FoersteTur
        fortryd={() => setViserFoersteTur(false)}
        faerdig={(id) => {
          setViserFoersteTur(false);
          // Turen er lige oprettet, men ikke tom: den har både navn og
          // svarene med. Derfor ikke ny=true — den skal ikke ryddes væk igen.
          aabnTur(id);
        }}
      />
    );
  }

  if (viserRundvisning) {
    return (
      <Rundvisning
        kunOpslag
        nytItem={() => void nytItem()}
        nyTur={() => void nyTur()}
        tilLogin={() => setViserLogin(true)}
        faerdig={() => setViserRundvisning(false)}
      />
    );
  }

  // Rundvisningen slutter med at tilbyde en konto. Har man allerede en, er den
  // del ikke bare overflødig — den ser ud som om man er blevet logget ud.
  if (!onboardingSet && !erLoggetInd) {
    return (
      <Rundvisning
        nytItem={() => void efterVelkomst(nytItem)}
        nyTur={() => void efterVelkomst(nyTur)}
        tilLogin={() => void efterVelkomst(async () => setViserLogin(true))}
        faerdig={() => void efterVelkomst()}
      />
    );
  }

  // En åben detaljeskærm lægger sig over den valgte fane, indtil man går
  // tilbage. De har deres egen header, så Skal får ingen titel her.
  if (valgtItem !== null) {
    return (
      <Skal fane={fane} skift={skiftFane}>
        <ItemDetalje itemId={valgtItem.id} nyOprettet={valgtItem.ny} tilbage={lukDetalje} />
      </Skal>
    );
  }

  if (valgtGruppe !== null) {
    return (
      <Skal fane={fane} skift={skiftFane}>
        <GruppeDetalje gruppeId={valgtGruppe.id} nyOprettet={valgtGruppe.ny} tilbage={lukDetalje} />
      </Skal>
    );
  }

  if (valgtTur !== null) {
    return (
      <Skal fane={fane} skift={skiftFane}>
        <TurDetalje
          turId={valgtTur.id}
          nyOprettet={valgtTur.ny}
          maal={valgtTur.maal}
          tilbage={lukDetalje}
        />
      </Skal>
    );
  }

  if (valgtSted !== null) {
    return (
      <Skal fane={fane} skift={skiftFane}>
        <StedDetalje
          stedId={valgtSted.id}
          nyOprettet={valgtSted.ny}
          tilbage={lukDetalje}
          aabnTur={(id) => { setValgtSted(null); aabnTur(id); }}
          opretTurHer={(sted) => void nyTurPaaSted(sted)}
        />
      </Skal>
    );
  }

  if (valgtDeltTur !== null) {
    return (
      <Skal fane={fane} skift={skiftFane}>
        <DeltTurDetalje deltTurId={valgtDeltTur} tilbage={lukDetalje} />
      </Skal>
    );
  }

  if (feltbogAar !== null) {
    return <FeltbogSide aar={feltbogAar} tilbage={() => setFeltbogAar(null)} />;
  }

  if (valgtAar !== null) {
    return (
      <Skal fane={fane} skift={skiftFane}>
        <AarsopgoerelseSide
          aar={valgtAar}
          vaelgAar={setValgtAar}
          aabnFeltbog={setFeltbogAar}
          tilbage={lukDetalje}
          aabnTur={aabnTur}
          aabnItem={aabnItem}
        />
      </Skal>
    );
  }

  switch (fane) {
    case 'dashboard':
      return (
        <DashboardSide
          fane={fane}
          skift={skiftFane}
          aabnItem={aabnItem}
          aabnTur={aabnTur}
          aabnAar={setValgtAar}
          nytItem={nytItem}
          nyTur={nyTur}
          foersteTur={() => setViserFoersteTur(true)}
          tilLogin={() => setViserLogin(true)}
        />
      );
    case 'folk': return <FolkSide fane={fane} skift={skiftFane} />;
    case 'mere': return (
      <MereSide
        fane={fane}
        skift={skiftFane}
        aabnAar={setValgtAar}
        aabnIndstillinger={(maal) => skiftFane('indstillinger', maal)}
      />
    );
    case 'grupper': return <GrupperListe fane={fane} skift={skiftFane} aabnGruppe={aabnGruppe} nyGruppe={nyGruppe} />;
    case 'ture': return <TureListe fane={fane} skift={skiftFane} aabnTur={aabnTur} aabnDeltTur={aabnDeltTur} nyTur={nyTur} />;
    case 'steder': return <StederListe fane={fane} skift={skiftFane} aabnSted={aabnSted} nytSted={nytSted} />;
    case 'statistik': return <StatistikSide fane={fane} skift={skiftFane} aabnItem={aabnItem} aabnAar={setValgtAar} />;
    case 'inventar': return <InventarSide fane={fane} skift={skiftFane} aabnItem={aabnItem} />;
    case 'indstillinger':
      return (
        <IndstillingerSide
          fane={fane}
          skift={skiftFane}
          tilLogin={() => setViserLogin(true)}
          seRundvisning={() => setViserRundvisning(true)}
          maal={indstillingsmaal}
        />
      );
    default: {
      // Værnet mod en fane uden en skærm. Projektet oversætter uden
      // strictNullChecks, så en switch der falder igennem, ikke er en fejl —
      // den giver bare undefined, og React tegner en blank skærm. Med ni faner
      // er det ikke en teoretisk risiko.
      //
      // Tildelingen til never fejler ved oversættelsen i samme øjeblik en
      // fane mangler sin case, uanset hvilke strenge tjek der er slået til.
      const uhaandteret: never = fane;
      throw new Error(`Fanen "${uhaandteret}" har ingen skærm`);
    }
  }
}

export default App;
