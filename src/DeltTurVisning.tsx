import { useState } from 'react';
import type { ReactNode } from 'react';
import type { GaesteBillede, GaesteItem, Gaestesnapshot } from './gaest';
import { ledigtFaelles, gaestetitel } from './gaest';
import type { Deltagelse } from './deltagelse';
import { baererePrGear, samletMedbragtVaegt, visningsnavn } from './deltagelse';
import { vejrIkonKode, linjerEfterPerson, medDeltagernes, samletVaegt, linjeAfMedbragt } from './smartMotor';
import type { Pakkelinje, Pakkeafsnit } from './smartMotor';
import { formatterPeriode, kortDag, datoTekst } from './datotekst';
import { Chip, Infokort, Knap, SektionsTitel } from './ui';

// Selve turen som den ser ud for en der har fået den delt. Bruges to steder:
// på gæstesiden, hvor snapshottet lige er hentet, og på en gemt delt tur,
// hvor det kommer fra basen. De skal se ens ud — det er den samme tur.

function DeltTurVisning({ snapshot, deltagelser = [], mig, opdater, children, kanMelde }: {
  snapshot: Gaestesnapshot;
  // Det de andre har skrevet sig på for. Tom når turen læses fra en gemt kopi
  // uden forbindelse.
  deltagelser?: Deltagelse[];
  // Gæstens eget bruger-id, når hun er logget ind. Bruges til at svare på det
  // spørgsmål, ejeren ikke har: hvad kommer *jeg* til at bære?
  mig?: string;
  // At hente ejerens nyeste hører til dér, hvor der står, at udgaven kan være
  // gammel. Se turmaal.ts: siger appen, at noget mangler, skal man kunne gøre
  // noget ved det, hvor man står.
  opdater?: { hent: () => void; henter: boolean; besked?: string };
  // Gæstens egen del — "Mit grej" og det, der hører til den. Den står inde i
  // visningen og ikke efter den, så fodnoten om øjebliksbilledet bliver ved
  // med at være det sidste på siden. Ellers stod forbeholdet midt i det hele.
  children?: ReactNode;
  // Om gæsten faktisk kan melde sig til at bære. Uden den ville kortet om
  // ledigt grej henvise til et "Mit grej", der ikke er der — og så er det
  // ikke en henvisning, det er en blindgyde.
  kanMelde?: boolean;
}) {
  const k = snapshot.koordinater;
  const baerere = baererePrGear(deltagelser);
  const medbragtVaegt = samletMedbragtVaegt(deltagelser);
  const [efterPerson, setEfterPerson] = useState(false);

  // Fælles grej ingen har taget. Det er gæstens eneste håndtag på siden.
  const ledige = ledigtFaelles(snapshot.afsnit, baerere);
  const ledigVaegt = ledige.reduce((s, i) => s + i.vaegt_g, 0);

  // Hvad gæsten selv kommer til at bære: det hun har skrevet, hun tager med,
  // plus det fælles, hun har meldt sig til. Begge dele står på hendes egen
  // række — der er ikke noget at slå op i ejerens tal.
  const minRaekke = mig ? deltagelser.find((d) => d.user === mig) : undefined;
  const minVaegt = minRaekke
    ? minRaekke.medbragt.reduce((s, g) => s + g.vaegt_g, 0)
      + snapshot.afsnit.flatMap((a) => a.items)
        .filter((i) => i.uid && minRaekke.baerer.includes(i.uid))
        .reduce((s, i) => s + i.vaegt_g, 0)
    : 0;

  // Ejerens egen liste, plus dem der har skrevet sig på siden turen blev delt.
  // Uden dem stod man ikke på deltagerlisten, selvom man havde taget turen
  // hjem til sig selv.
  const alleDeltagere = [...new Set([
    ...snapshot.deltagere,
    ...deltagelser.map(visningsnavn)
  ])];

  // Én liste med det hele: ejerens gear og det deltagerne selv tager med.
  const linjer: Pakkelinje[] = [
    ...snapshot.afsnit.flatMap((a) => a.items.map((i): Pakkelinje => ({
      uid: i.uid, navn: i.navn, vaegt_g: i.vaegt_g, delt: i.delt, egen: true,
      baerer: baererAf(i.uid, i.baerer, baerere).join(' og ')
    }))),
    ...deltagelser.flatMap((d) => d.medbragt.map((g) =>
      linjeAfMedbragt(g.navn, g.vaegt_g, visningsnavn(d))))
  ];

  // Ejerens egen opdeling, med deltagernes grej lagt til sidst — eller alt
  // samlet efter hvem der tager det med, som er den man pakker efter.
  const afsnit: Pakkeafsnit[] = efterPerson
    ? linjerEfterPerson(linjer)
    : medDeltagernes(
        snapshot.afsnit.map((a) => ({
          titel: a.titel,
          linjer: linjer.filter((l) => l.egen && a.items.some((i) => i.uid === l.uid && i.navn === l.navn))
        })).filter((a) => a.linjer.length > 0),
        linjer
      );

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div>
        <h1 style={{ fontSize: '26px', margin: '10px 0 4px' }}>{snapshot.navn || 'Uden navn'}</h1>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)' }}>
          {[
            formatterPeriode(snapshot.startdato, snapshot.slutdato),
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
            Åbn stedet i kort ↗
          </a>
        )}
      </div>

      {/* Billederne står før beskeden: de er det første man gerne vil se, når
          nogen har delt en tur med én. Gæsten henter dem direkte fra
          PocketBase — url'erne er det eneste hun får, aldrig resten af
          turen. */}
      {(snapshot.billeder ?? []).length > 0 && (
        <Gaestegalleri billeder={snapshot.billeder} navn={snapshot.navn} />
      )}

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

      {ledige.length > 0 && <Ledigt items={ledige} vaegt={ledigVaegt} kanMelde={!!kanMelde} />}

      {snapshot.vejr && snapshot.vejr.dage.length > 0 && (
        <Infokort label="Vejrudsigt da turen blev delt">
          <div style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            {snapshot.vejr.dage.map((d) => (
              <div key={d.dato} style={{ display: 'grid', gridTemplateColumns: '54px 22px 1fr auto', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '11px' }}>{kortDag(d.dato)}</span>
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

      {alleDeltagere.length > 0 && (
        <Infokort label={`Deltagere (${alleDeltagere.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {alleDeltagere.map((navn) => <Chip key={navn}>{navn}</Chip>)}
          </div>
        </Infokort>
      )}

      {/* Tallet er alt grejet på turen — ikke noget nogen enkelt bærer. Det
          stod før som "Samlet vægt · fordelt på 4 personer", og det læses som
          om man selv slipper med en fjerdedel. Har gæsten skrevet sig på,
          står hendes eget tal ved siden af; det er dét, hun spurgte om. */}
      <Infokort label="Alt grej på turen" fremhaevet>
        <div style={{ fontSize: '22px', fontFamily: "'Fraunces', Georgia, serif" }}>
          {((snapshot.vaegt_i_alt_g + medbragtVaegt) / 1000).toFixed(2)} kg
        </div>
        <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>
          {[
            `ejerens og deltagernes tilsammen${snapshot.personer > 1 ? `, ${snapshot.personer} af sted` : ''}`,
            medbragtVaegt > 0 ? `heraf ${(medbragtVaegt / 1000).toFixed(2)} kg fra deltagerne` : null
          ].filter(Boolean).join(' · ')}
        </div>

        {minRaekke && (
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid var(--accent-border)',
            fontSize: '13px'
          }}>
            {minVaegt > 0
              ? <>Du bærer <strong>{(minVaegt / 1000).toFixed(2)} kg</strong></>
              : 'Du har ikke skrevet noget på endnu'}
          </div>
        )}
      </Infokort>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <SektionsTitel>Pakkeliste</SektionsTitel>
          {/* Hele listen er det man planlægger efter; ens egen bunke er det
              man pakker efter. Begge dele skal kunne ses. */}
          <button
            onClick={() => setEfterPerson(!efterPerson)}
            style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: '16px',
              padding: '4px 12px', fontSize: '11px', cursor: 'pointer', color: 'var(--tekst-dæmpet)',
              marginBottom: '10px'
            }}
          >
            {efterPerson ? 'Vis efter gruppe' : 'Vis efter person'}
          </button>
        </div>

        {afsnit.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tekst-svag)' }}>Der er ikke valgt gear endnu.</div>
        ) : (
          afsnit.map((a) => (
            <div key={a.titel} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', fontWeight: 600, marginBottom: '5px' }}>
                {gaestetitel(a.titel)}
              </div>
              {a.linjer.map((l, n) => (
                <div
                  key={`${l.navn}-${n}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border-svag)',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ minWidth: 0 }}>{l.navn || 'Uden navn'}</span>
                  <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {/* I "efter person" står navnet allerede som overskrift. */}
                    {!efterPerson && l.baerer && <span style={{ marginRight: '8px' }}>{l.baerer}</span>}
                    {/* "delt" sagde, hvad det var, og ikke hvad der manglede.
                        Forskellen på "det tager Emil" og "det tager ingen" er
                        den vigtigste på listen for en gæst. */}
                    {l.delt && !l.baerer && (
                      <span style={{ fontSize: '10px', marginRight: '6px', color: 'var(--advarsel)' }}>
                        ingen bærer
                      </span>
                    )}
                    {l.vaegt_g} g
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--tekst-svag)', paddingTop: '4px' }}>
                {(samletVaegt(a.linjer) / 1000).toFixed(2)} kg
              </div>
            </div>
          ))
        )}
      </div>

      {children}

      <div style={{ textAlign: 'center', paddingTop: '6px' }}>
        <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', lineHeight: 1.6 }}>
          {opdater?.besked
            ?? `Et øjebliksbillede fra ${datoTekst(snapshot.delt_den)}. Turen kan være ændret siden.`}
        </div>
        {opdater && (
          <div style={{ marginTop: '8px' }}>
            <Knap onClick={opdater.hent} disabled={opdater.henter}>
              {opdater.henter ? 'Henter…' : 'Hent ejerens nyeste'}
            </Knap>
          </div>
        )}
      </div>
    </div>
  );
}

