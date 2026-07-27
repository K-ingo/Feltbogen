import { useState, useEffect } from 'react';
import { db } from './db';
import type { Item, ItemStatus, Garanti } from './db';
import TagsInput from './TagsInput';

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
    await db.items.update(item.id, aendringer);
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
      await db.items.delete(item.id);
      tilbage();
    }
  };

  if (!item) {
    return <div style={{ padding: '20px' }}>Indlæser...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={tilbage} style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer' }}>
          ‹ Tilbage
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuAaben(!menuAaben)}
            style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 12px' }}
          >
            ⋯
          </button>
          {menuAaben && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minWidth: '120px',
              zIndex: 10
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
                  color: '#c00'
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
        style={{ fontSize: '22px', fontWeight: 500, border: 'none', outline: 'none', width: '100%', marginBottom: '16px' }}
      />

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {(['ejer', 'overvejer', 'solgt'] as ItemStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => opdater({ status: s })}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: item.status === s ? '#333' : '#f0f0f0',
              color: item.status === s ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        <Felt label="Vægt (gram)" type="number" value={item.vaegt_g} onChange={(v) => opdater({ vaegt_g: Number(v) || 0 })} />
        <Felt label="Pris (kr)" type="number" value={item.pris_kr} onChange={(v) => opdater({ pris_kr: Number(v) || 0 })} />
        <Felt label="Antal" type="number" value={item.antal} onChange={(v) => opdater({ antal: Number(v) || 1 })} />
        <Felt label="Dimensioner" value={item.dimensioner} onChange={(v) => opdater({ dimensioner: v })} placeholder="fx ø 33 × 15 cm, 9L" />

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#f5f5f5', borderRadius: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={item.delt}
            onChange={(e) => opdater({ delt: e.target.checked })}
          />
          <span>Delt gear (bæres af én, bruges af flere)</span>
        </label>

        <TagsInput tags={item.tags} onChange={(nye) => opdater({ tags: nye })} />
        <TagsInput
          tags={item.kraever}
          onChange={(nye) => opdater({ kraever: nye })}
          label="Kræver"
          hjaelpetekst="Hårde afhængigheder"
          farve="#c00"
        />
        <TagsInput
          tags={item.komplementer}
          onChange={(nye) => opdater({ komplementer: nye })}
          label="Komplementer"
          hjaelpetekst="Bløde forslag"
          farve="#d97706"
        />

        <Felt label="Købt hos" value={item.koebt_hos} onChange={(v) => opdater({ koebt_hos: v })} placeholder="fx Friluftslageret.dk" />
        <Felt label="Købsdato" value={item.koebsdato} onChange={(v) => opdater({ koebsdato: v })} placeholder="MM/ÅÅÅÅ" />
        <Felt label="Købslink" value={item.koebslink} onChange={(v) => opdater({ koebslink: v })} placeholder="https://..." />
        <Felt label="Ordrenummer" value={item.ordrenummer} onChange={(v) => opdater({ ordrenummer: v })} placeholder="til returnering/reklamation" />

        <div style={{ border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            onClick={() => setGarantiAaben(!garantiAaben)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#f9f9f9',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>
              Garanti
              {item.garanti && item.garanti.laengde_aar > 0 && (
                <span style={{ color: '#666', fontSize: '11px', marginLeft: '8px' }}>
                  · {item.garanti.laengde_aar} år
                  {item.garanti.udloeber_dato && ` · udløber ${item.garanti.udloeber_dato}`}
                </span>
              )}
            </span>
            <span style={{ color: '#888', fontSize: '12px' }}>{garantiAaben ? '−' : '+'}</span>
          </button>
          {garantiAaben && (
            <div style={{ padding: '12px', display: 'grid', gap: '10px', background: 'white' }}>
              <Felt
                label="Længde (år)"
                type="number"
                value={item.garanti?.laengde_aar ?? 0}
                onChange={(v) => opdaterGaranti({ laengde_aar: Number(v) || 0 })}
              />
              <Felt
                label="Udløber dato"
                value={item.garanti?.udloeber_dato ?? ''}
                onChange={(v) => opdaterGaranti({ udloeber_dato: v })}
                placeholder="DD/MM/ÅÅÅÅ"
              />
              <Felt
                label="Påmindelse (dage før udløb)"
                type="number"
                value={item.garanti?.paamindelse_dage ?? 30}
                onChange={(v) => opdaterGaranti({ paamindelse_dage: Number(v) || 30 })}
              />
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Noter</label>
          <textarea
            value={item.noter}
            onChange={(e) => opdater({ noter: e.target.value })}
            rows={3}
            style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px', fontSize: '11px', color: '#999' }}>
        Oprettet: {new Date(item.oprettet).toLocaleDateString('da-DK')}
        {' · '}
        Ændret: {new Date(item.aendret).toLocaleDateString('da-DK')}
      </div>
    </div>
  );
}

interface FeltProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function Felt({ label, value, onChange, type = 'text', placeholder }: FeltProps) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
      />
    </div>
  );
}

export default ItemDetalje;