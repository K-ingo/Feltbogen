import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import GruppeDetalje from './GruppeDetalje';

function GrupperListe() {
  const [nytNavn, setNytNavn] = useState('');
  const [valgtGruppeId, setValgtGruppeId] = useState<number | null>(null);

  const grupper = useLiveQuery(() => db.grupper.toArray());
  const items = useLiveQuery(() => db.items.toArray());

  const opret = async () => {
    if (!nytNavn.trim()) return;
    const nu = new Date();
    await db.grupper.add({
      navn: nytNavn.trim(),
      tags: [],
      item_ids: [],
      noter: '',
      oprettet: nu,
      aendret: nu
    });
    setNytNavn('');
  };

  if (valgtGruppeId !== null) {
    return <GruppeDetalje gruppeId={valgtGruppeId} tilbage={() => setValgtGruppeId(null)} />;
  }

  const beregnGruppeInfo = (g: Gruppe) => {
    if (!items) return { antal: 0, vaegt: 0 };
    const gItems = items.filter((i) => i.id && g.item_ids.includes(i.id));
    return {
      antal: gItems.length,
      vaegt: gItems.reduce((sum, i) => sum + i.vaegt_g, 0)
    };
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
      <h1>Feltbogen</h1>
      <h2>Grupper</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <input
          placeholder="Ny gruppe (fx Hængekøje-sommer)"
          value={nytNavn}
          onChange={(e) => setNytNavn(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && opret()}
          style={{ flex: 1, padding: '8px', fontSize: '14px' }}
        />
        <button onClick={opret} style={{ padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>
          Opret
        </button>
      </div>

      <div>
        {grupper?.length === 0 && (
          <p style={{ color: '#888' }}>Ingen grupper endnu. Opret din første ovenfor.</p>
        )}
        {grupper?.map((g) => {
          const info = beregnGruppeInfo(g);
          return (
            <div
              key={g.id}
              onClick={() => g.id && setValgtGruppeId(g.id)}
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
                <div style={{ fontWeight: 500 }}>{g.navn}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {info.antal} items · {(info.vaegt / 1000).toFixed(1)} kg
                </div>
                {g.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {g.tags.map((tag) => (
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
          );
        })}
      </div>
    </div>
  );
}

export default GrupperListe;