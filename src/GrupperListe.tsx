import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import { opretGruppe } from './sync';
import GruppeDetalje from './GruppeDetalje';
import { Knap, Kort, Chip, layout } from './ui';

function GrupperListe() {
  const [nytNavn, setNytNavn] = useState('');
  const [valgtGruppeId, setValgtGruppeId] = useState<number | null>(null);

  const grupper = useLiveQuery(() => db.grupper.toArray());
  const items = useLiveQuery(() => db.items.toArray());

  const opret = async () => {
    if (!nytNavn.trim()) return;
    const nu = new Date();
    await opretGruppe({
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

  const beregnInfo = (g: Gruppe) => {
    if (!items) return { antal: 0, vaegt: 0 };
    const gItems = items.filter((i) => i.id && g.item_ids.includes(i.id));
    return { antal: gItems.length, vaegt: gItems.reduce((s, i) => s + i.vaegt_g, 0) };
  };

  return (
    <div style={layout.container}>
      <h1>Feltbogen</h1>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '20px' }}>
        Grupper · {grupper?.length ?? 0}
      </div>

      <Kort fremhaevet style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            placeholder="Ny gruppe (fx Hængekøje-sommer)"
            value={nytNavn}
            onChange={(e) => setNytNavn(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && opret()}
            style={{ flex: 1 }}
          />
          <Knap variant="primaer" onClick={opret}>Opret</Knap>
        </div>
      </Kort>

      <div>
        {grupper?.length === 0 && (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--tekst-svag)' }}>
            Ingen grupper endnu. Opret din første ovenfor.
          </div>
        )}
        {grupper?.map((g) => {
          const info = beregnInfo(g);
          return (
            <div
              key={g.id}
              onClick={() => g.id && setValgtGruppeId(g.id)}
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
                <div style={{ fontWeight: 500, color: 'var(--tekst)', fontSize: '14px' }}>{g.navn}</div>
                <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
                  {info.antal} items · {(info.vaegt / 1000).toFixed(1)} kg
                </div>
                {g.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {g.tags.slice(0, 5).map((tag) => (
                      <Chip key={tag} storrelse="lille">{tag}</Chip>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ color: 'var(--tekst-svag)', fontSize: '18px' }}>›</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GrupperListe;