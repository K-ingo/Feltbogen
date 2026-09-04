import { useEffect, useState } from 'react';
import type { Feltnote, Tur } from './db';
import type { VejrData } from './smartMotor';
import { vejrIkonKode } from './smartMotor';
import { fremdrift, manglende } from './afgangsTjek';
import { dageTilbage, dagsnavn, naesteSkift, vejrForDag } from './paaTur';
import { nyesteFoerst, tidstekst } from './feltnoter';

interface Props {
  tur: Tur;
  vejr: VejrData | null;
  // Skriver en indgang i turlogen. Skærmen retter ikke i de gamle — det gør
  // man hjemmefra, ikke med kolde fingre.
  skrivNote: (tekst: string) => void;
  luk: () => void;
}

// Skærmen man har åben når man er ude.
//
// Alt der ikke skal bruges her og nu er skåret væk: ingen pakkeliste, ingen
// budget, ingen redigering af turen. Mørkt uanset resten af appen, fordi det
// er en skærm man kigger på ved bålet og i en hængekøje, og fordi mørke
// pixels koster mindre batteri på en telefon der ikke kan lades op.
//
// Farverne står i hånden og ikke som var(--...): temaet her følger ikke
// resten af appen, det er hele pointen.
const BAGGRUND = '#0b0d0c';
const TEKST = '#e8e4dc';
const DAEMPET = '#8a8a82';
const SVAG = '#5a5a55';
const ACCENT = '#c8a55b';

