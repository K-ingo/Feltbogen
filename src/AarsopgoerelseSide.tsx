import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Tur } from './db';
import { layout } from './layout';
import { Knap, SektionsTitel } from './ui';
import { kortDag } from './datotekst';
import { mestBrugte, tureFordeltPrMaaned } from './statistik';
import {
  aarMedTure,
  aarsoverskrift,
  aarstalFor,
  fordeling,
  koldesteNat,
  laengsteBaering,
  laengsteTur,
  mestBesoegte,
  rejsefaeller,
  tureIAaret,
  vaadesteTur
} from './aarsopgoerelse';

interface Props {
  aar: number;
  vaelgAar: (aar: number) => void;
  aabnFeltbog: (aar: number) => void;
  tilbage: () => void;
  aabnTur: (id: number) => void;
  aabnItem: (id: number) => void;
}

const MAANEDER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// Så mange vises af hver liste. Årsopgørelsen skal kunne læses i ét træk;
// den fulde liste hører hjemme under Statistik.
const MAKS = 3;

// Årsopgørelsen: året som en side man kan læse igennem.
//
// Den er bevidst en anden slags skærm end Statistik. Statistik er et værktøj
// man slår op i; det her er en beretning, og derfor er tallene store, sproget
// hele sætninger, og rækkefølgen fortællende frem for alfabetisk.
//
// Alt bygger på data appen allerede har. Der er ingen tal her som ikke kan
// spores tilbage til noget der er skrevet ind.
function AarsopgoerelseSide({ aar, vaelgAar, aabnFeltbog, tilbage, aabnTur, aabnItem }: Props) {
  const alleTure = useLiveQuery(() => db.ture.toArray()) ?? [];
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];

  const ture = tureIAaret(alleTure, aar);
  const tal = aarstalFor(alleTure, items, aar);
  const aarene = aarMedTure(alleTure);

  const kold = koldesteNat(ture);
  const vaad = vaadesteTur(ture);
  const laengst = laengsteTur(ture);
  const baering = laengsteBaering(ture);
  const steder3 = mestBesoegte(ture, steder).slice(0, MAKS);
  const faeller = rejsefaeller(ture).slice(0, MAKS);
  const grej = mestBrugte(items, ture, grupper, MAKS);

  return (
    <div style={layout.container}>
      <button
        onClick={tilbage}
        style={{ background: 'transparent', border: 'none', fontSize: 'var(--skrift-brod)', cursor: 'pointer', color: 'var(--tekst-dæmpet)', padding: '4px 0', marginBottom: '10px' }}
      >
        ‹ Tilbage
      </button>

      <Aarshoved aar={aar} overskrift={aarsoverskrift(tal)} />

      {aarene.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '22px' }}>
          {aarene.map((a) => (
            <Knap key={a} variant={a === aar ? 'primaer' : 'sekundaer'} onClick={() => vaelgAar(a)}>
              {a}
            </Knap>
          ))}
        </div>
      )}

      {tal.ture === 0 ? (
        <div style={{ padding: '30px 0', color: 'var(--tekst-svag)', fontSize: 'var(--skrift-knap)', lineHeight: 1.6 }}>
          Der står ingen ture på {aar}. Kladder tælles ikke med — er der en tur
          der mangler, står den måske stadig som kladde.
        </div>
      ) : (
        <>
          <Tavle>
            <Stortal tal={tal.ture} enhed={tal.ture === 1 ? 'tur' : 'ture'} />
            <Stortal tal={tal.naetter} enhed={tal.naetter === 1 ? 'nat' : 'nætter'} />
            <Stortal tal={tal.dage} enhed="dage ude" />
            {tal.km > 0 && <Stortal tal={tal.km} enhed="km båret" />}
            {tal.rejsefaeller > 0 && (
              <Stortal tal={tal.rejsefaeller} enhed={tal.rejsefaeller === 1 ? 'rejsefælle' : 'rejsefæller'} />
            )}
            {tal.nytGrej > 0 && (
              <Stortal
                tal={tal.nytGrej}
                enhed={tal.nytGrej === 1 ? 'nyt stykke grej' : 'nye stykker grej'}
                under={tal.nytGrejKr > 0 ? `${tal.nytGrejKr.toLocaleString('da-DK')} kr` : undefined}
              />
            )}
            {tal.feltnoter > 0 && (
              <Stortal tal={tal.feltnoter} enhed={tal.feltnoter === 1 ? 'feltnote' : 'feltnoter'} />
            )}
          </Tavle>

          <Aarshjul maaneder={tureFordeltPrMaaned(ture)} />

          <SektionsTitel>Året der var</SektionsTitel>
          <div style={{ display: 'grid', gap: '8px', marginBottom: '26px' }}>
            {laengst && (
              <Nedslag
                overskrift="Længste tur"
                tekst={`${navnPaa(laengst.tur)} — ${laengst.tal} ${laengst.tal === 1 ? 'nat' : 'nætter'}`}
                aabn={() => aabn(laengst.tur, aabnTur)}
              />
            )}
            {baering && (
              <Nedslag
                overskrift="Længste bæring"
                tekst={`${navnPaa(baering.tur)} — ${baering.tal} km`}
                aabn={() => aabn(baering.tur, aabnTur)}
              />
            )}
            {kold && (
              <Nedslag
                overskrift="Koldeste nat"
                tekst={`${kold.grader.toFixed(0)}° natten til ${kortDag(kold.dato)} på ${navnPaa(kold.tur)}`}
                // Udsigten er det eneste vejr appen har. At kalde den en
                // måling ville være at opfinde data.
                fodnote="efter udsigten fra planlægningen"
                aabn={() => aabn(kold.tur, aabnTur)}
              />
            )}
            {vaad && (
              <Nedslag
                overskrift="Vådeste tur"
                tekst={`${navnPaa(vaad.tur)} — ${vaad.mm.toFixed(0)} mm`}
                fodnote="efter udsigten fra planlægningen"
                aabn={() => aabn(vaad.tur, aabnTur)}
              />
            )}
            {steder3.length > 0 && (
              <Nedslag
                overskrift={steder3.length === 1 ? 'Stedet' : 'Mest besøgt'}
                tekst={steder3.map((s) => `${s.navn} (${s.ture})`).join(' · ')}
              />
            )}
            {faeller.length > 0 && (
              <Nedslag
                overskrift={faeller.length === 1 ? 'Rejsefælle' : 'Mest afsted med'}
                tekst={faeller.map((f) => `${f.navn} (${f.ture})`).join(' · ')}
              />
            )}
          </div>

          {grej.length > 0 && (
            <>
              <SektionsTitel>Grejet der altid var med</SektionsTitel>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '26px' }}>
                {grej.map(({ item, antalTure }) => (
                  <Nedslag
                    key={item.uid}
                    overskrift={item.navn}
                    tekst={`med på ${antalTure} af årets ${tal.ture} ${tal.ture === 1 ? 'tur' : 'ture'}`}
                    aabn={item.id !== undefined ? () => aabnItem(item.id as number) : undefined}
                  />
                ))}
              </div>
            </>
          )}

          <Andele ture={ture} />

          {/* Bogen er årets ture skrevet ud, ikke tallene. Den hører til
              nederst: man læser opgørelsen først og trykker den bagefter. */}
          <div style={{ marginTop: '26px' }}>
            <Knap variant="primaer" onClick={() => aabnFeltbog(aar)}>
              Årets feltbog — til print og PDF
            </Knap>
          </div>

          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', lineHeight: 1.6, marginTop: '26px' }}>
            Talt op over de {tal.ture} {tal.ture === 1 ? 'tur' : 'ture'} der står på {aar}.
            Kladder tælles ikke med. Nyt grej regnes efter købsdatoen, så gear
            uden dato lander ikke i det år det tilfældigvis blev skrevet ind.
          </div>
        </>
      )}
    </div>
  );
}

