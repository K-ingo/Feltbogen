import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Ikon } from './Ikon';
import { matcherTur } from './turSoegning';
import { db, etiket } from './db';
import type { Billede, Tur } from './db';
import { formatterPeriode } from './datotekst';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, Badge, ListeRaekke, SektionsTitel, TomListe, Segment } from './ui';
import { Billedvisning } from './BilledSektion';
import { hero } from './billeder';
import { faseAf, FASENAVN } from './turfase';
import type { Fase } from './turfase';

// Farven signalerer hvor turen er i sit livsforløb.
//
// "Gjort op" er den eneste grønne: det er den eneste af faserne, hvor der
// ikke er mere, der skal gøres. En afsluttet tur, der ikke er gjort op,
// mangler stadig det sidste, og skal ikke se færdig ud.
const FASE_NIVEAU: Record<Fase, 'info' | 'accent' | 'advarsel' | 'succes'> = {
  kladde: 'info',
  klar: 'accent',
  aktiv: 'advarsel',
  afsluttet: 'info',
  evalueret: 'succes'
};

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnTur: (id: number, nyOprettet?: boolean) => void;
  aabnDeltTur: (id: number) => void;
  nyTur: () => void;
}

function TureListe({ fane, skift, aabnTur, aabnDeltTur, nyTur }: Props) {
  const [soegning, setSoegning] = useState('');
  const [visning, setVisning] = useState<'Kort' | 'Liste'>('Kort');
  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());
  // Ture andre har delt med én. De ligger i deres egen tabel og kan ikke
  // redigeres, men de hører hjemme her — det er stadig ture man skal med på.
  const delte = useLiveQuery(() => db.delte_ture.orderBy('gemt').reverse().toArray());
  const billeder = useLiveQuery(() => db.billeder.toArray()) ?? [];

  const egne = ture?.length ?? 0;
  const antalDelte = delte?.length ?? 0;
  const matcher = (navn: string, sted: string) => matcherTur(navn, sted, soegning);
  const visteTure = ture?.filter(t => matcher(t.navn, t.sted)) ?? [];
  const visteDelte = delte?.filter(d => matcher(d.snapshot.navn, d.snapshot.sted)) ?? [];

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Ture"
      undertitel={undertitel(egne, antalDelte)}
      handlinger={<Knap variant="primaer" onClick={nyTur}>+ Ny tur</Knap>}
      fab={nyTur}
    >
      {egne === 0 && antalDelte === 0 && <TomListe handling="Planlæg din første tur" onClick={nyTur}>Ingen ture endnu. Din første historie starter her.</TomListe>}
      {egne + antalDelte > 0 && <input type="search" aria-label="Søg ture" placeholder="Find en tur eller et sted…" value={soegning} onChange={e => setSoegning(e.target.value)} style={{ width: '100%', marginBottom: '24px' }} />}
      {soegning && visteTure.length + visteDelte.length === 0 && <TomListe handling="Ryd søgning" onClick={() => setSoegning('')}>Ingen ture matcher “{soegning}”. Prøv et andet navn eller sted.</TomListe>}

      {egne + antalDelte > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-detalje)' }}>{soegning ? `${visteTure.length + visteDelte.length} af ${egne + antalDelte} ture` : 'Dine ture'}</span>
        <Segment vaerdier={['Kort', 'Liste'] as const} valgt={visning} vaelg={setVisning} />
      </div>}
      <div className={`trip-grid${visning === 'Liste' ? ' is-compact' : ''}`}>
      {visteTure.map((t) => (
        <button
          className="trip-card"
          key={t.uid}
          onClick={() => t.id !== undefined && aabnTur(t.id)}
        >
          <Forsidebillede tur={t} billeder={billeder} />
          <span className="trip-card-body">
            <Badge niveau={FASE_NIVEAU[faseAf(t)]}>{FASENAVN[faseAf(t)]}</Badge>
            <span className="trip-card-title">{t.navn || 'Din næste tur'}</span>
            <span className="trip-card-meta">{t.sted || 'Sted ikke valgt'} · {formatterPeriode(t.startdato, t.slutdato) || 'Dato ikke valgt'}</span>
            <span className="trip-card-meta">{t.personer} {t.personer === 1 ? 'person' : 'personer'} · {t.naetter} {t.naetter === 1 ? 'nat' : 'nætter'}</span>
          </span>
        </button>
      ))}
      </div>

      {visteDelte.length > 0 && (
        <div style={{ marginTop: egne > 0 ? '26px' : '4px' }}>
          <SektionsTitel>Delt med dig</SektionsTitel>
          {visteDelte.map((d) => (
            <ListeRaekke
              key={d.token}
              onClick={() => d.id !== undefined && aabnDeltTur(d.id)}
              titel={
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {d.snapshot.navn || 'Uden navn'}
                  <Badge niveau="info">Delt</Badge>
                </span>
              }
              detalje={
                <>
                  {d.snapshot.sted || 'Intet sted'}
                  {formatterPeriode(d.snapshot.startdato, d.snapshot.slutdato) && ` · ${formatterPeriode(d.snapshot.startdato, d.snapshot.slutdato)}`}
                </>
              }
            />
          ))}
        </div>
      )}
    </Skal>
  );
}

function undertitel(egne: number, delte: number): string {
  const mine = `${egne} ${egne === 1 ? 'tur' : 'ture'}`;
  return delte > 0 ? `${mine} · ${delte} delt med dig` : mine;
}

// Turens forsidebillede som en lille firkant. Har turen ingen billeder, står
// der ingenting — en tom pladsholder ville give listen en spalte af huller.
function Forsidebillede({ tur, billeder }: { tur: Tur; billeder: Billede[] }) {
  const forside = hero(billeder, tur);
  if (!forside) return (
    <span className={`trip-card-photo trip-card-fallback trip-card-fallback--${tur.terraen}`}>
      <Ikon navn="kompas" size={38} />
      <small>{etiket(tur.aktivitet)} · {etiket(tur.terraen)}</small>
    </span>
  );

  return (
    <div className="trip-card-photo" style={{
      width: '100%',
      height: '180px',
      flexShrink: 0,
      overflow: 'hidden',
      background: 'var(--bg-forhoejet)',
      border: '1px solid var(--border-svag)'
    }}>
      <Billedvisning billede={forside} />
    </div>
  );
}

export default TureListe;
