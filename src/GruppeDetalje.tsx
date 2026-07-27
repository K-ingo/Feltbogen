import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import TagsInput from './TagsInput';
import { Kort, layout, SektionsTitel } from './ui';

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
    return <div style={{ padding: '20px', color: 'var(--tekst-dæmpet)' }}>Indlæser...</div>;
  }

  const valgteItems = items?.filter((i) => i.id && gruppe.item_ids.includes(i.id)) ?? [];
  const totalVaegt = valgteItems.reduce((sum, i) => sum + i.vaegt_g, 0);
  const totalPris = valgteItems.reduce((sum, i) => sum + i.pris_kr, 0);

  const tilgaengeligeItems = items?.filter((i) =>
    i.status === 'ejer' &&
    (soegning === '' || i.navn.toLowerCase().includes(soegning.toLowerCase()))
  ) ?? [];

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
                Slet gruppe
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        value={gruppe.navn}
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

      <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
        <TagsInput
          tags={gruppe.tags}
          onChange={(nye) => opdater({ tags: nye })}
          hjaelpetekst="fx sommer, hængekøje, solo"
        />

        <Kort fremhaevet>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>
            {valgteItems.length} items
          </div>
          <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
            {(totalVaegt / 1000).toFixed(2)} kg · {totalPris} kr
          </div>
        </Kort>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Noter
          </label>
          <textarea
            value={gruppe.noter}
            onChange={(e) => opdater({ noter: e.target.value })}
            rows={2}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
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
          const er_med = item.id ? gruppe.item_ids.includes(item.id) : false;
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
                background: er_med ? 'var(--accent-bg)' : 'transparent',
                marginBottom: '2px',
                border: '1px solid transparent'
              }}
            >
              <input
                type="checkbox"
                checked={er_med}
                onChange={() => item.id && toggleItem(item.id)}
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