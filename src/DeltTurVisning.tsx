import type { Gaestesnapshot } from './gaest';
import type { Deltagelse } from './deltagelse';
import { medbragtPrDeltager, baererePrGear, samletMedbragtVaegt } from './deltagelse';
import { vejrIkonKode } from './smartMotor';
import { formatterPeriode, kortDag, datoTekst } from './datotekst';
import { Chip, Infokort, SektionsTitel } from './ui';

// Selve turen som den ser ud for en der har fået den delt. Bruges to steder:
// på gæstesiden, hvor snapshottet lige er hentet, og på en gemt delt tur,
// hvor det kommer fra basen. De skal se ens ud — det er den samme tur.

function DeltTurVisning({ snapshot, deltagelser = [] }: {
  snapshot: Gaestesnapshot;
  // Det de andre har skrevet sig på for. Tom når turen læses fra en gemt kopi
  // uden forbindelse.
  deltagelser?: Deltagelse[];
}) {
  const k = snapshot.koordinater;
  const medbragt = medbragtPrDeltager(deltagelser);
  const baerere = baererePrGear(deltagelser);
  const medbragtVaegt = samletMedbragtVaegt(deltagelser);

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

      {snapshot.deltagere.length > 0 && (
        <Infokort label={`Deltagere (${snapshot.deltagere.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {snapshot.deltagere.map((navn) => <Chip key={navn}>{navn}</Chip>)}
          </div>
        </Infokort>
      )}

      <Infokort label="Samlet vægt" fremhaevet>
        <div style={{ fontSize: '22px', fontFamily: "'Fraunces', Georgia, serif" }}>
          {((snapshot.vaegt_i_alt_g + medbragtVaegt) / 1000).toFixed(2)} kg
        </div>
        <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>
          {[
            snapshot.personer > 1 ? `fordelt på ${snapshot.personer} personer` : null,
            medbragtVaegt > 0 ? `heraf ${(medbragtVaegt / 1000).toFixed(2)} kg fra deltagerne` : null
          ].filter(Boolean).join(' · ')}
        </div>
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
                  <span style={{ minWidth: 0 }}>{i.navn || 'Uden navn'}</span>
                  <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {baererAf(i.uid, i.baerer, baerere).map((navn) => (
                      <span key={navn} style={{ marginRight: '8px' }}>{navn}</span>
                    ))}
                    {i.delt && baererAf(i.uid, i.baerer, baerere).length === 0 && (
                      <span style={{ fontSize: '10px', marginRight: '6px' }}>delt</span>
                    )}
                    {i.vaegt_g} g
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {medbragt.length > 0 && (
        <div>
          <SektionsTitel>Deltagerne tager selv med</SektionsTitel>
          {medbragt.map((d) => (
            <div key={d.navn} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', fontWeight: 600, marginBottom: '5px' }}>
                {d.navn} · {(d.vaegt_g / 1000).toFixed(2)} kg
              </div>
              {d.gear.map((g, n) => (
                <div
                  key={`${g.navn}-${n}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border-svag)',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ minWidth: 0 }}>{g.navn}</span>
                  <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {g.vaegt_g} g
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', textAlign: 'center', paddingTop: '6px' }}>
        Et øjebliksbillede fra {datoTekst(snapshot.delt_den)}. Turen kan være ændret siden.
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

export default DeltTurVisning;
