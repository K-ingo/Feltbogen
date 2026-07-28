import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Kort, layout, SektionsTitel } from './ui';
import {
  filtrererTure,
  samletInventarvaerdi,
  samletVaegt,
  antalItems,
  tureFordeltPrMaaned,
  mestBrugte,
  ubrugteItems,
  fordelingPrGruppe
} from './statistik';
import type { Periode } from './statistik';

function StatistikSide() {
  const [periode, setPeriode] = useState<Periode>('i_aar');

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const alleTure = useLiveQuery(() => db.ture.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];

  const ture = filtrererTure(alleTure, periode);

  const inventarvaerdi = samletInventarvaerdi(items);
  const totalVaegt = samletVaegt(items);
  const totalItems = antalItems(items);
  const tureMaaneder = tureFordeltPrMaaned(ture);
  const maxMaaned = Math.max(...tureMaaneder, 1);
  const topBrugt = mestBrugte(items, ture, grupper, 5);
  const ubrugt = ubrugteItems(items, alleTure, grupper);
  const gruppeFordeling = fordelingPrGruppe(items, grupper);

  const perioder: { id: Periode; label: string }[] = [
    { id: 'i_aar', label: 'I år' },
    { id: 'sidste_aar', label: 'Sidste år' },
    { id: 'alt', label: 'Alt' }
  ];

  return (
    <div style={layout.container}>
      <h1>Feltbogen</h1>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '20px' }}>
        Statistik
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {perioder.map((p) => {
          const erAktiv = periode === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPeriode(p.id)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                background: erAktiv ? 'var(--accent)' : 'transparent',
                color: erAktiv ? 'var(--accent-tekst)' : 'var(--tekst-dæmpet)',
                border: `1px solid ${erAktiv ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '16px',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gap: '14px' }}>

        <Kort fremhaevet>
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Samlet inventarværdi
          </div>
          <div style={{ fontSize: '28px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>
            {inventarvaerdi.toLocaleString('da-DK')} <span style={{ fontSize: '16px', color: 'var(--tekst-dæmpet)' }}>kr</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
            {totalItems} items · {(totalVaegt / 1000).toFixed(2)} kg
          </div>
        </Kort>

        <Kort fremhaevet>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ture
            </div>
            <div style={{ fontSize: '22px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>
              {ture.length}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: '3px', height: '40px', marginTop: '8px' }}>
            {tureMaaneder.map((antal, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: antal > 0 ? `${Math.max((antal / maxMaaned) * 100, 15)}%` : '2px',
                  background: antal > 0 ? 'var(--accent)' : 'var(--border-svag)',
                  borderRadius: '2px',
                  transition: 'height 0.2s'
                }}
                title={`${['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'][i]}: ${antal}`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--tekst-svag)', marginTop: '4px' }}>
            <span>Jan</span>
            <span>Apr</span>
            <span>Jul</span>
            <span>Okt</span>
            <span>Dec</span>
          </div>
        </Kort>

        {ubrugt.antal > 0 && (
          <div style={{
            padding: '14px',
            background: 'var(--advarsel-bg)',
            border: '1px solid var(--advarsel-border)',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--advarsel)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
              Ubrugte items
            </div>
            <div style={{ fontSize: '22px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif", color: 'var(--advarsel)' }}>
              {ubrugt.antal} <span style={{ fontSize: '14px' }}>items</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
              Ikke brugt i sidste år · {ubrugt.vaerdi.toLocaleString('da-DK')} kr · {(ubrugt.vaegt / 1000).toFixed(1)} kg
            </div>
          </div>
        )}

        {topBrugt.length > 0 && (
          <Kort fremhaevet>
            <SektionsTitel>Mest brugte gear</SektionsTitel>
            <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
              {topBrugt.map((x, i) => (
                <div key={x.item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '11px', color: 'var(--tekst-svag)', width: '16px' }}>{i + 1}</span>
                    <span style={{ fontSize: '13px', color: 'var(--tekst)' }}>{x.item.navn}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>
                    {x.antalTure} {x.antalTure === 1 ? 'tur' : 'ture'}
                  </span>
                </div>
              ))}
            </div>
          </Kort>
        )}

        {gruppeFordeling.length > 0 && (
          <Kort fremhaevet>
            <SektionsTitel>Fordeling pr. gruppe</SektionsTitel>
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginTop: '4px', marginBottom: '12px', background: 'var(--border-svag)' }}>
              {gruppeFordeling.map((g, i) => (
                <div
                  key={i}
                  style={{
                    width: `${g.procent}%`,
                    background: 'var(--accent)',
                    opacity: 1 - (i * 0.15),
                    borderRight: i < gruppeFordeling.length - 1 ? '1px solid var(--bg)' : 'none'
                  }}
                  title={`${g.navn}: ${g.procent.toFixed(0)}%`}
                />
              ))}
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              {gruppeFordeling.map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      background: 'var(--accent)',
                      opacity: 1 - (i * 0.15)
                    }} />
                    <span style={{ fontSize: '13px', color: 'var(--tekst)' }}>{g.navn}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>
                    {(g.vaegt / 1000).toFixed(1)} kg · {g.procent.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </Kort>
        )}

        {items.length === 0 && (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--tekst-svag)', fontSize: '13px' }}>
            Ingen items endnu. Tilføj gear under Inventar for at se statistik.
          </div>
        )}

      </div>
    </div>
  );
}

export default StatistikSide;