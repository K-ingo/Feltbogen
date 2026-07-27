import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import TagsInput from './TagsInput';

interface Props {
  gruppeId: number;
  tilbage: () => void;
}

function GruppeDetalje({ gruppeId, tilbage }: Props) {
  const [gruppe, setGruppe] = useState<Gruppe | null>(null);
  const [menuAaben, setMenuAaben] = useState(false);
  const [soegning, setSoegning] = useState('');

  const items = useLiveQuery(() => db.items.toArray());

  useEffect(() => {
    db.grupper.get(gruppeId).then((fundet) => setGruppe(fundet ?? null));
  }, [gruppeId]);

  const opdater = async (aendringer: Partial<Gruppe>) => {
    if (!gruppe?.id) return;
    const nyGruppe = { ...gruppe, ...aendringer, aendret: new Date() };
    await db.grupper.update(gruppe.id, aendringer);
    setGruppe(nyGruppe);
  };

  const slet = async () => {
    if (!gruppe?.id) return;
    if (confirm(`Slet gruppen "${gruppe.navn}"?`)) {
      await db.grupper.delete(gruppe.id);
      tilbage();
    }
  };

  const toggleItem = async (itemId: number) => {
    if (!gruppe) return;
    const er_med = gruppe.item_ids.includes(itemId);
    const nyeIds = er_med
      ? gruppe.item_ids.filter((id) => id !== itemId)
      : [...gruppe.item_ids, itemId];
    await opdater({ item_ids: nyeIds });
  };

  if (!gruppe) {
    return <div style={{ padding: '20px' }}>Indlæser...</div>;
  }

  const valgteItems = items?.filter((i) => i.id && gruppe.item_ids.includes(i.id)) ?? [];
  const totalVaegt = valgteItems.reduce((sum, i) => sum + i.vaegt_g, 0);
  const totalPris = valgteItems.reduce((sum, i) => sum + i.pris_kr, 0);

  const tilgaengeligeItems = items?.filter((i) =>
    i.status === 'ejer' &&
    (soegning === '' || i.navn.toLowerCase().includes(soegning.toLowerCase()))
  ) ?? [];

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
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
                Slet gruppe
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        value={gruppe.navn}
        onChange={(e) => opdater({ navn: e.target.value })}
        style={{ fontSize: '22px', fontWeight: 500, border: 'none', outline: 'none', width: '100%', marginBottom: '16px' }}
      />

      <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
        <TagsInput
          tags={gruppe.tags}
          onChange={(nye) => opdater({ tags: nye })}
          hjaelpetekst="fx sommer, hængekøje, solo"
        />

        <div style={{ padding: '10px 12px', background: '#f5f5f5', borderRadius: '6px', fontSize: '13px', color: '#666' }}>
          {valgteItems.length} items · {(totalVaegt / 1000).toFixed(2)} kg · {totalPris} kr
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Noter</label>
          <textarea
            value={gruppe.noter}
            onChange={(e) => opdater({ noter: e.target.value })}
            rows={2}
            style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
      </div>

      <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Items i gruppen</h3>

      <input
        placeholder="Søg items i inventaret..."
        value={soegning}
        onChange={(e) => setSoegning(e.target.value)}
        style={{ width: '100%', padding: '8px', fontSize: '14px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
      />

      <div>
        {tilgaengeligeItems.length === 0 && (
          <p style={{ color: '#888', fontSize: '13px' }}>Ingen items matcher.</p>
        )}
        {tilgaengeligeItems.map((item) => {
          const er_med = item.id ? gruppe.item_ids.includes(item.id) : false;
          return (
            <label
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                background: er_med ? '#f0f7f0' : 'transparent'
              }}
            >
              <input
                type="checkbox"
                checked={er_med}
                onChange={() => item.id && toggleItem(item.id)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px' }}>{item.navn}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>
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