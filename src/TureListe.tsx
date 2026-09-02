import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Billede, Tur } from './db';
import { formatterPeriode } from './datotekst';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, Badge, ListeRaekke, SektionsTitel, TomListe } from './ui';
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
  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());
  // Ture andre har delt med én. De ligger i deres egen tabel og kan ikke
  // redigeres, men de hører hjemme her — det er stadig ture man skal med på.
  const delte = useLiveQuery(() => db.delte_ture.orderBy('gemt').reverse().toArray());
  const billeder = useLiveQuery(() => db.billeder.toArray()) ?? [];

  const egne = ture?.length ?? 0;
  const antalDelte = delte?.length ?? 0;

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Ture"
      undertitel={undertitel(egne, antalDelte)}
      handlinger={<Knap variant="primaer" onClick={nyTur}>+ Ny tur</Knap>}
      fab={nyTur}
    >
      {egne === 0 && antalDelte === 0 && <TomListe>Ingen ture endnu. Din første historie starter her.</TomListe>}

      {ture?.map((t) => (
        <ListeRaekke
          key={t.uid}
          onClick={() => t.id !== undefined && aabnTur(t.id)}
          foran={<Forsidebillede tur={t} billeder={billeder} />}
          titel={
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {t.navn}
              <Badge niveau={FASE_NIVEAU[faseAf(t)]}>{FASENAVN[faseAf(t)]}</Badge>
            </span>
          }
          detalje={
            <>
              {t.sted || 'Intet sted'} · {t.startdato}
              {t.personer > 1 && ` · ${t.personer} personer`}
            </>
          }
        />
      ))}

      {antalDelte > 0 && (
        <div style={{ marginTop: egne > 0 ? '26px' : '4px' }}>
          <SektionsTitel>Delt med dig</SektionsTitel>
          {delte?.map((d) => (
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
  if (!forside) return null;

  return (
    <div style={{
      width: '46px',
      height: '46px',
      flexShrink: 0,
      borderRadius: '7px',
      overflow: 'hidden',
      background: 'var(--bg-forhoejet)',
      border: '1px solid var(--border-svag)'
    }}>
      <Billedvisning billede={forside} />
    </div>
  );
}

export default TureListe;
