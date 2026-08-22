import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import TagsInput from './TagsInput';
import {
  Kort,
  SektionsTitel,
  Tekstomraade,
  TitelInput,
  DetaljeHeader,
  Indlaeser
} from './ui';
import { layout } from './layout';
import { sletGruppe, opdaterGruppe } from './sync';
import { meldSletning } from './fortryd';
import { useRedigerbar } from './useRedigerbar';

interface Props {
  gruppeId: number;
  tilbage: () => void;
  // Sat når gruppen netop er oprettet, så en navnløs post kan ryddes væk igen.
  nyOprettet?: boolean;
}

function GruppeDetalje({ gruppeId, tilbage, nyOprettet }: Props) {
  const [soegning, setSoegning] = useState('');

  const items = useLiveQuery(() => db.items.toArray());
  const { post: gruppe, opdater } = useRedigerbar(db.grupper, gruppeId, opdaterGruppe);

  const slet = async () => {
    if (gruppe?.id === undefined) return;
    const genskab = await sletGruppe(gruppe.id);
    if (genskab) meldSletning({ slags: 'Gruppen', navn: gruppe.navn, genskab });
    tilbage();
  };

  const toggleItem = async (itemUid: string) => {
    if (!gruppe) return;
    const nye = gruppe.item_ids.includes(itemUid)
      ? gruppe.item_ids.filter((uid) => uid !== itemUid)
      : [...gruppe.item_ids, itemUid];
    await opdater({ item_ids: nye });
  };

  if (!gruppe) return <Indlaeser />;

  const valgteItems = items?.filter((i) => gruppe.item_ids.includes(i.uid)) ?? [];
  const totalVaegt = valgteItems.reduce((sum, i) => sum + i.vaegt_g, 0);
  const totalPris = valgteItems.reduce((sum, i) => sum + i.pris_kr, 0);

  const tilgaengeligeItems = items?.filter((i) =>
    i.status === 'ejer' &&
    (soegning === '' || i.navn.toLowerCase().includes(soegning.toLowerCase()))
  ) ?? [];

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet gruppe" slet={slet} />

      <TitelInput
        value={gruppe.navn}
        onChange={(v) => opdater({ navn: v })}
        placeholder="Navn på gruppe"
        autoFokus={nyOprettet}
      />

      <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
        <TagsInput
          tags={gruppe.tags}
          onChange={(nye) => opdater({ tags: nye })}
          hjaelpetekst="fx sommer, hængekøje, solo"
        />

        <Kort fremhaevet>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>{valgteItems.length} items</div>
          <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
            {(totalVaegt / 1000).toFixed(2)} kg · {totalPris} kr
          </div>
        </Kort>

        <Tekstomraade label="Noter" value={gruppe.noter} onChange={(v) => opdater({ noter: v })} />
      </div>

      <SektionsTitel>Items i gruppen</SektionsTitel>

      <input
        placeholder="Søg items..."
        value={soegning}
        onChange={(e) => setSoegning(e.target.value)}
        style={{ width: '100%', marginBottom: '12px' }}
      />

      <div>
        {tilgaengeligeItems.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--tekst-svag)', fontSize: '13px' }}>
            Ingen items matcher.
          </div>
        )}
        {tilgaengeligeItems.map((item) => {
          const erMed = gruppe.item_ids.includes(item.uid);
          return (
            <label
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: erMed ? 'var(--accent-bg)' : 'transparent',
                marginBottom: '2px',
                border: '1px solid transparent'
              }}
            >
              <input
                type="checkbox"
                checked={erMed}
                onChange={() => toggleItem(item.uid)}
                style={{ width: 'auto' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--tekst)' }}>{item.navn}</div>
                <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>
                  {item.vaegt_g} g · {item.pris_kr} kr{item.delt && ' · delt'}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default GruppeDetalje;