function navnPaa(tur: Tur): string {
  return tur.navn.trim() || 'turen uden navn';
}

function aabn(tur: Tur, aabnTur: (id: number) => void): void {
  if (tur.id !== undefined) aabnTur(tur.id);
}

// Årstallet sat med den samme serif som overskrifterne, men stort nok til at
// være et forsidebillede frem for en rubrik.
function Aarshoved({ aar, overskrift }: { aar: number; overskrift: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '62px',
        lineHeight: 1,
        letterSpacing: '-2px',
        color: 'var(--accent)'
      }}>
        {aar}
      </div>
      <div style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '19px',
        lineHeight: 1.35,
        marginTop: '8px',
        color: 'var(--tekst)'
      }}>
        {overskrift}
      </div>
    </div>
  );
}

// Tallene står som løse fliser og ikke som ét gitter med stregerne tegnet af
// mellemrummene. Antallet af tal skifter — km og feltnoter er der kun når der
// er noget at vise — og et ulige antal ville efterlade et tomt felt i gitteret
// der ser ud som en fejl. Løse fliser har ikke det problem.
function Tavle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
      gap: '8px',
      marginBottom: '26px'
    }}>
      {children}
    </div>
  );
}

function Stortal({ tal, enhed, under }: { tal: number; enhed: string; under?: string }) {
  return (
    <div style={{
      padding: '14px',
      borderRadius: '10px',
      background: 'var(--bg-forhoejet)',
      border: '1px solid var(--border-svag)'
    }}>
      <div style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '30px',
        lineHeight: 1.1,
        color: 'var(--tekst)'
      }}>
        {tal.toLocaleString('da-DK')}
      </div>
      <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>{enhed}</div>
      {under && <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', marginTop: '1px' }}>{under}</div>}
    </div>
  );
}

