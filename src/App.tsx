import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import AuthSide from './AuthSide';
import { useAuth } from './useAuth';
import { useEffect, useState } from 'react';
import { migrerHvisNoedvendigt, hentFraPocketBase, opretItem } from './sync';
import type { Item } from './db';
import ItemDetalje from './ItemDetalje';
import GrupperListe from './GrupperListe';
import TureListe from './TureListe';
import BundNav from './BundNav';
import type { Fane } from './BundNav';
import { Knap, Kort, Chip, layout } from './ui';
import StatistikSide from './StatistikSide';

function App() {
  const { erLoggetInd } = useAuth();
  const [, setSynkroniserer] = useState(false);

  useEffect(() => {
    if (!erLoggetInd) return;
    setSynkroniserer(true);
    (async () => {
      await migrerHvisNoedvendigt();
      await hentFraPocketBase();
      setSynkroniserer(false);
    })();
  }, [erLoggetInd]);
  const [fane, setFane] = useState<Fane>('inventar');
  const [navn, setNavn] = useState('');
  const [vaegt, setVaegt] = useState('');
  const [pris, setPris] = useState('');
  const [valgtItemId, setValgtItemId] = useState<number | null>(null);
  const [soegning, setSoegning] = useState('');

  const items = useLiveQuery(() => db.items.toArray());

  const tilfoej = async () => {
    if (!navn) return;
    await opretItem({
      navn,
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
      oprettet: new Date(),
      aendret: new Date()
    });
    setNavn('');
    setVaegt('');
    setPris('');
  };

  if (!erLoggetInd) {
    return <AuthSide onLoggetInd={() => window.location.reload()} />;
  }

  if (valgtItemId !== null) {
    return (
      <>
        <ItemDetalje itemId={valgtItemId} tilbage={() => setValgtItemId(null)} />
        <BundNav aktiv={fane} skift={setFane} />
      </>
    );
  }

  if (fane === 'grupper') {
    return (
      <>
        <GrupperListe />
        <BundNav aktiv={fane} skift={setFane} />
      </>
    );
  }

  if (fane === 'ture') {
    return (
      <>
        <TureListe />
        <BundNav aktiv={fane} skift={setFane} />
      </>
    );
  }

  if (fane === 'statistik') {
    return (
      <>
        <StatistikSide />
        <BundNav aktiv={fane} skift={setFane} />
      </>
    );
  }

  const filtreret = items?.filter((i) =>
    soegning === '' || i.navn.toLowerCase().includes(soegning.toLowerCase()) ||
    i.tags.some((t) => t.toLowerCase().includes(soegning.toLowerCase()))
  );

  const totalVaerdi = items?.reduce((sum, i) => sum + i.pris_kr, 0) ?? 0;
  const antalEjer = items?.filter((i) => i.status === 'ejer').length ?? 0;

  return (
    <>
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
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                placeholder="Vægt (gram)"
                type="number"
                value={vaegt}
                onChange={(e) => setVaegt(e.target.value)}
              />
              <input
                placeholder="Pris (kr)"
                type="number"
                value={pris}
                onChange={(e) => setPris(e.target.value)}
              />
            </div>
            <Knap variant="primaer" onClick={tilfoej}>
              + Tilføj item
            </Knap>
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
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--tekst-svag)' }}>
              {soegning ? 'Ingen matches.' : 'Ingen items endnu. Tilføj dit første ovenfor.'}
            </div>
          )}
          {filtreret?.map((item: Item) => (
            <div
              key={item.id}
              onClick={() => item.id && setValgtItemId(item.id)}
              style={{
                padding: '14px 4px',
                borderBottom: '1px solid var(--border-svag)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: 'var(--tekst)', fontSize: '14px' }}>
                  {item.navn}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
                  {item.vaegt_g} g · {item.pris_kr} kr
                  {item.delt && ' · delt'}
                  {item.status !== 'ejer' && ` · ${item.status}`}
                </div>
                {item.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {item.tags.slice(0, 4).map((tag) => (
                      <Chip key={tag} storrelse="lille">{tag}</Chip>
                    ))}
                    {item.tags.length > 4 && (
                      <Chip storrelse="lille">+{item.tags.length - 4}</Chip>
                    )}
                  </div>
                )}
              </div>
              <div style={{ color: 'var(--tekst-svag)', fontSize: '18px' }}>›</div>
            </div>
          ))}
        </div>
      </div>
      <BundNav aktiv={fane} skift={setFane} />
    </>
  );
}

export default App;