// Det fælles grej, ingen har taget.
//
// Kortet står højt oppe og ikke nede i listen, fordi det er det eneste på
// siden, en gæst kan gøre noget ved — og fordi et stykke fælles grej uden en
// bærer er den fejl, man opdager på fjeldet og ikke før.
function Ledigt({ items, vaegt, kanMelde }: { items: GaesteItem[]; vaegt: number; kanMelde: boolean }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      background: 'var(--advarsel-bg)',
      border: '1px solid var(--advarsel)',
      fontSize: '13px',
      lineHeight: 1.55
    }}>
      <strong>
        {items.length === 1
          ? 'Ét stykke fælles grej mangler en bærer'
          : `${items.length} stykker fælles grej mangler en bærer`}
      </strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
        {items.map((i) => (
          <Chip key={i.uid || i.navn} farve="advarsel">
            {i.navn || 'Uden navn'} · {i.vaegt_g} g
          </Chip>
        ))}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)' }}>
        {(vaegt / 1000).toFixed(2)} kg i alt.
        {kanMelde
          ? <> Under <strong>Mit grej</strong> nedenfor kan du melde dig til at bære noget af det.</>
          : ' Sig til den, der har delt turen, hvis du kan tage noget af det.'}
      </div>
    </div>
  );
}

// Hvem bærer gearet: ejerens egen fordeling, plus dem der selv har meldt sig.
// Melder to sig på det samme, står de begge — det er noget ejeren skal se.
function baererAf(uid: string, fraEjeren: string, meldte: Map<string, string[]>): string[] {
  const navne = [...(uid ? meldte.get(uid) ?? [] : [])];
  if (fraEjeren && !navne.includes(fraEjeren)) navne.unshift(fraEjeren);
  return navne;
}

