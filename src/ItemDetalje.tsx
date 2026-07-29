import { useState, useEffect } from 'react';
import { db } from './db';
import type { Item, ItemStatus, Garanti } from './db';
import TagsInput from './TagsInput';
import {Felt, Kort, layout, SektionsTitel } from './ui';
import { sletItem, opdaterItem } from './sync';

interface Props {
  itemId: number;
  tilbage: () => void;
}

function ItemDetalje({ itemId, tilbage }: Props) {
  const [item, setItem] = useState<Item | null>(null);
  const [menuAaben, setMenuAaben] = useState(false);
  const [garantiAaben, setGarantiAaben] = useState(false);

  useEffect(() => {
    db.items.get(itemId).then((fundet) => {
      if (fundet) {
        setItem({
          ...fundet,
          kraever: fundet.kraever ?? [],
          komplementer: fundet.komplementer ?? [],
          koebslink: fundet.koebslink ?? '',
          ordrenummer: fundet.ordrenummer ?? '',
          garanti: fundet.garanti ?? null
        });
      } else {
        setItem(null);
      }
    });
  }, [itemId]);

  const opdater = async (aendringer: Partial<Item>) => {
    if (!item?.id) return;
    const nytItem = { ...item, ...aendringer, aendret: new Date() };
    await opdaterItem(item.id, aendringer);
    setItem(nytItem);
  };

  const opdaterGaranti = async (aendringer: Partial<Garanti>) => {
    if (!item) return;
    const nyGaranti: Garanti = {
      laengde_aar: item.garanti?.laengde_aar ?? 0,
      udloeber_dato: item.garanti?.udloeber_dato ?? '',
      paamindelse_dage: item.garanti?.paamindelse_dage ?? 30,
      ...aendringer
    };
    await opdater({ garanti: nyGaranti });
  };

  const slet = async () => {
    if (!item?.id) return;
    if (confirm(`Slet "${item.navn}"?`)) {
      await sletItem(item.id);
      tilbage();
    }
  };

  if (!item) {
    return <div style={{ padding: '20px', color: 'var(--tekst-dæmpet)' }}>Indlæser...</div>;
  }

  return (
    <div style={layout.container}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={tilbage}
          style={{ background: 'transparent', border: 'none', fontSize: '14px', cursor: 'pointer', color: 'var(--tekst-dæmpet)', padding: '4px 0' }}
        >
          ‹ Tilbage
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuAaben(!menuAaben)}
            style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px 12px', color: 'var(--tekst-dæmpet)' }}
          >
            ⋯
          </button>
          {menuAaben && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              background: 'var(--bg-forhoejet)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px var(--skygge)',
              minWidth: '140px',
              zIndex: 10,
              overflow: 'hidden'
            }}>
              <button
                onClick={() => { setMenuAaben(false); slet(); }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--fejl)',
                  fontSize: '13px'
                }}
              >
                Slet
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        value={item.navn}
        onChange={(e) => opdater({ navn: e.target.value })}
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: '26px',
          fontWeight: 400,
          border: 'none',
          background: 'transparent',
          padding: '4px 0',
          width: '100%',
          marginBottom: '14px',
          color: 'var(--tekst)'
        }}
      />

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
        {(['ejer', 'overvejer', 'solgt'] as ItemStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => opdater({ status: s })}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              background: item.status === s ? 'var(--accent)' : 'transparent',
              color: item.status === s ? 'var(--accent-tekst)' : 'var(--tekst-dæmpet)',
              border: `1px solid ${item.status === s ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '18px',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: 500
            }}
          >
            {s}
          </button>
        ))}
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

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Noter
          </label>
          <textarea
            value={item.noter}
            onChange={(e) => opdater({ noter: e.target.value })}
            rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px', fontSize: '11px', color: 'var(--tekst-svag)', textAlign: 'center' }}>
        Oprettet {new Date(item.oprettet).toLocaleDateString('da-DK')} · Ændret {new Date(item.aendret).toLocaleDateString('da-DK')}
      </div>
    </div>
  );
}

export default ItemDetalje;