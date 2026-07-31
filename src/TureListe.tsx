import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { TurStatus } from './db';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, Badge, ListeRaekke, TomListe } from './ui';

// Farven signalerer hvor turen er i sit livsforløb.
const STATUS_NIVEAU: Record<TurStatus, 'info' | 'accent' | 'advarsel'> = {
  kladde: 'info',
  klar: 'accent',
  aktiv: 'advarsel',
  afsluttet: 'info'
};

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnTur: (id: number, nyOprettet?: boolean) => void;
  nyTur: () => void;
}

function TureListe({ fane, skift, aabnTur, nyTur }: Props) {
  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Ture"
      undertitel={`${ture?.length ?? 0} ture`}
      handlinger={<Knap variant="primaer" onClick={nyTur}>+ Ny tur</Knap>}
      fab={nyTur}
    >
      {ture?.length === 0 && <TomListe>Ingen ture endnu. Opret din første.</TomListe>}
      {ture?.map((t) => (
        <ListeRaekke
          key={t.uid}
          onClick={() => t.id !== undefined && aabnTur(t.id)}
          titel={
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {t.navn}
              <Badge niveau={STATUS_NIVEAU[t.status]}>{t.status}</Badge>
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
    </Skal>
  );
}

export default TureListe;
