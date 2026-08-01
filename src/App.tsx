import { useEffect, useState } from 'react';
import AuthSide from './AuthSide';
import { useAuth } from './useAuth';
import { afstemMedServer, sendAfventende, sletItem, sletGruppe, sletTur } from './sync';
import { db } from './db';
import DashboardSide from './DashboardSide';
import InventarSide from './InventarSide';
import ItemDetalje from './ItemDetalje';
import GrupperListe from './GrupperListe';
import GruppeDetalje from './GruppeDetalje';
import TureListe from './TureListe';
import TurDetalje from './TurDetalje';
import StatistikSide from './StatistikSide';
import IndstillingerSide from './IndstillingerSide';
import Velkomst from './Velkomst';
import GaesteSide from './GaesteSide';
import { tokenFraAdresse } from './gaest';
import { opretTomtItem, opretTomGruppe, opretTomTur } from './opret';
import { markerSet, useErSet, ONBOARDING_SET } from './indstillinger';
import { Skal } from './Skal';
import type { Fane } from './Skal';

function App() {
  const { erLoggetInd } = useAuth();
  // Et gæstelink afgøres af adresselinjen og læses én gang. Går gæsten videre
  // ind i appen, ryddes den, så et genbesøg ikke lander på turen igen.
  const [gaesteToken, setGaesteToken] = useState(() => tokenFraAdresse());
  const onboardingSet = useErSet(ONBOARDING_SET);
  const [viserLogin, setViserLogin] = useState(false);
  const [fane, setFane] = useState<Fane>('dashboard');
  // Valget ligger her og ikke i listeskærmene, fordi dashboardet også åbner
  // både gear og ture. nyOprettet følger med, så detaljeskærmen kan rydde en
  // navnløs post væk igen hvis man fortryder.
  const [valgtItem, setValgtItem] = useState<{ id: number; ny: boolean } | null>(null);
  const [valgtGruppe, setValgtGruppe] = useState<{ id: number; ny: boolean } | null>(null);
  const [valgtTur, setValgtTur] = useState<{ id: number; ny: boolean } | null>(null);
  const aabnItem = (id: number, ny = false) => setValgtItem({ id, ny });
  const aabnGruppe = (id: number, ny = false) => setValgtGruppe({ id, ny });
  const aabnTur = (id: number, ny = false) => setValgtTur({ id, ny });

  // Nye poster åbnes med det samme — en tom post man skal lede efter bagefter
  // er ikke til nogen nytte.
  const nytItem = async () => aabnItem(await opretTomtItem(), true);
  const nyGruppe = async () => aabnGruppe(await opretTomGruppe(), true);
  const nyTur = async () => aabnTur(await opretTomTur(), true);

  // En navnløs post man lige har oprettet, kan ikke findes igen. Oprydningen
  // ligger her og ikke i detaljeskærmene, fordi man kan forlade dem ad to
  // veje — tilbage-knappen og et tryk i navigationen — og begge skal rydde op.
  const lukDetalje = async () => {
    const aabne = [
      { valgt: valgtItem, tabel: db.items, slet: sletItem },
      { valgt: valgtGruppe, tabel: db.grupper, slet: sletGruppe },
      { valgt: valgtTur, tabel: db.ture, slet: sletTur }
    ];

    setValgtItem(null);
    setValgtGruppe(null);
    setValgtTur(null);

    for (const { valgt, tabel, slet } of aabne) {
      if (!valgt?.ny) continue;
      const post = await tabel.get(valgt.id);
      if (post && !post.navn.trim()) await slet(valgt.id);
    }
  };

  // Et tryk i navigationen skal føre hen til fanen — også når der ligger en
  // detaljeskærm ovenpå. Ellers skifter markeringen, mens skærmen bliver
  // stående, og man skal trykke tilbage før man kan se hvor man er.
  const skiftFane = (f: Fane) => {
    void lukDetalje();
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
  useEffect(() => {
    if (!erLoggetInd) return;
    void afstemMedServer();

    const naarOnline = () => void afstemMedServer();
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

  // Gæsteruten går forud for alt andet: den kræver hverken konto eller
  // onboarding, og den viser aldrig noget fra denne enheds egen base.
  if (gaesteToken) {
    return (
      <GaesteSide
        token={gaesteToken}
        tilAppen={() => {
          window.history.replaceState(null, '', window.location.pathname);
          setGaesteToken(null);
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

  if (!onboardingSet) {
    return (
      <Velkomst
        nytItem={() => void efterVelkomst(nytItem)}
        nyTur={() => void efterVelkomst(nyTur)}
        tilLogin={() => void efterVelkomst(async () => setViserLogin(true))}
        spring={() => void efterVelkomst()}
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
        <TurDetalje turId={valgtTur.id} nyOprettet={valgtTur.ny} tilbage={lukDetalje} />
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
          nytItem={nytItem}
          nyTur={nyTur}
        />
      );
    case 'grupper': return <GrupperListe fane={fane} skift={skiftFane} aabnGruppe={aabnGruppe} nyGruppe={nyGruppe} />;
    case 'ture': return <TureListe fane={fane} skift={skiftFane} aabnTur={aabnTur} nyTur={nyTur} />;
    case 'statistik': return <StatistikSide fane={fane} skift={skiftFane} aabnItem={aabnItem} />;
    case 'inventar': return <InventarSide fane={fane} skift={skiftFane} aabnItem={aabnItem} />;
    case 'indstillinger': return <IndstillingerSide fane={fane} skift={skiftFane} tilLogin={() => setViserLogin(true)} />;
  }
}

export default App;
