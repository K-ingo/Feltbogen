import { useEffect, useState } from 'react';
import { hentDeltTur } from './gaest';
import type { Gaestesnapshot } from './gaest';
import { vejrIkonKode } from './smartMotor';
import { Chip, Infokort, SektionsTitel, Indlaeser } from './ui';
import { layout } from './layout';

interface Props {
  token: string;
  // Gæsten kan gå videre til sin egen konto — det er ikke en betingelse for
  // at se turen.
  tilAppen: () => void;
}

// Turen set af en gæst uden konto. Alt kommer fra ét frosset felt på turen;
// der er ingen adgang til ejerens inventar herfra.
function GaesteSide({ token, tilAppen }: Props) {
  const [tilstand, setTilstand] = useState<'henter' | 'ok' | 'ikke_fundet' | 'fejl'>('henter');
  const [snapshot, setSnapshot] = useState<Gaestesnapshot | null>(null);

  useEffect(() => {
    let aktiv = true;

    hentDeltTur(token).then((svar) => {
      if (!aktiv) return;
      if (svar.slags === 'ok') {
        setSnapshot(svar.snapshot);
        setTilstand('ok');
      } else {
        setTilstand(svar.slags);
      }
    });

    return () => { aktiv = false; };
  }, [token]);

  return (
    <div>
      <Topbar tilAppen={tilAppen} />

      <div style={{ ...layout.container, paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
        {tilstand === 'henter' && <Indlaeser />}
        {tilstand === 'ikke_fundet' && (
          <Besked
            titel="Linket virker ikke"
            tekst="Turen findes ikke, eller delingen er trukket tilbage. Spørg den der sendte dig linket."
          />
        )}
        {tilstand === 'fejl' && (
          <Besked
            titel="Kunne ikke hente turen"
            tekst="Der var ikke forbindelse til serveren. Prøv igen om lidt."
          />
        )}
        {tilstand === 'ok' && snapshot && <Turen snapshot={snapshot} />}
      </div>
    </div>
  );
}

function Topbar({ tilAppen }: { tilAppen: () => void }) {
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-topbar)',
      paddingTop: 'env(safe-area-inset-top)'
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
            Feltbogen
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>Delt med dig</div>
        </div>
        <button
          onClick={tilAppen}
          style={{
            padding: '7px 13px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--tekst)',
            border: '1px solid var(--border)'
          }}
        >
          Åbn Feltbogen
        </button>
      </div>
    </div>
  );
}

function Turen({ snapshot }: { snapshot: Gaestesnapshot }) {
  const k = snapshot.koordinater;

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div>
        <h1 style={{ fontSize: '26px', margin: '10px 0 4px' }}>{snapshot.navn || 'Uden navn'}</h1>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)' }}>
          {[
            periode(snapshot.startdato, snapshot.slutdato),
            snapshot.sted,
            `${snapshot.naetter} ${snapshot.naetter === 1 ? 'nat' : 'nætter'}`,
            snapshot.baereafstand_km > 0 ? `${snapshot.baereafstand_km} km bæreafstand` : null
          ].filter(Boolean).join(' · ')}
        </div>
        {k && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${k.lat}&mlon=${k.lng}#map=14/${k.lat}/${k.lng}`}
            target="_blank"
            rel="noreferrer noopener"
            style={{ fontSize: '12px', color: 'var(--accent)', display: 'inline-block', marginTop: '7px' }}
          >
            {k.lat}, {k.lng} · Åbn i kort ↗
          </a>
        )}
      </div>

      {snapshot.besked_fra_ejer && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          fontSize: '13px',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap'
        }}>
          {snapshot.besked_fra_ejer}
        </div>
      )}

      {snapshot.vejr && snapshot.vejr.dage.length > 0 && (
        <Infokort label="Vejrudsigt da turen blev delt">
          <div style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            {snapshot.vejr.dage.map((d) => (
              <div key={d.dato} style={{ display: 'grid', gridTemplateColumns: '54px 22px 1fr auto', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '11px' }}>{dagsnavn(d.dato)}</span>
                <span style={{ fontSize: '15px' }}>{vejrIkonKode(d.vejrkode)}</span>
                <span>{d.temp_min}–{d.temp_max}°C</span>
                <span style={{ fontSize: '11px', color: d.nedboer_mm > 0 ? 'var(--advarsel)' : 'var(--tekst-svag)' }}>
                  {d.nedboer_mm > 0 ? `${d.nedboer_mm} mm` : '—'}
                </span>
              </div>
            ))}
          </div>
        </Infokort>
      )}

      {snapshot.deltagere.length > 0 && (
        <Infokort label={`Deltagere (${snapshot.deltagere.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {snapshot.deltagere.map((navn) => <Chip key={navn}>{navn}</Chip>)}
          </div>
        </Infokort>
      )}

      <Infokort label="Samlet vægt" fremhaevet>
        <div style={{ fontSize: '22px', fontFamily: "'Fraunces', Georgia, serif" }}>
          {(snapshot.vaegt_i_alt_g / 1000).toFixed(2)} kg
        </div>
        {snapshot.personer > 1 && (
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>
            fordelt på {snapshot.personer} personer
          </div>
        )}
      </Infokort>

      <div>
        <SektionsTitel>Delt pakkeliste</SektionsTitel>
        {snapshot.afsnit.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tekst-svag)' }}>Der var ikke valgt gear endnu.</div>
        ) : (
          snapshot.afsnit.map((a) => (
            <div key={a.titel} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', fontWeight: 600, marginBottom: '5px' }}>
                {a.titel}
              </div>
              {a.items.map((i, n) => (
                <div
                  key={`${i.navn}-${n}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '10px',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border-svag)',
                    fontSize: '13px'
                  }}
                >
                  <span>{i.navn || 'Uden navn'}</span>
                  <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {i.delt && <span style={{ fontSize: '10px', marginRight: '6px' }}>delt</span>}
                    {i.vaegt_g} g
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', textAlign: 'center', paddingTop: '6px' }}>
        Et øjebliksbillede fra {datoTekst(snapshot.delt_den)}. Turen kan være ændret siden.
      </div>
    </div>
  );
}

function Besked({ titel, tekst }: { titel: string; tekst: string }) {
  return (
    <div style={{ padding: '50px 10px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '20px', marginBottom: '8px' }}>{titel}</div>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', lineHeight: 1.6 }}>{tekst}</div>
    </div>
  );
}

const MAANEDER = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december'
];

function periode(start: string, slut: string): string {
  const fra = new Date(start);
  if (!start || Number.isNaN(fra.getTime())) return '';

  const til = slut ? new Date(slut) : fra;
  const fuld = (d: Date) => `${d.getDate()}. ${MAANEDER[d.getMonth()]}`;

  if (!slut || Number.isNaN(til.getTime()) || fra.getTime() === til.getTime()) return fuld(fra);
  if (fra.getMonth() === til.getMonth() && fra.getFullYear() === til.getFullYear()) {
    return `${fra.getDate()}.–${fuld(til)}`;
  }
  return `${fuld(fra)} – ${fuld(til)}`;
}

function dagsnavn(dato: string): string {
  const d = new Date(dato);
  const dage = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  return `${dage[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function datoTekst(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'et tidligere tidspunkt' : d.toLocaleDateString('da-DK');
}

export default GaesteSide;