function PaaTurTilstand({ tur, vejr, skrivNote, luk }: Props) {
  const [udkast, setUdkast] = useState('');
  // Escape lukker. En skærm uden anden vej ud end en knap i et hjørne er
  // ubehagelig, og man kan komme til at åbne den.
  useEffect(() => {
    const paaTast = (e: KeyboardEvent) => { if (e.key === 'Escape') luk(); };
    window.addEventListener('keydown', paaTast);
    return () => window.removeEventListener('keydown', paaTast);
  }, [luk]);

  const idag = new Date();
  const dagIdag = vejrForDag(vejr, idag);
  const tilbage = dageTilbage(tur, idag);
  const tjek = fremdrift(tur.afgangs_tjek);
  const mangler = manglende(tur.afgangs_tjek);
  const noter = nyesteFoerst(tur.feltnoter ?? []);

  const skriv = () => {
    if (!udkast.trim()) return;
    skrivNote(udkast);
    setUdkast('');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 40,
      background: BAGGRUND,
      color: TEKST,
      overflowY: 'auto',
      // Ingen overgange og ingen bevægelse: en skærm der bevæger sig er en
      // skærm man kigger på, og det er ikke meningen.
      transition: 'none'
    }}>
      <div style={{
        maxWidth: '520px',
        margin: '0 auto',
        padding: 'calc(18px + env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom))'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '26px' }}>
          <span style={{ fontSize: 'var(--skrift-lille)', letterSpacing: '1.4px', textTransform: 'uppercase', color: SVAG }}>
            På tur
          </span>
          <button
            onClick={luk}
            style={{
              background: 'transparent',
              border: `1px solid ${SVAG}`,
              borderRadius: '6px',
              color: DAEMPET,
              fontSize: 'var(--skrift-detalje)',
              padding: '5px 12px',
              cursor: 'pointer'
            }}
          >
            Luk
          </button>
        </div>

        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: '28px',
          margin: '0 0 4px',
          color: TEKST
        }}>
          {tur.navn || 'Uden navn'}
        </h1>
        <div style={{ fontSize: 'var(--skrift-knap)', color: DAEMPET, marginBottom: '30px' }}>
          {[tur.sted, tilbage].filter(Boolean).join(' · ')}
        </div>

        <Blok titel="I dag">
          {dagIdag ? (
            <div>
              <div style={{ fontSize: '30px', fontFamily: "'Fraunces', Georgia, serif" }}>
                {vejrIkonKode(dagIdag.vejrkode)} {dagIdag.temp_min}–{dagIdag.temp_max}°C
              </div>
              <div style={{ fontSize: 'var(--skrift-knap)', color: DAEMPET, marginTop: '4px' }}>
                {dagIdag.nedboer_mm > 0 ? `${dagIdag.nedboer_mm} mm nedbør` : 'Tørt'} · {dagIdag.vind_ms} m/s
              </div>
              {(dagIdag.sol_op || dagIdag.sol_ned) && (
                <div style={{ fontSize: 'var(--skrift-knap)', color: DAEMPET, marginTop: '10px' }}>
                  Sol op {dagIdag.sol_op || '—'} · sol ned {dagIdag.sol_ned || '—'}
                </div>
              )}
            </div>
          ) : (
            <Tom>Ingen vejrudsigt hentet for i dag. Den skulle være hentet inden du tog afsted.</Tom>
          )}
        </Blok>

        <Blok titel="Næste vejrskift">
          <NaesteVejrskift vejr={vejr} idag={idag} />
        </Blok>

        {tjek.ialt > 0 && !tjek.faerdig && (
          <Blok titel={`Afgangs-tjek · ${tjek.afkrydsede} af ${tjek.ialt}`}>
            {/* Kun det der mangler. Er man kørt hjemmefra, er de afkrydsede
                punkter ikke længere noget man skal se på. */}
            <div style={{ display: 'grid', gap: '5px' }}>
              {mangler.map((l) => (
                <div key={l.id} style={{ fontSize: 'var(--skrift-brod)', color: ACCENT }}>
                  ○ {l.tekst}
                </div>
              ))}
            </div>
          </Blok>
        )}

        <Blok titel="Turlog">
          <textarea
            value={udkast}
            onChange={(e) => setUdkast(e.target.value)}
            rows={5}
            placeholder="Hvad skete der i dag?"
            style={{
              width: '100%',
              background: '#141614',
              color: TEKST,
              border: `1px solid ${SVAG}`,
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '15px',
              lineHeight: 1.6,
              resize: 'vertical'
            }}
          />

          <button
            onClick={skriv}
            disabled={!udkast.trim()}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '11px',
              borderRadius: '8px',
              border: 'none',
              background: udkast.trim() ? ACCENT : '#1e201e',
              color: udkast.trim() ? '#12140f' : SVAG,
              fontSize: 'var(--skrift-brod)',
              fontWeight: 600,
              cursor: udkast.trim() ? 'pointer' : 'default'
            }}
          >
            Skriv i loggen
          </button>

          <div style={{ fontSize: 'var(--skrift-lille)', color: SVAG, marginTop: '6px' }}>
            Gemmes på turen med det samme — også uden dækning.
          </div>

          {noter.length > 0 && (
            <div style={{ marginTop: '18px', display: 'grid', gap: '12px' }}>
              {/* Kun det man selv har skrevet på turen, nyeste først. Der er
                  ingen redigering her — det gør man hjemmefra, ikke med kolde
                  fingre i mørke. */}
              {noter.map((note: Feltnote) => (
                <div key={note.id}>
                  <div style={{ fontSize: 'var(--skrift-lille)', color: SVAG, marginBottom: '2px' }}>
                    {tidstekst(note.tid)}
                  </div>
                  <div style={{ fontSize: 'var(--skrift-brod)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {note.tekst}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Blok>
      </div>
    </div>
  );
}

function Blok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <div style={{
        fontSize: 'var(--skrift-mikro)',
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
        color: SVAG,
        marginBottom: '8px'
      }}>
        {titel}
      </div>
      {children}
    </section>
  );
}

function Tom({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 'var(--skrift-knap)', color: SVAG, lineHeight: 1.5 }}>{children}</div>;
}

// Den første dag forude hvor vejret rykker sig nok til at det betyder noget
// for hvordan man sover eller går.
function NaesteVejrskift({ vejr, idag }: { vejr: VejrData | null; idag: Date }) {
  const skift = naesteSkift(vejr, idag);

  if (!skift) {
    return <Tom>Ingen udsigt til at det ændrer sig — eller ingen udsigt hentet.</Tom>;
  }

  return (
    <div>
      <div style={{ fontSize: '15px' }}>
        {dagsnavn(skift.dag.dato)}: {vejrIkonKode(skift.dag.vejrkode)} {skift.aarsag}
      </div>
      <div style={{ fontSize: 'var(--skrift-knap)', color: DAEMPET, marginTop: '3px' }}>
        {skift.dag.temp_min}–{skift.dag.temp_max}°C · {skift.dag.nedboer_mm} mm · {skift.dag.vind_ms} m/s
      </div>
    </div>
  );
}

export default PaaTurTilstand;
