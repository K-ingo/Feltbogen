import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Knap } from './ui';
import { kortDag } from './datotekst';
import { bygFeltbog, filnavn, temperaturspand, vejrord } from './feltbog';
import type { Turside } from './feltbog';

interface Props {
  aar: number;
  tilbage: () => void;
}

// Årets feltbog, sat til at blive trykt.
//
// Den ligger uden for `Skal` og har derfor hverken faner eller sidebar: alt
// hvad der ikke er bogen, ville komme med på papiret. Det lille der er af
// betjening, bærer klassen `kun-skaerm` og forsvinder i printet.
//
// Siderne kan læses igennem på skærmen først. Det er meningen — man skal
// kunne se hvad man trykker, inden man bruger papir på det.
function FeltbogSide({ aar, tilbage }: Props) {
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];

  // Browseren foreslår sidens titel som filnavn når man gemmer som PDF.
  // Uden det her hedder filen "Feltbogen" — appens navn — uanset hvilket år
  // man står i.
  useEffect(() => {
    const foer = document.title;
    document.title = filnavn(aar);
    return () => { document.title = foer; };
  }, [aar]);

  const bog = bygFeltbog(aar, ture, items, grupper, steder);

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 20px 60px' }}>
      <div className="kun-skaerm" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '28px'
      }}>
        <button
          onClick={tilbage}
          style={{ background: 'transparent', border: 'none', fontSize: '14px', cursor: 'pointer', color: 'var(--tekst-dæmpet)', padding: '4px 0' }}
        >
          ‹ Tilbage
        </button>
        <Knap variant="primaer" onClick={() => window.print()}>Udskriv eller gem som PDF</Knap>
      </div>

      {bog.sider.length === 0 ? (
        <div className="kun-skaerm" style={{ color: 'var(--tekst-svag)', fontSize: '13px' }}>
          Der står ingen ture på {aar}, så der er ikke noget at trykke.
        </div>
      ) : (
        <>
          <Forside aar={bog.aar} overskrift={bog.overskrift} sider={bog.sider} tal={bog.tal} />
          {bog.sider.map((side) => (
            <Tursider key={side.tur.uid} side={side} />
          ))}
        </>
      )}
    </div>
  );
}

