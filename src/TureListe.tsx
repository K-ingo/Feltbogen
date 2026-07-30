import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { TurStatus } from './db';
import { opretTur } from './sync';
import TurDetalje from './TurDetalje';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, Kort, Badge, ListeRaekke, TomListe, Label } from './ui';

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
  const [valgtTurId, setValgtTurId] = useState<number | null>(null);
  const [opretAaben, setOpretAaben] = useState(false);

  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());

  if (valgtTurId !== null) {
    return (
      <Skal fane={fane} skift={skift}>
        <TurDetalje turId={valgtTurId} tilbage={() => setValgtTurId(null)} />
      </Skal>
    );
  }

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Ture"
      undertitel={`${ture?.length ?? 0} ture`}
      handlinger={<Knap variant="primaer" onClick={() => setOpretAaben(!opretAaben)}>+ Ny tur</Knap>}
      fab={() => setOpretAaben(true)}
    >
      {opretAaben && <OpretTur luk={() => setOpretAaben(false)} />}

      {ture?.length === 0 && <TomListe>Ingen ture endnu. Opret din første.</TomListe>}
      {ture?.map((t) => (
        <ListeRaekke
          key={t.uid}
          onClick={() => t.id !== undefined && setValgtTurId(t.id)}
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

function OpretTur({ luk }: { luk: () => void }) {
  const [navn, setNavn] = useState('');

  const gem = async () => {
    if (!navn.trim()) return;
    const nu = new Date();
    const idag = nu.toISOString().slice(0, 10);
    await opretTur({
      navn: navn.trim(),
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
    luk();
  };

  return (
    <Kort fremhaevet style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <Label>Ny tur</Label>
        <button
          onClick={luk}
          aria-label="Luk"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--tekst-dæmpet)' }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          autoFocus
          placeholder="fx Uge 32 — Øghaven"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gem()}
          style={{ flex: 1 }}
        />
        <Knap variant="primaer" onClick={gem}>Opret</Knap>
      </div>
    </Kort>
  );
}

export default TureListe;
