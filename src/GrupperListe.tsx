import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import { opretGruppe } from './sync';
import GruppeDetalje from './GruppeDetalje';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, Kort, TagChips, ListeRaekke, TomListe, Label } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
}

function GrupperListe({ fane, skift }: Props) {
  const [valgtGruppeId, setValgtGruppeId] = useState<number | null>(null);
  const [opretAaben, setOpretAaben] = useState(false);

  const grupper = useLiveQuery(() => db.grupper.toArray());
  const items = useLiveQuery(() => db.items.toArray());

  if (valgtGruppeId !== null) {
    return (
      <Skal fane={fane} skift={skift}>
        <GruppeDetalje gruppeId={valgtGruppeId} tilbage={() => setValgtGruppeId(null)} />
      </Skal>
    );
  }

  const beregnInfo = (g: Gruppe) => {
    const gItems = items?.filter((i) => g.item_ids.includes(i.uid)) ?? [];
    return { antal: gItems.length, vaegt: gItems.reduce((s, i) => s + i.vaegt_g, 0) };
  };

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Grupper"
      undertitel={`${grupper?.length ?? 0} grupper`}
      handlinger={<Knap variant="primaer" onClick={() => setOpretAaben(!opretAaben)}>+ Ny gruppe</Knap>}
      fab={() => setOpretAaben(true)}
    >
      {opretAaben && <OpretGruppe luk={() => setOpretAaben(false)} />}

      {grupper?.length === 0 && <TomListe>Ingen grupper endnu. Opret din første.</TomListe>}
      {grupper?.map((g) => {
        const info = beregnInfo(g);
        return (
          <ListeRaekke
            key={g.uid}
            titel={g.navn}
            detalje={`${info.antal} items · ${(info.vaegt / 1000).toFixed(1)} kg`}
            onClick={() => g.id !== undefined && setValgtGruppeId(g.id)}
          >
            <TagChips tags={g.tags} maks={5} />
          </ListeRaekke>
        );
      })}
    </Skal>
  );
}

function OpretGruppe({ luk }: { luk: () => void }) {
  const [navn, setNavn] = useState('');

  const gem = async () => {
    if (!navn.trim()) return;
    const nu = new Date();
    await opretGruppe({
      navn: navn.trim(),
      tags: [],
      item_ids: [],
      noter: '',
      oprettet: nu,
      aendret: nu
    });
    luk();
  };

  return (
    <Kort fremhaevet style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <Label>Ny gruppe</Label>
        <button
          onClick={luk}
          aria-label="Luk"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--tekst-dæmpet)' }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          autoFocus
          placeholder="fx Hængekøje-sommer"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gem()}
          style={{ flex: 1 }}
        />
        <Knap variant="primaer" onClick={gem}>Opret</Knap>
      </div>
    </Kort>
  );
}

export default GrupperListe;
