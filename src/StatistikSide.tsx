import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Kort, SektionsTitel, Segment } from './ui';
import { Skal } from './Skal';
import type { Fane } from './Skal';
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

const PERIODER: readonly Periode[] = ['i_aar', 'sidste_aar', 'alt'];
const PERIODE_LABEL: Record<Periode, string> = {
  i_aar: 'I år',
  sidste_aar: 'Sidste år',
  alt: 'Alt'
};

const MAANEDER = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

// Genbruges af de widgets der har en lille overskrift over et nøgletal.
const widgetTitelStil = {
  fontSize: '11px',
  color: 'var(--tekst-dæmpet)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
} as const;

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
}

function StatistikSide({ fane, skift }: Props) {
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

  return (
    <Skal fane={fane} skift={skift} titel="Statistik">
      <div style={{ marginBottom: '20px' }}>
        <Segment
          vaerdier={PERIODER}
          valgt={periode}
          vaelg={(p) => setPeriode(p)}
          formater={(p) => PERIODE_LABEL[p]}
        />
      </div>

      <div style={{ display: 'grid', gap: '14px' }}>

        <Kort fremhaevet>
          <div style={{ ...widgetTitelStil, marginBottom: '6px' }}>Samlet inventarværdi</div>
          <div style={{ fontSize: '28px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>
            {inventarvaerdi.toLocaleString('da-DK')} <span style={{ fontSize: '16px', color: 'var(--tekst-dæmpet)' }}>kr</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
            {totalItems} items · {(totalVaegt / 1000).toFixed(2)} kg
          </div>
        </Kort>

        <Kort fremhaevet>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <div style={widgetTitelStil}>Ture</div>
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
                title={`${MAANEDER[i]}: ${antal}`}
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
            <div style={{ ...widgetTitelStil, color: 'var(--advarsel)', marginBottom: '6px', fontWeight: 600 }}>
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
    </Skal>
  );
}

export default StatistikSide;