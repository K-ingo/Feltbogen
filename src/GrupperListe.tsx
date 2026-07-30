import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import { opretGruppe } from './sync';
import GruppeDetalje from './GruppeDetalje';
import { Knap, Kort, TagChips, ListeRaekke, TomListe } from './ui';
import { layout } from './layout';

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
    const gItems = items?.filter((i) => i.id !== undefined && g.item_ids.includes(i.id)) ?? [];
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
        {grupper?.length === 0 && <TomListe>Ingen grupper endnu. Opret din første ovenfor.</TomListe>}
        {grupper?.map((g) => {
          const info = beregnInfo(g);
          return (
            <ListeRaekke
              key={g.id}
              titel={g.navn}
              detalje={`${info.antal} items · ${(info.vaegt / 1000).toFixed(1)} kg`}
              onClick={() => g.id !== undefined && setValgtGruppeId(g.id)}
            >
              <TagChips tags={g.tags} maks={5} />
            </ListeRaekke>
          );
        })}
      </div>
    </div>
  );
}

export default GrupperListe;
