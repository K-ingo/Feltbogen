import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { TurStatus } from './db';
import { opretTur } from './sync';
import TurDetalje from './TurDetalje';
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
}

function TureListe({ fane, skift }: Props) {
  const [valgtTur, setValgtTur] = useState<{ id: number; ny: boolean } | null>(null);

  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());

  if (valgtTur !== null) {
    return (
      <Skal fane={fane} skift={skift}>
        <TurDetalje
          turId={valgtTur.id}
          nyOprettet={valgtTur.ny}
          tilbage={() => setValgtTur(null)}
        />
      </Skal>
    );
  }

  // Opretter en tom tur og går direkte ind i den — en tur har mange felter,
  // så det er der arbejdet foregår. Forlades den uden navn, ryddes den væk.
  const nyTur = async () => {
    const nu = new Date();
    const idag = nu.toISOString().slice(0, 10);
    const id = await opretTur({
      navn: '',
      sted: '',
      koordinater: null,
      startdato: idag,
      slutdato: idag,
      naetter: 0,
      personer: 1,
      overnatning: 'shelter',
      aktivitet: 'bushcraft',
      terraen: 'skov',
      baereafstand_km: 0,
      erfaring: 'oevet',
      status: 'kladde',
      gruppe_ids: [],
      loese_item_ids: [],
      deltagere: [],
      budget_linjer: [],
      besked_fra_ejer: '',
      noter: '',
      vejrsnapshot: '',
      oprettet: nu,
      aendret: nu
    });
    setValgtTur({ id, ny: true });
  };

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
          onClick={() => t.id !== undefined && setValgtTur({ id: t.id, ny: false })}
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
