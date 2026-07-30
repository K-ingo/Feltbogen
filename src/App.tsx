import { useEffect, useState } from 'react';
import AuthSide from './AuthSide';
import { useAuth } from './useAuth';
import { afstemMedServer, sendAfventende } from './sync';
import InventarSide from './InventarSide';
import ItemDetalje from './ItemDetalje';
import GrupperListe from './GrupperListe';
import TureListe from './TureListe';
import StatistikSide from './StatistikSide';
import { Skal } from './Skal';
import type { Fane } from './Skal';

function App() {
  const { erLoggetInd } = useAuth();
  const [fane, setFane] = useState<Fane>('inventar');
  const [valgtItemId, setValgtItemId] = useState<number | null>(null);

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

  if (!erLoggetInd) {
    // useAuth lytter på authStore, så skærmen skifter af sig selv ved login.
    return <AuthSide />;
  }

  // Et åbent item lægger sig over den valgte fane, indtil man går tilbage.
  // Detaljeskærme har deres egen header, så Skal får ingen titel her.
  if (valgtItemId !== null) {
    return (
      <Skal fane={fane} skift={setFane}>
        <ItemDetalje itemId={valgtItemId} tilbage={() => setValgtItemId(null)} />
      </Skal>
    );
  }

  switch (fane) {
    case 'grupper': return <GrupperListe fane={fane} skift={setFane} />;
    case 'ture': return <TureListe fane={fane} skift={setFane} />;
    case 'statistik': return <StatistikSide fane={fane} skift={setFane} />;
    case 'inventar': return <InventarSide fane={fane} skift={setFane} aabnItem={setValgtItemId} />;
  }
}

export default App;
