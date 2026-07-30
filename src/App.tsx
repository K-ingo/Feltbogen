import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import AuthSide from './AuthSide';
import { useAuth } from './useAuth';
import { sendAltUsendt, sendAfventende, hentFraPocketBase, opretItem } from './sync';
import ItemDetalje from './ItemDetalje';
import GrupperListe from './GrupperListe';
import TureListe from './TureListe';
import StatistikSide from './StatistikSide';
import BundNav from './BundNav';
import type { Fane } from './BundNav';
import { Knap, Kort, TagChips, ListeRaekke, TomListe } from './ui';
import { layout } from './layout';

function App() {
  const { erLoggetInd } = useAuth();
  const [fane, setFane] = useState<Fane>('inventar');
  const [valgtItemId, setValgtItemId] = useState<number | null>(null);

  // Send det der blev oprettet offline op, og hent det vi ikke har lokalt.
  useEffect(() => {
    if (!erLoggetInd) return;
    (async () => {
      await sendAltUsendt();
      await hentFraPocketBase();
    })();
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
  const skaerm = () => {
    if (valgtItemId !== null) {
      return <ItemDetalje itemId={valgtItemId} tilbage={() => setValgtItemId(null)} />;
    }
    switch (fane) {
      case 'grupper': return <GrupperListe />;
      case 'ture': return <TureListe />;
      case 'statistik': return <StatistikSide />;
      case 'inventar': return <Inventar aabnItem={setValgtItemId} />;
    }
  };

  return (
    <>
      {skaerm()}
      <BundNav aktiv={fane} skift={setFane} />
    </>
  );
}

function Inventar({ aabnItem }: { aabnItem: (id: number) => void }) {
  const [navn, setNavn] = useState('');
  const [vaegt, setVaegt] = useState('');
  const [pris, setPris] = useState('');
  const [soegning, setSoegning] = useState('');

  const items = useLiveQuery(() => db.items.toArray());

  const tilfoej = async () => {
    if (!navn.trim()) return;
    const nu = new Date();
    await opretItem({
      navn: navn.trim(),
      vaegt_g: Number(vaegt) || 0,
      pris_kr: Number(pris) || 0,
      dimensioner: '',
      antal: 1,
      delt: false,
      status: 'ejer',
      tags: [],
      kraever: [],
      komplementer: [],
      koebt_hos: '',
      koebsdato: '',
      koebslink: '',
      ordrenummer: '',
      garanti: null,
      noter: '',
      oprettet: nu,
      aendret: nu
    });
    setNavn('');
    setVaegt('');
    setPris('');
  };

  const q = soegning.trim().toLowerCase();
  const filtreret = items?.filter((i) =>
    q === '' || i.navn.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q))
  );

  const totalVaerdi = items?.reduce((sum, i) => sum + i.pris_kr, 0) ?? 0;
  const antalEjer = items?.filter((i) => i.status === 'ejer').length ?? 0;

  return (
    <div style={layout.container}>
      <h1>Feltbogen</h1>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '20px' }}>
        Inventar · {antalEjer} items · {totalVaerdi.toLocaleString('da-DK')} kr
      </div>

      <Kort fremhaevet style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            placeholder="Navn (fx Toaks 1L gryde)"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tilfoej()}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input placeholder="Vægt (gram)" type="number" value={vaegt} onChange={(e) => setVaegt(e.target.value)} />
            <input placeholder="Pris (kr)" type="number" value={pris} onChange={(e) => setPris(e.target.value)} />
          </div>
          <Knap variant="primaer" onClick={tilfoej}>+ Tilføj item</Knap>
        </div>
      </Kort>

      <input
        placeholder="Søg items eller tags..."
        value={soegning}
        onChange={(e) => setSoegning(e.target.value)}
        style={{ width: '100%', marginBottom: '16px' }}
      />

      <div>
        {filtreret?.length === 0 && (
          <TomListe>{soegning ? 'Ingen matches.' : 'Ingen items endnu. Tilføj dit første ovenfor.'}</TomListe>
        )}
        {filtreret?.map((item) => (
          <ListeRaekke
            key={item.id}
            titel={item.navn}
            detalje={
              <>
                {item.vaegt_g} g · {item.pris_kr} kr
                {item.delt && ' · delt'}
                {item.status !== 'ejer' && ` · ${item.status}`}
              </>
            }
            onClick={() => item.id !== undefined && aabnItem(item.id)}
          >
            <TagChips tags={item.tags} />
          </ListeRaekke>
        ))}
      </div>
    </div>
  );
}

export default App;
