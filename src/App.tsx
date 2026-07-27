import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item } from './db';
import ItemDetalje from './ItemDetalje';

function App() {
  const [navn, setNavn] = useState('');
  const [vaegt, setVaegt] = useState('');
  const [pris, setPris] = useState('');
  const [valgtItemId, setValgtItemId] = useState<number | null>(null);

  const items = useLiveQuery(() => db.items.toArray());

  const tilfoej = async () => {
    if (!navn) return;
    await db.items.add({
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

  if (valgtItemId !== null) {
    return <ItemDetalje itemId={valgtItemId} tilbage={() => setValgtItemId(null)} />;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Feltbogen</h1>
      <h2>Inventar</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <input
          placeholder="Navn (fx Toaks 1L gryde)"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          style={{ padding: '8px', fontSize: '14px' }}
        />
        <input
          placeholder="Vægt i gram"
          type="number"
          value={vaegt}
          onChange={(e) => setVaegt(e.target.value)}
          style={{ padding: '8px', fontSize: '14px' }}
        />
        <input
          placeholder="Pris i kr"
          type="number"
          value={pris}
          onChange={(e) => setPris(e.target.value)}
          style={{ padding: '8px', fontSize: '14px' }}
        />
        <button onClick={tilfoej} style={{ padding: '10px', fontSize: '14px', cursor: 'pointer' }}>
          Tilføj item
        </button>
      </div>

      <div>
        {items?.length === 0 && <p style={{ color: '#888' }}>Ingen items endnu. Tilføj dit første ovenfor.</p>}
        {items?.map((item: Item) => (
          <div
            key={item.id}
            onClick={() => item.id && setValgtItemId(item.id)}
            style={{
              padding: '12px',
              borderBottom: '1px solid #eee',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{item.navn}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {item.vaegt_g} g · {item.pris_kr} kr
                {item.delt && ' · delt'}
                {item.status !== 'ejer' && ` · ${item.status}`}
              </div>
              {item.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: '#e8e8e8',
                        borderRadius: '10px',
                        color: '#555'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ color: '#888', fontSize: '18px' }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;