function Forside({ aar, overskrift, sider, tal }: {
  aar: number;
  overskrift: string;
  sider: Turside[];
  tal: { naetter: number; dage: number; km: number };
}) {
  return (
    <section className="feltbog-side" style={{ marginBottom: '48px' }}>
      <div style={{ fontFamily: serif, fontSize: '15px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--tekst-dæmpet)' }}>
        Feltbogen
      </div>
      <div style={{ fontFamily: serif, fontSize: '84px', lineHeight: 1, letterSpacing: '-3px', color: 'var(--accent)', margin: '8px 0 14px' }}>
        {aar}
      </div>
      <div style={{ fontFamily: serif, fontSize: '20px', lineHeight: 1.4 }}>{overskrift}</div>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
        {tal.dage} dage ude{tal.km > 0 && ` · ${tal.km} km båret`}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '30px 0 18px' }} />

      <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
        {sider.map((s) => (
          <li key={s.tur.uid} style={{ fontSize: '13px' }}>
            <span style={{ fontWeight: 500 }}>{s.tur.navn.trim() || 'Uden navn'}</span>
            <span style={{ color: 'var(--tekst-dæmpet)' }}>
              {s.periode && ` · ${s.periode}`}{s.sted && ` · ${s.sted}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tursider({ side }: { side: Turside }) {
  const { tur } = side;

  return (
    <section className="feltbog-side" style={{ marginBottom: '48px' }}>
      <h2 style={{ fontSize: '26px', margin: '0 0 4px' }}>{tur.navn.trim() || 'Uden navn'}</h2>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '18px' }}>
        {[side.periode, side.sted].filter(Boolean).join(' · ')}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 26px', marginBottom: '20px' }}>
        {side.fakta.map((f) => (
          <div key={f.navn}>
            <div style={etiketStil}>{f.navn}</div>
            <div style={{ fontSize: '14px' }}>{f.vaerdi}</div>
          </div>
        ))}
        {side.vaegt_g > 0 && (
          <div>
            <div style={etiketStil}>Pakket vægt</div>
            <div style={{ fontSize: '14px' }}>{(side.vaegt_g / 1000).toFixed(2)} kg</div>
          </div>
        )}
      </div>

      {side.deltagere.length > 0 && (
        <Afsnit titel="Med på turen">
          <div style={{ fontSize: '13px' }}>{side.deltagere.join(', ')}</div>
        </Afsnit>
      )}

      {side.vejr.length > 0 && (
        <Afsnit titel="Vejret der var meldt">
          <table style={tabelStil}>
            <tbody>
              {side.vejr.map((d) => (
                <tr key={d.dato}>
                  <td style={{ ...celle, width: '22%' }}>{kortDag(d.dato)}</td>
                  <td style={{ ...celle, width: '26%' }}>{vejrord(d.vejrkode)}</td>
                  <td style={celle}>{temperaturspand(d.temp_min, d.temp_max)}</td>
                  <td style={celle}>{d.nedboer_mm.toFixed(1)} mm</td>
                  <td style={celle}>{Math.round(d.vind_ms)} m/s</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...etiketStil, marginTop: '5px' }}>
            Udsigten fra planlægningen, ikke en måling.
          </div>
        </Afsnit>
      )}

      {side.pakkeliste.length > 0 && (
        <Afsnit titel="Pakkeliste">
          <div style={{ display: 'grid', gap: '12px' }}>
            {side.pakkeliste.map((del) => (
              <div key={del.navn}>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '3px' }}>
                  {del.navn}
                  <span style={{ color: 'var(--tekst-dæmpet)', fontWeight: 400 }}>
                    {' '}· {(del.vaegt_g / 1000).toFixed(2)} kg
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--tekst-dæmpet)', lineHeight: 1.6 }}>
                  {del.items.map((i) => (i.antal > 1 ? `${i.navn} ×${i.antal}` : i.navn)).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </Afsnit>
      )}

      {side.budget && (
        <Afsnit titel="Budget">
          <table style={tabelStil}>
            <tbody>
              {side.budget.linjer.map((l) => (
                <tr key={l.id}>
                  <td style={celle}>{l.beskrivelse.trim() || l.kategori}</td>
                  <td style={{ ...celle, textAlign: 'right' }}>{l.forventet_kr} kr</td>
                  <td style={{ ...celle, textAlign: 'right' }}>{l.faktisk_kr} kr</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...celle, fontWeight: 500 }}>I alt</td>
                <td style={{ ...celle, textAlign: 'right', fontWeight: 500 }}>{side.budget.forventet} kr</td>
                <td style={{ ...celle, textAlign: 'right', fontWeight: 500 }}>{side.budget.faktisk} kr</td>
              </tr>
            </tbody>
          </table>
          <div style={{ ...etiketStil, marginTop: '5px' }}>Forventet · faktisk</div>
        </Afsnit>
      )}

      {side.dage.length > 0 && (
        <Afsnit titel="Feltnoter">
          <div style={{ display: 'grid', gap: '10px' }}>
            {side.dage.map((dag) => (
              <div key={dag.dato}>
                <div style={etiketStil}>{dag.dato ? kortDag(dag.dato) : 'Uden dato'}</div>
                {dag.indgange.map((n) => (
                  <div key={n.id} style={{ fontSize: '13px', lineHeight: 1.55, marginTop: '2px' }}>
                    {n.tekst}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Afsnit>
      )}

      {tur.noter.trim() && (
        <Afsnit titel="Noter">
          <div style={{ fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{tur.noter}</div>
        </Afsnit>
      )}
    </section>
  );
}

function Afsnit({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <h3 style={{ fontSize: '14px', margin: '0 0 6px' }}>{titel}</h3>
      {children}
    </div>
  );
}

const serif = "'Fraunces', Georgia, serif";

const etiketStil: CSSProperties = {
  fontSize: '10.5px',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: 'var(--tekst-svag)'
};

const tabelStil: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12.5px'
};

const celle: CSSProperties = {
  padding: '3px 0',
  borderBottom: '1px solid var(--border-svag)',
  textAlign: 'left'
};

export default FeltbogSide;
