import { useState } from 'react';
import { db, ITEM_STATUS } from './db';
import type { Item, Garanti } from './db';
import TagsInput from './TagsInput';
import {
  Felt,
  Kort,
  SektionsTitel,
  Segment,
  Tekstomraade,
  TitelInput,
  DetaljeHeader,
  Indlaeser
} from './ui';
import { layout } from './layout';
import { sletItem, opdaterItem } from './sync';
import { useRedigerbar } from './useRedigerbar';

interface Props {
  itemId: number;
  tilbage: () => void;
}

// Felter tilføjet efter de første items blev oprettet kan mangle på gamle poster.
function medStandardfelter(item: Item): Item {
  return {
    ...item,
    kraever: item.kraever ?? [],
    komplementer: item.komplementer ?? [],
    koebslink: item.koebslink ?? '',
    ordrenummer: item.ordrenummer ?? '',
    garanti: item.garanti ?? null
  };
}

function ItemDetalje({ itemId, tilbage }: Props) {
  const [garantiAaben, setGarantiAaben] = useState(false);

  const { post: item, opdater } = useRedigerbar(db.items, itemId, opdaterItem, {
    normaliser: medStandardfelter
  });

  const opdaterGaranti = async (aendringer: Partial<Garanti>) => {
    if (!item) return;
    await opdater({
      garanti: {
        laengde_aar: item.garanti?.laengde_aar ?? 0,
        udloeber_dato: item.garanti?.udloeber_dato ?? '',
        paamindelse_dage: item.garanti?.paamindelse_dage ?? 30,
        ...aendringer
      }
    });
  };

  const slet = async () => {
    if (item?.id === undefined) return;
    if (confirm(`Slet "${item.navn}"?`)) {
      await sletItem(item.id);
      tilbage();
    }
  };

  if (!item) return <Indlaeser />;

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet" slet={slet} />

      <TitelInput value={item.navn} onChange={(v) => opdater({ navn: v })} />

      <div style={{ marginBottom: '24px' }}>
        <Segment vaerdier={ITEM_STATUS} valgt={item.status} vaelg={(s) => opdater({ status: s })} />
      </div>

      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Felt label="Vægt (gram)" type="number" value={item.vaegt_g} onChange={(v) => opdater({ vaegt_g: Number(v) || 0 })} />
          <Felt label="Pris (kr)" type="number" value={item.pris_kr} onChange={(v) => opdater({ pris_kr: Number(v) || 0 })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Felt label="Antal" type="number" value={item.antal} onChange={(v) => opdater({ antal: Number(v) || 1 })} />
          <Felt label="Dimensioner" value={item.dimensioner} onChange={(v) => opdater({ dimensioner: v })} placeholder="ø 33 × 15 cm" />
        </div>

        <Kort fremhaevet style={{ padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={item.delt}
              onChange={(e) => opdater({ delt: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Delt gear</div>
              <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>Bæres af én, bruges af flere</div>
            </div>
          </label>
        </Kort>

        <div style={{ height: '4px' }} />
        <SektionsTitel>Kompatibilitet</SektionsTitel>

        <TagsInput tags={item.tags} onChange={(nye) => opdater({ tags: nye })} />
        <TagsInput
          tags={item.kraever}
          onChange={(nye) => opdater({ kraever: nye })}
          label="Kræver"
          hjaelpetekst="Hårde afhængigheder"
          farve="fejl"
        />
        <TagsInput
          tags={item.komplementer}
          onChange={(nye) => opdater({ komplementer: nye })}
          label="Komplementer"
          hjaelpetekst="Bløde forslag"
          farve="advarsel"
        />

        <div style={{ height: '4px' }} />
        <SektionsTitel>Købsinfo</SektionsTitel>

        <Felt label="Købt hos" value={item.koebt_hos} onChange={(v) => opdater({ koebt_hos: v })} placeholder="fx Friluftslageret.dk" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Felt label="Købsdato" value={item.koebsdato} onChange={(v) => opdater({ koebsdato: v })} placeholder="MM/ÅÅÅÅ" />
          <Felt label="Ordrenummer" value={item.ordrenummer} onChange={(v) => opdater({ ordrenummer: v })} />
        </div>
        <Felt label="Købslink" value={item.koebslink} onChange={(v) => opdater({ koebslink: v })} placeholder="https://..." />

        <Kort fremhaevet style={{ padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setGarantiAaben(!garantiAaben)}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--tekst)'
            }}
          >
            <span>
              Garanti
              {item.garanti && item.garanti.laengde_aar > 0 && (
                <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '11px', marginLeft: '8px' }}>
                  · {item.garanti.laengde_aar} år
                </span>
              )}
            </span>
            <span style={{ color: 'var(--tekst-svag)', fontSize: '14px' }}>{garantiAaben ? '−' : '+'}</span>
          </button>
          {garantiAaben && (
            <div style={{ padding: '4px 14px 14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Felt
                  label="Længde (år)"
                  type="number"
                  value={item.garanti?.laengde_aar ?? 0}
                  onChange={(v) => opdaterGaranti({ laengde_aar: Number(v) || 0 })}
                />
                <Felt
                  label="Påmindelse (dage)"
                  type="number"
                  value={item.garanti?.paamindelse_dage ?? 30}
                  onChange={(v) => opdaterGaranti({ paamindelse_dage: Number(v) || 30 })}
                />
              </div>
              <Felt
                label="Udløber dato"
                value={item.garanti?.udloeber_dato ?? ''}
                onChange={(v) => opdaterGaranti({ udloeber_dato: v })}
                placeholder="DD/MM/ÅÅÅÅ"
              />
            </div>
          )}
        </Kort>

        <Tekstomraade label="Noter" value={item.noter} onChange={(v) => opdater({ noter: v })} raekker={3} />
      </div>

      <div style={{ marginTop: '30px', fontSize: '11px', color: 'var(--tekst-svag)', textAlign: 'center' }}>
        Oprettet {new Date(item.oprettet).toLocaleDateString('da-DK')} · Ændret {new Date(item.aendret).toLocaleDateString('da-DK')}
      </div>
    </div>
  );
}

export default ItemDetalje;