// Årets tolv måneder som en stribe. Ikke en graf med akser — et rytmebillede
// af hvornår man kom afsted.
function Aarshjul({ maaneder }: { maaneder: number[] }) {
  const top = Math.max(...maaneder, 1);

  return (
    <div style={{ marginBottom: '26px' }}>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '54px' }}>
        {maaneder.map((antal, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div
              title={`${MAANEDER[i]}: ${antal}`}
              style={{
                height: `${Math.max((antal / top) * 100, antal > 0 ? 12 : 3)}%`,
                borderRadius: '3px',
                background: antal > 0 ? 'var(--accent)' : 'var(--border-svag)'
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '3px', marginTop: '5px' }}>
        {MAANEDER.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 'var(--skrift-mikro)', color: 'var(--tekst-svag)' }}>
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}

function Nedslag({ overskrift, tekst, fodnote, aabn }: {
  overskrift: string;
  tekst: string;
  fodnote?: string;
  aabn?: () => void;
}) {
  const indhold = (
    <>
      <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {overskrift}
      </div>
      <div style={{ fontSize: 'var(--skrift-brod)', marginTop: '3px', color: 'var(--tekst)' }}>{tekst}</div>
      {fodnote && (
        <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', marginTop: '2px' }}>{fodnote}</div>
      )}
    </>
  );

  const ramme = {
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'var(--bg-forhoejet)',
    border: '1px solid var(--border-svag)'
  };

  if (!aabn) return <div style={ramme}>{indhold}</div>;

  return (
    <button onClick={aabn} style={{ ...ramme, width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--tekst)' }}>
      {indhold}
    </button>
  );
}

// Hvad året mest bestod af. Kun kendetegn med mere end én værdi siger noget —
// står der "shelter 6" og intet andet, er det ikke en fordeling.
function Andele({ ture }: { ture: Tur[] }) {
  const raekker = [
    { navn: 'Overnatning', andele: fordeling(ture, (t) => t.overnatning) },
    { navn: 'Terræn', andele: fordeling(ture, (t) => t.terraen) },
    { navn: 'Aktivitet', andele: fordeling(ture, (t) => t.aktivitet) }
  ].filter((r) => r.andele.length > 1);

  if (raekker.length === 0) return null;

  return (
    <>
      <SektionsTitel>Sådan så året ud</SektionsTitel>
      <div style={{ display: 'grid', gap: '12px' }}>
        {raekker.map((r) => (
          <div key={r.navn}>
            <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', marginBottom: '5px' }}>{r.navn}</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {r.andele.map((a) => (
                <span
                  key={a.vaerdi}
                  style={{
                    fontSize: 'var(--skrift-detalje)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent-border)',
                    color: 'var(--tekst)'
                  }}
                >
                  {a.vaerdi} <span style={{ color: 'var(--tekst-dæmpet)' }}>{a.antal}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default AarsopgoerelseSide;