// Forsidebilledet stort, resten som en stribe under. Snapshottet har allerede
// lagt dem i den rækkefølge.
function Gaestegalleri({ billeder, navn }: { billeder: GaesteBillede[]; navn: string }) {
  const [forside, ...resten] = billeder;

  return (
    <div>
      <img
        src={forside.url}
        alt={forside.beskrivelse || navn}
        style={{
          width: '100%',
          maxHeight: '260px',
          objectFit: 'cover',
          borderRadius: '10px',
          display: 'block',
          background: 'var(--bg-forhoejet)'
        }}
      />
      {forside.beskrivelse && (
        <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
          {forside.beskrivelse}
        </div>
      )}
      <Hent billede={forside} />

      {resten.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '10px', paddingBottom: '2px' }}>
          {resten.map((b) => (
            <div key={b.url} style={{ flexShrink: 0, width: '84px' }}>
              <img
                src={b.url}
                alt={b.beskrivelse || navn}
                loading="lazy"
                style={{
                  width: '84px',
                  height: '84px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  background: 'var(--bg-forhoejet)',
                  display: 'block'
                }}
              />
              <Hent billede={b} kort />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Vejen til originalen. `?download=1` er allerede sat af den der delte, og
// den er det der gør at filen bliver gemt frem for åbnet i en fane.
function Hent({ billede, kort }: { billede: GaesteBillede; kort?: boolean }) {
  if (!billede.original) return null;

  return (
    <a
      href={billede.original}
      download
      style={{
        display: 'inline-block',
        marginTop: '4px',
        fontSize: kort ? '11px' : '12px',
        color: 'var(--accent)'
      }}
    >
      {kort ? 'Hent' : `Hent i fuld kvalitet${billede.original_byte > 0 ? ` (${megabyte(billede.original_byte)})` : ''}`}
    </a>
  );
}

// Gæstesiden har ikke resten af appens hjælpere til rådighed — den skal kunne
// stå alene med et snapshot og ingenting andet.
function megabyte(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export default DeltTurVisning;
