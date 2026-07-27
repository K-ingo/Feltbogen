import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Tur } from './db';
import TurDetalje from './TurDetalje';

function TureListe() {
  const [nytNavn, setNytNavn] = useState('');
  const [valgtTurId, setValgtTurId] = useState<number | null>(null);

  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());

  const opret = async () => {
    if (!nytNavn.trim()) return;
    const nu = new Date();
    const idag = nu.toISOString().slice(0, 10);
    await db.ture.add({
      navn: nytNavn.trim(),
      sted: '',
      koordinater: null,
      startdato: idag,
      slutdato: idag,
      naetter: 0,
      personer: 1,
      overnatning: 'shelter',
      aktivitet: 'bushcraft',
      terraen: 'skov',
      baereafstand_km: 0,
      erfaring: 'oevet',
      status: 'kladde',
      gruppe_ids: [],
      loese_item_ids: [],
      deltagere: [],
      budget_linjer: [],
      besked_fra_ejer: '',
      noter: '',
      oprettet: nu,
      aendret: nu
    });
    setNytNavn('');
  };

  if (valgtTurId !== null) {
    return <TurDetalje turId={valgtTurId} tilbage={() => setValgtTurId(null)} />;
  }

  const statusFarve = (status: string) => {
    switch (status) {
      case 'kladde': return { bg: '#f0f0f0', tekst: '#666' };
      case 'klar': return { bg: '#e8f0e8', tekst: '#2a6a2a' };
      case 'aktiv': return { bg: '#fff4e0', tekst: '#a06000' };
      case 'afsluttet': return { bg: '#f0f0f0', tekst: '#888' };
      default: return { bg: '#f0f0f0', tekst: '#666' };
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
      <h1>Feltbogen</h1>
      <h2>Ture</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <input
          placeholder="Ny tur (fx Uge 32 — Øghaven)"
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
        {ture?.length === 0 && (
          <p style={{ color: '#888' }}>Ingen ture endnu. Opret din første ovenfor.</p>
        )}
        {ture?.map((t: Tur) => {
          const farve = statusFarve(t.status);
          return (
            <div
              key={t.id}
              onClick={() => t.id && setValgtTurId(t.id)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 500 }}>{t.navn}</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    background: farve.bg,
                    color: farve.tekst,
                    borderRadius: '10px',
                    textTransform: 'capitalize'
                  }}>
                    {t.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                  {t.sted || 'Intet sted'} · {t.startdato}
                  {t.personer > 1 && ` · ${t.personer} personer`}
                </div>
              </div>
              <div style={{ color: '#888', fontSize: '18px' }}>›</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TureListe;